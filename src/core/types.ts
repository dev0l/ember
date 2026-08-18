// ─────────────────────────────────────────────
// Ember Core Types
// The interaction language, expressed in TypeScript
// ─────────────────────────────────────────────

/**
 * The 6 states of the Ember Interaction Language.
 *
 * AWAKENED → REVEALING → EXPANDED → SELECTED → TRANSITION → READY_TO_EXPLORE
 *
 * Each state represents a moment in the interaction journey:
 * - AWAKENED: The ember rests. Gentle breathing pulse. Invitation awaits.
 * - REVEALING: Hold expands the pulse, revealing hidden paths.
 * - EXPANDED: Energy reaches destinations. Ember-nodes ignite as options.
 * - SELECTED: One path chosen. Unchosen nodes collapse back.
 * - TRANSITION: Selected ember grows to center. Previous dissolves.
 * - READY_TO_EXPLORE: New layer active. The ember breathes again.
 */
export type EmberState =
  | 'AWAKENED'
  | 'REVEALING'
  | 'EXPANDED'
  | 'SELECTED'
  | 'TRANSITION'
  | 'READY_TO_EXPLORE';

/**
 * Events that drive state transitions.
 * The state machine is a pure function: (state, event) → state
 */
export type EmberEvent =
  | { type: 'HOLD' }
  | { type: 'RELEASE' }
  | { type: 'REVEAL_COMPLETE' }
  | { type: 'SELECT'; nodeId: string }
  | { type: 'PINCH' }
  | { type: 'TRANSITION_COMPLETE' }
  | { type: 'COLLAPSE' }
  | { type: 'NAVIGATE'; destination: string };

/**
 * A single ember-node in the hub menu.
 * Menu structure is data, not code. Adding options = adding to this array.
 * (Design Principle #3: Data-driven nodes)
 */
export interface EmberNode {
  /** Unique identifier */
  id: string;
  /** Display label (e.g., "Collections") */
  label: string;
  /** Subtitle text (e.g., "Browse your embers") */
  subtitle?: string;
  /** Icon identifier — maps to an icon component or asset */
  icon: string;
  /** Angular position on the orbit (degrees, 0 = top, clockwise) */
  offsetAngle: number;
  /** Distance from center (0-1 relative, where 1 = full orbit radius) */
  offsetRadius: number;
  /** Whether this node is currently active/available */
  enabled: boolean;
  /** Route to navigate to when this node is selected and confirmed */
  route?: string;
}

/**
 * Represents a knowledge collection (group of embers).
 */
export interface EmberCollection {
  id: string;
  title: string;
  description?: string;
  emberCount: number;
  updatedAt: string;
  createdAt: string;
  thumbnail?: string;
}

/**
 * Represents a single document/ember within a collection.
 */
export interface EmberDocument {
  id: string;
  collectionId: string;
  title: string;
  sourceType: 'chatgpt' | 'markdown' | 'transcript' | 'text' | 'notes';
  content?: string;
  metadata: EmberDocumentMetadata;
  createdAt: string;
  importedAt: string;
  tags: string[];
  status: 'imported' | 'structured' | 'reviewed' | 'annotated' | 'exported';
}

export interface EmberDocumentMetadata {
  conversationId?: string;
  participants?: string[];
  messageCount?: number;
  wordCount?: number;
  canon?: boolean;
}
