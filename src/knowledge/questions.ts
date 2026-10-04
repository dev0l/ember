// ─────────────────────────────────────────────
// Authored Knowledge — Questions
//
// "We don't necessarily need twenty-seven fucking questions
//  before allowing the poor human to proceed." 😂
//
// Questions know which dimension they explore.
// Answers establish or modify conditions.
//
// The first few establish dimensions.
// Further enquiry is voluntary.
// ─────────────────────────────────────────────

/**
 * A possible answer choice for a question.
 * Each choice can establish conditions.
 */
export interface QuestionChoice {
  /** Display text */
  label: string;

  /** Value stored in the answer */
  value: string;

  /** Condition IDs this choice establishes */
  establishesConditions: string[];
}

/**
 * An authored question in Ember's knowledge.
 *
 * Questions aren't just text — they know what they explore,
 * what choices are available, and what conditions they establish.
 */
export interface AuthoredQuestion {
  /** Unique identifier */
  id: string;

  /** The question text — human, warm, not clinical */
  text: string;

  /** Which dimension this explores */
  dimensionId: string;

  /** Whether this is part of the initial foundational set */
  phase: 'foundational' | 'exploratory';

  /** Answer type */
  answerType: 'choice' | 'text' | 'multi-choice';

  /** Available choices (for choice/multi-choice types) */
  choices?: QuestionChoice[];

  /** Placeholder text for text-type answers */
  placeholder?: string;

  /**
   * Conditions that must be active for this question to be relevant.
   * Empty = always relevant (foundational questions).
   */
  requiredConditions: string[];
}

// ─────────────────────────────────────────────
// The Question Library
//
// Phase 1: Foundational (always asked, in order)
// Phase 2: Exploratory (conditionally relevant, voluntary)
// ─────────────────────────────────────────────

export const QUESTION_LIBRARY: AuthoredQuestion[] = [
  // ── Foundational Questions ──────────────────

  {
    id: 'q-purpose',
    text: 'What are you hoping this makes possible?',
    dimensionId: 'purpose',
    phase: 'foundational',
    answerType: 'text',
    placeholder: 'Describe what you imagine this enabling...',
    requiredConditions: [],
  },
  {
    id: 'q-audience',
    text: 'Who or what is it for?',
    dimensionId: 'audience',
    phase: 'foundational',
    answerType: 'text',
    placeholder: 'Who would use this? Just you, a group, everyone?',
    requiredConditions: [],
  },
  {
    id: 'q-platform',
    text: 'Where should it live?',
    dimensionId: 'platform',
    phase: 'foundational',
    answerType: 'choice',
    choices: [
      {
        label: 'Mobile app (phone/tablet)',
        value: 'mobile',
        establishesConditions: ['platform-mobile'],
      },
      {
        label: 'Web application (browser)',
        value: 'web',
        establishesConditions: ['platform-web'],
      },
      {
        label: 'Both mobile and web',
        value: 'both',
        establishesConditions: ['platform-mobile', 'platform-web'],
      },
      {
        label: 'Not sure yet',
        value: 'uncertain',
        establishesConditions: ['platform-uncertain'],
      },
    ],
    requiredConditions: [],
  },

  // ── Exploratory Questions ──────────────────
  // (shown when "Explore further" is chosen)

  {
    id: 'q-persistence',
    text: 'Does information need to remain available after the app closes?',
    dimensionId: 'persistence',
    phase: 'exploratory',
    answerType: 'choice',
    choices: [
      {
        label: 'Yes — data must survive closing the app',
        value: 'yes',
        establishesConditions: ['requires-persistence'],
      },
      {
        label: 'No — temporary/session-based is fine',
        value: 'no',
        establishesConditions: ['no-persistence'],
      },
      {
        label: 'Uncertain',
        value: 'uncertain',
        establishesConditions: ['persistence-uncertain'],
      },
    ],
    requiredConditions: [],
  },
  {
    id: 'q-offline',
    text: 'Should it work without an internet connection?',
    dimensionId: 'connectivity',
    phase: 'exploratory',
    answerType: 'choice',
    choices: [
      {
        label: 'Yes — fully offline capable',
        value: 'yes',
        establishesConditions: ['offline-required'],
      },
      {
        label: 'No — internet connection expected',
        value: 'no',
        establishesConditions: ['online-required'],
      },
      {
        label: 'Ideally some offline, but not critical',
        value: 'partial',
        establishesConditions: ['offline-preferred'],
      },
    ],
    requiredConditions: [],
  },
  {
    id: 'q-accounts',
    text: 'Do users need accounts or login?',
    dimensionId: 'identity',
    phase: 'exploratory',
    answerType: 'choice',
    choices: [
      {
        label: 'No accounts needed',
        value: 'none',
        establishesConditions: ['no-auth'],
      },
      {
        label: 'Yes — users need to sign in',
        value: 'required',
        establishesConditions: ['auth-required'],
      },
      {
        label: 'Maybe later, not initially',
        value: 'deferred',
        establishesConditions: ['auth-deferred'],
      },
    ],
    requiredConditions: [],
  },
  {
    id: 'q-scale',
    text: 'What\'s the intended scale?',
    dimensionId: 'scale',
    phase: 'exploratory',
    answerType: 'choice',
    choices: [
      {
        label: 'Just me / personal tool',
        value: 'individual',
        establishesConditions: ['scale-individual'],
      },
      {
        label: 'Small group (friends, team)',
        value: 'small-group',
        establishesConditions: ['scale-small-group'],
      },
      {
        label: 'Public / many users',
        value: 'public',
        establishesConditions: ['scale-public'],
      },
    ],
    requiredConditions: [],
  },
  {
    id: 'q-important-to-preserve',
    text: 'What already feels important to preserve?',
    dimensionId: 'purpose',
    phase: 'exploratory',
    answerType: 'text',
    placeholder: 'Any constraints, values, or non-negotiables...',
    requiredConditions: [],
  },
  {
    id: 'q-uncertainty',
    text: 'What are you most uncertain about?',
    dimensionId: 'purpose',
    phase: 'exploratory',
    answerType: 'text',
    placeholder: 'What feels unclear or risky...',
    requiredConditions: [],
  },
];

/**
 * Get foundational questions (always asked first).
 */
export function getFoundationalQuestions(): AuthoredQuestion[] {
  return QUESTION_LIBRARY.filter((q) => q.phase === 'foundational');
}

/**
 * Get exploratory questions that haven't been asked yet
 * and whose conditions are met.
 */
export function getAvailableExploratoryQuestions(
  askedIds: string[],
  activeConditions: string[],
): AuthoredQuestion[] {
  return QUESTION_LIBRARY.filter((q) => {
    if (q.phase !== 'exploratory') return false;
    if (askedIds.includes(q.id)) return false;

    // Check if required conditions are met (empty = always available)
    if (q.requiredConditions.length === 0) return true;
    return q.requiredConditions.every((c) => activeConditions.includes(c));
  });
}
