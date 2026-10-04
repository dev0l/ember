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
       design_pack_version = excluded.design_pack_version,
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
  for (let i = 0; i < project.answers.length; i++) {
    const a = project.answers[i];
    db.runSync(
      `INSERT INTO inquiry_answers
       (inquiry_id, question_id, dimension_id, raw_response, value, sequence, answered_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(inquiry_id, question_id) DO UPDATE SET
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

  const row = db.getFirstSync<InquiryRow>(
    `SELECT * FROM inquiries WHERE ember_id = ? LIMIT 1`,
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
// Design Packs remain as files. The inquiry row carries the version counter.

export function saveDesignPack(
  emberId: string,
  version: number,
  markdown: string,
): string {
  ensurePacksDir();
  const filename = `${emberId}-v${version}.md`;
  const file = new File(PACKS_DIR, filename);
  file.write(markdown);
  return file.uri;
}

export function loadDesignPack(
  emberId: string,
  version: number,
): string | null {
  const filename = `${emberId}-v${version}.md`;
  const file = new File(PACKS_DIR, filename);
  try {
    if (!file.exists) return null;
    return file.textSync();
  } catch {
    return null;
  }
}

export function loadLatestDesignPack(
  projectId: string,
): { markdown: string; version: number } | null {
  // The version is now stored in the inquiry row
  const db = getDatabase();
  const row = db.getFirstSync<{ design_pack_version: number }>(
    `SELECT design_pack_version FROM inquiries WHERE id = ?`,
    projectId,
  );

  if (!row || row.design_pack_version === 0) return null;

  const markdown = loadDesignPack(projectId, row.design_pack_version);
  if (!markdown) return null;

  return { markdown, version: row.design_pack_version };
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
