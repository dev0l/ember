// ─────────────────────────────────────────────
// Ember Constants
// Animation timing, interaction thresholds, and design tokens
// ─────────────────────────────────────────────

/**
 * Animation durations in milliseconds.
 * These define the rhythm of the interaction language.
 *
 * Design Principle #1: Directness > Choreography
 * When the user's finger is on the screen, response is instant.
 * Choreography is reserved for non-interactive moments.
 */
export const TIMING = {
  /** AWAKENED → EXPANDED full reveal duration */
  revealDuration: 400,
  /** Collapse back to AWAKENED */
  collapseDuration: 300,
  /** Node selection highlight */
  selectFocusDuration: 200,
  /** SELECTED → TRANSITION → READY_TO_EXPLORE */
  transitionDuration: 500,
  /** Breathing pulse cycle (idle) */
  pulseInterval: 2000,
  /** Delay before auto-advancing from REVEALING → EXPANDED */
  revealAutoAdvance: 100,
  /** Delay before auto-advancing from TRANSITION → READY_TO_EXPLORE */
  transitionAutoAdvance: 400,
} as const;

/**
 * Interaction thresholds — when do gestures trigger state changes?
 */
export const THRESHOLDS = {
  /** Minimum hold duration before REVEALING triggers (ms) */
  holdDurationMs: 300,
  /** Pinch scale threshold to trigger TRANSITION */
  pinchScaleThreshold: 0.7,
  /** Touch target radius for nodes (dp) */
  nodeHitRadiusDp: 40,
  /** Minimum swipe velocity to trigger COLLAPSE (dp/s) */
  swipeVelocityThreshold: 500,
} as const;

/**
 * Animation progress breakpoints.
 *
 * Design Principle #2: Single progress float
 * One menuProgress value (0→1) drives all animation.
 * These breakpoints define which layers activate at which progress.
 */
export const PROGRESS = {
  /** Path reveal starts at this progress value */
  pathRevealStart: 0.0,
  /** Path reveal completes at this progress value */
  pathRevealEnd: 0.4,
  /** Node ignition starts at this progress value */
  nodeIgniteStart: 0.3,
  /** Node ignition completes at this progress value */
  nodeIgniteEnd: 1.0,
  /** Core pulse amplitude range (dp) */
  corePulseAmplitude: 5,
  /** Core base radius (dp) */
  coreBaseRadius: 40,
} as const;
