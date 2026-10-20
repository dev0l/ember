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
import { COLORS, TYPOGRAPHY } from '@/theme';

import { StageMode, TerritoryStackState, EmberPlateData, DevelopingPlateData } from './types';
import { PlateRail, RAIL_HEIGHT } from './PlateRail';
import { PlateCover } from './PlateCover';
import CollectionsScreen from '@/app/(main)/collections';
import SparksScreen from '@/app/(main)/sparks';
import EmberViewScreen from '@/app/(main)/ember/[id]';
import EmberSessionScreen from '@/app/(main)/ember-session/[id]';
import type { EmberSeed } from '@/core';

const ANIM_DURATION = 550;
const ANIM_EASING = Easing.bezier(0.32, 0.04, 0.18, 1);

export function TerritoryStage() {
  const [mode, setMode] = useState<StageMode>('split');
  const [stageHeight, setStageHeight] = useState<number>(0);

  // Stacking state architecture — preserving per-territory lineages
  // Law I: Plate order represents lineage, not focus. Focus changes expansion, not order.
  // Law II: Switching between territories collapses the inactive territory as a unit and restores its stack on return.
  const [stackState, setStackState] = useState<TerritoryStackState>({
    activeTerritory: null,
    embersFocus: 'collection',
    selectedEmber: null,
    activeSession: null,
    lastEmbersFocus: 'collection',
  });

  const openProgress = useSharedValue(0);
  const rail1Progress = useSharedValue(0); // 0 = rail 1 down (collection expanded), 1 = rail 1 up (ember/developing expanded)
  const rail2Progress = useSharedValue(0); // 0 = rail 2 down (collection/ember expanded), 1 = rail 2 up (developing expanded)

  const travel = stageHeight > 0 ? stageHeight / 2 - RAIL_HEIGHT : 0;
  const interiorHeight = Math.max(0, stageHeight - 2 * RAIL_HEIGHT);
  const hasSession = stackState.activeSession !== null;
  const numInteriorRails = hasSession ? 2 : 1;
  const availableSurfaceHeight = Math.max(0, interiorHeight - numInteriorRails * RAIL_HEIGHT);

  // ── Mode Transitions ──
  const openEmbers = useCallback(() => {
    setMode('embers');
    setStackState((prev) => {
      const targetFocus = prev.lastEmbersFocus;
      const targetR1 =
        prev.selectedEmber && (targetFocus === 'ember' || targetFocus === 'developing') ? 1 : 0;
      const targetR2 =
        prev.selectedEmber && prev.activeSession && targetFocus === 'developing' ? 1 : 0;
      rail1Progress.value = withTiming(targetR1, { duration: ANIM_DURATION, easing: ANIM_EASING });
      rail2Progress.value = withTiming(targetR2, { duration: ANIM_DURATION, easing: ANIM_EASING });
      return {
        ...prev,
        activeTerritory: 'embers',
        embersFocus: prev.selectedEmber ? targetFocus : 'collection',
      };
    });
    openProgress.value = withTiming(1, { duration: ANIM_DURATION, easing: ANIM_EASING });
  }, [openProgress, rail1Progress, rail2Progress]);

  const openSparks = useCallback(() => {
    setMode('sparks');
    setStackState((prev) => ({
      ...prev,
      activeTerritory: 'sparks',
      lastEmbersFocus: prev.embersFocus,
    }));
    openProgress.value = withTiming(1, { duration: ANIM_DURATION, easing: ANIM_EASING });
  }, [openProgress]);

  const returnToSplit = useCallback(() => {
    setMode('split');
    setStackState((prev) => ({
      ...prev,
      activeTerritory: null,
      lastEmbersFocus: prev.embersFocus,
    }));
    openProgress.value = withTiming(0, { duration: ANIM_DURATION, easing: ANIM_EASING });
  }, [openProgress]);

  // ── Lineage & Focus Actions ──
  const handleSelectEmber = useCallback(
    (id: string, seed?: EmberSeed) => {
      const emberData: EmberPlateData = {
        id,
        title: seed?.name || 'Untitled Ember',
        nature: seed?.nature,
      };
      setStackState((prev) => ({
        ...prev,
        selectedEmber: emberData,
        // If selecting a different ember, reset activeSession
        activeSession: prev.selectedEmber?.id === id ? prev.activeSession : null,
        embersFocus: 'ember',
        lastEmbersFocus: 'ember',
      }));
      rail1Progress.value = withTiming(1, { duration: ANIM_DURATION, easing: ANIM_EASING });
      rail2Progress.value = withTiming(0, { duration: ANIM_DURATION, easing: ANIM_EASING });
    },
    [rail1Progress, rail2Progress],
  );

  const handleOpenSession = useCallback(
    (inquiryId: string, movement: 'explore' | 'develop') => {
      setStackState((prev) => ({
        ...prev,
        activeSession: {
          inquiryId,
          movement,
          title: movement === 'explore' ? 'Exploring' : 'Developing',
        },
        embersFocus: 'developing',
        lastEmbersFocus: 'developing',
      }));
      rail1Progress.value = withTiming(1, { duration: ANIM_DURATION, easing: ANIM_EASING });
      rail2Progress.value = withTiming(1, { duration: ANIM_DURATION, easing: ANIM_EASING });
    },
    [rail1Progress, rail2Progress],
  );

  const handleSessionMovementChange = useCallback(
    (movement: 'explore' | 'develop') => {
      setStackState((prev) => {
        if (!prev.activeSession) return prev;
        return {
          ...prev,
          activeSession: {
            ...prev.activeSession,
            movement,
            title: movement === 'explore' ? 'Exploring' : 'Developing',
          },
        };
      });
    },
    [],
  );

  const handleSessionInvestigationChange = useCallback(
    (isInvestigating: boolean) => {
      setStackState((prev) => {
        if (!prev.activeSession) return prev;
        const nextTitle = isInvestigating
          ? 'Investigating'
          : prev.activeSession.movement === 'explore'
          ? 'Exploring'
          : 'Developing';
        if (prev.activeSession.title === nextTitle) return prev;
        return {
          ...prev,
          activeSession: {
            ...prev.activeSession,
            title: nextTitle,
          },
        };
      });
    },
    [],
  );

  const handleCloseSession = useCallback(() => {
    rail1Progress.value = withTiming(1, { duration: ANIM_DURATION, easing: ANIM_EASING });
    rail2Progress.value = withTiming(0, { duration: ANIM_DURATION, easing: ANIM_EASING });
    setStackState((prev) => ({
      ...prev,
      activeSession: null,
      embersFocus: prev.selectedEmber ? 'ember' : 'collection',
      lastEmbersFocus: prev.selectedEmber ? 'ember' : 'collection',
    }));
  }, [rail1Progress, rail2Progress]);

  const focusCollection = useCallback(() => {
    setStackState((prev) => ({
      ...prev,
      embersFocus: 'collection',
      lastEmbersFocus: 'collection',
    }));
    rail1Progress.value = withTiming(0, { duration: ANIM_DURATION, easing: ANIM_EASING });
    rail2Progress.value = withTiming(0, { duration: ANIM_DURATION, easing: ANIM_EASING });
  }, [rail1Progress, rail2Progress]);

  const focusEmber = useCallback(() => {
    if (!stackState.selectedEmber) return;
    setStackState((prev) => ({
      ...prev,
      embersFocus: 'ember',
      lastEmbersFocus: 'ember',
    }));
    rail1Progress.value = withTiming(1, { duration: ANIM_DURATION, easing: ANIM_EASING });
    rail2Progress.value = withTiming(0, { duration: ANIM_DURATION, easing: ANIM_EASING });
  }, [stackState.selectedEmber, rail1Progress, rail2Progress]);

  const focusDeveloping = useCallback(() => {
    if (!stackState.activeSession) return;
    setStackState((prev) => ({
      ...prev,
      embersFocus: 'developing',
      lastEmbersFocus: 'developing',
    }));
    rail1Progress.value = withTiming(1, { duration: ANIM_DURATION, easing: ANIM_EASING });
    rail2Progress.value = withTiming(1, { duration: ANIM_DURATION, easing: ANIM_EASING });
  }, [stackState.activeSession, rail1Progress, rail2Progress]);

  const dismissEmber = useCallback(() => {
    rail1Progress.value = withTiming(0, { duration: ANIM_DURATION, easing: ANIM_EASING });
    rail2Progress.value = withTiming(0, { duration: ANIM_DURATION, easing: ANIM_EASING });
    setStackState((prev) => ({
      ...prev,
      selectedEmber: null,
      activeSession: null,
      embersFocus: 'collection',
      lastEmbersFocus: 'collection',
    }));
  }, [rail1Progress, rail2Progress]);

  // ── Android Back Handler ──
  useEffect(() => {
    const onHardwareBack = () => {
      if (mode === 'split') {
        return false;
      }
      if (mode === 'sparks') {
        returnToSplit();
        return true;
      }
      if (mode === 'embers') {
        if (stackState.selectedEmber) {
          if (stackState.embersFocus === 'developing') {
            focusEmber();
            return true;
          }
          if (stackState.embersFocus === 'ember') {
            focusCollection();
            return true;
          }
          if (stackState.embersFocus === 'collection') {
            dismissEmber();
            return true;
          }
        }
        returnToSplit();
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
    return () => subscription.remove();
  }, [
    mode,
    stackState.selectedEmber,
    stackState.embersFocus,
    focusDeveloping,
    focusEmber,
    focusCollection,
    dismissEmber,
    returnToSplit,
  ]);

  // ── Plate Tap Handlers ──
  const handleTopPlatePress = useCallback(() => {
    if (mode === 'split') {
      openEmbers();
    } else if (mode === 'embers') {
      if (
        stackState.selectedEmber &&
        (stackState.embersFocus === 'ember' || stackState.embersFocus === 'developing')
      ) {
        focusCollection();
      } else {
        returnToSplit();
      }
    } else if (mode === 'sparks') {
      openEmbers();
    }
  }, [
    mode,
    stackState.selectedEmber,
    stackState.embersFocus,
    openEmbers,
    focusCollection,
    returnToSplit,
  ]);

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

  const emberRailAnimatedStyle = useAnimatedStyle(() => {
    const topOffset = availableSurfaceHeight * (1 - rail1Progress.value);
    return {
      transform: [{ translateY: topOffset }],
    };
  });

  const developingRailAnimatedStyle = useAnimatedStyle(() => {
    const topOffset =
      availableSurfaceHeight + RAIL_HEIGHT - availableSurfaceHeight * rail2Progress.value;
    return {
      transform: [{ translateY: topOffset }],
    };
  });

  const collectionsSurfaceAnimatedStyle = useAnimatedStyle(() => ({
    opacity: 1 - rail1Progress.value,
  }));

  const emberSurfaceAnimatedStyle = useAnimatedStyle(() => ({
    opacity: rail1Progress.value * (1 - rail2Progress.value),
  }));

  const developingSurfaceAnimatedStyle = useAnimatedStyle(() => ({
    opacity: rail2Progress.value,
  }));

  const halfHeight = stageHeight > 0 ? stageHeight / 2 : 280;

  // Dynamic roles based on territory and active mode
  let topRole = 'OPEN ↓';
  if (mode === 'split') {
    topRole = 'OPEN ↓';
  } else if (mode === 'embers') {
    if (
      stackState.selectedEmber &&
      (stackState.embersFocus === 'ember' || stackState.embersFocus === 'developing')
    ) {
      topRole = 'COLLECTION ↑';
    } else {
      topRole = 'HERE ◆';
    }
  } else if (mode === 'sparks') {
    if (stackState.activeSession && stackState.lastEmbersFocus === 'developing') {
      const sessionTitle =
        stackState.activeSession.title ||
        (stackState.activeSession.movement === 'explore' ? 'Exploring' : 'Developing');
      topRole = `• Embers | RETURN · ${sessionTitle.toUpperCase()}`;
    } else if (stackState.selectedEmber) {
      topRole = `RETURN · ${stackState.selectedEmber.title}`;
    } else {
      topRole = 'OPEN ↑';
    }
  }

  const bottomRole =
    mode === 'split'
      ? '↑ OPEN'
      : mode === 'sparks'
      ? 'HERE ◆'
      : 'OPEN ↓';

  // Dynamic status hint
  let footerHint = 'Draw the plates apart. Their edges stay.';
  if (mode === 'sparks') {
    if (stackState.activeSession && stackState.lastEmbersFocus === 'developing') {
      const sessionTitle =
        stackState.activeSession.title ||
        (stackState.activeSession.movement === 'explore' ? 'Exploring' : 'Developing');
      footerHint = `Sparks open. ${sessionTitle} session held in Embers lineage.`;
    } else if (stackState.selectedEmber) {
      footerHint = `Sparks open. Embers held with ${stackState.selectedEmber.title}.`;
    } else {
      footerHint = 'Sparks open. Embers held at the upper edge.';
    }
  } else if (mode === 'embers') {
    if (stackState.selectedEmber) {
      if (stackState.embersFocus === 'developing') {
        const activeSessionLabel =
          stackState.activeSession?.title === 'Investigating'
            ? 'Investigating'
            : stackState.activeSession?.movement === 'explore'
            ? 'Explore'
            : 'Develop';
        footerHint = `${stackState.selectedEmber.title} · ${activeSessionLabel} open. Embers held above.`;
      } else if (stackState.embersFocus === 'ember') {
        const heldSessionLabel =
          stackState.activeSession?.title ||
          (stackState.activeSession?.movement === 'explore' ? 'Exploring' : 'Developing');
        footerHint = stackState.activeSession
          ? `${stackState.selectedEmber.title} open. ${heldSessionLabel} held below.`
          : `${stackState.selectedEmber.title} open. Embers collection held above.`;
      } else {
        footerHint = `Embers collection open. ${stackState.selectedEmber.title} held below.`;
      }
    } else {
      footerHint = 'Embers open. Sparks held at the lower edge.';
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Brand / Header Bar ── */}
      <View style={styles.headerBar}>
        <View style={styles.wordmarkGroup}>
          <Text style={styles.sparkGlyph}>⌁</Text>
          <Text style={styles.wordmark}>EMBER</Text>
        </View>

        <View style={styles.headerActions}>
          {mode === 'embers' && stackState.selectedEmber && (
            <Pressable
              style={styles.headerButton}
              onPress={() => {
                if (stackState.embersFocus === 'developing') {
                  focusEmber();
                } else if (stackState.embersFocus === 'ember') {
                  focusCollection();
                } else {
                  dismissEmber();
                }
              }}
              hitSlop={8}
            >
              <Text style={styles.headerButtonText}>
                {stackState.embersFocus === 'developing'
                  ? `← ${stackState.selectedEmber.title}`
                  : stackState.embersFocus === 'ember'
                  ? '← Embers'
                  : 'Deselect'}
              </Text>
            </Pressable>
          )}

          {mode !== 'split' && (
            <Pressable
              style={styles.headerButton}
              onPress={returnToSplit}
              hitSlop={8}
            >
              <Text style={styles.splitButtonText}>Split</Text>
            </Pressable>
          )}

          {mode === 'split' && (
            <View style={styles.splitBadge}>
              <Text style={styles.splitBadgeText}>SPLIT</Text>
            </View>
          )}
        </View>
      </View>

      {/* ── The Mechanical Stage ── */}
      <View style={styles.stage} onLayout={onLayoutStage}>
        {/* ── Revealed Interior Territory ── */}
        <Animated.View
          style={[styles.territory, surfaceAnimatedStyle]}
          pointerEvents={mode === 'split' ? 'none' : 'auto'}
        >
          {/* ── Embers Territory Surface ── */}
          <View style={[styles.surfaceContainer, mode !== 'embers' && styles.hidden]}>
            {stackState.selectedEmber === null ? (
              // Root view: full collections list
              <CollectionsScreen
                hideHeader={true}
                onSelectEmber={handleSelectEmber}
                selectedEmberId={null}
              />
            ) : (
              // Stacked lineage: CollectionsScreen -> Ember View -> Developing Session
              <View style={styles.stackedTerritory}>
                {/* 1. Collections Surface (expands when focus is 'collection') */}
                <Animated.View
                  style={[
                    styles.collectionsSurfaceWrapper,
                    { height: availableSurfaceHeight },
                    collectionsSurfaceAnimatedStyle,
                  ]}
                  pointerEvents={stackState.embersFocus === 'collection' ? 'auto' : 'none'}
                >
                  <CollectionsScreen
                    hideHeader={true}
                    onSelectEmber={handleSelectEmber}
                    selectedEmberId={stackState.selectedEmber.id}
                  />
                </Animated.View>

                {/* 2. Ember Plate Rail (translates between y=0 and y=availableSurfaceHeight) */}
                <Animated.View
                  style={[
                    styles.emberRailWrapper,
                    emberRailAnimatedStyle,
                  ]}
                  pointerEvents="auto"
                >
                  <PlateRail
                    title={stackState.selectedEmber.title}
                    subtitle={
                      stackState.selectedEmber.nature
                        ? stackState.selectedEmber.nature.toUpperCase()
                        : undefined
                    }
                    role={
                      stackState.embersFocus === 'ember'
                        ? 'HERE ◆'
                        : stackState.embersFocus === 'developing'
                        ? 'EMBER ↑'
                        : 'OPEN ↓'
                    }
                    isActive={stackState.embersFocus === 'ember'}
                    position="middle"
                    onPress={() => {
                      if (stackState.embersFocus === 'ember') {
                        focusCollection();
                      } else {
                        focusEmber();
                      }
                    }}
                  />
                </Animated.View>

                {/* 3. Ember View Surface (expands between Rail 1 and Rail 2) */}
                <Animated.View
                  style={[
                    styles.emberSurfaceWrapper,
                    { height: availableSurfaceHeight },
                    emberSurfaceAnimatedStyle,
                  ]}
                  pointerEvents={stackState.embersFocus === 'ember' ? 'auto' : 'none'}
                >
                  <EmberViewScreen
                    emberId={stackState.selectedEmber.id}
                    hideHeader={true}
                    onBack={focusCollection}
                    onOpenSession={handleOpenSession}
                    onCloseSession={handleCloseSession}
                    isFocused={stackState.embersFocus === 'ember'}
                  />
                </Animated.View>

                {/* 4. Developing Plate Rail (if session active, translates between y=48 and y=availableSurfaceHeight + 48) */}
                {hasSession && stackState.activeSession && (
                  <Animated.View
                    style={[
                      styles.developingRailWrapper,
                      developingRailAnimatedStyle,
                    ]}
                    pointerEvents="auto"
                  >
                    <PlateRail
                      title={
                        stackState.activeSession.title ||
                        (stackState.activeSession.movement === 'explore'
                          ? 'Exploring'
                          : 'Developing')
                      }
                      subtitle={stackState.activeSession.movement.toUpperCase()}
                      role={stackState.embersFocus === 'developing' ? 'HERE ◆' : 'OPEN ↓'}
                      isActive={stackState.embersFocus === 'developing'}
                      position="middle"
                      onPress={() => {
                        if (stackState.embersFocus === 'developing') {
                          focusEmber();
                        } else {
                          focusDeveloping();
                        }
                      }}
                    />
                  </Animated.View>
                )}

                {/* 5. Developing Session Surface (expands beneath Rail 2) */}
                {hasSession && stackState.activeSession && (
                  <Animated.View
                    style={[
                      styles.developingSurfaceWrapper,
                      { height: availableSurfaceHeight },
                      developingSurfaceAnimatedStyle,
                    ]}
                    pointerEvents={stackState.embersFocus === 'developing' ? 'auto' : 'none'}
                  >
                    <EmberSessionScreen
                      inquiryId={stackState.activeSession.inquiryId}
                      initialMovement={stackState.activeSession.movement}
                      hideHeader={true}
                      onBack={focusEmber}
                      onMovementChange={handleSessionMovementChange}
                      onInvestigationStateChange={handleSessionInvestigationChange}
                      onCloseSession={handleCloseSession}
                    />
                  </Animated.View>
                )}
              </View>
            )}
          </View>

          {/* ── Sparks Territory Surface ── */}
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
        <Text style={styles.hintText}>{footerHint}</Text>
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
    gap: 12,
  },
  headerButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  headerButtonText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
  },
  splitButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.emberOrange,
    letterSpacing: 0.5,
  },
  splitBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.25)',
    backgroundColor: 'rgba(255, 107, 43, 0.05)',
  },
  splitBadgeText: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 9,
    color: COLORS.emberOrange,
    letterSpacing: 1.2,
    fontWeight: '700',
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
  stackedTerritory: {
    ...StyleSheet.absoluteFill,
    position: 'relative',
  },
  collectionsSurfaceWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  emberRailWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: RAIL_HEIGHT,
    zIndex: 15,
  },
  emberSurfaceWrapper: {
    position: 'absolute',
    top: RAIL_HEIGHT,
    left: 0,
    right: 0,
  },
  developingRailWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: RAIL_HEIGHT,
    zIndex: 16,
  },
  developingSurfaceWrapper: {
    position: 'absolute',
    top: 2 * RAIL_HEIGHT,
    left: 0,
    right: 0,
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
