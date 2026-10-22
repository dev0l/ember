import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  BackHandler,
  LayoutChangeEvent,
  Alert,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { COLORS, TYPOGRAPHY } from '@/theme';

import { StageMode, TerritoryStackState, EmberPlateData } from './types';
import { PlateRail, RAIL_HEIGHT } from './PlateRail';
import { PlateCover } from './PlateCover';
import CollectionsScreen from '@/app/(main)/collections';
import SparksScreen from '@/app/(main)/sparks';
import CreateEmberScreen from '@/app/(main)/create';
import EmberViewScreen from '@/app/(main)/ember/[id]';
import EditEmberScreen from '@/app/(main)/ember/edit/[id]';
import EmberSessionScreen from '@/app/(main)/ember-session/[id]';
import { QuickCaptureModal } from '@/components/sparks/QuickCaptureModal';
import { loadEmber, saveEmber } from '@/services/ember-storage';
import { listSparks, associateSparksWithEmber } from '@/services/spark-storage';
import { createEmberSeed, type EmberSeed } from '@/core';
import type { Spark } from '@/core/spark-types';

const ANIM_DURATION = 550;
const ANIM_EASING = Easing.bezier(0.32, 0.04, 0.18, 1);

export function TerritoryStage() {
  const params = useLocalSearchParams<{ openEmberId?: string }>();
  const [mode, setMode] = useState<StageMode>('split');
  const [stageHeight, setStageHeight] = useState<number>(0);

  // In-stage Create / Edit surface states and dirty guards
  const [isCreatingEmber, setIsCreatingEmber] = useState(false);
  const [isCreateDirty, setIsCreateDirty] = useState(false);
  const [isEditingEmber, setIsEditingEmber] = useState(false);
  const [isEditDirty, setIsEditDirty] = useState(false);

  // Quick Capture modal state & cross-surface Spark refresh counter
  const [showQuickCapture, setShowQuickCapture] = useState(false);
  const [sparksRefreshTrigger, setSparksRefreshTrigger] = useState(0);
  const [lingeringSparkCount, setLingeringSparkCount] = useState(0);
  const [externalStagedSpark, setExternalStagedSpark] = useState<Spark | null>(null);

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

  // Keep lingering spark count synchronized for the lower cover plate etching
  const refreshSparksMetadata = useCallback(() => {
    try {
      const lingering = listSparks('lingering');
      setLingeringSparkCount(lingering.length);
    } catch {
      // Ignore pre-init fallback
    }
  }, []);

  useEffect(() => {
    refreshSparksMetadata();
  }, [refreshSparksMetadata, sparksRefreshTrigger, mode]);

  const notifySparksChanged = useCallback(() => {
    setSparksRefreshTrigger((n) => n + 1);
  }, []);

  // ── Guard Unsaved Create / Edit Work ──
  const guardUnsavedWork = useCallback(
    (onProceed: () => void) => {
      if (mode === 'embers' && stackState.embersFocus === 'collection' && isCreatingEmber) {
        if (isCreateDirty) {
          Alert.alert(
            'Discard Unsaved Ember?',
            'You have unsaved thoughts in this new Ember. Discard them and leave? (Any Sparks you caught will remain safely in Lingering Sparks.)',
            [
              { text: 'Keep Editing', style: 'cancel' },
              {
                text: 'Discard',
                style: 'destructive',
                onPress: () => {
                  setIsCreatingEmber(false);
                  setIsCreateDirty(false);
                  setExternalStagedSpark(null);
                  onProceed();
                },
              },
            ],
          );
          return;
        }
        setIsCreatingEmber(false);
        setIsCreateDirty(false);
        setExternalStagedSpark(null);
      }

      if (mode === 'embers' && stackState.embersFocus === 'ember' && isEditingEmber) {
        if (isEditDirty) {
          Alert.alert(
            'Discard Unsaved Changes?',
            'You have unsaved edits to this Ember. Discard your changes and leave?',
            [
              { text: 'Keep Editing', style: 'cancel' },
              {
                text: 'Discard',
                style: 'destructive',
                onPress: () => {
                  setIsEditingEmber(false);
                  setIsEditDirty(false);
                  onProceed();
                },
              },
            ],
          );
          return;
        }
        setIsEditingEmber(false);
        setIsEditDirty(false);
      }

      onProceed();
    },
    [mode, stackState.embersFocus, isCreatingEmber, isCreateDirty, isEditingEmber, isEditDirty],
  );

  // ── Mode Transitions (Shared values written outside setState updaters to avoid render-phase writes) ──
  const openEmbers = useCallback(() => {
    const targetFocus = stackState.selectedEmber ? stackState.lastEmbersFocus : 'collection';
    const targetR1 =
      stackState.selectedEmber && (targetFocus === 'ember' || targetFocus === 'developing') ? 1 : 0;
    const targetR2 =
      stackState.selectedEmber && stackState.activeSession && targetFocus === 'developing' ? 1 : 0;

    setMode('embers');
    setStackState((prev) => ({
      ...prev,
      activeTerritory: 'embers',
      embersFocus: prev.selectedEmber ? prev.lastEmbersFocus : 'collection',
    }));

    openProgress.value = withTiming(1, { duration: ANIM_DURATION, easing: ANIM_EASING });
    rail1Progress.value = withTiming(targetR1, { duration: ANIM_DURATION, easing: ANIM_EASING });
    rail2Progress.value = withTiming(targetR2, { duration: ANIM_DURATION, easing: ANIM_EASING });
  }, [
    stackState.selectedEmber,
    stackState.lastEmbersFocus,
    stackState.activeSession,
    openProgress,
    rail1Progress,
    rail2Progress,
  ]);

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
      const resolvedSeed = seed ?? loadEmber(id) ?? undefined;
      const emberData: EmberPlateData = {
        id,
        title: resolvedSeed?.name || 'Untitled Ember',
        nature: resolvedSeed?.nature,
      };
      setIsCreatingEmber(false);
      setIsCreateDirty(false);
      setExternalStagedSpark(null);
      setIsEditingEmber(false);
      setIsEditDirty(false);
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

  // Open an Ember directly in the Embers plate stack from Sparks (Spark New Ember / Participate in Ember / Quick Capture)
  const handleOpenEmberFromSparks = useCallback(
    (id: string, seed?: EmberSeed) => {
      const resolvedSeed = seed ?? loadEmber(id) ?? undefined;
      const emberData: EmberPlateData = {
        id,
        title: resolvedSeed?.name || 'Untitled Ember',
        nature: resolvedSeed?.nature,
      };
      setIsCreatingEmber(false);
      setIsCreateDirty(false);
      setExternalStagedSpark(null);
      setIsEditingEmber(false);
      setIsEditDirty(false);
      setMode('embers');
      setStackState((prev) => ({
        ...prev,
        activeTerritory: 'embers',
        selectedEmber: emberData,
        activeSession: prev.selectedEmber?.id === id ? prev.activeSession : null,
        embersFocus: 'ember',
        lastEmbersFocus: 'ember',
      }));
      openProgress.value = withTiming(1, { duration: ANIM_DURATION, easing: ANIM_EASING });
      rail1Progress.value = withTiming(1, { duration: ANIM_DURATION, easing: ANIM_EASING });
      rail2Progress.value = withTiming(0, { duration: ANIM_DURATION, easing: ANIM_EASING });
    },
    [openProgress, rail1Progress, rail2Progress],
  );

  useEffect(() => {
    if (params.openEmberId) {
      handleOpenEmberFromSparks(params.openEmberId);
    }
  }, [params.openEmberId, handleOpenEmberFromSparks]);

  // ── Quick Capture Handlers ("Visible across app, accessible outside Inquiry") ──
  const isInActiveInquiry = mode === 'embers' && stackState.embersFocus === 'developing';
  const isCreatingInStage =
    mode === 'embers' && stackState.embersFocus === 'collection' && isCreatingEmber;

  const handleOpenQuickCapture = useCallback(() => {
    if (isInActiveInquiry) {
      Alert.alert(
        'Inquiry in Progress',
        'Quick Capture is paused while you are inside an active Inquiry session so your focus stays undisturbed. Step back to the Ember rail or Split when you want to catch a new Spark.',
        [{ text: 'Got it' }],
      );
      return;
    }
    setShowQuickCapture(true);
  }, [isInActiveInquiry]);

  const handleQuickCaptureSaved = useCallback(
    (spark: Spark) => {
      notifySparksChanged();
      if (isCreatingInStage) {
        setExternalStagedSpark(spark);
      }
    },
    [notifySparksChanged, isCreatingInStage],
  );

  const handleCarrySparkIntoNewEmber = useCallback(
    (spark: Spark) => {
      const seed = createEmberSeed('open', {
        name: spark.title,
      });
      saveEmber(seed);
      associateSparksWithEmber([spark.id], seed.id);
      notifySparksChanged();
      handleOpenEmberFromSparks(seed.id, seed);
    },
    [notifySparksChanged, handleOpenEmberFromSparks],
  );

  const handleOpenSparksFromQuickCapture = useCallback(() => {
    guardUnsavedWork(openSparks);
  }, [guardUnsavedWork, openSparks]);

  // ── In-Stage Create & Edit Handlers ──
  const handleStartCreateEmber = useCallback(() => {
    setIsCreatingEmber(true);
    setIsCreateDirty(false);
    setExternalStagedSpark(null);
  }, []);

  const handleRequestCancelCreate = useCallback(() => {
    guardUnsavedWork(() => {});
  }, [guardUnsavedWork]);

  const handleEmberCreated = useCallback(
    (seed: EmberSeed) => {
      setIsCreatingEmber(false);
      setIsCreateDirty(false);
      setExternalStagedSpark(null);
      notifySparksChanged();
      handleSelectEmber(seed.id, seed);
    },
    [notifySparksChanged, handleSelectEmber],
  );

  const handleStartEditEmber = useCallback(() => {
    setIsEditingEmber(true);
    setIsEditDirty(false);
  }, []);

  const handleRequestCancelEdit = useCallback(() => {
    guardUnsavedWork(() => {});
  }, [guardUnsavedWork]);

  const handleEmberSaved = useCallback((updated: EmberSeed) => {
    setIsEditingEmber(false);
    setIsEditDirty(false);
    setStackState((prev) => ({
      ...prev,
      selectedEmber: prev.selectedEmber
        ? {
            ...prev.selectedEmber,
            title: updated.name || 'Untitled Ember',
            nature: updated.nature,
          }
        : null,
    }));
  }, []);

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
    setIsEditingEmber(false);
    setIsEditDirty(false);
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
    setIsCreatingEmber(false);
    setIsCreateDirty(false);
    setExternalStagedSpark(null);
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
    setIsCreatingEmber(false);
    setIsCreateDirty(false);
    setExternalStagedSpark(null);
    setIsEditingEmber(false);
    setIsEditDirty(false);
    setStackState((prev) => ({
      ...prev,
      embersFocus: 'developing',
      lastEmbersFocus: 'developing',
    }));
    rail1Progress.value = withTiming(1, { duration: ANIM_DURATION, easing: ANIM_EASING });
    rail2Progress.value = withTiming(1, { duration: ANIM_DURATION, easing: ANIM_EASING });
  }, [stackState.activeSession, rail1Progress, rail2Progress]);

  const dismissEmber = useCallback(() => {
    setIsCreatingEmber(false);
    setIsCreateDirty(false);
    setExternalStagedSpark(null);
    setIsEditingEmber(false);
    setIsEditDirty(false);
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
        if (stackState.embersFocus === 'collection' && isCreatingEmber) {
          handleRequestCancelCreate();
          return true;
        }
        if (stackState.selectedEmber) {
          if (stackState.embersFocus === 'developing') {
            focusEmber();
            return true;
          }
          if (stackState.embersFocus === 'ember') {
            if (isEditingEmber) {
              handleRequestCancelEdit();
              return true;
            }
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
    isCreatingEmber,
    isEditingEmber,
    handleRequestCancelCreate,
    handleRequestCancelEdit,
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
      if (stackState.embersFocus === 'collection' && isCreatingEmber) {
        handleRequestCancelCreate();
      } else if (
        stackState.selectedEmber &&
        (stackState.embersFocus === 'ember' || stackState.embersFocus === 'developing')
      ) {
        guardUnsavedWork(focusCollection);
      } else {
        guardUnsavedWork(returnToSplit);
      }
    } else if (mode === 'sparks') {
      openEmbers();
    }
  }, [
    mode,
    stackState.selectedEmber,
    stackState.embersFocus,
    isCreatingEmber,
    handleRequestCancelCreate,
    guardUnsavedWork,
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
      guardUnsavedWork(openSparks);
    }
  }, [mode, guardUnsavedWork, openSparks, returnToSplit]);

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
    if (stackState.embersFocus === 'collection' && isCreatingEmber) {
      topRole = 'CREATE EMBER ◆';
    } else if (
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
      ? lingeringSparkCount > 0
        ? `${lingeringSparkCount} LINGERING · ↑ OPEN`
        : '↑ OPEN'
      : mode === 'sparks'
      ? 'HERE ◆'
      : 'OPEN ↓';

  // Dynamic status hint
  let footerHint = 'Draw the plates apart, or catch a spark directly below.';
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
    if (stackState.embersFocus === 'collection' && isCreatingEmber) {
      footerHint = 'Embers · Creating new Ember. Sparks held at the lower edge.';
    } else if (stackState.selectedEmber) {
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
        footerHint = isEditingEmber
          ? `${stackState.selectedEmber.title} · Editing Ember. Embers held above.`
          : stackState.activeSession
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
          {/* Stage-level Quick Capture Pill: Visible across app, accessible outside Inquiry */}
          <Pressable
            style={[
              styles.quickCaptureHeaderPill,
              isInActiveInquiry && styles.quickCaptureHeaderPillLocked,
            ]}
            onPress={handleOpenQuickCapture}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={
              isInActiveInquiry
                ? 'Quick Capture paused during Inquiry'
                : 'Quick Capture a Spark'
            }
          >
            <Text style={styles.quickCaptureHeaderGlyph}>⌁</Text>
            <Text style={styles.quickCaptureHeaderText}>+ Spark</Text>
          </Pressable>

          {mode === 'embers' && (stackState.selectedEmber || isCreatingEmber) && (
            <Pressable
              style={styles.headerButton}
              onPress={() => {
                if (stackState.embersFocus === 'collection' && isCreatingEmber) {
                  handleRequestCancelCreate();
                } else if (stackState.embersFocus === 'developing') {
                  focusEmber();
                } else if (stackState.embersFocus === 'ember') {
                  if (isEditingEmber) {
                    handleRequestCancelEdit();
                  } else {
                    focusCollection();
                  }
                } else {
                  dismissEmber();
                }
              }}
              hitSlop={8}
            >
              <Text style={styles.headerButtonText}>
                {stackState.embersFocus === 'collection' && isCreatingEmber
                  ? '← Embers'
                  : stackState.embersFocus === 'developing' && stackState.selectedEmber
                  ? `← ${stackState.selectedEmber.title}`
                  : stackState.embersFocus === 'ember' && stackState.selectedEmber
                  ? isEditingEmber
                    ? `← ${stackState.selectedEmber.title}`
                    : '← Embers'
                  : 'Deselect'}
              </Text>
            </Pressable>
          )}

          {mode !== 'split' && (
            <Pressable
              style={styles.headerButton}
              onPress={() => guardUnsavedWork(returnToSplit)}
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
              // Root view: full collections list or in-stage Create Ember
              isCreatingEmber ? (
                <CreateEmberScreen
                  hideHeader={true}
                  onCreated={handleEmberCreated}
                  onCancel={handleRequestCancelCreate}
                  onDirtyChange={setIsCreateDirty}
                  externalStagedSpark={externalStagedSpark}
                />
              ) : (
                <CollectionsScreen
                  hideHeader={true}
                  onSelectEmber={handleSelectEmber}
                  onCreateEmber={handleStartCreateEmber}
                  selectedEmberId={null}
                  isFocused={mode === 'embers'}
                  refreshTrigger={sparksRefreshTrigger}
                />
              )
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
                  {isCreatingEmber ? (
                    <CreateEmberScreen
                      hideHeader={true}
                      onCreated={handleEmberCreated}
                      onCancel={handleRequestCancelCreate}
                      onDirtyChange={setIsCreateDirty}
                      externalStagedSpark={externalStagedSpark}
                    />
                  ) : (
                    <CollectionsScreen
                      hideHeader={true}
                      onSelectEmber={handleSelectEmber}
                      onCreateEmber={handleStartCreateEmber}
                      selectedEmberId={stackState.selectedEmber.id}
                      isFocused={mode === 'embers' && stackState.embersFocus === 'collection'}
                      refreshTrigger={sparksRefreshTrigger}
                    />
                  )}
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
                        ? isEditingEmber
                          ? 'EDITING ◆'
                          : 'HERE ◆'
                        : stackState.embersFocus === 'developing'
                        ? 'EMBER ↑'
                        : 'OPEN ↓'
                    }
                    isActive={stackState.embersFocus === 'ember'}
                    position="middle"
                    onPress={() => {
                      if (stackState.embersFocus === 'ember') {
                        if (isEditingEmber) {
                          handleRequestCancelEdit();
                        } else {
                          focusCollection();
                        }
                      } else {
                        guardUnsavedWork(focusEmber);
                      }
                    }}
                  />
                </Animated.View>

                {/* 3. Ember View / Edit Surface (expands between Rail 1 and Rail 2) */}
                <Animated.View
                  style={[
                    styles.emberSurfaceWrapper,
                    { height: availableSurfaceHeight },
                    emberSurfaceAnimatedStyle,
                  ]}
                  pointerEvents={stackState.embersFocus === 'ember' ? 'auto' : 'none'}
                >
                  {isEditingEmber ? (
                    <EditEmberScreen
                      emberId={stackState.selectedEmber.id}
                      hideHeader={true}
                      onSaved={handleEmberSaved}
                      onCancel={handleRequestCancelEdit}
                      onDirtyChange={setIsEditDirty}
                    />
                  ) : (
                    <EmberViewScreen
                      emberId={stackState.selectedEmber.id}
                      hideHeader={true}
                      onBack={focusCollection}
                      onEdit={handleStartEditEmber}
                      onRemoved={dismissEmber}
                      onOpenSession={handleOpenSession}
                      onCloseSession={handleCloseSession}
                      onSparksChanged={notifySparksChanged}
                      refreshTrigger={sparksRefreshTrigger}
                      isFocused={stackState.embersFocus === 'ember' && !isEditingEmber}
                    />
                  )}
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
                          guardUnsavedWork(focusDeveloping);
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
            <SparksScreen
              hideHeader={true}
              isFocused={mode === 'sparks'}
              refreshTrigger={sparksRefreshTrigger}
              onSparksChanged={notifySparksChanged}
              onOpenEmber={handleOpenEmberFromSparks}
            />
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
            onQuickCapture={mode === 'split' ? handleOpenQuickCapture : undefined}
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

      {/* ── Stage-Level Quick Capture Modal ── */}
      <QuickCaptureModal
        visible={showQuickCapture}
        contextMode={isCreatingInStage ? 'attach' : 'standalone'}
        targetEmberLabel={isCreatingInStage ? 'New Ember' : undefined}
        onClose={() => setShowQuickCapture(false)}
        onCaptured={handleQuickCaptureSaved}
        onCarryIntoNewEmber={handleCarrySparkIntoNewEmber}
        onOpenSparksTerritory={
          mode !== 'sparks' ? handleOpenSparksFromQuickCapture : undefined
        }
      />
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
    gap: 10,
  },
  quickCaptureHeaderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.35)',
    backgroundColor: 'rgba(255, 107, 43, 0.08)',
  },
  quickCaptureHeaderPillLocked: {
    opacity: 0.35,
    borderColor: '#4A3727',
    backgroundColor: 'transparent',
  },
  quickCaptureHeaderGlyph: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.emberOrange,
  },
  quickCaptureHeaderText: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: '#F5ECE0',
    letterSpacing: 0.6,
  },
  headerButton: {
    paddingVertical: 6,
    paddingHorizontal: 6,
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
