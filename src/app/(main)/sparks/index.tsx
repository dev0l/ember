// ─────────────────────────────────────────────
// Sparks Screen
//
// Capture thoughts. Let them linger. Select them.
// Spark an Ember.
//
// "Capture says: 'Carry this.'
//  Ember says something more like: 'Attend to this.'"
// ─────────────────────────────────────────────

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ScrollView,
  StyleSheet,
  Modal,
  GestureResponderEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';

import type { Spark } from '@/core/spark-types';
import type { EmberSeed } from '@/core/ember-types';
import { createEmberSeed } from '@/core/ember-types';
import {
  listSparks,
  saveSpark,
  associateSparksWithEmber,
  deleteSpark,
  releaseSparkFromEmber,
} from '@/services/spark-storage';
import { saveEmber, loadEmber, listEmbers } from '@/services/ember-storage';
import { loadProject } from '@/services/ember-project-storage';
import { QuickCaptureModal } from '@/components/sparks/QuickCaptureModal';
import { COLORS, TYPOGRAPHY, SPACING } from '@/theme';

const FILTER_ORDER: readonly ('all' | 'lingering' | 'participating')[] = [
  'all',
  'lingering',
  'participating',
];

export interface SparksScreenProps {
  hideHeader?: boolean;
  isFocused?: boolean;
  refreshTrigger?: number;
  onSparksChanged?: () => void;
  onOpenEmber?: (emberId: string, seed?: EmberSeed) => void;
  onRequestQuickCapture?: () => void;
  onCreateEmberWithSparks?: (sparks: Spark[]) => void;
}

