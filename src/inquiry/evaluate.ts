// ─────────────────────────────────────────────
// Inquiry Engine — Evaluator
//
// evaluateInquiry(evidence) → InquiryState
//
// Pure and deterministic. The single semantic authority for:
//   applicability · dispositions · conditions · Design Pack availability ·
//   Develop outstanding requirements · blockers · coverage candidates ·
//   adoption validity · review currency · warrant · generation availability.
//
// Neither availability nor warrant depends on: number of answers, number of
// conditions, exhausting a question list, visiting a screen, leaving or
// returning, or having generated before.
//
// UI and animation consume this state; they never compute semantics.
// ─────────────────────────────────────────────

import type {
  Applicability,
  Blocker,
  Capability,
  CommittedAnswer,
  Configuration,
  DecisionKind,
  Disposition,
  InquiryDecision,
  InquiryEvidence,
  InquiryQuestion,
  InquiryState,
  Movement,
  PriorMaterial,
  QuestionState,
  WarrantGap,
} from './types.ts';
import { INQUIRY_LIBRARY_VERSION, INQUIRY_QUESTIONS } from './questions.ts';
import { CAPABILITY_LABELS, CONDITION_CAPABILITIES, CONFIGURATIONS } from './configurations.ts';
import { fingerprint } from './fingerprint.ts';
import { assessHandoffContent, HANDOFF_NOT_ASSESSED } from './handoff.ts';

export interface InquiryLibrary {
  version: string;
  questions: InquiryQuestion[];
  configurations: Configuration[];
  conditionCapabilities: Record<string, Capability>;
}

export const DEFAULT_LIBRARY: InquiryLibrary = {
  version: INQUIRY_LIBRARY_VERSION,
  questions: INQUIRY_QUESTIONS,
  configurations: CONFIGURATIONS,
  conditionCapabilities: CONDITION_CAPABILITIES,
};

export const DESIGN_PACK_CONSEQUENCE = 'design-pack';

/** Dispositions that count as a valid committed response. */
const RESPONDED: ReadonlySet<Disposition> = new Set(['decided', 'unresolved', 'excluded', 'context']);
/** Dispositions that satisfy a requirement (Explore availability / Develop warrant). */
const VALID_FOR_WARRANT: ReadonlySet<Disposition> = new Set(['decided', 'excluded']);

// ── Predicate evaluation ─────────────────────

export function testApplicability(
  predicate: Applicability,
  conditions: ReadonlySet<string>,
  answered: ReadonlySet<string>,
): boolean {
  if ('condition' in predicate) return conditions.has(predicate.condition);
  if ('answered' in predicate) return answered.has(predicate.answered);
  if ('all' in predicate) return predicate.all.every((p) => testApplicability(p, conditions, answered));
  if ('any' in predicate) return predicate.any.some((p) => testApplicability(p, conditions, answered));
  return !testApplicability(predicate.not, conditions, answered);
}

// ── Evidence helpers ─────────────────────────

/** Latest answer per question (answeredAt; later array position breaks ties). */
function latestAnswers(answers: CommittedAnswer[]): Map<string, CommittedAnswer> {
  const latest = new Map<string, CommittedAnswer>();
  for (const a of answers) {
    const prev = latest.get(a.questionId);
    if (!prev || a.answeredAt >= prev.answeredAt) latest.set(a.questionId, a);
  }
  return latest;
}

/** Latest decision per kind (decidedAt; later array position breaks ties). */
function latestDecisions(decisions: InquiryDecision[]): Map<DecisionKind, InquiryDecision> {
  const latest = new Map<DecisionKind, InquiryDecision>();
  for (const d of decisions) {
    const prev = latest.get(d.kind);
    if (!prev || d.decidedAt >= prev.decidedAt) latest.set(d.kind, d);
  }
  return latest;
}

function evidenceEntry(a: CommittedAnswer) {
  return { q: a.questionId, v: a.value, s: a.specification?.trim() || undefined };
}

// ── Evaluator ────────────────────────────────

