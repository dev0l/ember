// ─────────────────────────────────────────────
// Ember Project Storage — SQLite Backend
//
// Replaces JSON file persistence with relational storage.
//
// EmberProject is stored across `inquiries` + `inquiry_answers` tables.
//
// DERIVED on load (not stored):
//   - conditions: from answers + authored question choices
//   - activatedPropositions: from conditions via evaluatePropositions()
//   - status: from answer count + designPackVersion
//   - askedQuestionIds: from inquiry_answers.question_id
//
// UNIQUE(inquiry_id, question_id) on inquiry_answers prevents
// duplicate answers to the same question. If a phase is re-entered,
// the effective answer is replaced, not duplicated.
//
// Design Packs remain as files on disk in {documentDir}/design-packs/
// ─────────────────────────────────────────────

import { Paths, File, Directory } from 'expo-file-system';
import type {
  EmberProject,
  EmberAnswer,
  EstablishedCondition,
} from '@/core/ember-project-types';
import { QUESTION_LIBRARY } from '@/knowledge/questions';
import { evaluatePropositions } from '@/knowledge/propositions';
import { getDatabase } from './database';

const PACKS_DIR = new Directory(Paths.document, 'design-packs');

function ensurePacksDir(): void {
  if (!PACKS_DIR.exists) {
    PACKS_DIR.create();
  }
}

// ── Project CRUD ──────────────────────────

export function saveProject(project: EmberProject): void {
  const db = getDatabase();

  const now = new Date().toISOString();

  // All writes for one save are atomic: an interruption must not leave
  // the inquiry row updated with only some of its answers persisted.
  db.withTransactionSync(() => {
    // Upsert the inquiry row — use ON CONFLICT DO UPDATE rather than
    // INSERT OR REPLACE to avoid triggering ON DELETE CASCADE on inquiry_answers
    db.runSync(
      `INSERT INTO inquiries
       (id, ember_id, name, original_material, open_questions, design_pack_version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         ember_id = excluded.ember_id,
         name = excluded.name,
         original_material = excluded.original_material,
         open_questions = excluded.open_questions,
         design_pack_version = MAX(inquiries.design_pack_version, excluded.design_pack_version),
         updated_at = excluded.updated_at`,
      project.id,
      project.seedId ?? null,
      project.name,
      project.originalMaterial,
      JSON.stringify(project.openQuestions),
      project.designPackVersion,
      project.createdAt,
      now,
    );

    // Upsert answers — UNIQUE(inquiry_id, question_id) prevents duplicates.
    // On conflict (same question answered again), update with the new answer.
    //
    // Schema v3: this is the legacy write path, so it never asserts engine
    // provenance (library_version) or a specification. If it actually changes
    // an answer, any engine provenance/specification on that row no longer
    // describes it and is cleared. Re-saving an unchanged answer (every save
    // re-writes all answers) leaves them intact. SQLite evaluates the CASE
    // against the pre-update row.
    for (let i = 0; i < project.answers.length; i++) {
      const a = project.answers[i];
      db.runSync(
        `INSERT INTO inquiry_answers
         (inquiry_id, question_id, dimension_id, raw_response, value, sequence, answered_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(inquiry_id, question_id) DO UPDATE SET
           specification = CASE
             WHEN inquiry_answers.value IS excluded.value
              AND inquiry_answers.raw_response IS excluded.raw_response
             THEN inquiry_answers.specification ELSE NULL END,
           library_version = CASE
             WHEN inquiry_answers.value IS excluded.value
              AND inquiry_answers.raw_response IS excluded.raw_response
             THEN inquiry_answers.library_version ELSE NULL END,
           dimension_id = excluded.dimension_id,
           raw_response = excluded.raw_response,
           value = excluded.value,
           sequence = excluded.sequence,
           answered_at = excluded.answered_at`,
        project.id,
        a.questionId,
        a.dimensionId,
        a.rawResponse,
        a.value,
        i,
        a.answeredAt,
      );
    }
  });
}

export function loadProject(id: string): EmberProject | null {
  const db = getDatabase();

  const row = db.getFirstSync<InquiryRow>(
    `SELECT * FROM inquiries WHERE id = ?`,
    id,
  );

  if (!row) return null;
  return hydrateProject(row);
}

/**
 * Load an EmberProject by its associated Ember ID.
 * Replaces the O(N) scan: listProjects().find(p => p.seedId === id)
 */
