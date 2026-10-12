// ─────────────────────────────────────────────
// Inquiry Engine — Types
//
// Phase 1 of the Enquiry Flow construction plan.
// Pure semantic model. No UI, no persistence, no React Native.
//
// Flow (D1 + availability ≠ generation):
//   Inquiry exists → Explore (purpose, audience/context, optional material)
//   → Design Pack AVAILABLE (purpose + audience established)
//   → user deliberately CHOOSES Design Pack → Develop
//   → WARRANTED (coverage, no blockers, adopted, reviewed)
//   → generation available.
//
// Erasable TypeScript only (no enums / namespaces / parameter properties):
// this module runs directly under Node's type stripping for tests.
// ─────────────────────────────────────────────

/** The two movements of the current bounded Inquiry. */
export type Movement = 'explore' | 'develop';

/**
 * Applicability predicate. Questions referenced via `answered` and conditions
 * referenced via `condition` must come from questions EARLIER in library
 * order, so applicability is computed in one deterministic pass.
 */
export type Applicability =
  | { condition: string }
  | { answered: string }
  | { all: Applicability[] }
  | { any: Applicability[] }
  | { not: Applicability };

/** Authored disposition carried by a structured choice. */
export type ChoiceDisposition = 'decided' | 'unresolved' | 'excluded';

/**
 * Derived disposition of a question for a given evidence state.
 * Never persisted.
 *
 * - unanswered:      applicable, no committed (recognised) response
 * - not-applicable:  prerequisite false; requires no answer
 * - decided:         explicit structured choice establishes a requirement
 * - unresolved:      the user cannot yet decide
 * - excluded:        deliberate scope decision for this version
 * - context:         free text recorded; establishes no technical condition
 * - incomplete:      a choice that requires a verbatim specification lacks it
 */
export type Disposition =
  | 'unanswered'
  | 'not-applicable'
  | 'decided'
  | 'unresolved'
  | 'excluded'
  | 'context'
  | 'incomplete';

export interface InquiryChoice {
  label: string;
  value: string;
  disposition: ChoiceDisposition;
  /** Conditions established when this choice is the active answer. */
  establishes: string[];
  /** If true, the answer must carry verbatim text (e.g. named actions). */
  requiresSpecification?: boolean;
}

export interface InquiryQuestion {
  id: string;
  movement: Movement;
  text: string;
  answerType: 'text' | 'choice';
  choices?: InquiryChoice[];
  placeholder?: string;
  /**
   * required — Explore: gates Design Pack availability.
   *            Develop: needs a valid disposition for warrant (when applicable).
   * optional — available material; never gates.
   */
  role: 'required' | 'optional';
  /** Conditions established by any non-empty committed text answer. */
  establishesOnText?: string[];
  /** Absent = always applicable within its movement. */
  applicableWhen?: Applicability;
}

// ── Coverage model ───────────────────────────

/** A capability a configuration must provide for the declared requirements. */
export type Capability =
  | 'target-mobile'
  | 'target-web'
  | 'state-session'
  | 'state-durable'
  | 'data-local-device'
  | 'data-cross-device'
  | 'data-shared'
  | 'data-documents'
  | 'data-queryable'
  | 'external-service'
  | 'offline-full'
  | 'offline-partial'
  | 'auth'
  | 'recovery-export'
  | 'binding-constraint';

/** Handoff content a configuration provides for one capability it satisfies. */
export interface CapabilityProvision {
  guidance: string[];
  checks: string[];
}

export interface Configuration {
  id: string;
  name: string;
  summary: string;
  /** Capabilities this configuration covers coherently. */
  satisfies: Capability[];
  /** Must hold (against current conditions) for this configuration to qualify. */
  prerequisites?: Applicability;
  /** Construction guidance that applies whenever this configuration is used. */
  guidance: string[];
  /** Verification checks that apply whenever this configuration is used. */
  checks: string[];
  // ── Handoff content (Phase 3) ──
  // A Design Pack may only say what is authored here. If a part is missing,
  // the handoff cannot be produced (requiredHandoffContentCanBeProduced).
  /** Stack choices supplied by Ember as authored defaults — not user-established. */
  defaults: string[];
  /** Material tradeoffs of this configuration, stated honestly. */
  tradeoffs: string[];
  /** Limits the pack must state (retention, scope of the claim). */
  limits: string[];
  /** Setup responsibilities. */
  setup: string[];
  /** Starter organization (one line per entry). No domain features. */
  starterLayout: string[];
  /** Naming and code conventions. */
  conventions: string[];
  /** Bounded implementation sequence. */
  sequence: string[];
  /** Content for each satisfied capability; used only when that capability is required. */
  provisions: Partial<Record<Capability, CapabilityProvision>>;
}

