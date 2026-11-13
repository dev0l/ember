// ─────────────────────────────────────────────
// Inquiry Draft Store & Session Navigation Helpers
//
// Holds uncommitted question input (Explore free text, Develop choice
// selection, and conditional specification text) keyed by inquiryId
// and questionId across component unmount/remount transitions
// (Ember deselection, switching Embers, or Spark-to-Ember navigation).
//
// Also provides pure helpers for bounded preceding-question fallback
// and inner Investigation back-hierarchy resolution.
//
// Strictly separate from committed InquiryEvidence (`inquiry_answers`
// and `inquiry_decisions`): uncommitted drafts have zero authority in
// `evaluateInquiry()`, fingerprints, or Design Pack generation until
// the user explicitly commits an answer via Save & Continue / Save Resolution.
//
// Lifecycle:
//   - In-memory only for the active application session (not persisted across OS app restarts).
//   - Cleared per-question when an answer is committed (`clearQuestionDraft`).
//   - Cleared per-inquiry on Decline & Reset Inquiry (`clearInquiryDrafts`).
//   - Cleared per-inquiry on Delete / Complete Ember or Design Pack completion (`clearInquiryDrafts`).
// ─────────────────────────────────────────────

export interface QuestionDraft {
  currentAnswer: string;
  selectedChoice: string | null;
  specificationText: string;
}

export interface CommittedQuestionBaseline {
  answerType?: 'text' | 'choice';
  committedValue?: string;
  committedSpecification?: string;
}

const draftsByInquiry = new Map<string, Map<string, QuestionDraft>>();

function isEmptyDraft(draft: QuestionDraft): boolean {
  return (
    draft.currentAnswer === '' &&
    draft.selectedChoice === null &&
    draft.specificationText === ''
  );
}

/**
 * Retrieve the uncommitted draft for a specific `(inquiryId, questionId)`, if any.
 */
export function getQuestionDraft(
  inquiryId: string | undefined,
  questionId: string | undefined,
): QuestionDraft | undefined {
  if (!inquiryId || !questionId) return undefined;
  const draft = draftsByInquiry.get(inquiryId)?.get(questionId);
  return draft ? { ...draft } : undefined;
}

/**
 * Resolve the input state to display when a question becomes active or a session mounts:
 *   1. Uncommitted draft from the in-memory session store (if present).
 *   2. Committed answer from `InquiryEvidence` (when re-examining a recorded answer in Investigation
 *      or revisiting the immediately preceding answer).
 *   3. Empty initial state (`''`, `null`, `''`).
 */
export function resolveQuestionInputState(
  inquiryId: string | undefined,
  questionId: string | undefined,
  baseline?: CommittedQuestionBaseline,
): QuestionDraft {
  const existingDraft = getQuestionDraft(inquiryId, questionId);
  if (existingDraft) {
    return existingDraft;
  }

  if (baseline?.committedValue !== undefined) {
    if (baseline.answerType === 'text') {
      return {
        currentAnswer: baseline.committedValue,
        selectedChoice: null,
        specificationText: '',
      };
    }
    return {
      currentAnswer: '',
      selectedChoice: baseline.committedValue,
      specificationText: baseline.committedSpecification || '',
    };
  }

  return {
    currentAnswer: '',
    selectedChoice: null,
    specificationText: '',
  };
}

/**
 * Update the uncommitted draft for `(inquiryId, questionId)` with a partial patch.
 * Preserves companion fields (e.g., retaining `specificationText` when toggling `selectedChoice`
 * on a Develop question, or retaining `selectedChoice` when editing `specificationText`).
 */
export function updateQuestionDraft(
  inquiryId: string | undefined,
  questionId: string | undefined,
  patch: Partial<QuestionDraft>,
  baseline?: CommittedQuestionBaseline,
): QuestionDraft {
  const base = resolveQuestionInputState(inquiryId, questionId, baseline);
  const next: QuestionDraft = {
    currentAnswer:
      patch.currentAnswer !== undefined ? patch.currentAnswer : base.currentAnswer,
    selectedChoice:
      patch.selectedChoice !== undefined ? patch.selectedChoice : base.selectedChoice,
    specificationText:
      patch.specificationText !== undefined
        ? patch.specificationText
        : base.specificationText,
  };

  if (!inquiryId || !questionId) {
    return next;
  }

  const hasCommittedBaseline = baseline?.committedValue !== undefined;
  if (!hasCommittedBaseline && isEmptyDraft(next)) {
    clearQuestionDraft(inquiryId, questionId);
    return next;
  }

  let inquiryMap = draftsByInquiry.get(inquiryId);
  if (!inquiryMap) {
    inquiryMap = new Map<string, QuestionDraft>();
    draftsByInquiry.set(inquiryId, inquiryMap);
  }
  inquiryMap.set(questionId, { ...next });
  return next;
}

