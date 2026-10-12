// ─────────────────────────────────────────────
// Inquiry Decision Storage — append-only log (schema v3)
//
// Persists the deliberate user acts the Inquiry engine reads:
//   consequence-chosen, configuration-adopted, review-confirmed.
//
// Append-only by construction: there is no update or delete API.
// A later decision of the same kind supersedes an earlier one at
// evaluation time (latest decidedAt wins, see inquiry/evaluate.ts);
// the earlier act remains recorded. Decisions are removed only when
// their Inquiry is deleted (ON DELETE CASCADE).
//
// Phase 2: persistence only. Nothing in the UI records decisions yet.
// ─────────────────────────────────────────────

import type { DecisionKind, InquiryDecision, CommittedAnswer, InquiryEvidence } from '@/inquiry';
import { getDatabase } from './database';

interface DecisionRow {
  id: number;
  inquiry_id: string;
  kind: DecisionKind;
  value: string;
  evidence_fingerprint: string | null;
  decided_at: string;
}

/**
 * Append a decision to an Inquiry's log.
 * The decision is stored exactly as the engine produced it —
 * including the evidence fingerprint it was made against.
 */
export function recordDecision(inquiryId: string, decision: InquiryDecision): void {
  const db = getDatabase();
  db.runSync(
    `INSERT INTO inquiry_decisions
     (inquiry_id, kind, value, evidence_fingerprint, decided_at)
     VALUES (?, ?, ?, ?, ?)`,
    inquiryId,
    decision.kind,
    decision.value,
    decision.evidenceFingerprint ?? null,
    decision.decidedAt,
  );
}

/**
 * Load an Inquiry's full decision history in the order it was recorded.
 * Returned whole (not collapsed to the latest of each kind) so the engine
 * remains the only place that decides which decision is authoritative.
 */
export function loadDecisions(inquiryId: string): InquiryDecision[] {
  const db = getDatabase();
  const rows = db.getAllSync<DecisionRow>(
    `SELECT * FROM inquiry_decisions
     WHERE inquiry_id = ?
     ORDER BY decided_at ASC, id ASC`,
    inquiryId,
  );

  return rows.map(r => {
    const decision: InquiryDecision = {
      kind: r.kind,
      value: r.value,
      decidedAt: r.decided_at,
    };
    if (r.evidence_fingerprint !== null) {
      decision.evidenceFingerprint = r.evidence_fingerprint;
    }
    return decision;
  });
}

interface AnswerRow {
  question_id: string;
  dimension_id: string;
  raw_response: string;
  value: string;
  specification: string | null;
  library_version: string | null;
  answered_at: string;
}

/**
 * Save or update an answer to an Inquiry's questionnaire under engine authority.
 * Writes specification and stamps library_version = INQUIRY_LIBRARY_VERSION.
 */
export function saveAnswer(
  inquiryId: string,
  questionId: string,
  value: string,
  options?: {
    specification?: string;
    rawResponse?: string;
    dimensionId?: string;
    sequence?: number;
    answeredAt?: string;
  },
): void {
  const db = getDatabase();
  const now = options?.answeredAt ?? new Date().toISOString();
  const rawResponse = options?.rawResponse ?? value;
  const dimensionId = options?.dimensionId ?? '';
  const seq = options?.sequence ?? 0;
  const spec = options?.specification?.trim() || null;

  db.runSync(
    `INSERT INTO inquiry_answers
     (inquiry_id, question_id, dimension_id, raw_response, value, specification, library_version, sequence, answered_at)
     VALUES (?, ?, ?, ?, ?, ?, 'inquiry-library@1', ?, ?)
     ON CONFLICT(inquiry_id, question_id) DO UPDATE SET
       raw_response = excluded.raw_response,
       value = excluded.value,
       specification = excluded.specification,
       library_version = excluded.library_version,
       dimension_id = excluded.dimension_id,
       sequence = excluded.sequence,
       answered_at = excluded.answered_at`,
    inquiryId,
    questionId,
    dimensionId,
    rawResponse,
    value,
    spec,
    seq,
    now,
  );

  // Update inquiry updated_at
  db.runSync(
    `UPDATE inquiries SET updated_at = ? WHERE id = ?`,
    now,
    inquiryId,
  );
}

/**
 * Load all committed answers for an Inquiry.
 */
export function loadAnswers(inquiryId: string): CommittedAnswer[] {
  const db = getDatabase();
  const rows = db.getAllSync<AnswerRow>(
    `SELECT question_id, dimension_id, raw_response, value, specification, library_version, answered_at
     FROM inquiry_answers
     WHERE inquiry_id = ?
     ORDER BY sequence ASC, id ASC`,
    inquiryId,
  );

  return rows.map(r => {
    const a: CommittedAnswer = {
      questionId: r.question_id,
      value: r.value,
      answeredAt: r.answered_at,
    };
    if (r.specification) {
      a.specification = r.specification;
    }
    return a;
  });
}

/**
 * Load the entire InquiryEvidence (answers + decisions) for evaluation.
 */
export function loadInquiryEvidence(inquiryId: string): InquiryEvidence {
  return {
    answers: loadAnswers(inquiryId),
    decisions: loadDecisions(inquiryId),
  };
}

/**
 * Load an Inquiry row by its associated Ember ID, or create a fresh Inquiry if none exists.
 */
export function ensureInquiryForEmber(emberId: string, emberName?: string): { id: string; emberId: string; name: string } {
  const db = getDatabase();
  const existing = db.getFirstSync<{ id: string; ember_id: string; name: string }>(
    `SELECT id, ember_id, name FROM inquiries WHERE ember_id = ? ORDER BY created_at ASC, id ASC LIMIT 1`,
    emberId,
  );
  if (existing) {
    return { id: existing.id, emberId: existing.ember_id, name: existing.name };
  }

  const now = new Date().toISOString();
  const id = `ember-proj-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
  const name = emberName || 'Untitled Ember';

  db.runSync(
    `INSERT INTO inquiries (id, ember_id, name, original_material, open_questions, design_pack_version, created_at, updated_at)
     VALUES (?, ?, ?, '', '[]', 0, ?, ?)`,
    id,
    emberId,
    name,
    now,
    now,
  );

  return { id, emberId, name };
}

/**
 * Load an Inquiry row by its inquiryId.
 */
export function loadInquiryRow(inquiryId: string): { id: string; emberId: string | null; name: string } | null {
  const db = getDatabase();
  const row = db.getFirstSync<{ id: string; ember_id: string | null; name: string }>(
    `SELECT id, ember_id, name FROM inquiries WHERE id = ?`,
    inquiryId,
  );
  if (!row) return null;
  return { id: row.id, emberId: row.ember_id, name: row.name };
}