export function loadProjectByEmberId(emberId: string): EmberProject | null {
  const db = getDatabase();

  // inquiries.ember_id is not unique (cardinality is an open decision, D6).
  // Order deterministically so LIMIT 1 never selects an arbitrary row:
  // the earliest Inquiry wins, id breaks timestamp ties.
  const row = db.getFirstSync<InquiryRow>(
    `SELECT * FROM inquiries WHERE ember_id = ?
     ORDER BY created_at ASC, id ASC
     LIMIT 1`,
    emberId,
  );

  if (!row) return null;
  return hydrateProject(row);
}

export function listProjects(): EmberProject[] {
  const db = getDatabase();

  const rows = db.getAllSync<InquiryRow>(
    `SELECT * FROM inquiries ORDER BY updated_at DESC`,
  );

  return rows.map(hydrateProject);
}

export function deleteProject(id: string): void {
  const db = getDatabase();
  // CASCADE will remove inquiry_answers rows
  db.runSync(`DELETE FROM inquiries WHERE id = ?`, id);
}

// ── Design Pack Storage ──────────────────────────
// Design Pack markdown remains as files ({documentDir}/design-packs/
// `${inquiryId}-v${version}.md`). Schema v3 adds a design_packs record per
// file stating where it came from. inquiries.design_pack_version remains the
// compatibility counter that existing readers use; every recorded save
// advances it in the same transaction as the record.

/** Generator label for the current proposition-based generator. */
export const LEGACY_GENERATOR = 'legacy-propositions';

export type DesignPackProvenance = 'engine' | 'legacy' | 'unknown';

/**
 * Where a newly generated Design Pack comes from.
 * 'unknown' is deliberately absent: it can only be assigned by the backfill
 * to files that predate records. New generation must say what it is.
 */
export type DesignPackOrigin =
  | { provenance: 'legacy'; generator: string }
  | {
      provenance: 'engine';
      generator: string;
      libraryVersion: string;
      configurationId: string;
      /** InquiryState.fingerprints.evidence at generation. */
      evidenceFingerprint: string;
      /** InquiryState.fingerprints.review at generation — compare with designPackStaleness(). */
      reviewFingerprint: string;
    };

const LEGACY_ORIGIN: DesignPackOrigin = {
  provenance: 'legacy',
  generator: LEGACY_GENERATOR,
};

export interface DesignPackRecord {
  inquiryId: string;
  version: number;
  fileName: string;
  provenance: DesignPackProvenance;
  generator?: string;
  libraryVersion?: string;
  configurationId?: string;
  evidenceFingerprint?: string;
  reviewFingerprint?: string;
  /** Absent when unknown (backfilled files). */
  generatedAt?: string;
  /** When this record was written — for backfills, the backfill time. */
  recordedAt: string;
}

function designPackFileName(inquiryId: string, version: number): string {
  return `${inquiryId}-v${version}.md`;
}

/**
 * Write a Design Pack file and record its provenance.
 *
 * The file is written first; the record and the compatibility counter are
 * then written in one transaction. Existing callers pass no origin and are
 * recorded as 'legacy' — which is what the current generator is.
 *
 * If no Inquiry row exists for `inquiryId` the file is still written (as
 * before) but no record can reference it; that is logged in development.
 */
export function saveDesignPack(
  inquiryId: string,
  version: number,
  markdown: string,
  origin: DesignPackOrigin = LEGACY_ORIGIN,
): string {
  ensurePacksDir();
  const fileName = designPackFileName(inquiryId, version);
  const file = new File(PACKS_DIR, fileName);
  file.write(markdown);

  const db = getDatabase();
  const now = new Date().toISOString();
  const engine = origin.provenance === 'engine' ? origin : null;

  let recorded = false;
  db.withTransactionSync(() => {
    const result = db.runSync(
      `INSERT INTO design_packs
       (inquiry_id, version, file_name, provenance, generator, library_version,
        configuration_id, evidence_fingerprint, review_fingerprint, generated_at, recorded_at)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
       WHERE EXISTS (SELECT 1 FROM inquiries WHERE id = ?)
       ON CONFLICT(inquiry_id, version) DO UPDATE SET
         file_name = excluded.file_name,
         provenance = excluded.provenance,
         generator = excluded.generator,
         library_version = excluded.library_version,
         configuration_id = excluded.configuration_id,
         evidence_fingerprint = excluded.evidence_fingerprint,
         review_fingerprint = excluded.review_fingerprint,
         generated_at = excluded.generated_at,
         recorded_at = excluded.recorded_at`,
      inquiryId,
      version,
      fileName,
      origin.provenance,
      origin.generator,
      engine?.libraryVersion ?? null,
      engine?.configurationId ?? null,
      engine?.evidenceFingerprint ?? null,
      engine?.reviewFingerprint ?? null,
      now,
      now,
      inquiryId,
    );
    recorded = result.changes > 0;

    if (recorded) {
      db.runSync(
        `UPDATE inquiries
         SET design_pack_version = MAX(design_pack_version, ?)
         WHERE id = ?`,
        version,
        inquiryId,
      );
    }
  });

  if (!recorded && __DEV__) {
    console.warn(
      `🔥 [DesignPack] ${fileName} written without a record — no Inquiry ${inquiryId}`,
    );
  }

  return file.uri;
}