export default function SparksScreen({
  hideHeader = false,
  isFocused = true,
  refreshTrigger = 0,
  onSparksChanged,
  onOpenEmber,
  onRequestQuickCapture,
  onCreateEmberWithSparks,
}: SparksScreenProps = {}) {
  const [sparks, setSparks] = useState<Spark[]>([]);
  const [availableEmbers, setAvailableEmbers] = useState<EmberSeed[]>(() => listEmbers());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelecting, setIsSelecting] = useState(false);
  const [confirmingBatchDelete, setConfirmingBatchDelete] = useState(false);
  const [sparkFilter, setSparkFilter] = useState<'all' | 'lingering' | 'participating'>('all');

  // Detail modal & inline modal states (edit / release confirm / delete confirm)
  const [detailSpark, setDetailSpark] = useState<Spark | null>(null);
  const [isEditingDetail, setIsEditingDetail] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [detailInlineConfirm, setDetailInlineConfirm] = useState<
    'release' | 'delete' | null
  >(null);

  const [showEmberPicker, setShowEmberPicker] = useState(false);
  const [showLocalQuickCapture, setShowLocalQuickCapture] = useState(false);

  // Horizontal swipe gesture tracking for lateral filter switching (All <-> Lingering <-> Participating)
  const listTouchStartRef = useRef<{ x: number; y: number } | null>(null);

  const loadData = useCallback(() => {
    const status =
      sparkFilter === 'all'
        ? undefined
        : sparkFilter === 'lingering'
        ? ('lingering' as const)
        : ('ember-associated' as const);
    setSparks(listSparks(status));
    setAvailableEmbers(listEmbers());
    setSelectedIds(new Set());
    setIsSelecting(false);
    setConfirmingBatchDelete(false);
  }, [sparkFilter]);

  // Reload sparks on focus or filter change
  useFocusEffect(loadData);

  useEffect(() => {
    if (isFocused) {
      loadData();
    }
  }, [isFocused, refreshTrigger, loadData]);

  // Resolve ember names for participating sparks
  const emberNames = useMemo(() => {
    const map: Record<string, string> = {};
    const byId = new Map(availableEmbers.map((e) => [e.id, e]));
    const uniqueIds = new Set(
      sparks
        .filter((s) => s.status === 'ember-associated' && s.emberId)
        .map((s) => s.emberId!),
    );
    for (const eid of uniqueIds) {
      const seed = byId.get(eid) ?? loadEmber(eid);
      if (seed) {
        map[eid] = seed.name || 'Untitled Ember';
        continue;
      }
      const proj = loadProject(eid);
      if (proj) {
        map[eid] = proj.name || 'Untitled Enquiry';
      }
    }
    return map;
  }, [sparks, availableEmbers]);

  const lingeringInView = useMemo(
    () => sparks.filter((s) => s.status === 'lingering'),
    [sparks],
  );

  // ── Canonical Quick Capture Entry ──
  const handleOpenCapture = useCallback(() => {
    if (onRequestQuickCapture) {
      onRequestQuickCapture();
      return;
    }
    setShowLocalQuickCapture(true);
  }, [onRequestQuickCapture]);

  const handleLocalSparkCaptured = useCallback(() => {
    loadData();
    onSparksChanged?.();
  }, [loadData, onSparksChanged]);

  // ── Open Detail Inspection Sheet ──
  const openDetailModal = useCallback((spark: Spark) => {
    setDetailSpark(spark);
    setIsEditingDetail(false);
    setEditTitle(spark.title);
    setEditContent(spark.content);
    setDetailInlineConfirm(null);
  }, []);

  const closeDetailModal = useCallback(() => {
    setDetailSpark(null);
    setIsEditingDetail(false);
    setDetailInlineConfirm(null);
  }, []);

  // ── Selection & Inspection Vocabulary (Creative Space Emergent Lineage) ──
  // - Cards at rest are quiet and uncrowded.
  // - Holding (long-pressing) a lingering Spark awakens Selection Mode.
  // - While in Selection Mode, tapping any lingering Spark toggles its selection circle.
  const isSelectionMode = isSelecting || selectedIds.size > 0;

  const toggleSparkSelection = useCallback((sparkId: string) => {
    setConfirmingBatchDelete(false);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(sparkId)) {
        next.delete(sparkId);
      } else {
        next.add(sparkId);
      }
      if (next.size === 0) {
        setIsSelecting(false);
      } else {
        setIsSelecting(true);
      }
      return next;
    });
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectedIds(new Set());
    setIsSelecting(false);
    setConfirmingBatchDelete(false);
  }, []);

  const handleToggleSelectAllOrNone = useCallback(() => {
    setConfirmingBatchDelete(false);
    if (selectedIds.size >= lingeringInView.length && lingeringInView.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(lingeringInView.map((s) => s.id)));
      setIsSelecting(true);
    }
  }, [selectedIds.size, lingeringInView]);

  const handleCardPress = useCallback(
    (spark: Spark) => {
      if (spark.status === 'lingering' && isSelectionMode) {
        toggleSparkSelection(spark.id);
        return;
      }
      openDetailModal(spark);
    },
    [isSelectionMode, toggleSparkSelection, openDetailModal],
  );

  const handleCardLongPress = useCallback(
    (spark: Spark) => {
      if (spark.status === 'lingering') {
        toggleSparkSelection(spark.id);
        return;
      }
      openDetailModal(spark);
    },
    [toggleSparkSelection, openDetailModal],
  );

  // ── Lateral Filter Swipe (All <-> Lingering <-> Participating) ──
  const handleListTouchStart = useCallback((e: GestureResponderEvent) => {
    listTouchStartRef.current = {
      x: e.nativeEvent.pageX,
      y: e.nativeEvent.pageY,
    };
  }, []);

  const handleListTouchEnd = useCallback(
    (e: GestureResponderEvent) => {
      const start = listTouchStartRef.current;
      listTouchStartRef.current = null;
      if (!start) return;
      const dx = e.nativeEvent.pageX - start.x;
      const dy = e.nativeEvent.pageY - start.y;
      if (Math.abs(dx) >= 56 && Math.abs(dx) > Math.abs(dy) * 1.8) {
        const currentIndex = FILTER_ORDER.indexOf(sparkFilter);
        if (dx < 0 && currentIndex < FILTER_ORDER.length - 1) {
          setSparkFilter(FILTER_ORDER[currentIndex + 1]);
        } else if (dx > 0 && currentIndex > 0) {
          setSparkFilter(FILTER_ORDER[currentIndex - 1]);
        }
      }
    },
    [sparkFilter],
  );

  // ── Promote a Single Spark Immediately into an Ember ──
  const promoteSingleSparkToEmber = useCallback(
    (spark: Spark) => {
      const seed = createEmberSeed('open', {
        name: spark.title,
      });
      saveEmber(seed);
      associateSparksWithEmber([spark.id], seed.id);
      loadData();
      onSparksChanged?.();

      if (onOpenEmber) {
        onOpenEmber(seed.id, seed);
        return;
      }
      router.replace(`/(main)/ember/${seed.id}` as any);
    },
    [loadData, onSparksChanged, onOpenEmber],
  );

  // ── Spark a New Ember (1 Spark -> immediate promotion; 2+ Sparks -> pre-stage in Create Ember) ──
  const handleSparkEmber = useCallback(() => {
    const selected = sparks.filter((s) => selectedIds.has(s.id));
    if (selected.length === 0) return;

    if (selected.length === 1) {
      promoteSingleSparkToEmber(selected[0]);
      return;
    }

    if (onCreateEmberWithSparks) {
      exitSelectionMode();
      onCreateEmberWithSparks(selected);
      return;
    }

    const seed = createEmberSeed('open', {});
    saveEmber(seed);
    associateSparksWithEmber(
      selected.map((s) => s.id),
      seed.id,
    );
    loadData();
    onSparksChanged?.();
    if (onOpenEmber) {
      onOpenEmber(seed.id, seed);
      return;
    }
    router.replace(`/(main)/ember/${seed.id}` as any);
  }, [
    sparks,
    selectedIds,
    promoteSingleSparkToEmber,
    onCreateEmberWithSparks,
    exitSelectionMode,
    loadData,
    onSparksChanged,
    onOpenEmber,
  ]);

  // ── Participate in Existing Ember ──
  const handleOpenEmberPicker = useCallback(() => {
    setConfirmingBatchDelete(false);
    setAvailableEmbers(listEmbers());
    setShowEmberPicker(true);
  }, []);

  const handleParticipateFromDetail = useCallback(
    (spark: Spark) => {
      closeDetailModal();
      setSelectedIds(new Set([spark.id]));
      setIsSelecting(true);
      setAvailableEmbers(listEmbers());
      setShowEmberPicker(true);
    },
    [closeDetailModal],
  );

  const handleSelectEmber = useCallback(
    (emberId: string) => {
      const selected = sparks.filter((s) => selectedIds.has(s.id));
      if (selected.length === 0) return;

      associateSparksWithEmber(
        selected.map((s) => s.id),
        emberId,
      );
      setShowEmberPicker(false);
      loadData();
      onSparksChanged?.();

      if (onOpenEmber) {
        const seed = loadEmber(emberId) ?? undefined;
        onOpenEmber(emberId, seed);
        return;
      }

      router.replace(`/(main)/ember/${emberId}` as any);
    },
    [sparks, selectedIds, loadData, onSparksChanged, onOpenEmber],
  );

  // ── Execute Batch Delete (from Inline Bottom Confirmation Bar) ──
  const executeBatchDeleteSparks = useCallback(() => {
    const selected = sparks.filter((s) => selectedIds.has(s.id));
    if (selected.length === 0) return;

    for (const s of selected) {
      deleteSpark(s.id);
    }
    const status =
      sparkFilter === 'all'
        ? undefined
        : sparkFilter === 'lingering'
        ? ('lingering' as const)
        : ('ember-associated' as const);
    setSparks(listSparks(status));
    exitSelectionMode();
    onSparksChanged?.();
  }, [sparks, selectedIds, sparkFilter, exitSelectionMode, onSparksChanged]);

  // ── Detail Sheet: Save Inline Spark Edits ──
  const handleSaveDetailEdit = useCallback(() => {
    if (!detailSpark || !editContent.trim()) return;
    const nextTitle =
      editTitle.trim() || editContent.trim().split('\n')[0].slice(0, 48);
    const updated: Spark = {
      ...detailSpark,
      title: nextTitle,
      content: editContent.trim(),
    };
    saveSpark(updated);
    setDetailSpark(updated);
    setIsEditingDetail(false);
    loadData();
    onSparksChanged?.();
  }, [detailSpark, editTitle, editContent, loadData, onSparksChanged]);

  // ── Detail Sheet: Open Associated Ember ──
  const handleOpenAssociatedEmber = useCallback(() => {
    if (!detailSpark?.emberId) return;
    const emberId = detailSpark.emberId;
    closeDetailModal();
    if (onOpenEmber) {
      const seed = loadEmber(emberId) ?? undefined;
      onOpenEmber(emberId, seed);
      return;
    }
    router.replace(`/(main)/ember/${emberId}` as any);
  }, [detailSpark, closeDetailModal, onOpenEmber]);

  // ── Detail Sheet: Execute Inline Confirmed Release or Delete ──
  const executeDetailRelease = useCallback(() => {
    if (!detailSpark) return;
    releaseSparkFromEmber(detailSpark.id);
    closeDetailModal();
    loadData();
    onSparksChanged?.();
  }, [detailSpark, closeDetailModal, loadData, onSparksChanged]);

  const executeDetailDelete = useCallback(() => {
    if (!detailSpark) return;
    deleteSpark(detailSpark.id);
    closeDetailModal();
    loadData();
    onSparksChanged?.();
  }, [detailSpark, closeDetailModal, loadData, onSparksChanged]);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }, []);

  const Container = hideHeader ? View : SafeAreaView;

  return (
    <Container style={styles.container}>
      {/* ── Standalone Header ── */}
      {!hideHeader && (
        <View style={styles.header}>
          <Pressable onPress={handleBack} hitSlop={12}>
            <Text style={styles.backArrow}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Sparks</Text>
          <Pressable onPress={handleOpenCapture} hitSlop={8} style={styles.subBarPrimaryPill}>
            <Text style={styles.subBarPrimaryText}>+ Spark</Text>
          </Pressable>
        </View>
      )}

      {/* ── Connected Sub-Plate Contextual Bar (Filter + Capture OR Selection Header) ── */}
      <View style={styles.embeddedSubBar}>
        {!isSelectionMode ? (
          <>
            <View style={styles.filterPillsRow}>
              {FILTER_ORDER.map((filter) => {
                const active = sparkFilter === filter;
                return (
                  <Pressable
                    key={filter}
                    onPress={() => setSparkFilter(filter)}
                    hitSlop={6}
                    style={[styles.filterTab, active && styles.filterTabActive]}
                  >
                    <Text
                      style={[
                        styles.filterTabText,
                        active && styles.filterTabTextActive,
                      ]}
                    >
                      {filter === 'all'
                        ? 'All'
                        : filter === 'lingering'
                        ? 'Lingering'
                        : 'Participating'}
                      {active ? ` · ${sparks.length}` : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.subBarRightGroup}>
              {sparks.length > 0 && (
                <Pressable
                  onPress={handleOpenCapture}
                  hitSlop={8}
                  style={styles.subBarPrimaryPill}
                >
                  <Text style={styles.subBarPrimaryText}>+ Capture Spark</Text>
                </Pressable>
              )}
            </View>
          </>
        ) : (
          <>
            <Pressable
              onPress={exitSelectionMode}
              hitSlop={8}
              style={styles.selectionClearBtn}
            >
              <Text style={styles.selectionCloseGlyph}>✕</Text>
              <Text style={styles.selectionCountText}>
                {selectedIds.size} selected
              </Text>
            </Pressable>

            <Pressable
              onPress={handleToggleSelectAllOrNone}
              hitSlop={8}
              style={styles.allNoneToggle}
            >
              <Text style={styles.allNoneToggleText}>
                {selectedIds.size >= lingeringInView.length && lingeringInView.length > 0
                  ? 'None'
                  : 'All / None'}
              </Text>
            </Pressable>
          </>
        )}
      </View>

      {/* ── Spark List (Quiet Cards at Rest + Emergent Selection Mode) ── */}
      <View
        style={styles.listSection}
        onTouchStart={handleListTouchStart}
        onTouchEnd={handleListTouchEnd}
      >
        <FlatList
          data={sparks}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            isSelectionMode && styles.listContentWithDock,
          ]}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {sparkFilter === 'lingering'
                  ? 'No lingering sparks. All sparks have found an Ember.'
                  : sparkFilter === 'participating'
                  ? 'No participating sparks yet. Spark an Ember to relate sparks.'
                  : 'No sparks yet. Catch a thought worth carrying.'}
              </Text>
              {sparkFilter !== 'participating' && (
                <Pressable onPress={handleOpenCapture} style={styles.emptyCapturePill}>
                  <Text style={styles.emptyCapturePillText}>⌁ + Catch a Spark</Text>
                </Pressable>
              )}
            </View>
          }
          renderItem={({ item }) => {
            const isSelected = selectedIds.has(item.id);
            const isParticipating = item.status === 'ember-associated';
            return (
              <Pressable
                onPress={() => handleCardPress(item)}
                onLongPress={() => handleCardLongPress(item)}
                delayLongPress={240}
                style={[
                  styles.sparkCard,
                  isSelected && styles.sparkCardSelected,
                  isParticipating && styles.sparkCardParticipating,
                ]}
              >
                <View style={styles.sparkCardBodyRow}>
                  <View style={styles.sparkCardTextCol}>
                    <View style={styles.sparkCardHeaderRow}>
                      <View style={styles.sparkTitleRow}>
                        <Text
                          style={[
                            styles.sparkElectronDot,
                            isParticipating && styles.sparkConstellationDot,
                          ]}
                        >
                          {isParticipating ? '✦' : '•'}
                        </Text>
                        <Text style={styles.sparkTitle} numberOfLines={1}>
                          {item.title}
                        </Text>
                      </View>

                      {isParticipating && (
                        <Text style={styles.participatingBadgeText}>
                          PARTICIPATING
                        </Text>
                      )}
                    </View>

                    {item.content.trim() !== item.title.trim() && (
                      <Text style={styles.sparkContent} numberOfLines={2}>
                        {item.content}
                      </Text>
                    )}

                    <View style={styles.sparkCardFooterRow}>
                      <Text style={styles.sparkDate}>
                        {formatRelative(item.createdAt)}
                      </Text>
                      {isParticipating && item.emberId && emberNames[item.emberId] ? (
                        <Text style={styles.sparkEmberName} numberOfLines={1}>
                          → {emberNames[item.emberId]}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  {/* Emergent Circular Selection Indicator (Creative Space lineage) */}
                  {isSelectionMode && !isParticipating && (
                    <Pressable
                      onPress={() => toggleSparkSelection(item.id)}
                      hitSlop={10}
                      style={[
                        styles.selectionCircle,
                        isSelected && styles.selectionCircleActive,
                      ]}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: isSelected }}
                      accessibilityLabel={`Select ${item.title}`}
                    >
                      {isSelected && (
                        <Text style={styles.selectionCheckGlyph}>✓</Text>
                      )}
                    </Pressable>
                  )}
                </View>
              </Pressable>
            );
          }}
        />
      </View>

      {/* ── Emergent Bottom Contextual Action Dock & Inline Confirmation Bar (Creative Space Lineage) ── */}
      {isSelectionMode && (
        <View style={styles.bottomDockWrapper}>
          {!confirmingBatchDelete ? (
            <View style={styles.bottomActionDock}>
              <Pressable
                onPress={handleSparkEmber}
                disabled={selectedIds.size === 0}
                style={[
                  styles.dockActionPrimary,
                  selectedIds.size === 0 && styles.dockActionDisabled,
                ]}
              >
                <Text style={styles.dockActionPrimaryGlyph}>✦</Text>
                <Text style={styles.dockActionPrimaryText}>
                  {selectedIds.size > 1
                    ? `Shape Ember (${selectedIds.size})`
                    : 'Spark Ember'}
                </Text>
              </Pressable>

              <Pressable
                onPress={handleOpenEmberPicker}
                disabled={selectedIds.size === 0}
                style={[
                  styles.dockActionSecondary,
                  selectedIds.size === 0 && styles.dockActionDisabled,
                ]}
              >
                <Text style={styles.dockActionSecondaryText}>Participate</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  if (selectedIds.size > 0) {
                    setConfirmingBatchDelete(true);
                  }
                }}
                disabled={selectedIds.size === 0}
                style={[
                  styles.dockActionDanger,
                  selectedIds.size === 0 && styles.dockActionDisabled,
                ]}
              >
                <Text style={styles.dockActionDangerText}>Delete</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.inlineConfirmBar}>
              <Text style={styles.inlineConfirmPrompt}>
                Delete {selectedIds.size} spark{selectedIds.size > 1 ? 's' : ''}?
              </Text>
              <View style={styles.inlineConfirmActions}>
                <Pressable
                  onPress={() => setConfirmingBatchDelete(false)}
                  style={styles.inlineConfirmCancelBtn}
                >
                  <Text style={styles.inlineConfirmCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={executeBatchDeleteSparks}
                  style={styles.inlineConfirmDeleteBtn}
                >
                  <Text style={styles.inlineConfirmDeleteText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      )}

      {/* ── Unified Spark Inspection, Edit & Inline Confirmation Sheet ── */}
      <Modal
        visible={!!detailSpark}
        transparent
        animationType="fade"
        onRequestClose={closeDetailModal}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={closeDetailModal}
        >
          <Pressable style={styles.modalContent} onPress={() => {}}>
            {detailSpark && (
              <>
                <View style={styles.modalHeaderRow}>
                  <Text style={styles.modalStatusBadge}>
                    {detailSpark.status === 'lingering'
                      ? '• LINGERING SPARK'
                      : '✦ PARTICIPATING SPARK'}
                  </Text>
                  <View style={styles.modalHeaderRight}>
                    {!isEditingDetail && (
                      <Pressable
                        onPress={() => {
                          setIsEditingDetail(true);
                          setDetailInlineConfirm(null);
                        }}
                        hitSlop={8}
                        style={styles.modalEditPill}
                      >
                        <Text style={styles.modalEditPillText}>Edit</Text>
                      </Pressable>
                    )}
                    <Text style={styles.modalMeta}>
                      {formatRelative(detailSpark.createdAt)}
                    </Text>
                  </View>
                </View>

                {isEditingDetail ? (
                  <View style={styles.inlineEditContainer}>
                    <TextInput
                      style={styles.inlineEditTitleInput}
                      value={editTitle}
                      onChangeText={setEditTitle}
                      placeholder="Spark title"
                      placeholderTextColor={COLORS.textMuted}
                    />
                    <TextInput
                      style={styles.inlineEditContentInput}
                      value={editContent}
                      onChangeText={setEditContent}
                      placeholder="Spark thought..."
                      placeholderTextColor={COLORS.textMuted}
                      multiline
                      textAlignVertical="top"
                    />
                    <View style={styles.inlineEditActions}>
                      <Pressable
                        onPress={() => {
                          setIsEditingDetail(false);
                          setEditTitle(detailSpark.title);
                          setEditContent(detailSpark.content);
                        }}
                        style={styles.inlineConfirmCancelBtn}
                      >
                        <Text style={styles.inlineConfirmCancelText}>Cancel</Text>
                      </Pressable>
                      <Pressable
                        onPress={handleSaveDetailEdit}
                        style={styles.inlineSaveEditBtn}
                      >
                        <Text style={styles.inlineSaveEditText}>Save Spark</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <>
                    <Text selectable style={styles.modalTitle}>
                      {detailSpark.title}
                    </Text>

                    <ScrollView
                      style={styles.modalBodyScroll}
                      showsVerticalScrollIndicator
                    >
                      <Text selectable style={styles.modalBody}>
                        {detailSpark.content}
                      </Text>
                    </ScrollView>

                    {/* Inline Confirmation Bar inside Inspection Sheet (replaces OS Alert.alert) */}
                    {detailInlineConfirm === 'release' ? (
                      <View style={styles.sheetInlineConfirmBox}>
                        <Text style={styles.sheetInlineConfirmTitle}>
                          Release to Lingering Sparks?
                        </Text>
                        <Text style={styles.sheetInlineConfirmSub}>
                          Detaches from{' '}
                          {(detailSpark.emberId && emberNames[detailSpark.emberId]) ||
                            'its Ember'}{' '}
                          without deleting either.
                        </Text>
                        <View style={styles.inlineConfirmActions}>
                          <Pressable
                            onPress={() => setDetailInlineConfirm(null)}
                            style={styles.inlineConfirmCancelBtn}
                          >
                            <Text style={styles.inlineConfirmCancelText}>Cancel</Text>
                          </Pressable>
                          <Pressable
                            onPress={executeDetailRelease}
                            style={styles.inlineSaveEditBtn}
                          >
                            <Text style={styles.inlineSaveEditText}>Release</Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : detailInlineConfirm === 'delete' ? (
                      <View style={styles.sheetInlineDangerBox}>
                        <Text style={styles.sheetInlineDangerTitle}>
                          Delete this Spark permanently?
                        </Text>
                        <Text style={styles.sheetInlineConfirmSub}>
                          {detailSpark.status === 'ember-associated'
                            ? `Removes "${detailSpark.title}" from ${
                                (detailSpark.emberId &&
                                  emberNames[detailSpark.emberId]) ||
                                'its Ember'
                              } and deletes it.`
                            : `Permanently deletes "${detailSpark.title}".`}
                        </Text>
                        <View style={styles.inlineConfirmActions}>
                          <Pressable
                            onPress={() => setDetailInlineConfirm(null)}
                            style={styles.inlineConfirmCancelBtn}
                          >
                            <Text style={styles.inlineConfirmCancelText}>Cancel</Text>
                          </Pressable>
                          <Pressable
                            onPress={executeDetailDelete}
                            style={styles.inlineConfirmDeleteBtn}
                          >
                            <Text style={styles.inlineConfirmDeleteText}>
                              Delete Spark
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : detailSpark.status === 'lingering' ? (
                      <View style={styles.modalLifecycleActions}>
                        <Pressable
                          onPress={() => {
                            const target = detailSpark;
                            closeDetailModal();
                            promoteSingleSparkToEmber(target);
                          }}
                          style={styles.primaryDetailButton}
                        >
                          <Text style={styles.primaryDetailButtonTitle}>
                            ✦ Spark New Ember →
                          </Text>
                          <Text style={styles.primaryDetailButtonHint}>
                            Begin an Ember with this Spark participating
                          </Text>
                        </Pressable>

                        <Pressable
                          onPress={() => handleParticipateFromDetail(detailSpark)}
                          style={styles.releaseSparkButton}
                        >
                          <Text style={styles.releaseSparkButtonTitle}>
                            Participate in Existing Ember
                          </Text>
                          <Text style={styles.releaseSparkButtonHint}>
                            Bring this Spark into an Ember you are already holding
                          </Text>
                        </Pressable>

                        <Pressable
                          onPress={() => {
                            const targetId = detailSpark.id;
                            closeDetailModal();
                            setSelectedIds(new Set([targetId]));
                            setIsSelecting(true);
                          }}
                          style={styles.releaseSparkButton}
                        >
                          <Text style={styles.releaseSparkButtonTitle}>
                            Select Multiple Sparks
                          </Text>
                          <Text style={styles.releaseSparkButtonHint}>
                            Combine with other lingering Sparks to shape an Ember
                          </Text>
                        </Pressable>

                        <Pressable
                          onPress={() => setDetailInlineConfirm('delete')}
                          style={styles.deleteParticipatingButton}
                        >
                          <Text style={styles.deleteParticipatingButtonText}>
                            Delete Spark
                          </Text>
                        </Pressable>
                      </View>
                    ) : (
                      <>
                        {detailSpark.emberId && (
                          <View style={styles.modalParticipationBox}>
                            <View style={styles.modalParticipationInfo}>
                              <Text style={styles.modalParticipationLabel}>
                                PARTICIPATING IN
                              </Text>
                              <Text style={styles.modalRelation} numberOfLines={1}>
                                {emberNames[detailSpark.emberId] || 'Associated Ember'}
                              </Text>
                            </View>
                            <Pressable
                              onPress={handleOpenAssociatedEmber}
                              style={styles.openEmberPill}
                            >
                              <Text style={styles.openEmberPillText}>Open Ember →</Text>
                            </Pressable>
                          </View>
                        )}

                        <View style={styles.modalLifecycleActions}>
                          <Pressable
                            onPress={() => setDetailInlineConfirm('release')}
                            style={styles.releaseSparkButton}
                          >
                            <Text style={styles.releaseSparkButtonTitle}>
                              Release to Lingering
                            </Text>
                            <Text style={styles.releaseSparkButtonHint}>
                              Detach from this Ember · keep both Spark and Ember
                            </Text>
                          </Pressable>

                          <Pressable
                            onPress={() => setDetailInlineConfirm('delete')}
                            style={styles.deleteParticipatingButton}
                          >
                            <Text style={styles.deleteParticipatingButtonText}>
                              Delete Spark
                            </Text>
                          </Pressable>
                        </View>
                      </>
                    )}
                  </>
                )}

                <Pressable
                  onPress={closeDetailModal}
                  style={styles.modalClose}
                >
                  <Text style={styles.modalCloseText}>Close</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Ember Picker Modal ── */}
      <Modal
        visible={showEmberPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEmberPicker(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowEmberPicker(false)}
        >
          <Pressable style={styles.pickerContent} onPress={() => {}}>
            <Text style={styles.pickerTitle}>Choose an Ember</Text>
            <Text style={styles.pickerSubtitle}>
              {selectedIds.size} spark{selectedIds.size > 1 ? 's' : ''} will participate
            </Text>
            <FlatList
              data={availableEmbers}
              keyExtractor={(item) => item.id}
              style={styles.pickerList}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No Embers yet. Create one first.</Text>
              }
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => handleSelectEmber(item.id)}
                  style={styles.pickerItem}
                >
                  <Text style={styles.pickerItemName}>
                    {item.name || 'Untitled Ember'}
                  </Text>
                  <Text style={styles.pickerItemNature}>
                    {item.nature.toUpperCase()}
                  </Text>
                </Pressable>
              )}
            />
            <Pressable
              onPress={() => setShowEmberPicker(false)}
              style={styles.modalClose}
            >
              <Text style={styles.modalCloseText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Standalone Fallback Quick Capture Modal ── */}
      <QuickCaptureModal
        visible={showLocalQuickCapture}
        contextMode="standalone"
        onClose={() => setShowLocalQuickCapture(false)}
        onCaptured={handleLocalSparkCaptured}
      />
    </Container>
  );
}

function formatRelative(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.deepCharcoal,
  },
  flex: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  backArrow: {
    fontSize: 22,
    color: COLORS.emberOrange,
    paddingHorizontal: SPACING.xs,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
  },

  // Connected sub-plate contextual bar
  embeddedSubBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: '#1A1713',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 107, 43, 0.14)',
    gap: SPACING.xs,
  },
  filterPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  filterTab: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.14)',
  },
  filterTabActive: {
    borderColor: COLORS.emberOrange,
    backgroundColor: 'rgba(255, 107, 43, 0.12)',
  },
  filterTabText: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 9,
    fontWeight: '600',
    color: COLORS.textMuted,
    letterSpacing: 0.5,
  },
  filterTabTextActive: {
    color: COLORS.emberOrange,
    fontWeight: '700',
  },
  subBarRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subBarSelectToggle: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(186, 162, 138, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  subBarSelectToggleText: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 9,
    fontWeight: '600',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
  },
  selectionClearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingRight: 8,
  },
  selectionCloseGlyph: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  selectionCountText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
    letterSpacing: 0.3,
  },
  allNoneToggle: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.25)',
    backgroundColor: 'rgba(255, 107, 43, 0.06)',
  },
  allNoneToggleText: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.emberOrange,
    letterSpacing: 0.6,
  },
  subBarPrimaryPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.emberOrange,
    backgroundColor: 'rgba(255, 107, 43, 0.14)',
  },
  subBarPrimaryText: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.emberOrange,
    letterSpacing: 0.6,
  },

  // List
  listSection: {
    flex: 1,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
  },
  listContent: {
    paddingBottom: SPACING.xl * 2,
  },
  listContentWithDock: {
    paddingBottom: 92,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: SPACING.xl * 1.5,
    gap: SPACING.md,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  emptyCapturePill: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.emberOrange,
    backgroundColor: 'rgba(255, 107, 43, 0.12)',
  },
  emptyCapturePillText: {
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: '700',
    color: COLORS.emberOrange,
    letterSpacing: 0.6,
  },

  // Quiet Spark Card (Creative Space Lineage)
  sparkCard: {
    backgroundColor: '#161511',
    paddingHorizontal: SPACING.md,
    paddingVertical: 13,
    borderRadius: 11,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.1)',
  },
  sparkCardSelected: {
    borderColor: COLORS.emberOrange,
    backgroundColor: 'rgba(255, 107, 43, 0.09)',
  },
  sparkCardParticipating: {
    borderColor: 'rgba(255, 184, 77, 0.14)',
    backgroundColor: '#14130F',
  },
  sparkCardBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  sparkCardTextCol: {
    flex: 1,
    gap: 5,
  },
  sparkCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  sparkTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flex: 1,
  },
  sparkElectronDot: {
    fontSize: 13,
    color: COLORS.emberGold,
    includeFontPadding: false,
  },
  sparkConstellationDot: {
    fontSize: 10,
    color: COLORS.emberOrange,
  },
  sparkTitle: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: '600',
    color: COLORS.textPrimary,
    flex: 1,
  },
  participatingBadgeText: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 8,
    fontWeight: '700',
    color: '#A8947E',
    letterSpacing: 0.8,
  },
  sparkContent: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.textSecondary,
    lineHeight: 17,
  },
  sparkCardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
    gap: SPACING.sm,
  },
  sparkDate: {
    fontSize: 10,
    color: COLORS.textMuted,
  },
  sparkEmberName: {
    fontSize: 10,
    color: COLORS.emberOrange,
    opacity: 0.9,
    letterSpacing: 0.3,
    flex: 1,
    textAlign: 'right',
  },

  // Emergent Circular Selection Indicator
  selectionCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#6E5D4D',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(18, 17, 14, 0.6)',
  },
  selectionCircleActive: {
    borderColor: COLORS.emberOrange,
    backgroundColor: COLORS.emberOrange,
  },
  selectionCheckGlyph: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.deepCharcoal,
    includeFontPadding: false,
  },

  // Bottom Contextual Action Dock & Inline Confirmation Bar
  bottomDockWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    backgroundColor: 'rgba(20, 19, 15, 0.96)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 107, 43, 0.22)',
  },
  bottomActionDock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  dockActionPrimary: {
    flex: 1.35,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: COLORS.emberOrange,
  },
  dockActionPrimaryGlyph: {
    fontSize: 11,
    color: COLORS.deepCharcoal,
    fontWeight: '700',
  },
  dockActionPrimaryText: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.deepCharcoal,
    letterSpacing: 0.6,
  },
  dockActionSecondary: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#5A4330',
    backgroundColor: '#1E1B16',
  },
  dockActionSecondaryText: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 10,
    fontWeight: '600',
    color: '#F5ECE0',
    letterSpacing: 0.5,
  },
  dockActionDanger: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 87, 0.4)',
    backgroundColor: 'rgba(200, 75, 49, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockActionDangerText: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: '#E57C62',
    letterSpacing: 0.5,
  },
  dockActionDisabled: {
    opacity: 0.38,
  },

  // Inline Crimson Confirmation Bar (cs-screen 15 & 22 lineage)
  inlineConfirmBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#261411',
    borderWidth: 1,
    borderColor: 'rgba(229, 124, 98, 0.45)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 10,
  },
  inlineConfirmPrompt: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F5ECE0',
    flex: 1,
  },
  inlineConfirmActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'flex-end',
  },
  inlineConfirmCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#5A4330',
    backgroundColor: '#171511',
  },
  inlineConfirmCancelText: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 10,
    fontWeight: '600',
    color: '#C4B19B',
  },
  inlineConfirmDeleteBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#C84B31',
  },
  inlineConfirmDeleteText: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF5E6',
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.74)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalContent: {
    backgroundColor: '#171511',
    borderRadius: 16,
    padding: SPACING.lg,
    width: '100%',
    maxWidth: 368,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: '#5A4330',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalEditPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.3)',
    backgroundColor: 'rgba(255, 107, 43, 0.08)',
  },
  modalEditPillText: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.emberOrange,
  },
  modalStatusBadge: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.emberOrange,
    letterSpacing: 1,
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  modalBodyScroll: {
    maxHeight: 200,
  },
  modalBody: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  modalMeta: {
    fontSize: 9,
    color: COLORS.textMuted,
  },
  inlineEditContainer: {
    gap: SPACING.sm,
    marginTop: 4,
  },
  inlineEditTitleInput: {
    backgroundColor: '#12110E',
    borderWidth: 1,
    borderColor: '#4A3727',
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  inlineEditContentInput: {
    backgroundColor: '#12110E',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.3)',
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textPrimary,
    minHeight: 96,
    maxHeight: 160,
  },
  inlineEditActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  inlineSaveEditBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.emberOrange,
  },
  inlineSaveEditText: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.deepCharcoal,
  },
  sheetInlineConfirmBox: {
    backgroundColor: '#1D1812',
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 77, 0.35)',
    borderRadius: 10,
    padding: SPACING.md,
    gap: 6,
    marginTop: 4,
  },
  sheetInlineConfirmTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F5ECE0',
  },
  sheetInlineConfirmSub: {
    fontSize: 11,
    color: '#C4B19B',
    lineHeight: 16,
  },
  sheetInlineDangerBox: {
    backgroundColor: '#241411',
    borderWidth: 1,
    borderColor: 'rgba(229, 124, 98, 0.45)',
    borderRadius: 10,
    padding: SPACING.md,
    gap: 6,
    marginTop: 4,
  },
  sheetInlineDangerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFD8CE',
  },
  primaryDetailButton: {
    backgroundColor: 'rgba(255, 107, 43, 0.14)',
    borderWidth: 1,
    borderColor: COLORS.emberOrange,
    borderRadius: 10,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    gap: 2,
  },
  primaryDetailButtonTitle: {
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: '700',
    color: COLORS.emberOrange,
  },
  primaryDetailButtonHint: {
    fontSize: 10,
    color: '#BAA28A',
  },
  modalParticipationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#12110E',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.22)',
    borderRadius: 10,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginTop: 4,
    gap: SPACING.sm,
  },
  modalParticipationInfo: {
    flex: 1,
    gap: 2,
  },
  modalParticipationLabel: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 8,
    fontWeight: '700',
    color: '#8F7A65',
    letterSpacing: 1,
  },
  modalRelation: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: '#F5ECE0',
    fontWeight: '600',
  },
  openEmberPill: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 107, 43, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.3)',
  },
  openEmberPillText: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.emberOrange,
    letterSpacing: 0.5,
  },
  modalLifecycleActions: {
    gap: SPACING.xs,
    marginTop: 4,
  },
  releaseSparkButton: {
    backgroundColor: '#1E1B16',
    borderWidth: 1,
    borderColor: '#4A3727',
    borderRadius: 10,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    gap: 2,
  },
  releaseSparkButtonTitle: {
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: '600',
    color: '#F5ECE0',
  },
  releaseSparkButtonHint: {
    fontSize: 10,
    color: '#8F7A65',
  },
  deleteParticipatingButton: {
    paddingVertical: SPACING.xs + 2,
    alignItems: 'center',
  },
  deleteParticipatingButtonText: {
    fontSize: 11,
    color: '#D97757',
    letterSpacing: 0.4,
  },
  modalClose: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    marginTop: 2,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 107, 43, 0.08)',
  },
  modalCloseText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textMuted,
  },

  // Ember Picker Modal
  pickerContent: {
    backgroundColor: '#171511',
    borderRadius: 16,
    padding: SPACING.lg,
    width: '100%',
    maxWidth: 340,
    maxHeight: '70%',
    borderWidth: 1,
    borderColor: '#5A4330',
  },
  pickerTitle: {
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  pickerSubtitle: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.textMuted,
    marginBottom: SPACING.md,
  },
  pickerList: {
    maxHeight: 300,
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 107, 43, 0.06)',
  },
  pickerItemName: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textPrimary,
    fontWeight: '500',
    flex: 1,
  },
  pickerItemNature: {
    fontSize: 8,
    color: COLORS.emberOrange,
    letterSpacing: 1,
    opacity: 0.6,
  },
});
