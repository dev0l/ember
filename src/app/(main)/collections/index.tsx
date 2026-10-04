// ─────────────────────────────────────────────
// Collections Screen
//
// Lists all persisted Embers (seeds) and Enquiries (projects)
// from device storage.
// ─────────────────────────────────────────────

import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';

import { COLORS, TYPOGRAPHY, SPACING } from '@/theme';
import type { EmberSeed } from '@/core';
import type { EmberProject } from '@/core/ember-project-types';
import { EMBER_NATURE_LABELS } from '@/core';
import { listEmbers } from '@/services/ember-storage';
import { listProjects } from '@/services/ember-project-storage';

export default function CollectionsScreen() {
  const [tab, setTab] = useState<'seeds' | 'projects'>('seeds');
  const [embers, setEmbers] = useState<EmberSeed[]>([]);
  const [projects, setProjects] = useState<EmberProject[]>([]);

  // Reload data every time the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      const loadedSeeds = listEmbers();
      const loadedProjects = listProjects();
      setEmbers(loadedSeeds);
      setProjects(loadedProjects);
    }, []),
  );

  const handleOpenEmber = useCallback((id: string) => {
    router.push(`/(main)/ember/${id}` as any);
  }, []);

  const handleOpenProject = useCallback((project: EmberProject) => {
    // Route through Ember View when the project has a seed association
    if (project.seedId) {
      router.push(`/(main)/ember/${project.seedId}` as any);
      return;
    }
    // Legacy projects without seedId — direct access
    if (project.designPackVersion > 0 || project.status === 'generated') {
      Alert.alert(
        project.name || 'Untitled Enquiry',
        'Choose an action for this enquiry:',
        [
          {
            text: 'View Design Pack',
            onPress: () =>
              router.push({
                pathname: '/(main)/design-pack/[id]',
                params: { id: project.id },
              } as any),
          },
          {
            text: 'Resume Enquiry',
            onPress: () =>
              router.push({
                pathname: '/(main)/ember-session/[id]',
                params: { id: project.id },
              } as any),
          },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
    } else {
      router.push({
        pathname: '/(main)/ember-session/[id]',
        params: { id: project.id },
      } as any);
    }
  }, []);

  const handleCreate = useCallback(() => {
    router.push('/(main)/create' as any);
  }, []);

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

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Header Bar ── */}
      <View style={styles.headerBar}>
        <Pressable onPress={handleBack} hitSlop={12}>
          <Text style={styles.backArrow}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Embers</Text>
        <Pressable onPress={handleCreate} hitSlop={12}>
          <Text style={styles.headerAction}>+ Spark</Text>
        </Pressable>
      </View>
      {/* ── Segment / Tab Switcher ──
           Only show Enquiries tab when legacy projects (without seedId) exist.
           Modern projects are accessible through their Embers via Ember View. */}
      {projects.some((p) => !p.seedId) && (
        <View style={styles.tabsContainer}>
          <Pressable
            style={[styles.tabButton, tab === 'seeds' && styles.tabButtonActive]}
            onPress={() => setTab('seeds')}
          >
            <Text
              style={[styles.tabText, tab === 'seeds' && styles.tabTextActive]}
            >
              Embers ({embers.length})
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabButton, tab === 'projects' && styles.tabButtonActive]}
            onPress={() => setTab('projects')}
          >
            <Text
              style={[styles.tabText, tab === 'projects' && styles.tabTextActive]}
            >
              Legacy ({projects.filter((p) => !p.seedId).length})
            </Text>
          </Pressable>
        </View>
      )}

      {/* ── Tab Content: Embers (Seeds) ── */}
      {tab === 'seeds' && (
        <>
          {embers.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No Embers yet</Text>
              <Text style={styles.emptyText}>
                Create your first Ember to begin.
              </Text>
              <Pressable onPress={handleCreate} style={styles.emptyButton}>
                <Text style={styles.emptyButtonText}>Create Ember</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={embers}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.card}
                  onPress={() => handleOpenEmber(item.id)}
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardNature}>
                      {EMBER_NATURE_LABELS[item.nature]}
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
                  {item.spark && !item.carriedSentence && (
                    <Text style={styles.cardSpark} numberOfLines={2}>
                      {item.spark}
                    </Text>
                  )}
                  <View style={styles.cardFooter}>
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
                </Pressable>
              )}
              ListFooterComponent={
                <Pressable onPress={handleCreate} style={styles.addButton}>
                  <Text style={styles.addButtonText}>+ Create another Ember</Text>
                </Pressable>
              }
            />
          )}
        </>
      )}

      {/* ── Tab Content: Enquiries (Projects) ── */}
      {tab === 'projects' && (
        <>
          {projects.length === 0 ? (
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
              data={projects}
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
    </SafeAreaView>
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
    gap: SPACING.md,
  },
  emptyTitle: {
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  emptyButton: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.emberOrange,
    marginTop: SPACING.md,
  },
  emptyButtonText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.emberOrange,
    fontWeight: '600',
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
  },

  // Card
  card: {
    backgroundColor: COLORS.surfaceDark,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.12)',
    borderRadius: 12,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardNature: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.emberOrange,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  cardPackBadge: {
    color: '#ffb366',
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
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
  },
  cardSpark: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.xs,
  },
  cardMeta: {
    fontSize: 9,
    color: COLORS.textMuted,
    letterSpacing: 0.5,
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
});
