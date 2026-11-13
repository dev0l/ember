import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { useLocalSearchParams } from 'expo-router';
import { COLORS, TYPOGRAPHY } from '@/theme';

import { StageMode, TerritoryStackState, EmberPlateData } from './types';
import { PlateRail, RAIL_HEIGHT } from './PlateRail';
import { PlateCover } from './PlateCover';
import type { PlateEmberFieldItem } from './PlateFieldCanvas';
import type { ConstellationStage } from './EmberConstellationGlyph';
import CollectionsScreen from '@/app/(main)/collections';
import SparksScreen from '@/app/(main)/sparks';
import CreateEmberScreen from '@/app/(main)/create';
import EmberViewScreen from '@/app/(main)/ember/[id]';
import EditEmberScreen from '@/app/(main)/ember/edit/[id]';
import EmberSessionScreen from '@/app/(main)/ember-session/[id]';
import DesignPackViewScreen from '@/app/(main)/design-pack/[id]';
import { QuickCaptureModal } from '@/components/sparks/QuickCaptureModal';
import { loadEmber, listEmbers } from '@/services/ember-storage';
import { listSparks } from '@/services/spark-storage';
import { listProjects } from '@/services/ember-project-storage';
import { loadInquiryEvidence } from '@/services/inquiry-storage';
import { evaluateInquiry } from '@/inquiry';
import type { EmberSeed } from '@/core';
import type { Spark } from '@/core/spark-types';

const ANIM_DURATION = 520;
const ANIM_EASING = Easing.bezier(0.32, 0.04, 0.18, 1);

interface PendingDiscardGuard {
  title: string;
  detail: string;
  onConfirm: () => void;
}