/**
 * Clear the uncommitted draft for a single question (called when an answer is committed).
 */
export function clearQuestionDraft(
  inquiryId: string | undefined,
  questionId: string | undefined,
): void {
  if (!inquiryId || !questionId) return;
  const inquiryMap = draftsByInquiry.get(inquiryId);
  if (!inquiryMap) return;
  inquiryMap.delete(questionId);
  if (inquiryMap.size === 0) {
    draftsByInquiry.delete(inquiryId);
  }
}

/**
 * Clear all uncommitted drafts for an entire Inquiry (called on Decline & Reset Inquiry,
 * Delete Ember, Complete & Clear Ember, or Design Pack completion).
 */
export function clearInquiryDrafts(inquiryId: string | undefined): void {
  if (!inquiryId) return;
  draftsByInquiry.delete(inquiryId);
}

/**
 * Clear all uncommitted drafts across all Inquiries (used for test isolation).
 */
export function clearAllInquiryDrafts(): void {
  draftsByInquiry.clear();
}

// ── Bounded Preceding-Answer Fallback & Inner Session Back Hierarchy ──

export interface PrecedingQuestionCandidate {
  id: string;
  movement: 'explore' | 'develop';
  applicable: boolean;
  hasAnswer: boolean;
}

/**
 * Determine the immediately preceding answered question in the current movement
 * before `currentQuestionId`, if any.
 *
 * Bounded by design: returns at most the single immediately preceding applicable
 * answered question in the same movement so the user can revisit their just-submitted
 * response without introducing unrestricted question-history browsing.
 */
export function findPrecedingAnsweredQuestionId(
  questions: readonly PrecedingQuestionCandidate[],
  movement: 'explore' | 'develop',
  currentQuestionId: string | undefined,
): string | undefined {
  if (!currentQuestionId) return undefined;
  const applicableInMovement = questions.filter(
    (q) => q.movement === movement && q.applicable,
  );
  const currentIdx = applicableInMovement.findIndex((q) => q.id === currentQuestionId);
  if (currentIdx <= 0) return undefined;

  for (let i = currentIdx - 1; i >= 0; i--) {
    if (applicableInMovement[i].hasAnswer) {
      return applicableInMovement[i].id;
    }
  }
  return undefined;
}

export interface SessionSubViewState {
  investigatingQuestionId: string | null;
  revisitingPreviousQuestionId: string | null;
  isInvestigating: boolean;
}

export type SessionBackStepResult =
  | { handled: true; nextState: SessionSubViewState }
  | { handled: false; nextState: SessionSubViewState };

/**
 * Resolve one backward step inside EmberSessionScreen before stepping out to EmberViewScreen:
 *   1. If resolving/re-examining a targeted question in Investigation (`investigatingQuestionId !== null`),
 *      return to the Investigation threshold (`investigatingQuestionId: null`).
 *   2. If revisiting the immediately preceding question in guided inquiry (`revisitingPreviousQuestionId !== null`),
 *      return to the active forward question (`revisitingPreviousQuestionId: null`).
 *   3. If in User-Chosen Investigation (`isInvestigating === true`),
 *      return to the Adoption / Review / Warranted threshold (`isInvestigating: false`).
 *   4. Otherwise, return `{ handled: false }` so TerritoryStage steps up to EmberViewScreen.
 */
export function resolveSessionBackStep(
  state: SessionSubViewState,
): SessionBackStepResult {
  if (state.investigatingQuestionId !== null) {
    return {
      handled: true,
      nextState: {
        ...state,
        investigatingQuestionId: null,
      },
    };
  }
  if (state.revisitingPreviousQuestionId !== null) {
    return {
      handled: true,
      nextState: {
        ...state,
        revisitingPreviousQuestionId: null,
      },
    };
  }
  if (state.isInvestigating) {
    return {
      handled: true,
      nextState: {
        ...state,
        isInvestigating: false,
      },
    };
  }
  return {
    handled: false,
    nextState: state,
  };
}
