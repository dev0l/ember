import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  BackHandler,
  LayoutChangeEvent,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '@/theme';

import { StageMode, TerritoryStackState } from './types';
import { RAIL_HEIGHT } from './PlateRail';
import { PlateCover } from './PlateCover';
import CollectionsScreen from '@/app/(main)/collections';
import SparksScreen from '@/app/(main)/sparks';

const ANIM_DURATION = 550;
const ANIM_EASING = Easing.bezier(0.32, 0.04, 0.18, 1);

export function TerritoryStage() {
  const [mode, setMode] = useState<StageMode>('split');
  const [stageHeight, setStageHeight] = useState<number>(0);

  // Stacking state architecture — preserving per-territory lineages
  const [stackState, setStackState] = useState<TerritoryStackState>({
    activeTerritory: null,
    embersStack: [{ id: 'embers-root', title: 'Embers', role: 'COLLECTION', depth: 0 }],
    sparksStack: [{ id: 'sparks-root', title: 'Sparks', role: 'COLLECTION', depth: 0 }],
  });

  const openProgress = useSharedValue(0);

  const travel = stageHeight > 0 ? stageHeight / 2 - RAIL_HEIGHT : 0;

  // ── Mode Transitions ──
  const openEmbers = useCallback(() => {
    setMode('embers');
    setStackState((prev) => ({ ...prev, activeTerritory: 'embers' }));
    openProgress.value = withTiming(1, { duration: ANIM_DURATION, easing: ANIM_EASING });
  }, [openProgress]);

  const openSparks = useCallback(() => {
    setMode('sparks');
    setStackState((prev) => ({ ...prev, activeTerritory: 'sparks' }));
    openProgress.value = withTiming(1, { duration: ANIM_DURATION, easing: ANIM_EASING });
  }, [openProgress]);

  const returnToSplit = useCallback(() => {
    setMode('split');
    setStackState((prev) => ({ ...prev, activeTerritory: null }));
    openProgress.value = withTiming(0, { duration: ANIM_DURATION, easing: ANIM_EASING });
  }, [openProgress]);

  // ── Android Back Handler ──
  useEffect(() => {
    const onHardwareBack = () => {
      if (mode !== 'split') {
        returnToSplit();
        return true; // Event consumed; do not pop Expo Router stack
      }
      return false; // At split root, let OS handle back
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
    return () => subscription.remove();
  }, [mode, returnToSplit]);

  // ── Plate Tap Handlers ──
  const handleTopPlatePress = useCallback(() => {
    if (mode === 'split') {
      openEmbers();
    } else if (mode === 'embers') {
      returnToSplit();
    } else if (mode === 'sparks') {
      openEmbers();
    }
  }, [mode, openEmbers, returnToSplit]);

  const handleBottomPlatePress = useCallback(() => {
    if (mode === 'split') {
      openSparks();
    } else if (mode === 'sparks') {
      returnToSplit();
    } else if (mode === 'embers') {
      openSparks();
    }
  }, [mode, openSparks, returnToSplit]);

  const onLayoutStage = useCallback((e: LayoutChangeEvent) => {
    const { height } = e.nativeEvent.layout;
    setStageHeight(height);
  }, []);

  // ── Animated Styles ──
  const topCoverAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -travel * openProgress.value }],
  }));

  const bottomCoverAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: travel * openProgress.value }],
  }));

  const seamAnimatedStyle = useAnimatedStyle(() => ({
    opacity: 1 - openProgress.value,
  }));

  const surfaceAnimatedStyle = useAnimatedStyle(() => ({
    opacity: openProgress.value,
  }));

  const halfHeight = stageHeight > 0 ? stageHeight / 2 : 280;

  // Dynamic roles based on territory and active mode
  const topRole =
    mode === 'split'
      ? 'OPEN ↓'
      : mode === 'embers'
      ? 'HERE ◆'
      : 'OPEN ↑';

  const bottomRole =
    mode === 'split'
      ? '↑ OPEN'
      : mode === 'sparks'
      ? 'HERE ◆'
      : 'OPEN ↓';

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Brand / Header Bar ── */}
      <View style={styles.headerBar}>
        <View style={styles.wordmarkGroup}>
          <Text style={styles.sparkGlyph}>⌁</Text>
          <Text style={styles.wordmark}>EMBER</Text>
        </View>

        <View style={styles.headerActions}>
          <Pressable
            style={[styles.headerButton, mode === 'split' && styles.headerButtonDisabled]}
            onPress={returnToSplit}
            disabled={mode === 'split'}
            hitSlop={8}
          >
            <Text style={[styles.headerButtonText, mode === 'split' && styles.disabledText]}>
              Back
            </Text>
          </Pressable>

          <Pressable
            style={[styles.headerButton, mode === 'split' && styles.headerButtonActive]}
            onPress={returnToSplit}
            hitSlop={8}
          >
            <Text style={[styles.headerButtonText, mode === 'split' && styles.activeButtonText]}>
              Split
            </Text>
          </Pressable>
        </View>
      </View>

      {/* ── The Mechanical Stage ── */}
      <View style={styles.stage} onLayout={onLayoutStage}>
        {/* ── Revealed Interior Territory ── */}
        <Animated.View
          style={[styles.territory, surfaceAnimatedStyle]}
          pointerEvents={mode === 'split' ? 'none' : 'auto'}
        >
          {/* Embers Territory Surface */}
          <View style={[styles.surfaceContainer, mode !== 'embers' && styles.hidden]}>
            <CollectionsScreen hideHeader={true} />
          </View>

          {/* Sparks Territory Surface */}
          <View style={[styles.surfaceContainer, mode !== 'sparks' && styles.hidden]}>
            <SparksScreen hideHeader={true} />
          </View>
        </Animated.View>

        {/* ── Upper Cover Plate (Embers) ── */}
        <Animated.View
          style={[styles.coverWrapper, styles.topCoverWrapper, topCoverAnimatedStyle]}
          pointerEvents="auto"
        >
          <PlateCover
            position="top"
            title="Embers"
            etchTop="KEEP SOMETHING ALIVE"
            etchSub="01 / UPPER TERRITORY"
            role={topRole}
            height={halfHeight}
            onPress={handleTopPlatePress}
          />
        </Animated.View>

        {/* ── Lower Cover Plate (Sparks) ── */}
        <Animated.View
          style={[styles.coverWrapper, styles.bottomCoverWrapper, bottomCoverAnimatedStyle]}
          pointerEvents="auto"
        >
          <PlateCover
            position="bottom"
            title="Sparks"
            etchTop="CATCH WHAT CATCHES YOU"
            etchSub="02 / LOWER TERRITORY"
            role={bottomRole}
            height={halfHeight}
            onPress={handleBottomPlatePress}
          />
        </Animated.View>

        {/* ── Center Seam Horizon Line ── */}
        <Animated.View
          style={[styles.seam, { top: halfHeight - 1 }, seamAnimatedStyle]}
          pointerEvents="none"
        />
      </View>

      {/* ── Footer Territory Status Hint ── */}
      <View style={styles.footer}>
        <Text style={styles.hintText}>
          {mode === 'split'
            ? 'Draw the plates apart. Their edges stay.'
            : mode === 'embers'
            ? 'Embers open. Sparks held at the lower edge.'
            : 'Sparks open. Embers held at the upper edge.'}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.deepCharcoal,
  },
  headerBar: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 107, 43, 0.08)',
  },
  wordmarkGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sparkGlyph: {
    color: COLORS.emberOrange,
    fontSize: 16,
    fontWeight: '700',
  },
  wordmark: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary,
    letterSpacing: 3,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  headerButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  headerButtonActive: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.emberOrange,
  },
  headerButtonDisabled: {
    opacity: 0.35,
  },
  headerButtonText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
  },
  disabledText: {
    color: '#665E54',
  },
  activeButtonText: {
    color: COLORS.emberOrange,
    fontWeight: '600',
  },
  stage: {
    flex: 1,
    marginHorizontal: 10,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#4A3727',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#12110E',
    position: 'relative',
  },
  territory: {
    ...StyleSheet.absoluteFill,
    top: RAIL_HEIGHT,
    bottom: RAIL_HEIGHT,
    backgroundColor: '#141410',
  },
  surfaceContainer: {
    ...StyleSheet.absoluteFill,
  },
  hidden: {
    display: 'none',
  },
  coverWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    width: '100%',
    zIndex: 20,
  },
  topCoverWrapper: {
    top: 0,
  },
  bottomCoverWrapper: {
    bottom: 0,
  },
  seam: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#FF6B2B',
    shadowColor: '#FF6B2B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 25,
  },
  footer: {
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  hintText: {
    fontSize: 10,
    color: '#8A7A68',
    fontStyle: 'italic',
    letterSpacing: 0.5,
  },
});
