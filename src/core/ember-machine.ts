// ─────────────────────────────────────────────
// Ember State Machine
// Pure function: (currentState, event) → nextState
// No side effects. Animation and navigation are driven by subscribers.
// ─────────────────────────────────────────────

import type { EmberState, EmberEvent } from './types';

/**
 * Transition table for the Ember Interaction Language.
 *
 * AWAKENED ──(HOLD)──────────→ REVEALING
 * REVEALING ──(REVEAL_COMPLETE)→ EXPANDED
 * EXPANDED ──(SELECT)────────→ SELECTED
 * EXPANDED ──(COLLAPSE)──────→ AWAKENED
 * SELECTED ──(PINCH)─────────→ TRANSITION
 * SELECTED ──(SELECT)────────→ SELECTED (re-select different node)
 * SELECTED ──(COLLAPSE)──────→ EXPANDED
 * TRANSITION ──(TRANSITION_COMPLETE)→ READY_TO_EXPLORE
 * READY_TO_EXPLORE ──(NAVIGATE)→ AWAKENED (new context loaded)
 * ANY ──(COLLAPSE)───────────→ AWAKENED (emergency exit)
 */
export function emberTransition(
  state: EmberState,
  event: EmberEvent,
): EmberState {
  switch (state) {
    case 'AWAKENED':
      switch (event.type) {
        case 'HOLD':
          return 'EXPANDED';
        default:
          return state;
      }

    case 'REVEALING':
      // Deprecated in the simplified flow, but kept for safety. Directs to EXPANDED on completion.
      switch (event.type) {
        case 'REVEAL_COMPLETE':
          return 'EXPANDED';
        case 'RELEASE':
        case 'COLLAPSE':
          return 'AWAKENED';
        default:
          return state;
      }

    case 'EXPANDED':
      switch (event.type) {
        case 'SELECT':
          return 'SELECTED';
        case 'COLLAPSE':
          return 'AWAKENED';
        default:
          return state;
      }

    case 'SELECTED':
      switch (event.type) {
        case 'PINCH':
          return 'TRANSITION';
        case 'SELECT':
          return 'SELECTED'; // Re-selecting another option
        case 'COLLAPSE':
          return 'AWAKENED'; // Resets the context back to idle
        default:
          return state;
      }

    case 'TRANSITION':
      switch (event.type) {
        case 'TRANSITION_COMPLETE':
          return 'READY_TO_EXPLORE';
        case 'COLLAPSE':
          return 'AWAKENED';
        default:
          return state;
      }

    case 'READY_TO_EXPLORE':
      switch (event.type) {
        case 'NAVIGATE':
          return 'AWAKENED';
        case 'COLLAPSE':
          return 'AWAKENED';
        default:
          return state;
      }

    default:
      return state;
  }
}

/**
 * Check if a transition is valid from the current state.
 * Useful for guards in gesture handlers.
 */
export function canTransition(
  state: EmberState,
  event: EmberEvent,
): boolean {
  return emberTransition(state, event) !== state;
}

/**
 * Get the list of valid events for a given state.
 * Useful for debugging and UI hints.
 */
export function validEvents(state: EmberState): EmberEvent['type'][] {
  const allEvents: EmberEvent['type'][] = [
    'HOLD', 'RELEASE', 'REVEAL_COMPLETE', 'SELECT',
    'PINCH', 'TRANSITION_COMPLETE', 'COLLAPSE', 'NAVIGATE',
  ];

  return allEvents.filter((type) => {
    const event = type === 'SELECT'
      ? { type: 'SELECT' as const, nodeId: '__test__' }
      : type === 'NAVIGATE'
        ? { type: 'NAVIGATE' as const, destination: '__test__' }
        : { type } as EmberEvent;
    return emberTransition(state, event) !== state;
  });
}
