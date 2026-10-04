// ─────────────────────────────────────────────
// Spark Types
//
// A Spark is captured material. It doesn't have to become an Ember.
//
// "Capture says: 'Carry this.'
//  Ember says something more like: 'Attend to this.'"
//
// Sparks linger. Then one catches your attention.
// Spark Ember. 🔥
// ─────────────────────────────────────────────

/**
 * The current lifecycle state of a Spark.
 *
 * - lingering: captured but not yet attended to
 * - ember-associated: selected into an Ember session
 * - archived: set aside (not deleted, just quiet)
 */
export type SparkStatus = 'lingering' | 'ember-associated' | 'archived';

/**
 * How the Spark was initially captured.
 */
export type SparkInputType = 'text' | 'voice';

/**
 * A captured fragment of thought.
 *
 * Not an Ember — just something worth carrying.
 * The user decides when it becomes part of something larger.
 */
export interface Spark {
  /** Unique identifier */
  id: string;

  /** User-supplied title (or deterministic fallback) */
  title: string;

  /** The captured content — text of the thought */
  content: string;

  /** How it was captured */
  inputType: SparkInputType;

  /** Path to audio file, if voice input (for future use) */
  audioUri?: string;

  /** Current lifecycle state */
  status: SparkStatus;

  /** If associated with an Ember, which one */
  emberId?: string;

  /** When this Spark was captured */
  createdAt: string;
}

/**
 * Creates a new Spark from text input.
 */
export function createTextSpark(
  title: string,
  content: string,
): Spark {
  return {
    id: generateSparkId(),
    title: title.trim() || fallbackTitle(),
    content: content.trim(),
    inputType: 'text',
    status: 'lingering',
    createdAt: new Date().toISOString(),
  };
}

function generateSparkId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `spark-${timestamp}-${random}`;
}

function fallbackTitle(): string {
  const now = new Date();
  const day = now.toLocaleDateString('en-US', { weekday: 'long' });
  const time = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `Spark — ${day}, ${time}`;
}
