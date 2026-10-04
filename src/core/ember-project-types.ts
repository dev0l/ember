// ─────────────────────────────────────────────
// Ember Project Types
//
// An EmberProject is what emerges when Sparks are attended to.
// It carries structured state developed through enquiry.
//
// "Don't store the design-pack text as the primary truth.
//  Store the underlying information.
//  Then generate the design pack from it."
//
// Three layers:
//   Authored Knowledge + User State → Deterministic Evaluation → Design Pack
// ─────────────────────────────────────────────

/**
 * The lifecycle of an Ember Project.
 *
 * - developing: enquiry is active, conditions being established
 * - generated: a Design Pack has been generated from the current state
 * - revisiting: the user has returned to modify/extend the enquiry
 */
export type EmberProjectStatus = 'developing' | 'generated' | 'revisiting';

/**
 * Confidence level for a piece of information.
 *
 * - established: the user explicitly stated or selected this
 * - proposed: Ember inferred this from conditions
 * - open: not yet determined, preserved as a question
 */
export type ConfidenceLevel = 'established' | 'proposed' | 'open';

/**
 * A single answer to an enquiry question.
 * Preserves the user's original words alongside structured interpretation.
 */
export interface EmberAnswer {
  /** Which question produced this answer */
  questionId: string;

  /** The user's original response — never overwritten */
  rawResponse: string;

  /** Which dimension this answer informs */
  dimensionId: string;

  /** Structured value extracted from the response */
  value: string;

  /** When this answer was given */
  answeredAt: string;
}

/**
 * A condition established through enquiry.
 * Conditions activate propositions.
 *
 * "We're not categorizing the project. We're establishing its conditions."
 */
export interface EstablishedCondition {
  /** Unique condition key (e.g., 'requires-persistence', 'offline-required') */
  id: string;

  /** Human-readable description */
  label: string;

  /** How this condition was established */
  confidence: ConfidenceLevel;

  /** Which answer(s) established this condition */
  sourceAnswerIds: string[];
}

/**
 * A technology proposition activated by conditions.
 * Propositions carry their reasoning — "why" matters.
 */
export interface ActivatedProposition {
  /** Reference to the authored proposition */
  propositionId: string;

  /** Why this proposition is active */
  confidence: ConfidenceLevel;

  /** Which conditions activated it */
  activatingConditionIds: string[];

  /** Which conditions conflict (if any — makes it "proposed with tensions") */
  conflictingConditionIds: string[];
}

/**
 * The complete structured state of an Ember Project.
 *
 * This is what lives in the JSON file.
 * The Design Pack is generated FROM this state.
 */
export interface EmberProject {
  /** Unique project ID */
  id: string;

  /** EmberSeed this project was crossed from (if any) */
  seedId?: string;

  /** Project name (can evolve) */
  name: string;

  /** Current lifecycle state */
  status: EmberProjectStatus;

  /**
   * IDs of Sparks that seeded this Ember.
   *
   * LEGACY: Always [] in current construction. The actual Spark participation
   * relationship is now persisted via the `spark_participations` junction table.
   * This field was populated by the removed isNew path. Preserved in the type
   * to avoid breaking the factory function; may be removed when types are next
   * reworked. Do not wire this to spark_participations — different semantics.
   */
  sparkIds: string[];

  /** The original Spark content, preserved */
  originalMaterial: string;

  // ── Enquiry State ──

  /** Answers given during enquiry, in order */
  answers: EmberAnswer[];

  /** IDs of questions already asked */
  askedQuestionIds: string[];

  /** Conditions established through answers */
  conditions: EstablishedCondition[];

  /** Propositions activated by conditions */
  activatedPropositions: ActivatedProposition[];

  /** Questions the user wants to preserve (not tasks) */
  openQuestions: string[];

  // ── Metadata ──

  /** When this Ember was sparked into existence */
  createdAt: string;

  /** Last meaningful interaction */
  updatedAt: string;

  /** Design Pack version counter */
  designPackVersion: number;
}

/**
 * Creates a new EmberProject from selected Sparks.
 */
export function createEmberProject(
  name: string,
  sparkIds: string[],
  originalMaterial: string,
): EmberProject {
  return {
    id: generateProjectId(),
    name: name.trim() || 'Untitled Ember',
    status: 'developing',
    sparkIds,
    originalMaterial,
    answers: [],
    askedQuestionIds: [],
    conditions: [],
    activatedPropositions: [],
    openQuestions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    designPackVersion: 0,
  };
}

function generateProjectId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `ember-proj-${timestamp}-${random}`;
}