export function TerritoryStage() {
  const params = useLocalSearchParams<{ openEmberId?: string }>();
  const [mode, setMode] = useState<StageMode>('split');
  const [dragPreviewTerritory, setDragPreviewTerritory] = useState<'embers' | 'sparks' | null>(
    null,
  );
  const [stageHeight, setStageHeight] = useState<number>(0);

  // In-stage Create / Edit surface states and dirty guards
  const [isCreatingEmber, setIsCreatingEmber] = useState(false);
  const [isCreateDirty, setIsCreateDirty] = useState(false);
  const [isEditingEmber, setIsEditingEmber] = useState(false);
  const [isEditDirty, setIsEditDirty] = useState(false);
  const [pendingDiscardGuard, setPendingDiscardGuard] = useState<PendingDiscardGuard | null>(
    null,
  );

  // Quick Capture modal state & cross-surface Spark/Session refresh counters
  const [showQuickCapture, setShowQuickCapture] = useState(false);
  const [sparksRefreshTrigger, setSparksRefreshTrigger] = useState(0);
  const [sessionRefreshTrigger, setSessionRefreshTrigger] = useState(0);
  const [lingeringSparkCount, setLingeringSparkCount] = useState(0);
  const [emberSummaries, setEmberSummaries] = useState<PlateEmberFieldItem[]>([]);
  const [externalStagedSpark, setExternalStagedSpark] = useState<Spark | null>(null);
  const [initialCreateSparks, setInitialCreateSparks] = useState<Spark[]>([]);

  // Inner back handler registered by EmberSessionScreen (handles question/investigation sub-views before collapsing the session rail)
  const sessionBackHandlerRef = useRef<(() => boolean) | null>(null);
  const handleRegisterSessionBack = useCallback((fn: (() => boolean) | null) => {
    sessionBackHandlerRef.current = fn;
  }, []);

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

  // Keep lingering spark count and Ember constellation summaries synchronized for the Split cover plates
  const refreshStageFieldMetadata = useCallback(() => {
    try {
      const lingering = listSparks('lingering');
      setLingeringSparkCount(lingering.length);

      const seeds = listEmbers();
      const associated = listSparks('ember-associated');
      const projects = listProjects();

      const countByEmber: Record<string, number> = {};
      for (const s of associated) {
        if (s.emberId) {
          countByEmber[s.emberId] = (countByEmber[s.emberId] ?? 0) + 1;
        }
      }

      const projectByEmber: Record<string, (typeof projects)[number]> = {};
      for (const p of projects) {
        if (p.seedId) {
          projectByEmber[p.seedId] = p;
        }
      }

      const summaries: PlateEmberFieldItem[] = seeds.map((seed) => {
        const linked = projectByEmber[seed.id];
        let stage: ConstellationStage = 'seed';
        if (linked) {
          if (linked.designPackVersion > 0) {
            stage = 'pack';
          } else {
            const ev = loadInquiryEvidence(linked.id);
            const st = evaluateInquiry(ev);
            if (st.designPack.generationAvailable) {
              stage = 'warranted';
            } else if (st.designPack.chosen) {
              stage = 'developing';
            } else if (ev.answers.length > 0) {
              stage = 'exploring';
            }
          }
        }
        return {
          id: seed.id,
          title: seed.name || 'Untitled Ember',
          sparkCount: countByEmber[seed.id] ?? 0,
          stage,
        };
      });

      setEmberSummaries(summaries);
    } catch {
      // Ignore pre-init fallback
    }
  }, []);

  useEffect(() => {
    refreshStageFieldMetadata();
  }, [refreshStageFieldMetadata, sparksRefreshTrigger, sessionRefreshTrigger, mode]);

  const notifySparksChanged = useCallback(() => {
    setSparksRefreshTrigger((n) => n + 1);
  }, []);

  // ── Guard Unsaved Create / Edit Work via Inline Mechanical Confirmation ──
  const guardUnsavedWork = useCallback(
    (onProceed: () => void) => {
      if (mode === 'embers' && stackState.embersFocus === 'collection' && isCreatingEmber) {
        if (isCreateDirty) {
          setPendingDiscardGuard({
            title: 'Discard Unsaved Ember?',
            detail:
              'Any Sparks you caught remain safely in Lingering Sparks.',
            onConfirm: () => {
              setPendingDiscardGuard(null);
              setIsCreatingEmber(false);
              setIsCreateDirty(false);
              setExternalStagedSpark(null);
              setInitialCreateSparks([]);
              notifySparksChanged();
              onProceed();
            },
          });
          return;
        }
        setIsCreatingEmber(false);
        setIsCreateDirty(false);
        setExternalStagedSpark(null);
        setInitialCreateSparks([]);
        notifySparksChanged();
      }

      if (mode === 'embers' && stackState.embersFocus === 'ember' && isEditingEmber) {
        if (isEditDirty) {
          setPendingDiscardGuard({
            title: 'Discard Unsaved Edits?',
            detail: 'Your uncommitted changes to this Ember will be discarded.',
            onConfirm: () => {
              setPendingDiscardGuard(null);
              setIsEditingEmber(false);
              setIsEditDirty(false);
              onProceed();
            },
          });
          return;
        }
        setIsEditingEmber(false);
        setIsEditDirty(false);
      }

      setPendingDiscardGuard(null);
      onProceed();
    },
    [
      mode,
      stackState.embersFocus,
      isCreatingEmber,
      isCreateDirty,
      isEditingEmber,
      isEditDirty,
      notifySparksChanged,
    ],
  );

  // ── Mode Transitions (Shared values written outside setState updaters to avoid render-phase writes) ──
  const openEmbers = useCallback(() => {
    const targetFocus = stackState.selectedEmber ? stackState.lastEmbersFocus : 'collection';
    const targetR1 =
      stackState.selectedEmber && (targetFocus === 'ember' || targetFocus === 'developing') ? 1 : 0;
    const targetR2 =
      stackState.selectedEmber && stackState.activeSession && targetFocus === 'developing' ? 1 : 0;

    setDragPreviewTerritory(null);
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
    setDragPreviewTerritory(null);
    setMode('sparks');
    setStackState((prev) => ({
      ...prev,
      activeTerritory: 'sparks',
      lastEmbersFocus: prev.embersFocus,
    }));
    openProgress.value = withTiming(1, { duration: ANIM_DURATION, easing: ANIM_EASING });
  }, [openProgress]);

  const returnToSplit = useCallback(() => {
    setDragPreviewTerritory(null);
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
      setPendingDiscardGuard(null);
      setIsCreatingEmber(false);
      setIsCreateDirty(false);
      setExternalStagedSpark(null);
      setInitialCreateSparks([]);
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
      setPendingDiscardGuard(null);
      setIsCreatingEmber(false);
      setIsCreateDirty(false);
      setExternalStagedSpark(null);
      setInitialCreateSparks([]);
      setIsEditingEmber(false);
      setIsEditDirty(false);
      setDragPreviewTerritory(null);
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

  // Pre-stage multiple Sparks in CreateEmberScreen inside the Embers plate stack
  const handleCreateEmberWithSparks = useCallback(
    (sparksToStage: Spark[]) => {
      setPendingDiscardGuard(null);
      setInitialCreateSparks(sparksToStage);
      setExternalStagedSpark(null);
      setIsCreatingEmber(true);
      setIsCreateDirty(sparksToStage.length > 0);
      setIsEditingEmber(false);
      setIsEditDirty(false);
      setDragPreviewTerritory(null);
      setMode('embers');
      setStackState((prev) => ({
        ...prev,
        activeTerritory: 'embers',
        embersFocus: 'collection',
        lastEmbersFocus: 'collection',
      }));
      openProgress.value = withTiming(1, { duration: ANIM_DURATION, easing: ANIM_EASING });
      rail1Progress.value = withTiming(0, { duration: ANIM_DURATION, easing: ANIM_EASING });
      rail2Progress.value = withTiming(0, { duration: ANIM_DURATION, easing: ANIM_EASING });
    },
    [openProgress, rail1Progress, rail2Progress],
  );

  const handleQuickEditEmberFromCollection = useCallback(
    (id: string, seed?: EmberSeed) => {
      handleSelectEmber(id, seed);
      setIsEditingEmber(true);
      setIsEditDirty(false);
    },
    [handleSelectEmber],
  );

  useEffect(() => {
    if (params.openEmberId) {
      handleOpenEmberFromSparks(params.openEmberId);
    }
  }, [params.openEmberId, handleOpenEmberFromSparks]);

  // ── Quick Capture Handlers ──
  const isInActiveInquiry =
    mode === 'embers' &&
    stackState.embersFocus === 'developing' &&
    stackState.activeSession?.posture !== 'design-pack';
  const isCreatingInStage =
    mode === 'embers' && stackState.embersFocus === 'collection' && isCreatingEmber;

  const handleOpenQuickCapture = useCallback(() => {
    if (isInActiveInquiry) {
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

  // ── In-Stage Create & Edit Handlers ──
  const handleStartCreateEmber = useCallback(() => {
    setPendingDiscardGuard(null);
    setIsCreatingEmber(true);
    setIsCreateDirty(false);
    setExternalStagedSpark(null);
    setInitialCreateSparks([]);
  }, []);

  const handleRequestCancelCreate = useCallback(() => {
    guardUnsavedWork(() => {});
  }, [guardUnsavedWork]);

  const handleEmberCreated = useCallback(
    (seed: EmberSeed) => {
      setPendingDiscardGuard(null);
      setIsCreatingEmber(false);
      setIsCreateDirty(false);
      setExternalStagedSpark(null);
      setInitialCreateSparks([]);
      notifySparksChanged();
      handleSelectEmber(seed.id, seed);
    },
    [notifySparksChanged, handleSelectEmber],
  );

  const handleStartEditEmber = useCallback(() => {
    setPendingDiscardGuard(null);
    setIsEditingEmber(true);
    setIsEditDirty(false);
  }, []);

  const handleRequestCancelEdit = useCallback(() => {
    guardUnsavedWork(() => {});
  }, [guardUnsavedWork]);

  const handleEmberSaved = useCallback((updated: EmberSeed) => {
    setPendingDiscardGuard(null);
    setIsEditingEmber(false);
    setIsEditDirty(false);
    setSessionRefreshTrigger((n) => n + 1);
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
      setSessionRefreshTrigger((n) => n + 1);
      setStackState((prev) => {
        const preserveInvestigatingTitle =
          prev.activeSession &&
          prev.activeSession.inquiryId === inquiryId &&
          prev.activeSession.movement === movement &&
          prev.activeSession.posture === 'inquiry' &&
          prev.activeSession.title === 'Investigating';
        return {
          ...prev,
          activeSession: {
            inquiryId,
            movement,
            posture: 'inquiry',
            title: preserveInvestigatingTitle
              ? 'Investigating'
              : movement === 'explore'
              ? 'Exploring'
              : 'Developing',
          },
          embersFocus: 'developing',
          lastEmbersFocus: 'developing',
        };
      });
      rail1Progress.value = withTiming(1, { duration: ANIM_DURATION, easing: ANIM_EASING });
      rail2Progress.value = withTiming(1, { duration: ANIM_DURATION, easing: ANIM_EASING });
    },
    [rail1Progress, rail2Progress],
  );

  const handleOpenDesignPack = useCallback(
    (inquiryId: string) => {
      setSessionRefreshTrigger((n) => n + 1);
      setStackState((prev) => ({
        ...prev,
        activeSession: {
          inquiryId,
          movement: 'develop',
          posture: 'design-pack',
          title: 'Design Pack',
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
            posture: 'inquiry',
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
        if (!prev.activeSession || prev.activeSession.posture === 'design-pack') return prev;
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
    setPendingDiscardGuard(null);
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
    setPendingDiscardGuard(null);
    setIsCreatingEmber(false);
    setIsCreateDirty(false);
    setExternalStagedSpark(null);
    setInitialCreateSparks([]);
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
    setPendingDiscardGuard(null);
    setIsCreatingEmber(false);
    setIsCreateDirty(false);
    setExternalStagedSpark(null);
    setInitialCreateSparks([]);
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
    setPendingDiscardGuard(null);
    setIsCreatingEmber(false);
    setIsCreateDirty(false);
    setExternalStagedSpark(null);
    setInitialCreateSparks([]);
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
      if (pendingDiscardGuard) {
        setPendingDiscardGuard(null);
        return true;
      }
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
            if (
              stackState.activeSession?.posture !== 'design-pack' &&
              sessionBackHandlerRef.current?.()
            ) {
              return true;
            }
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
    pendingDiscardGuard,
    mode,
    stackState.selectedEmber,
    stackState.embersFocus,
    stackState.activeSession?.posture,
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

  // ── Plate Tap & Swipe Handlers ──
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
    opacity: Math.max(0, 1 - openProgress.value * 2.2),
    transform: [{ scaleY: 1 + (1 - Math.abs(openProgress.value * 2 - 1)) * 0.8 }],
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
    topRole = emberSummaries.length > 0 ? `${emberSummaries.length} · OPEN ↓` : 'OPEN ↓';
  } else if (mode === 'embers') {
    if (stackState.embersFocus === 'collection' && isCreatingEmber) {
      topRole = 'CREATE EMBER ◆';
    } else if (
      stackState.selectedEmber &&
      (stackState.embersFocus === 'ember' || stackState.embersFocus === 'developing')
    ) {
      topRole = 'COLLECTION ↑';
    } else {
      topRole = 'HERE ◆ · CLOSE ↓';
    }
  } else if (mode === 'sparks') {
    if (stackState.activeSession && stackState.lastEmbersFocus === 'developing') {
      const sessionTitle =
        stackState.activeSession.title ||
        (stackState.activeSession.movement === 'explore' ? 'Exploring' : 'Developing');
      topRole = `RETURN · ${sessionTitle.toUpperCase()}`;
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
      ? 'HERE ◆ · CLOSE ↑'
      : lingeringSparkCount > 0
      ? `${lingeringSparkCount} LINGERING · OPEN ↓`
      : 'OPEN ↓';

  // Dynamic status hint
  let footerHint = 'Draw the plates apart, or catch a spark directly below.';
  if (mode === 'sparks') {
    if (stackState.activeSession && stackState.lastEmbersFocus === 'developing') {
      if (stackState.activeSession.posture === 'design-pack') {
        footerHint = 'Sparks open · pull lower rail up to return to Horizon, or upper rail for Design Pack.';
      } else {
        const sessionTitle =
          stackState.activeSession.title ||
          (stackState.activeSession.movement === 'explore' ? 'Exploring' : 'Developing');
        footerHint = `Sparks open · ${sessionTitle} held in upper rail.`;
      }
    } else if (stackState.selectedEmber) {
      footerHint = `Sparks open · ${stackState.selectedEmber.title} held in upper rail.`;
    } else {
      footerHint = 'Sparks open · pull lower rail up to close, or upper rail for Embers.';
    }
  } else if (mode === 'embers') {
    if (stackState.embersFocus === 'collection' && isCreatingEmber) {
      footerHint = 'Embers · Shaping new Ember. Sparks held at the lower rail.';
    } else if (stackState.selectedEmber) {
      if (stackState.embersFocus === 'developing') {
        const activeSessionLabel =
          stackState.activeSession?.posture === 'design-pack'
            ? 'Design Pack'
            : stackState.activeSession?.title === 'Investigating'
            ? 'Investigating'
            : stackState.activeSession?.movement === 'explore'
            ? 'Explore'
            : 'Develop';
        footerHint = `${stackState.selectedEmber.title} · ${activeSessionLabel} open. Pull rail down to step back.`;
      } else if (stackState.embersFocus === 'ember') {
        const heldSessionLabel =
          stackState.activeSession?.posture === 'design-pack'
            ? 'Design Pack'
            : stackState.activeSession?.title ||
              (stackState.activeSession?.movement === 'explore' ? 'Exploring' : 'Developing');
        footerHint = isEditingEmber
          ? `${stackState.selectedEmber.title} · Editing Ember.`
          : stackState.activeSession
          ? `${stackState.selectedEmber.title} open · ${heldSessionLabel} held on lower rail.`
          : `${stackState.selectedEmber.title} open · Collection held on upper rail.`;
      } else {
        footerHint = `Embers collection open · ${stackState.selectedEmber.title} held on lower rail.`;
      }
    } else {
      footerHint = 'Embers open · pull upper rail down to close to Horizon.';
    }
  }

  const effectiveActiveTerritory =
    mode !== 'split' ? mode : dragPreviewTerritory ?? null;

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Instrument Bezel Bar (No redundant Split or duplicate Capture buttons) ── */}
      <View style={styles.headerBar}>
        <View style={styles.wordmarkGroup}>
          <Text style={styles.sparkGlyph}>⌁</Text>
          <Text style={styles.wordmark}>EMBER</Text>
        </View>

        <View style={styles.headerActions}>
          {/* When in Embers (and outside active Inquiry), provide global Quick Capture in bezel */}
          {mode === 'embers' && !isInActiveInquiry && (
            <Pressable
              style={styles.quickCaptureHeaderPill}
              onPress={handleOpenQuickCapture}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Quick Capture a Spark"
            >
              <Text style={styles.quickCaptureHeaderGlyph}>⌁</Text>
              <Text style={styles.quickCaptureHeaderText}>+ Spark</Text>
            </Pressable>
          )}

          {mode === 'embers' && isInActiveInquiry && (
            <View style={styles.bezelTelemetryPill}>
              <Text style={styles.bezelTelemetryDot}>◆</Text>
              <Text style={styles.bezelTelemetryText}>INQUIRY FOCUS</Text>
            </View>
          )}

          {mode === 'split' && (
            <View style={styles.bezelTelemetryPill}>
              <Text style={styles.bezelTelemetryDot}>✦</Text>
              <Text style={styles.bezelTelemetryText}>
                {emberSummaries.length} EMBER{emberSummaries.length === 1 ? '' : 'S'} ·{' '}
                {lingeringSparkCount} SPARK{lingeringSparkCount === 1 ? '' : 'S'}
              </Text>
            </View>
          )}

          {mode === 'sparks' && (
            <View style={styles.bezelTelemetryPill}>
              <Text style={styles.bezelTelemetryDot}>•</Text>
              <Text style={styles.bezelTelemetryText}>
                02 / SPARKS · {lingeringSparkCount} LINGERING
              </Text>
            </View>
          )}

          {mode === 'embers' &&
            stackState.embersFocus === 'collection' &&
            !isCreatingEmber &&
            stackState.selectedEmber && (
              <Pressable
                style={styles.headerButton}
                onPress={dismissEmber}
                hitSlop={8}
              >
                <Text
                  style={styles.headerButtonText}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  Clear Rail
                </Text>
              </Pressable>
            )}
        </View>
      </View>

      {/* ── Inline Mechanical Confirmation Bar for Unsaved Create / Edit Guards ── */}
      {pendingDiscardGuard && (
        <View style={styles.inlineGuardBar}>
          <View style={styles.inlineGuardTextCol}>
            <Text style={styles.inlineGuardTitle}>{pendingDiscardGuard.title}</Text>
            <Text style={styles.inlineGuardDetail} numberOfLines={2}>
              {pendingDiscardGuard.detail}
            </Text>
          </View>
          <View style={styles.inlineGuardActions}>
            <Pressable
              onPress={() => setPendingDiscardGuard(null)}
              style={styles.inlineGuardCancelBtn}
            >
              <Text style={styles.inlineGuardCancelText}>Keep Editing</Text>
            </Pressable>
            <Pressable
              onPress={pendingDiscardGuard.onConfirm}
              style={styles.inlineGuardConfirmBtn}
            >
              <Text style={styles.inlineGuardConfirmText}>Discard</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ── The Mechanical Stage ── */}
      <View style={styles.stage} onLayout={onLayoutStage}>
        {/* ── Revealed Interior Territory ── */}
        <Animated.View
          style={[styles.territory, surfaceAnimatedStyle]}
          pointerEvents={mode === 'split' ? 'none' : 'auto'}
        >
          {/* ── Embers Territory Surface ── */}
          <View
            style={[
              styles.surfaceContainer,
              effectiveActiveTerritory !== 'embers' && styles.hidden,
            ]}
          >
            {stackState.selectedEmber === null ||
            (stackState.embersFocus === 'collection' && isCreatingEmber) ? (
              // Root view: full collections list or full-height in-stage Create Ember
              isCreatingEmber ? (
                <CreateEmberScreen
                  hideHeader={true}
                  onCreated={handleEmberCreated}
                  onCancel={handleRequestCancelCreate}
                  onDirtyChange={setIsCreateDirty}
                  externalStagedSpark={externalStagedSpark}
                  initialStagedSparks={initialCreateSparks}
                />
              ) : (
                <CollectionsScreen
                  hideHeader={true}
                  onSelectEmber={handleSelectEmber}
                  onEditEmber={handleQuickEditEmberFromCollection}
                  onDeselectEmber={dismissEmber}
                  onEmbersChanged={notifySparksChanged}
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
                  <CollectionsScreen
                    hideHeader={true}
                    onSelectEmber={handleSelectEmber}
                    onEditEmber={handleQuickEditEmberFromCollection}
                    onDeselectEmber={dismissEmber}
                    onEmbersChanged={notifySparksChanged}
                    onCreateEmber={handleStartCreateEmber}
                    selectedEmberId={stackState.selectedEmber.id}
                    isFocused={mode === 'embers' && stackState.embersFocus === 'collection'}
                    refreshTrigger={sparksRefreshTrigger}
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
                      stackState.selectedEmber.nature &&
                      stackState.selectedEmber.nature !== 'open'
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
                    railProgress={rail1Progress}
                    travelDistance={availableSurfaceHeight}
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
                    onSwipeUp={() => {
                      if (stackState.embersFocus === 'collection') {
                        guardUnsavedWork(focusEmber);
                      } else if (stackState.embersFocus === 'ember') {
                        if (isEditingEmber) {
                          handleRequestCancelEdit();
                        } else {
                          focusCollection();
                        }
                      } else {
                        guardUnsavedWork(focusEmber);
                      }
                    }}
                    onSwipeDown={() => {
                      if (stackState.embersFocus === 'collection') {
                        dismissEmber();
                      } else if (stackState.embersFocus === 'ember') {
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
                      onOpenDesignPack={handleOpenDesignPack}
                      onCloseSession={handleCloseSession}
                      onSparksChanged={notifySparksChanged}
                      refreshTrigger={sparksRefreshTrigger + sessionRefreshTrigger}
                      isFocused={
                        mode === 'embers' &&
                        stackState.embersFocus === 'ember' &&
                        !isEditingEmber
                      }
                    />
                  )}
                </Animated.View>

                {/* 4. Developing / Design Pack Plate Rail (if session active, translates between y=48 and y=availableSurfaceHeight + 48) */}
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
                        (stackState.activeSession.posture === 'design-pack'
                          ? 'Design Pack'
                          : stackState.activeSession.movement === 'explore'
                          ? 'Exploring'
                          : 'Developing')
                      }
                      subtitle={
                        stackState.activeSession.posture === 'design-pack'
                          ? 'GENERATED'
                          : undefined
                      }
                      role={stackState.embersFocus === 'developing' ? 'HERE ◆' : 'OPEN ↓'}
                      isActive={stackState.embersFocus === 'developing'}
                      position="middle"
                      railProgress={rail2Progress}
                      travelDistance={availableSurfaceHeight}
                      onPress={() => {
                        if (stackState.embersFocus === 'developing') {
                          focusEmber();
                        } else {
                          guardUnsavedWork(focusDeveloping);
                        }
                      }}
                      onSwipeUp={() => {
                        if (stackState.embersFocus === 'developing') {
                          focusEmber();
                        } else {
                          guardUnsavedWork(focusDeveloping);
                        }
                      }}
                      onSwipeDown={() => {
                        if (stackState.embersFocus === 'developing') {
                          focusEmber();
                        } else {
                          handleCloseSession();
                        }
                      }}
                    />
                  </Animated.View>
                )}

                {/* 5. Developing Session / Design Pack Use Surface (expands beneath Rail 2) */}
                {hasSession && stackState.activeSession && (
                  <Animated.View
                    style={[
                      styles.developingSurfaceWrapper,
                      { height: availableSurfaceHeight },
                      developingSurfaceAnimatedStyle,
                    ]}
                    pointerEvents={stackState.embersFocus === 'developing' ? 'auto' : 'none'}
                  >
                    {stackState.activeSession.posture === 'design-pack' ? (
                      <DesignPackViewScreen
                        inquiryId={stackState.activeSession.inquiryId}
                        emberTitle={stackState.selectedEmber.title}
                        hideHeader={true}
                        isFocused={mode === 'embers' && stackState.embersFocus === 'developing'}
                        refreshTrigger={sparksRefreshTrigger + sessionRefreshTrigger}
                        onBack={focusEmber}
                      />
                    ) : (
                      <EmberSessionScreen
                        inquiryId={stackState.activeSession.inquiryId}
                        initialMovement={stackState.activeSession.movement}
                        hideHeader={true}
                        isFocused={mode === 'embers' && stackState.embersFocus === 'developing'}
                        refreshTrigger={sparksRefreshTrigger + sessionRefreshTrigger}
                        onBack={focusEmber}
                        onMovementChange={handleSessionMovementChange}
                        onInvestigationStateChange={handleSessionInvestigationChange}
                        onRegisterBackHandler={handleRegisterSessionBack}
                        onCloseSession={handleCloseSession}
                        onOpenDesignPack={handleOpenDesignPack}
                      />
                    )}
                  </Animated.View>
                )}
              </View>
            )}
          </View>

          {/* ── Sparks Territory Surface ── */}
          <View
            style={[
              styles.surfaceContainer,
              effectiveActiveTerritory !== 'sparks' && styles.hidden,
            ]}
          >
            <SparksScreen
              hideHeader={true}
              isFocused={mode === 'sparks'}
              refreshTrigger={sparksRefreshTrigger}
              onSparksChanged={notifySparksChanged}
              onOpenEmber={handleOpenEmberFromSparks}
              onCreateEmberWithSparks={handleCreateEmberWithSparks}
              onRequestQuickCapture={handleOpenQuickCapture}
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
            isSplit={mode === 'split'}
            openProgress={openProgress}
            travel={travel}
            emberSummaries={emberSummaries}
            onDragPreviewTerritory={setDragPreviewTerritory}
            onPress={handleTopPlatePress}
            onSwipeUp={handleTopPlatePress}
            onSwipeDown={() => {
              if (mode === 'split' || mode === 'sparks') {
                openEmbers();
              } else {
                handleTopPlatePress();
              }
            }}
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
            isSplit={mode === 'split'}
            openProgress={openProgress}
            travel={travel}
            lingeringCount={lingeringSparkCount}
            onDragPreviewTerritory={setDragPreviewTerritory}
            onPress={handleBottomPlatePress}
            onSwipeUp={handleBottomPlatePress}
            onSwipeDown={handleBottomPlatePress}
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
        <Text style={styles.hintText} numberOfLines={1} ellipsizeMode="tail">
          {footerHint}
        </Text>
      </View>

      {/* ── Stage-Level Quick Capture Modal ── */}
      <QuickCaptureModal
        visible={showQuickCapture}
        contextMode={isCreatingInStage ? 'attach' : 'standalone'}
        targetEmberLabel={isCreatingInStage ? 'New Ember' : undefined}
        onClose={() => setShowQuickCapture(false)}
        onCaptured={handleQuickCaptureSaved}
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
    height: 46,
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
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.35)',
    backgroundColor: 'rgba(255, 107, 43, 0.1)',
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
  bezelTelemetryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(186, 162, 138, 0.16)',
    backgroundColor: 'rgba(26, 23, 19, 0.7)',
  },
  bezelTelemetryDot: {
    fontSize: 9,
    color: COLORS.emberGold,
  },
  bezelTelemetryText: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 9,
    fontWeight: '600',
    color: '#A8947E',
    letterSpacing: 1.1,
  },
  headerButton: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(186, 162, 138, 0.2)',
    maxWidth: 150,
    flexShrink: 1,
  },
  headerButtonText: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 9,
    color: COLORS.textSecondary,
    letterSpacing: 0.6,
  },
  inlineGuardBar: {
    marginHorizontal: 10,
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 87, 0.45)',
    backgroundColor: '#211511',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  inlineGuardTextCol: {
    flex: 1,
    gap: 2,
  },
  inlineGuardTitle: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: '#F5ECE0',
    letterSpacing: 0.8,
  },
  inlineGuardDetail: {
    fontSize: 11,
    color: '#C4B19B',
  },
  inlineGuardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlineGuardCancelBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#5A4330',
    backgroundColor: '#171511',
  },
  inlineGuardCancelText: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 9,
    fontWeight: '600',
    color: '#C4B19B',
  },
  inlineGuardConfirmBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#C84B31',
  },
  inlineGuardConfirmText: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    color: '#FFF5E6',
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
    shadowOpacity: 0.85,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 25,
  },
  footer: {
    height: 30,
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