export function loadDesignPack(
  inquiryId: string,
  version: number,
): string | null {
  const file = new File(PACKS_DIR, designPackFileName(inquiryId, version));
  try {
    if (!file.exists) return null;
    return file.textSync();
  } catch {
    return null;
  }
}

/**
 * Load the latest acknowledged Design Pack for an Inquiry.
 *
 * "Latest" is still the compatibility counter: every recorded save advances
 * it atomically, so it equals the highest engine/legacy record. A backfilled
 * 'unknown' file above the counter (e.g. written before an interrupted save)
 * is inventoried but was never acknowledged, so it is not surfaced here.
 * The record for that version is attached when one exists; it is absent for
 * packs that predate the backfill.
 */
export function loadLatestDesignPack(
  inquiryId: string,
): { markdown: string; version: number; record: DesignPackRecord | null } | null {
  const db = getDatabase();
  const row = db.getFirstSync<{ design_pack_version: number }>(
    `SELECT design_pack_version FROM inquiries WHERE id = ?`,
    inquiryId,
  );

  if (!row || row.design_pack_version === 0) return null;

  const markdown = loadDesignPack(inquiryId, row.design_pack_version);
  if (!markdown) return null;

  return {
    markdown,
    version: row.design_pack_version,
    record: loadDesignPackRecord(inquiryId, row.design_pack_version),
  };
}

interface DesignPackRow {
  inquiry_id: string;
  version: number;
  file_name: string;
  provenance: DesignPackProvenance;
  generator: string | null;
  library_version: string | null;
  configuration_id: string | null;
  evidence_fingerprint: string | null;
  review_fingerprint: string | null;
  generated_at: string | null;
  recorded_at: string;
}

function toDesignPackRecord(r: DesignPackRow): DesignPackRecord {
  const record: DesignPackRecord = {
    inquiryId: r.inquiry_id,
    version: r.version,
    fileName: r.file_name,
    provenance: r.provenance,
    recordedAt: r.recorded_at,
  };
  if (r.generator !== null) record.generator = r.generator;
  if (r.library_version !== null) record.libraryVersion = r.library_version;
  if (r.configuration_id !== null) record.configurationId = r.configuration_id;
  if (r.evidence_fingerprint !== null) record.evidenceFingerprint = r.evidence_fingerprint;
  if (r.review_fingerprint !== null) record.reviewFingerprint = r.review_fingerprint;
  if (r.generated_at !== null) record.generatedAt = r.generated_at;
  return record;
}

/** All Design Pack records for an Inquiry, oldest version first. */
export function loadDesignPackRecords(inquiryId: string): DesignPackRecord[] {
  const db = getDatabase();
  return db
    .getAllSync<DesignPackRow>(
      `SELECT * FROM design_packs WHERE inquiry_id = ? ORDER BY version ASC`,
      inquiryId,
    )
    .map(toDesignPackRecord);
}

export function loadDesignPackRecord(
  inquiryId: string,
  version: number,
): DesignPackRecord | null {
  const db = getDatabase();
  const row = db.getFirstSync<DesignPackRow>(
    `SELECT * FROM design_packs WHERE inquiry_id = ? AND version = ?`,
    inquiryId,
    version,
  );
  return row ? toDesignPackRecord(row) : null;
}

const DESIGN_PACK_FILE_PATTERN = /^(.*)-v(\d+)\.md$/;

/**
 * Inventory Design Pack files that predate schema v3 records.
 *
 * Every existing file whose Inquiry still exists gets a record with
 * provenance 'unknown': no generator, no fingerprints, no configuration and
 * no generation time are asserted, because none can be established.
 * Files already recorded are left untouched (INSERT OR IGNORE), so this is
 * idempotent and never downgrades a 'legacy'/'engine' record.
 * Counters without a file get no record — nothing is invented.
 * Files whose Inquiry no longer exists are left on disk, unrecorded.
 *
 * Returns the number of records inserted.
 */