export function evaluateInquiry(
  evidence: InquiryEvidence,
  library: InquiryLibrary = DEFAULT_LIBRARY,
): InquiryState {
  const latest = latestAnswers(evidence.answers);
  const knownIds = new Set(library.questions.map((q) => q.id));
  const priorMaterial: PriorMaterial[] = [];

  for (const [qid, a] of latest) {
    if (!knownIds.has(qid)) priorMaterial.push({ answer: a, reason: 'unknown-question' });
  }

  // Single pass in library order: applicability may only reference earlier questions.
  const conditions = new Set<string>();
  const answered = new Set<string>();
  const questions: QuestionState[] = [];
  const conditionSource = new Map<string, QuestionState>();

  for (const q of library.questions) {
    const applicable = q.applicableWhen
      ? testApplicability(q.applicableWhen, conditions, answered)
      : true;
    const answer = latest.get(q.id);
    const base = { id: q.id, movement: q.movement, role: q.role, applicable };

    if (!applicable) {
      if (answer) priorMaterial.push({ answer, reason: 'not-applicable' });
      questions.push({ ...base, disposition: 'not-applicable', established: [] });
      continue;
    }
    if (!answer) {
      questions.push({ ...base, disposition: 'unanswered', established: [] });
      continue;
    }

    let disposition: Disposition;
    let established: string[] = [];

    if (q.answerType === 'text') {
      if (answer.value.trim()) {
        disposition = 'context';
        established = q.establishesOnText ?? [];
      } else {
        disposition = 'unanswered';
      }
    } else {
      const choice = q.choices?.find((c) => c.value === answer.value);
      if (!choice) {
        priorMaterial.push({ answer, reason: 'unrecognized-value' });
        questions.push({ ...base, disposition: 'unanswered', established: [] });
        continue;
      }
      if (choice.requiresSpecification && !answer.specification?.trim()) {
        disposition = 'incomplete';
      } else {
        disposition = choice.disposition;
        established = choice.establishes;
      }
    }

    const state: QuestionState = { ...base, disposition, answer, established };
    questions.push(state);
    if (RESPONDED.has(disposition)) answered.add(q.id);
    for (const c of established) {
      conditions.add(c);
      if (!conditionSource.has(c)) conditionSource.set(c, state);
    }
  }

  // ── Explore → availability (D1) ──
  const exploreQs = questions.filter((q) => q.movement === 'explore');
  const missingRequired = exploreQs
    .filter((q) => q.role === 'required' && q.disposition !== 'context')
    .map((q) => q.id);
  const openOptional = exploreQs
    .filter((q) => q.role === 'optional' && q.disposition === 'unanswered')
    .map((q) => q.id);
  const available = missingRequired.length === 0;

  // ── Decisions ──
  const decisions = latestDecisions(evidence.decisions);
  const chosen =
    available && decisions.get('consequence-chosen')?.value === DESIGN_PACK_CONSEQUENCE;

  // ── Fingerprints ──
  const activeEntries = questions
    .filter((q) => q.applicable && q.answer && q.disposition !== 'unanswered')
    .map((q) => ({ movement: q.movement, entry: evidenceEntry(q.answer!) }));
  const evidenceFp = fingerprint({
    lib: library.version,
    answers: activeEntries.map((e) => e.entry),
  });
  const requirementsFp = fingerprint({
    lib: library.version,
    answers: activeEntries.filter((e) => e.movement === 'develop').map((e) => e.entry),
  });
  const adoption = decisions.get('configuration-adopted');
  const reviewFp = fingerprint({ evidence: evidenceFp, adopted: adoption?.value ?? null });

  // ── Develop (only once the Design Pack is chosen) ──
  const developQs = chosen
    ? questions.filter((q) => q.movement === 'develop' && q.applicable)
    : [];
  const outstanding = developQs
    .filter((q) => q.role === 'required' && (q.disposition === 'unanswered' || q.disposition === 'incomplete'))
    .map((q) => q.id);

  const blockers: Blocker[] = [];
  for (const q of developQs) {
    if (q.disposition === 'unresolved') {
      blockers.push({
        kind: 'unresolved-decision',
        subject: q.id,
        detail: 'This decision is still open and would change the construction.',
      });
    }
  }

  const requiredCapabilities: Capability[] = [];
  if (chosen) {
    for (const c of conditions) {
      const cap = library.conditionCapabilities[c];
      if (cap && !requiredCapabilities.includes(cap)) requiredCapabilities.push(cap);
    }
    requiredCapabilities.sort();
  }

  const authored = new Set<Capability>(library.configurations.flatMap((c) => c.satisfies));
  for (const cap of requiredCapabilities) {
    if (authored.has(cap)) continue;
    const sourceCondition = Object.keys(library.conditionCapabilities).find(
      (c) => library.conditionCapabilities[c] === cap && conditions.has(c),
    );
    const source = sourceCondition ? conditionSource.get(sourceCondition) : undefined;
    blockers.push({
      kind: 'knowledge-boundary',
      subject: cap,
      detail: `Ember has no authored configuration that covers ${CAPABILITY_LABELS[cap]}.`,
      preservedText: source?.answer?.specification?.trim() || undefined,
    });
  }

  const candidates = chosen
    ? library.configurations
        .filter((cfg) =>
          (cfg.prerequisites ? testApplicability(cfg.prerequisites, conditions, answered) : true) &&
          requiredCapabilities.every((cap) => cfg.satisfies.includes(cap)),
        )
        .map((cfg) => cfg.id)
    : [];

  const hasBoundary = blockers.some((b) => b.kind === 'knowledge-boundary');
  if (chosen && !hasBoundary && candidates.length === 0) {
    blockers.push({
      kind: 'uncovered-combination',
      subject: 'configuration',
      detail: `No single authored configuration covers this combination: ${requiredCapabilities
        .map((c) => CAPABILITY_LABELS[c])
        .join(', ')}.`,
    });
  }

  // ── Adoption & review ──
  const requirementsComplete = chosen && outstanding.length === 0 && blockers.length === 0;
  const canAdopt = requirementsComplete && candidates.length > 0;
  const adoptedConfigurationId = adoption?.value;
  const adoptionValid =
    canAdopt &&
    adoption !== undefined &&
    candidates.includes(adoption.value) &&
    adoption.evidenceFingerprint === requirementsFp;
  const review = decisions.get('review-confirmed');
  const reviewCurrent = adoptionValid && review?.evidenceFingerprint === reviewFp;

  // ── Handoff content (requiredHandoffContentCanBeProduced) ──
  // Assessed only for a validly adopted configuration, only from its authored content.
  const adoptedCfg = adoptionValid
    ? library.configurations.find((c) => c.id === adoptedConfigurationId)
    : undefined;
  const handoffContent = adoptedCfg
    ? assessHandoffContent(adoptedCfg, requiredCapabilities)
    : HANDOFF_NOT_ASSESSED;

  // ── Warrant ──
  const gaps: WarrantGap[] = [];
  if (!available) gaps.push('not-available');
  else if (!chosen) gaps.push('not-chosen');
  else {
    if (outstanding.length > 0) gaps.push('outstanding-requirements');
    if (blockers.some((b) => b.kind === 'unresolved-decision')) gaps.push('unresolved-decisions');
    if (hasBoundary) gaps.push('knowledge-boundary');
    if (blockers.some((b) => b.kind === 'uncovered-combination')) gaps.push('uncovered-combination');
    if (adoption === undefined) gaps.push('no-adopted-configuration');
    else if (!adoptionValid) gaps.push('adoption-invalid');
    else if (!handoffContent.producible) gaps.push('handoff-content-unavailable');
    if (!reviewCurrent) gaps.push('review-not-current');
  }
  const warranted = gaps.length === 0;

  return {
    libraryVersion: library.version,
    questions,
    conditions: [...conditions].sort(),
    explore: { missingRequired, openOptional },
    designPack: {
      available,
      missingForAvailability: missingRequired,
      chosen,
      developing: chosen && !warranted,
      outstanding,
      blockers,
      requiredCapabilities,
      candidates,
      adoptedConfigurationId,
      adoptionValid,
      canAdopt,
      handoffContent,
      reviewCurrent,
      canConfirmReview: adoptionValid,
      warranted,
      warrantGaps: gaps,
      generationAvailable: warranted,
    },
    fingerprints: { evidence: evidenceFp, requirements: requirementsFp, review: reviewFp },
    priorMaterial,
  };
}

