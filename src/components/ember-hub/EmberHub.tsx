import React, { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useRouter } from 'expo-router';

import { useEmberStore } from '@/store';
import { useEmberAnimation } from '@/hooks/useEmberAnimation';
import { EmberCanvas } from './EmberCanvas';
import { EmberNode } from './EmberNode';

export const EmberHub = () => {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const { state, nodes, selectedNodeId, dispatch } = useEmberStore();

  // Hub geometric configuration
  const cx = width / 2;
  const cy = height / 2 - 40; // Shifted up slightly to balance header/footer
  const orbitRadius = Math.min(width, height) * 0.32;

  // 1. Define animation callbacks
  const handleRevealComplete = () => {
    dispatch({ type: 'REVEAL_COMPLETE' });
  };

  const handleTransitionComplete = () => {
    dispatch({ type: 'TRANSITION_COMPLETE' });
  };

  // 2. Initialize our animation shared values
  const {
    pulseVal,
    revealVal,
    expandVal,
    selectVal,
    transitionVal,
  } = useEmberAnimation(state, selectedNodeId, {
    onRevealComplete: handleRevealComplete,
    onTransitionComplete: handleTransitionComplete,
  });

  // 3. Handle navigation side effects when transition completes
  useEffect(() => {
    if (state === 'READY_TO_EXPLORE' && selectedNodeId) {
      const selectedNode = nodes.find((n) => n.id === selectedNodeId);
      if (selectedNode && selectedNode.route) {
        // Navigate to the node's route
        router.push(selectedNode.route as any);
        // Reset state machine back to AWAKENED for the new context
        dispatch({ type: 'NAVIGATE', destination: selectedNode.route });
      } else {
        // Safe fallback collapse
        dispatch({ type: 'COLLAPSE' });
      }
    }
  }, [state, selectedNodeId, nodes, router, dispatch]);

  // 4. Gesture Handlers
  // Hold-to-reveal gesture on the center core
  const holdGesture = Gesture.Pan()
    .onBegin((e) => {
      // Check distance from center core (cx, cy)
      const dx = e.x - cx;
      const dy = e.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 50) {
        if (state === 'AWAKENED') {
          runOnJS(dispatch)({ type: 'HOLD' });
        }
      }
    })
    .onFinalize(() => {
      // If released while revealing, collapse back to AWAKENED
      if (state === 'REVEALING') {
        runOnJS(dispatch)({ type: 'RELEASE' });
      }
    });

  // Pinch-to-enter gesture when a node is selected (user pinches the center ember)
  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      if (state === 'SELECTED') {
        // Verify that the pinch is focused on the center ember
        const dx = e.focalX - cx;
        const dy = e.focalY - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 80) {
          // Pinch inward or outward beyond threshold triggers transition
          if (e.scale > 1.25 || e.scale < 0.75) {
            runOnJS(dispatch)({ type: 'PINCH' });
          }
        }
      }
    });

  // Tap-outside gesture to collapse when expanded or selected
  const backgroundTap = Gesture.Tap()
    .onEnd((e) => {
      // If tap is far away from the center and we are expanded/selected, collapse
      const dx = e.x - cx;
      const dy = e.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 80 && (state === 'EXPANDED' || state === 'SELECTED')) {
        runOnJS(dispatch)({ type: 'COLLAPSE' });
      }
    });

  // Combine gestures
  const gestures = Gesture.Simultaneous(
    Gesture.Race(holdGesture, backgroundTap),
    pinchGesture
  );

  return (
    <GestureDetector gesture={gestures}>
      <View style={StyleSheet.absoluteFill}>
        {/* ── Skia Canvas Layer ── */}
        <EmberCanvas
          state={state}
          nodes={nodes}
          selectedNodeId={selectedNodeId}
          pulseVal={pulseVal}
          revealVal={revealVal}
          selectVal={selectVal}
          transitionVal={transitionVal}
          cx={cx}
          cy={cy}
          orbitRadius={orbitRadius}
          closeRadius={64}
        />

        {/* ── Interactive React Native Overlay Nodes ── */}
        {nodes.map((node) => {
          const rad = ((node.offsetAngle - 90) * Math.PI) / 180;
          const nx = cx + orbitRadius * node.offsetRadius * Math.cos(rad);
          const ny = cy + orbitRadius * node.offsetRadius * Math.sin(rad);
          
          const closeRadius = 64; // Sits just outside the 36px core
          const closeX = cx + closeRadius * Math.cos(rad);
          const closeY = cy + closeRadius * Math.sin(rad);

          return (
            <EmberNode
              key={node.id}
              id={node.id}
              label={node.label}
              subtitle={node.subtitle}
              icon={node.icon}
              cx={cx}
              cy={cy}
              nx={nx}
              ny={ny}
              closeX={closeX}
              closeY={closeY}
              isSelected={selectedNodeId === node.id}
              hasSelection={selectedNodeId !== null}
              expandVal={expandVal}
              selectVal={selectVal}
              transitionVal={transitionVal}
              pulseVal={pulseVal}
              enabled={node.enabled}
              onPress={() => dispatch({ type: 'SELECT', nodeId: node.id })}
            />
          );
        })}
      </View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({});
