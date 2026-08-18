// ─────────────────────────────────────────────
// Ember Store
// Zustand store connecting the state machine to the app
// ─────────────────────────────────────────────

import { create } from 'zustand';
import { emberTransition } from '@/core/ember-machine';
import type { EmberState, EmberEvent, EmberNode } from '@/core/types';

interface EmberStore {
  // ── State Machine ──
  /** Current interaction state */
  state: EmberState;
  /** Dispatch an event to the state machine */
  dispatch: (event: EmberEvent) => void;

  // ── Selection ──
  /** ID of the currently selected node (null if none) */
  selectedNodeId: string | null;
  /** Select a node by ID */
  selectNode: (nodeId: string) => void;
  /** Clear selection */
  clearSelection: () => void;

  // ── Nodes ──
  /** Current set of ember nodes (data-driven, changes per navigation depth) */
  nodes: EmberNode[];
  /** Update the node configuration */
  setNodes: (nodes: EmberNode[]) => void;

  // ── Reset ──
  /** Reset to initial AWAKENED state */
  reset: () => void;
}

export const useEmberStore = create<EmberStore>((set, get) => ({
  // Initial state
  state: 'AWAKENED',
  selectedNodeId: null,
  nodes: [],

  dispatch: (event: EmberEvent) => {
    const currentState = get().state;
    const nextState = emberTransition(currentState, event);

    if (nextState !== currentState) {
      // Log state transitions in development
      if (__DEV__) {
        console.log(
          `🔥 [Ember] ${currentState} ──(${event.type})──→ ${nextState}`
        );
      }

      set({ state: nextState });

      // Handle side effects of specific transitions
      if (event.type === 'SELECT' && 'nodeId' in event) {
        set({ selectedNodeId: event.nodeId });
      }

      if (event.type === 'COLLAPSE' || event.type === 'RELEASE') {
        set({ selectedNodeId: null });
      }

      if (event.type === 'NAVIGATE') {
        // Reset to AWAKENED for the new context
        set({ selectedNodeId: null });
      }
    }
  },

  selectNode: (nodeId: string) => {
    get().dispatch({ type: 'SELECT', nodeId });
  },

  clearSelection: () => {
    set({ selectedNodeId: null });
  },

  setNodes: (nodes: EmberNode[]) => {
    set({ nodes });
  },

  reset: () => {
    set({
      state: 'AWAKENED',
      selectedNodeId: null,
    });
  },
}));
