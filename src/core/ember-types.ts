// ─────────────────────────────────────────────
// Ember Data Model
// "What does it mean for an Ember to come into existence?"
//
// These types represent the seed of an Ember — the minimum
// meaningful structure for it to begin becoming.
//
// Inspired by Hermes intake pulse structure:
//   questions to preserve, texture, language seeds,
//   source links, candidate structures — but adapted
//   for what an Ember needs at its moment of initiation.
// ─────────────────────────────────────────────

/**
 * What kind of thing is beginning?
 *
 * This is the initiation question. The nature is not a permanent lock —
 * an Ember may change what it is becoming over time.
 * For now, it establishes the initial posture.
 */
export type EmberNature = 'project' | 'idea' | 'principle' | 'open';

/**
 * Display labels for each nature.
 * These are what the user sees during initiation.
 */
export const EMBER_NATURE_LABELS: Record<EmberNature, string> = {
  project: 'Project',
  idea: 'Idea',
  principle: 'Principle',
  open: 'Open',
};

/**
 * Subtle descriptions for each nature.
 * Shown below the selection to help the user feel what each means.
 */
export const EMBER_NATURE_HINTS: Record<EmberNature, string> = {
  project: 'Something being built or developed',
  idea: 'A thought, spark, or emerging insight',
  principle: 'A guiding truth or pattern',
  open: 'Let it become what it becomes',
};

/**
 * A reference to external material.
 *
 * Not a copy — a pointer. The distinction between the Ember
 * and the material it refers to matters.
 *
 * "A source may simply become a reference associated with the Ember."
 */
export interface EmberSource {
  /** Unique identifier */
  id: string;
  /** Display name (filename or user-given label) */
  name: string;
  /** URI to the source (file://, content://, or other scheme) */
  uri: string;
  /** MIME type if known */
  mimeType?: string;
  /** When this source was attached */
  addedAt: string;
}

/**
 * The persisted Ember seed.
 *
 * This is what lives in the Markdown frontmatter + body.
 * It represents the minimum meaningful structure for an Ember
 * to begin becoming — not a complete knowledge object.
 *
 * Questions are held as living signals, not tasks to close.
 * The carried sentence is a compressed essence that may evolve.
 */
export interface EmberSeed {
  /** Unique identifier (UUID) */
  id: string;

  /** What kind of thing is beginning? */
  nature: EmberNature;

  /** Optional name — "a name may emerge later" */
  name?: string;

  /** Initial text seed — what sparked this Ember into existence */
  spark?: string;

  /**
   * Questions worth preserving.
   * Not tasks requiring answers — things worth holding.
   * A question may later be answered, transformed, become irrelevant,
   * merge with another, or simply "no longer require an answer"
   * without necessarily being marked solved.
   */
  questions: string[];

  /**
   * Compressed essence phrase (6-10 words).
   * Carries something of the Ember's current becoming.
   * May evolve over time while retaining lineage.
   */
  carriedSentence?: string;

  /**
   * References to external material.
   * Not copies — pointers. Sources are associated, not consumed.
   */
  sources: EmberSource[];

  /** When this Ember came into existence */
  createdAt: string;

  /** Last time this Ember was touched */
  updatedAt: string;
}

/**
 * Creates a fresh EmberSeed with defaults.
 * Only `nature` is required to begin.
 */
export function createEmberSeed(
  nature: EmberNature,
  overrides?: Partial<Omit<EmberSeed, 'id' | 'createdAt' | 'updatedAt'>>,
): EmberSeed {
  const now = new Date().toISOString();
  const id = generateEmberId();

  return {
    id,
    nature,
    questions: [],
    sources: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Generates a simple unique ID for an Ember.
 * Uses timestamp + random suffix for uniqueness without external deps.
 */
function generateEmberId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `ember-${timestamp}-${random}`;
}