export function backfillDesignPackRecords(): number {
  if (!PACKS_DIR.exists) return 0;

  const db = getDatabase();
  const now = new Date().toISOString();
  let inserted = 0;

  const entries = PACKS_DIR.list();
  db.withTransactionSync(() => {
    for (const entry of entries) {
      if (!(entry instanceof File)) continue;
      const match = DESIGN_PACK_FILE_PATTERN.exec(entry.name);
      if (!match) continue;

      const inquiryId = match[1];
      const version = Number(match[2]);
      if (!Number.isSafeInteger(version) || version < 1) continue;

      const result = db.runSync(
        `INSERT OR IGNORE INTO design_packs
         (inquiry_id, version, file_name, provenance, recorded_at)
         SELECT ?, ?, ?, 'unknown', ?
         WHERE EXISTS (SELECT 1 FROM inquiries WHERE id = ?)`,
        inquiryId,
        version,
        entry.name,
        now,
        inquiryId,
      );
      inserted += result.changes;
    }
  });

  return inserted;
}

// ── Hydration: Derive conditions and propositions on load ──

interface InquiryRow {
  id: string;
  ember_id: string | null;
  name: string;
  original_material: string;
  open_questions: string;
  design_pack_version: number;
  created_at: string;
  updated_at: string;
}

/**
 * Reconstruct a full EmberProject from the inquiry row + answers.
 *
 * Conditions are DERIVED from answers + authored question choices.
 * Propositions are DERIVED from conditions.
 * Status is DERIVED from answer count + design_pack_version.
 * askedQuestionIds is DERIVED from answers.
 */
function hydrateProject(row: InquiryRow): EmberProject {
  const db = getDatabase();

  // Load answers from the answers table
  const answerRows = db.getAllSync<AnswerRow>(
    `SELECT * FROM inquiry_answers WHERE inquiry_id = ? ORDER BY sequence ASC`,
    row.id,
  );

  const answers: EmberAnswer[] = answerRows.map(a => ({
    questionId: a.question_id,
    rawResponse: a.raw_response,
    dimensionId: a.dimension_id,
    value: a.value,
    answeredAt: a.answered_at,
  }));

  const askedQuestionIds = answerRows.map(a => a.question_id);

  // Derive conditions from answers + authored question choices
  const conditions = deriveConditions(answers);

  // Derive propositions from conditions
  const conditionIds = conditions.map(c => c.id);
  const evaluated = evaluatePropositions(conditionIds);
  const activatedPropositions = evaluated.map(e => ({
    propositionId: e.proposition.id,
    confidence: e.confidence,
    activatingConditionIds: e.matchingSupports,
    conflictingConditionIds: e.activeConflicts,
  }));

  // Derive status
  let status: EmberProject['status'] = 'developing';
  if (row.design_pack_version > 0) {
    status = 'generated';
  }

  let openQuestions: string[] = [];
  try {
    openQuestions = JSON.parse(row.open_questions);
  } catch { /* empty */ }

  return {
    id: row.id,
    seedId: row.ember_id ?? undefined,
    name: row.name,
    status,
    sparkIds: [], // Not stored — Spark lineage remains an open question
    originalMaterial: row.original_material,
    answers,
    askedQuestionIds,
    conditions,
    activatedPropositions,
    openQuestions,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    designPackVersion: row.design_pack_version,
  };
}

/**
 * Derive conditions from answers by looking up the authored question choices.
 *
 * For each answer to a choice question, find the selected choice
 * and extract its establishesConditions.
 */
function deriveConditions(answers: EmberAnswer[]): EstablishedCondition[] {
  const conditions: EstablishedCondition[] = [];
  const seen = new Set<string>();

  for (const answer of answers) {
    const question = QUESTION_LIBRARY.find(q => q.id === answer.questionId);
    if (!question || !question.choices) continue;

    const choice = question.choices.find(c => c.value === answer.value);
    if (!choice) continue;

    for (const condId of choice.establishesConditions) {
      if (seen.has(condId)) continue;
      seen.add(condId);
      conditions.push({
        id: condId,
        label: condId.replace(/-/g, ' '),
        confidence: 'established',
        sourceAnswerIds: [answer.questionId],
      });
    }
  }

  return conditions;
}

interface AnswerRow {
  id: number;
  inquiry_id: string;
  question_id: string;
  dimension_id: string;
  raw_response: string;
  value: string;
  sequence: number;
  answered_at: string;
}
