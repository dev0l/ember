import { useEffect } from 'react';
import {
  useSharedValue,
  withTiming,
  withRepeat,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import type { EmberState } from '@/core/types';

interface EmberAnimationCallbacks {
  onRevealComplete: () => void;
  onTransitionComplete: () => void;
}

export function useEmberAnimation(
  state: EmberState,
  selectedNodeId: string | null,
  callbacks: EmberAnimationCallbacks
) {
  const pulseVal = useSharedValue(0);
  const revealVal = useSharedValue(0);
  const expandVal = useSharedValue(0);
  const selectVal = useSharedValue(0);
  const transitionVal = useSharedValue(0);

  // 1. Continuous breathing pulse for core
  useEffect(() => {
    pulseVal.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  // 2. React to state changes
  useEffect(() => {
    switch (state) {
      case 'AWAKENED':
        revealVal.value = withTiming(0, { duration: 400, easing: Easing.out(Easing.quad) });
        expandVal.value = withTiming(0, { duration: 400, easing: Easing.out(Easing.quad) });
        selectVal.value = withTiming(0, { duration: 350 });
        transitionVal.value = withTiming(0, { duration: 300 });
        break;

      case 'REVEALING':
        // Kept for backward compatibility
        break;

      case 'EXPANDED':
        // Animate paths and options expansion together
        revealVal.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.quad) });
        expandVal.value = withTiming(1, {
          duration: 650,
          easing: Easing.out(Easing.back(1.1)),
        });
        selectVal.value = withTiming(0, { duration: 350 });
        transitionVal.value = withTiming(0, { duration: 300 });
        break;

      case 'SELECTED':
        revealVal.value = withTiming(1, { duration: 200 });
        expandVal.value = withTiming(1, { duration: 200 });
        // Transition to selected node highlighting and satellite gathering
        selectVal.value = withTiming(1, {
          duration: 550,
          easing: Easing.out(Easing.quad),
        });
        transitionVal.value = withTiming(0, { duration: 300 });
        break;

      case 'TRANSITION':
        revealVal.value = withTiming(1, { duration: 200 });
        expandVal.value = withTiming(1, { duration: 200 });
        selectVal.value = withTiming(1, { duration: 200 });
        // Selected node fades while center core expands to fill the screen
        transitionVal.value = withTiming(
          1,
          { duration: 900, easing: Easing.inOut(Easing.quad) },
          (finished) => {
            if (finished) {
              runOnJS(callbacks.onTransitionComplete)();
            }
          }
        );
        break;

      case 'READY_TO_EXPLORE':
        break;
    }
  }, [state, callbacks]);

  return {
    pulseVal,
    revealVal,
    expandVal,
    selectVal,
    transitionVal,
  };
}