// ── Evidence (inputs) ────────────────────────

/** A committed answer. Drafts are never evidence. */
export interface CommittedAnswer {
  questionId: string;
  /** Choice value, or the trimmed text for text questions. */
  value: string;
  /** Verbatim specification accompanying a choice, when required. */
  specification?: string;
  answeredAt: string;
}

export type DecisionKind =
  | 'consequence-chosen'
  | 'configuration-adopted'
  | 'review-confirmed';

/** A deliberate user act. Latest of each kind (by decidedAt) is authoritative. */
export interface InquiryDecision {
  kind: DecisionKind;
  value: string;
  /** Fingerprint of the evidence the act was made against. */
  evidenceFingerprint?: string;
  decidedAt: string;
}

/** Everything the engine needs. The Inquiry's existence is the initiation fact. */
export interface InquiryEvidence {
  answers: CommittedAnswer[];
  decisions: InquiryDecision[];
}

// ── Derived state (outputs) ──────────────────

export interface QuestionState {
  id: string;
  movement: Movement;
  role: 'required' | 'optional';
  applicable: boolean;
  disposition: Disposition;
  /** The active answer, if any (absent when not applicable). */
  answer?: CommittedAnswer;
  established: string[];
}

export type BlockerKind =
  | 'unresolved-decision'
  | 'knowledge-boundary'
  | 'uncovered-combination';

export interface Blocker {
  kind: BlockerKind;
  /** Question id, capability, or 'configuration'. */
  subject: string;
  detail: string;
  /** Verbatim user text preserved for honest reporting (e.g. constraints). */
  preservedText?: string;
}

export type PriorMaterialReason =
  | 'not-applicable'
  | 'unrecognized-value'
  | 'unknown-question';

export interface PriorMaterial {
  answer: CommittedAnswer;
  reason: PriorMaterialReason;
}

export type WarrantGap =
  | 'not-available'
  | 'not-chosen'
  | 'outstanding-requirements'
  | 'unresolved-decisions'
  | 'knowledge-boundary'
  | 'uncovered-combination'
  | 'no-adopted-configuration'
  | 'adoption-invalid'
  | 'handoff-content-unavailable'
  | 'review-not-current';

/**
 * requiredHandoffContentCanBeProduced, assessed for the adopted configuration
 * only — and only from content that configuration actually authors.
 */
export interface HandoffContentState {
  /** False until a configuration is validly adopted (nothing to assess yet). */
  assessed: boolean;
  /** Every required part is authored for the adopted configuration. */
  producible: boolean;
  /**
   * Missing parts: 'setup' | 'starter-layout' | 'conventions' | 'sequence' |
   * 'base-guidance' | 'base-checks' | `capability:<Capability>`.
   */
  missing: string[];
}

export interface DesignPackState {
  /** Purpose and audience established (D1). Not generation availability. */
  available: boolean;
  /** Missing Explore requirements for availability. */
  missingForAvailability: string[];
  /** The user deliberately chose the Design Pack consequence. */
  chosen: boolean;
  /** chosen and not yet warranted. */
  developing: boolean;
  /** Applicable Develop questions without a committed, complete answer. */
  outstanding: string[];
  blockers: Blocker[];
  requiredCapabilities: Capability[];
  /** Configurations that cover every currently required capability. */
  candidates: string[];
  adoptedConfigurationId?: string;
  adoptionValid: boolean;
  /** Requirements complete, no blockers, at least one candidate. */
  canAdopt: boolean;
  handoffContent: HandoffContentState;
  reviewCurrent: boolean;
  canConfirmReview: boolean;
  warranted: boolean;
  warrantGaps: WarrantGap[];
  /** Generation is available only when warranted. */
  generationAvailable: boolean;
}

export interface InquiryFingerprints {
  /** All active evidence + library version. */
  evidence: string;
  /** Active Develop answers only — what adoption depends on. */
  requirements: string;
  /** Evidence + adopted configuration — what review confirms. */
  review: string;
}

export interface InquiryState {
  libraryVersion: string;
  questions: QuestionState[];
  conditions: string[];
  explore: {
    /** Required Explore questions not yet established. */
    missingRequired: string[];
    /** Optional Explore material still unanswered. Availability never closes Explore. */
    openOptional: string[];
  };
  designPack: DesignPackState;
  fingerprints: InquiryFingerprints;
  priorMaterial: PriorMaterial[];
}