// ── Movement helpers ─────────────────────────

/**
 * The next question to ask within a movement, or undefined.
 * Explore: required material first, then optional material (Explore stays open).
 * Develop: only once chosen; first outstanding applicable requirement.
 */
export function nextQuestion(
  state: InquiryState,
  movement: Movement,
  library: InquiryLibrary = DEFAULT_LIBRARY,
): InquiryQuestion | undefined {
  const byId = new Map(library.questions.map((q) => [q.id, q]));
  if (movement === 'explore') {
    const id = state.explore.missingRequired[0] ?? state.explore.openOptional[0];
    return id ? byId.get(id) : undefined;
  }
  const id = state.designPack.outstanding[0];
  return id ? byId.get(id) : undefined;
}

// ── Decision builders (pure; persistence is Phase 2) ──

export function chooseDesignPack(state: InquiryState, decidedAt: string): InquiryDecision | null {
  if (!state.designPack.available) return null;
  return { kind: 'consequence-chosen', value: DESIGN_PACK_CONSEQUENCE, decidedAt };
}

export function adoptConfiguration(
  state: InquiryState,
  configurationId: string,
  decidedAt: string,
): InquiryDecision | null {
  if (!state.designPack.canAdopt || !state.designPack.candidates.includes(configurationId)) return null;
  return {
    kind: 'configuration-adopted',
    value: configurationId,
    evidenceFingerprint: state.fingerprints.requirements,
    decidedAt,
  };
}

/**
 * The user confirms the recorded outcome, constraints and open material
 * contain no KNOWN unrepresented consequential issue. Ember does not claim
 * to have verified free text semantically.
 */
export function confirmReview(state: InquiryState, decidedAt: string): InquiryDecision | null {
  if (!state.designPack.canConfirmReview) return null;
  return {
    kind: 'review-confirmed',
    value: state.designPack.adoptedConfigurationId ?? '',
    evidenceFingerprint: state.fingerprints.review,
    decidedAt,
  };
}

/**
 * Whether a previously generated Design Pack still represents current evidence.
 * Packs without a recorded fingerprint have unknown provenance.
 */
export function designPackStaleness(
  recordedReviewFingerprint: string | null | undefined,
  state: InquiryState,
): 'current' | 'stale' | 'unknown' {
  if (!recordedReviewFingerprint) return 'unknown';
  return recordedReviewFingerprint === state.fingerprints.review ? 'current' : 'stale';
}
