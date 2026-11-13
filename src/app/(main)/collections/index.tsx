// ─────────────────────────────────────────────
// Collections Screen
//
// Lists all persisted Embers (seeds) and Enquiries (projects)
// from device storage, with Constellation Glyphs reflecting
// participating Sparks and Inquiry maturity.
// ─────────────────────────────────────────────

import { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';

import { COLORS, TYPOGRAPHY, SPACING } from '@/theme';
import {
  EMBER_NATURE_LABELS,
  describeEmberDeletionSummary,
  type EmberSeed,
} from '@/core';
import type { Spark } from '@/core/spark-types';
import type { EmberProject } from '@/core/ember-project-types';
import { listEmbers, deleteEmber } from '@/services/ember-storage';
import { listSparks } from '@/services/spark-storage';
import { listProjects } from '@/services/ember-project-storage';
import { loadInquiryEvidence } from '@/services/inquiry-storage';
import { evaluateInquiry } from '@/inquiry';
import {
  EmberConstellationGlyph,
  type ConstellationStage,
} from '@/components/plates/EmberConstellationGlyph';

export interface CollectionsScreenProps {
  hideHeader?: boolean;
  onSelectEmber?: (id: string, ember?: EmberSeed) => void;
  onEditEmber?: (id: string, ember?: EmberSeed) => void;
  onDeselectEmber?: () => void;
  onEmbersChanged?: () => void;
  onCreateEmber?: () => void;
  selectedEmberId?: string | null;
  isFocused?: boolean;
  refreshTrigger?: number;
}

export default function CollectionsScreen({
  hideHeader = false,
  onSelectEmber,
  onEditEmber,
  onDeselectEmber,
  onEmbersChanged,
  onCreateEmber,
  selectedEmberId = null,
  isFocused = true,
  refreshTrigger = 0,
}: CollectionsScreenProps = {}) {
  const [tab, setTab] = useState<'seeds' | 'projects'>('seeds');
  const [embers, setEmbers] = useState<EmberSeed[]>([]);
  const [associatedSparks, setAssociatedSparks] = useState<Spark[]>([]);
  const [projects, setProjects] = useState<EmberProject[]>([]);
  const [actionEmber, setActionEmber] = useState<EmberSeed | null>(null);
  const [confirmingDeleteInModal, setConfirmingDeleteInModal] = useState(false);

  const loadData = useCallback(() => {
    const loadedSeeds = listEmbers();
    const loadedSparks = listSparks('ember-associated');
    const loadedProjects = listProjects();
    setEmbers(loadedSeeds);
    setAssociatedSparks(loadedSparks);
    setProjects(loadedProjects);
  }, []);

  useFocusEffect(loadData);

  useEffect(() => {
    if (isFocused) {
      loadData();
    }
  }, [isFocused, selectedEmberId, refreshTrigger, loadData]);

  // Group participating Sparks by Ember ID for collection card previews & counts
  const sparksByEmberId = useMemo(() => {
    const map: Record<string, Spark[]> = {};
    for (const s of associatedSparks) {
      if (s.emberId) {
        if (!map[s.emberId]) map[s.emberId] = [];
        map[s.emberId].push(s);
      }
    }
    return map;
  }, [associatedSparks]);

  // Map seed-linked Inquiries by Ember ID so Collection cards reflect real progression
  const projectByEmberId = useMemo(() => {
    const map: Record<string, EmberProject> = {};
    for (const p of projects) {
      if (p.seedId) {
        map[p.seedId] = p;
      }
    }
    return map;
  }, [projects]);

  const legacyProjects = useMemo(
    () => projects.filter((p) => !p.seedId),
    [projects],
  );
  const activeTab = legacyProjects.length > 0 ? tab : 'seeds';

  useEffect(() => {
    setConfirmingDeleteInModal(false);
  }, [actionEmber]);

  const closeActionModal = useCallback(() => {
    setActionEmber(null);
    setConfirmingDeleteInModal(false);
  }, []);

  const handleOpenEmber = useCallback(
    (id: string) => {
      if (onSelectEmber) {
        const seed = embers.find((e) => e.id === id);
        onSelectEmber(id, seed);
        return;
      }
      router.push(`/(main)/ember/${id}` as any);
    },
    [embers, onSelectEmber],
  );

  const handleQuickEditEmber = useCallback(
    (seed: EmberSeed) => {
      closeActionModal();
      if (onEditEmber) {
        onEditEmber(seed.id, seed);
        return;
      }
      router.push(`/(main)/ember/edit/${seed.id}` as any);
    },
    [closeActionModal, onEditEmber],
  );

  const actionEmberDeletionSummary = useMemo(() => {
    if (!actionEmber) return null;
    const emberSparks = sparksByEmberId[actionEmber.id] ?? [];
    const linkedProject = projectByEmberId[actionEmber.id];
    const hasPack = Boolean(linkedProject && linkedProject.designPackVersion > 0);
    const inquiryState = linkedProject
      ? evaluateInquiry(loadInquiryEvidence(linkedProject.id))
      : null;

    return describeEmberDeletionSummary({
      seed: actionEmber,
      participatingSparks: emberSparks,
      inquiryState,
      hasDesignPack: hasPack,
    });
  }, [actionEmber, sparksByEmberId, projectByEmberId]);

  const executeDeleteActionEmber = useCallback(() => {
    if (!actionEmber) return;
    const targetId = actionEmber.id;
    closeActionModal();
    if (selectedEmberId === targetId) {
      onDeselectEmber?.();
    }
    deleteEmber(targetId);
    loadData();
    onEmbersChanged?.();
  }, [actionEmber, closeActionModal, selectedEmberId, onDeselectEmber, loadData, onEmbersChanged]);

  const handleOpenProject = useCallback(
    (project: EmberProject) => {
      if (project.seedId) {
        if (onSelectEmber) {
          const seed = embers.find((e) => e.id === project.seedId);
          onSelectEmber(project.seedId, seed);
          return;
        }
        router.push(`/(main)/ember/${project.seedId}` as any);
        return;
      }

      if (project.designPackVersion > 0 || project.status === 'generated') {
        router.push({
          pathname: '/(main)/design-pack/[id]',
          params: { id: project.id },
        } as any);
      } else {
        router.push({
          pathname: '/(main)/ember-session/[id]',
          params: { id: project.id },
        } as any);
      }
    },
    [embers, onSelectEmber],
  );

  const handleCreate = useCallback(() => {
    if (onCreateEmber) {
      onCreateEmber();
      return;
    }
    router.push('/(main)/create' as any);
  }, [onCreateEmber]);

  const handleSparks = useCallback(() => {
    router.push('/(main)/sparks' as any);
  }, []);

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
      {/* ── Standalone Header Bar ── */}
      {!hideHeader && (
        <View style={styles.headerBar}>
          <Pressable onPress={handleBack} hitSlop={12}>
            <Text style={styles.backArrow}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Embers</Text>
          <Pressable onPress={handleCreate} hitSlop={12}>
            <Text style={styles.headerAction}>+ New Ember</Text>
          </Pressable>
        </View>
      )}

      {/* ── Segment / Tab Switcher (only if seedless legacy projects exist) ── */}
      {legacyProjects.length > 0 && (
        <View style={styles.tabsContainer}>
          <Pressable
            style={[styles.tabButton, activeTab === 'seeds' && styles.tabButtonActive]}
            onPress={() => setTab('seeds')}
          >
            <Text
              style={[styles.tabText, activeTab === 'seeds' && styles.tabTextActive]}
            >
              Embers ({embers.length})
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabButton, activeTab === 'projects' && styles.tabButtonActive]}
            onPress={() => setTab('projects')}
          >
            <Text
              style={[styles.tabText, activeTab === 'projects' && styles.tabTextActive]}
            >
              Legacy ({legacyProjects.length})
            </Text>
          </Pressable>
        </View>
      )}

      {/* ── Tab Content: Embers (Seeds) ── */}
      {activeTab === 'seeds' && (
        <>
          {hideHeader && (
            <View style={styles.embeddedSubBar}>
              <Text style={styles.embeddedSubBarMeta}>
                COLLECTION · {embers.length} EMBER{embers.length === 1 ? '' : 'S'}
              </Text>
              {embers.length > 0 && (
                <Pressable
                  onPress={handleCreate}
                  hitSlop={8}
                  style={styles.subBarPrimaryPill}
                >
                  <Text style={styles.subBarPrimaryPillText}>+ New Ember</Text>
                </Pressable>
              )}
            </View>
          )}
          {embers.length === 0 ? (
            <View style={styles.emptyContainer}>
              <EmberConstellationGlyph sparkCount={0} stage="seed" size={56} animated={true} />
              <Text style={styles.emptyTitle}>No Embers yet</Text>
              <Text style={styles.emptyText}>
                Kindle your first Ember from a question or lingering Spark.
              </Text>
              <Pressable onPress={handleCreate} style={styles.emptyButton}>
                <Text style={styles.emptyButtonText}>✦ Create Ember</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={embers}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => {
                const emberSparks = sparksByEmberId[item.id] ?? [];
                const previewSparkText =
                  item.spark || (emberSparks.length > 0 ? emberSparks[0].content : undefined);
                const linkedProject = projectByEmberId[item.id];
                const hasPack = Boolean(
                  linkedProject && linkedProject.designPackVersion > 0,
                );
                const evidence = linkedProject
                  ? loadInquiryEvidence(linkedProject.id)
                  : undefined;
                const evaluated = evidence ? evaluateInquiry(evidence) : undefined;

                let constellationStage: ConstellationStage = 'seed';
                if (hasPack) {
                  constellationStage = 'pack';
                } else if (evaluated?.designPack.generationAvailable) {
                  constellationStage = 'warranted';
                } else if (evaluated?.designPack.chosen) {
                  constellationStage = 'developing';
                } else if (evidence && evidence.answers.length > 0) {
                  constellationStage = 'exploring';
                }

                const statusBadge = hasPack
                  ? `DESIGN PACK v${linkedProject!.designPackVersion}`
                  : evaluated?.designPack.generationAvailable
                  ? 'WARRANTED'
                  : evaluated?.designPack.chosen
                  ? 'DEVELOPING'
                  : evidence && evidence.answers.length > 0
                  ? 'EXPLORING'
                  : item.nature !== 'open'
                  ? EMBER_NATURE_LABELS[item.nature]
                  : 'EMBER';

                return (
                  <Pressable
                    style={[
                      styles.card,
                      selectedEmberId === item.id && styles.cardSelected,
                    ]}
                    onPress={() => handleOpenEmber(item.id)}
                    onLongPress={() => setActionEmber(item)}
                    delayLongPress={240}
                  >
                    <View style={styles.cardBodyRow}>
                      <View style={styles.cardTextCol}>
                        <View style={styles.cardHeader}>
                          <Text
                            style={[
                              styles.cardNature,
                              hasPack && styles.cardPackBadge,
                            ]}
                          >
                            {statusBadge}
                          </Text>
                          <Text style={styles.cardDate}>
                            {formatRelativeDate(item.updatedAt)}
                          </Text>
                        </View>
                        <Text style={styles.cardTitle} numberOfLines={1}>
                          {item.name || 'Untitled'}
                        </Text>
                        {item.carriedSentence && (
                          <Text style={styles.cardEssence} numberOfLines={1}>
                            {item.carriedSentence}
                          </Text>
                        )}
                        {previewSparkText && !item.carriedSentence && (
                          <Text style={styles.cardSpark} numberOfLines={2}>
                            {previewSparkText}
                          </Text>
                        )}
                        <View style={styles.cardFooter}>
                          {emberSparks.length > 0 && (
                            <Text style={styles.cardMeta}>
                              ✦ {emberSparks.length} spark
                              {emberSparks.length !== 1 ? 's' : ''}
                            </Text>
                          )}
                          {item.questions.length > 0 && (
                            <Text style={styles.cardMeta}>
                              {item.questions.length} question
                              {item.questions.length !== 1 ? 's' : ''}
                            </Text>
                          )}
                          {item.sources.length > 0 && (
                            <Text style={styles.cardMeta}>
                              {item.sources.length} source
                              {item.sources.length !== 1 ? 's' : ''}
                            </Text>
                          )}
                        </View>
                      </View>

                      <EmberConstellationGlyph
                        sparkCount={emberSparks.length}
                        stage={constellationStage}
                        size={42}
                        animated={selectedEmberId === item.id}
                      />
                    </View>
                  </Pressable>
                );
              }}
            />
          )}
        </>
      )}

      {/* ── Tab Content: Legacy (seedless Inquiries only) ── */}
      {activeTab === 'projects' && (
        <>
          {legacyProjects.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No Enquiries yet</Text>
              <Text style={styles.emptyText}>
                Capture sparks or develop an Ember to initiate an enquiry.
              </Text>
              <Pressable onPress={handleSparks} style={styles.emptyButton}>
                <Text style={styles.emptyButtonText}>Capture Sparks</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={legacyProjects}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.card}
                  onPress={() => handleOpenProject(item)}
                >
                  <View style={styles.cardHeader}>
                    <Text
                      style={[
                        styles.cardNature,
                        item.designPackVersion > 0 && styles.cardPackBadge,
                      ]}
                    >
                      {item.designPackVersion > 0
                        ? `DESIGN PACK v${item.designPackVersion}`
                        : item.status.toUpperCase()}
                    </Text>
                    <Text style={styles.cardDate}>
                      {formatRelativeDate(item.updatedAt)}
                    </Text>
                  </View>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.name || 'Untitled Enquiry'}
                  </Text>
                  {item.originalMaterial ? (
                    <Text style={styles.cardSpark} numberOfLines={2}>
                      {item.originalMaterial}
                    </Text>
                  ) : null}
                  <View style={styles.cardFooter}>
                    <Text style={styles.cardMeta}>
                      {item.conditions.length} condition
                      {item.conditions.length !== 1 ? 's' : ''}
                    </Text>
                    <Text style={styles.cardMeta}>
                      {item.answers.length} answer
                      {item.answers.length !== 1 ? 's' : ''}
                    </Text>
                    <Text style={styles.cardMeta}>
                      {item.sparkIds.length > 0
                        ? `${item.sparkIds.length} spark${item.sparkIds.length !== 1 ? 's' : ''}`
                        : 'From seed'}
                    </Text>
                  </View>
                </Pressable>
              )}
              ListFooterComponent={
                <Pressable onPress={handleSparks} style={styles.addButton}>
                  <Text style={styles.addButtonText}>+ Capture more Sparks</Text>
                </Pressable>
              }
            />
          )}
        </>
      )}

      {/* ── Long-Press Ember Quick-Action Modal (with Inline Stage-Aware Deletion Confirmation) ── */}
      <Modal
        visible={!!actionEmber}
        transparent
        animationType="fade"
        onRequestClose={closeActionModal}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={closeActionModal}
        >
          <Pressable style={styles.modalContent} onPress={() => {}}>
            {actionEmber && (
              <>
                <Text style={styles.modalBadge}>✦ EMBER CONSTELLATION</Text>
                <Text style={styles.modalTitle} numberOfLines={1}>
                  {actionEmber.name || 'Untitled Ember'}
                </Text>
                {actionEmber.carriedSentence ? (
                  <Text style={styles.modalSubtitle} numberOfLines={2}>
                    {actionEmber.carriedSentence}
                  </Text>
                ) : null}

                {confirmingDeleteInModal && actionEmberDeletionSummary ? (
                  <View style={styles.inlineDeleteConfirmBox}>
                    <Text style={styles.inlineDeleteConfirmTitle}>
                      Delete this Ember?
                    </Text>
                    <Text style={styles.inlineDeleteConfirmBody}>
                      {actionEmberDeletionSummary.message}
                    </Text>
                    <View style={styles.inlineDeleteConfirmActions}>
                      <Pressable
                        onPress={() => setConfirmingDeleteInModal(false)}
                        style={styles.inlineCancelBtn}
                      >
                        <Text style={styles.inlineCancelBtnText}>Cancel</Text>
                      </Pressable>
                      <Pressable
                        onPress={executeDeleteActionEmber}
                        style={styles.inlineConfirmDeleteBtn}
                      >
                        <Text style={styles.inlineConfirmDeleteBtnText}>
                          Delete Ember
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <View style={styles.modalActionsList}>
                    <Pressable
                      onPress={() => {
                        const id = actionEmber.id;
                        closeActionModal();
                        handleOpenEmber(id);
                      }}
                      style={styles.modalPrimaryBtn}
                    >
                      <Text style={styles.modalPrimaryBtnText}>Open Ember →</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => handleQuickEditEmber(actionEmber)}
                      style={styles.modalSecondaryBtn}
                    >
                      <Text style={styles.modalSecondaryBtnText}>Edit Ember</Text>
                    </Pressable>

                    {selectedEmberId === actionEmber.id && onDeselectEmber && (
                      <Pressable
                        onPress={() => {
                          closeActionModal();
                          onDeselectEmber();
                        }}
                        style={styles.modalSecondaryBtn}
                      >
                        <Text style={styles.modalSecondaryBtnText}>
                          Clear from Rail
                        </Text>
                      </Pressable>
                    )}

                    <Pressable
                      onPress={() => setConfirmingDeleteInModal(true)}
                      style={styles.modalDangerBtn}
                    >
                      <Text style={styles.modalDangerBtnText}>Delete Ember</Text>
                    </Pressable>
                  </View>
                )}

                <Pressable
                  onPress={closeActionModal}
                  style={styles.modalCloseBtn}
                >
                  <Text style={styles.modalCloseBtnText}>Close</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </Container>
  );
}

function formatRelativeDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.deepCharcoal,
  },

  // Header
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  backArrow: {
    fontSize: 20,
    color: COLORS.emberOrange,
    paddingHorizontal: SPACING.sm,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
  },
  headerAction: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: '600',
    color: COLORS.emberOrange,
    paddingHorizontal: SPACING.xs,
  },

  // Connected sub-plate contextual bar
  embeddedSubBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: 10,
    backgroundColor: '#1A1713',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 107, 43, 0.14)',
  },
  embeddedSubBarMeta: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
    letterSpacing: 1.2,
  },
  subBarPrimaryPill: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: COLORS.emberOrange,
  },
  subBarPrimaryPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.deepCharcoal,
    letterSpacing: 0.3,
  },

  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
    gap: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 107, 43, 0.12)',
  },
  tabButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabButtonActive: {
    borderColor: 'rgba(255, 107, 43, 0.3)',
    backgroundColor: 'rgba(255, 107, 43, 0.08)',
  },
  tabText: {
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: '600',
    color: COLORS.textMuted,
    letterSpacing: 0.5,
  },
  tabTextActive: {
    color: COLORS.emberOrange,
  },
  listContent: {
    padding: SPACING.md,
    gap: SPACING.sm,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    gap: SPACING.sm,
  },
  emptyTitle: {
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginTop: 4,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 19,
  },
  emptyButton: {
    paddingVertical: 10,
    paddingHorizontal: SPACING.xl,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.emberOrange,
    backgroundColor: 'rgba(255, 107, 43, 0.1)',
    marginTop: SPACING.sm,
  },
  emptyButtonText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.emberOrange,
    fontWeight: '700',
    letterSpacing: 0.8,
  },

  // Card
  card: {
    backgroundColor: '#161511',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.12)',
    borderRadius: 12,
    padding: SPACING.md,
  },
  cardSelected: {
    borderColor: COLORS.emberOrange,
    backgroundColor: 'rgba(255, 107, 43, 0.08)',
  },
  cardBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  cardTextCol: {
    flex: 1,
    gap: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardNature: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.emberOrange,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  cardPackBadge: {
    color: COLORS.emberGold,
  },
  cardDate: {
    fontSize: 9,
    color: COLORS.textMuted,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
    letterSpacing: 0.3,
  },
  cardEssence: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    letterSpacing: 0.4,
  },
  cardSpark: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: 2,
  },
  cardMeta: {
    fontSize: 10,
    color: COLORS.textMuted,
    letterSpacing: 0.4,
  },

  // Add button
  addButton: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    marginTop: SPACING.sm,
  },
  addButtonText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.emberOrange,
    opacity: 0.6,
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
  },

  // Long-press Quick Action Modal
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
    maxWidth: 348,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: '#5A4330',
  },
  modalBadge: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.emberOrange,
    letterSpacing: 1.2,
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: '600',
    color: '#F5ECE0',
  },
  modalSubtitle: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  modalActionsList: {
    gap: SPACING.xs,
    marginTop: 6,
  },
  modalPrimaryBtn: {
    backgroundColor: 'rgba(255, 107, 43, 0.14)',
    borderWidth: 1,
    borderColor: COLORS.emberOrange,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
  },
  modalPrimaryBtnText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: '700',
    color: COLORS.emberOrange,
  },
  modalSecondaryBtn: {
    backgroundColor: '#1E1B16',
    borderWidth: 1,
    borderColor: '#4A3727',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
  },
  modalSecondaryBtnText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: '600',
    color: '#F5ECE0',
  },
  modalDangerBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 2,
  },
  modalDangerBtnText: {
    fontSize: 12,
    color: '#D97757',
    fontWeight: '600',
  },
  inlineDeleteConfirmBox: {
    backgroundColor: '#241411',
    borderWidth: 1,
    borderColor: 'rgba(229, 124, 98, 0.45)',
    borderRadius: 10,
    padding: SPACING.md,
    gap: 8,
    marginTop: 4,
  },
  inlineDeleteConfirmTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFD8CE',
  },
  inlineDeleteConfirmBody: {
    fontSize: 11,
    color: '#D8C2B0',
    lineHeight: 16,
  },
  inlineDeleteConfirmActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  inlineCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#5A4330',
    backgroundColor: '#171511',
  },
  inlineCancelBtnText: {
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
  inlineConfirmDeleteBtnText: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF5E6',
  },
  modalCloseBtn: {
    alignItems: 'center',
    paddingVertical: SPACING.xs + 2,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 107, 43, 0.08)',
  },
  modalCloseBtnText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textMuted,
  },
});
