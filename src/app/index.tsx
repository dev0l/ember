import { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';

import { COLORS, TYPOGRAPHY, SPACING } from '@/theme';
import { useEmberStore } from '@/store';
import type { EmberNode } from '@/core';
import { EmberHub } from '@/components/ember-hub/EmberHub';
import { listEmbers } from '@/services/ember-storage';
import { listProjects } from '@/services/ember-project-storage';

// ─────────────────────────────────────────────
// Home Hub Screen
// ─────────────────────────────────────────────

interface RecentEmberItem {
  id: string;
  title: string;
  type: string;
  kind: 'seed' | 'project';
  time: string;
  updatedAt: string;
  hasDesignPack: boolean;
  seedId?: string;
}

function formatRelativeTime(isoString: string): string {
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

/**
 * Home-level ember nodes.
 * Menu structure is data, not code. (Design Principle #3)
 */
const HOME_NODES: EmberNode[] = [
  {
    id: 'collections',
    label: 'Collections',
    subtitle: 'Browse your embers',
    icon: 'archive',
    offsetAngle: 0,     // Top
    offsetRadius: 1,
    enabled: true,
    route: '/(main)/collections',
  },
  {
    id: 'recent',
    label: 'Recent',
    subtitle: 'Continue your journey',
    icon: 'clock',
    offsetAngle: 90,    // Right
    offsetRadius: 1,
    enabled: true,
    route: '/(main)/recent',
  },
  {
    id: 'import',
    label: 'Import',
    subtitle: 'Bring in new material',
    icon: 'download',
    offsetAngle: 180,   // Bottom
    offsetRadius: 1,
    enabled: true,
    route: '/(main)/import',
  },
  {
    id: 'create',
    label: 'Spark Ember',
    subtitle: 'Something is beginning',
    icon: 'flame',
    offsetAngle: 270,   // Left
    offsetRadius: 1,
    enabled: true,
    route: '/(main)/create',
  },
];

export default function HubScreen() {
  const { state, selectedNodeId, setNodes } = useEmberStore();
  const [recents, setRecents] = useState<RecentEmberItem[]>([]);

  // Load home nodes on mount
  useEffect(() => {
    setNodes(HOME_NODES);
  }, [setNodes]);

  useFocusEffect(
    useCallback(() => {
      const seeds = listEmbers();
      const projects = listProjects();

      const seedItems: RecentEmberItem[] = seeds.map((s) => ({
        id: s.id,
        title: s.name || 'Untitled Ember',
        type: s.nature.toUpperCase(),
        kind: 'seed',
        time: formatRelativeTime(s.updatedAt),
        updatedAt: s.updatedAt,
        hasDesignPack: false,
      }));

      const projectItems: RecentEmberItem[] = projects.map((p) => ({
        id: p.id,
        title: p.name || 'Untitled Project',
        type: p.designPackVersion > 0 ? `PACK v${p.designPackVersion}` : 'ENQUIRY',
        kind: 'project',
        time: formatRelativeTime(p.updatedAt),
        updatedAt: p.updatedAt,
        hasDesignPack: p.designPackVersion > 0 || p.status === 'generated',
        seedId: p.seedId,
      }));

      // Exclude project items whose Ember seed is already shown
      const seedIds = new Set(seeds.map((s) => s.id));
      const dedupedProjects = projectItems.filter(
        (p) => !p.seedId || !seedIds.has(p.seedId),
      );

      const combined = [...seedItems, ...dedupedProjects].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );

      setRecents(combined.slice(0, 10));
    }, []),
  );

  const handleOpenRecent = useCallback((item: RecentEmberItem) => {
    if (item.kind === 'seed') {
      router.push(`/(main)/ember/${item.id}` as any);
      return;
    }
    // Route through Ember View when the project has a seed association
    if (item.seedId) {
      router.push(`/(main)/ember/${item.seedId}` as any);
      return;
    }
    // Legacy projects without seedId — direct access
    if (item.hasDesignPack) {
      Alert.alert(
        item.title,
        'Choose an action for this enquiry:',
        [
          {
            text: 'View Design Pack',
            onPress: () => router.push(`/(main)/design-pack/${item.id}` as any),
          },
          {
            text: 'Resume Enquiry',
            onPress: () => router.push(`/(main)/ember-session/${item.id}` as any),
          },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
    } else {
      router.push(`/(main)/ember-session/${item.id}` as any);
    }
  }, []);

  return (
    <View style={styles.container}>
      {/* ── Fullscreen Interactive Canvas & Gestures ── */}
      <EmberHub />

      {/* ── Overlay Content (Header / Footer / Info) ── */}
      <SafeAreaView style={styles.safeArea} pointerEvents="box-none">
        {/* Header */}
        <View style={styles.header} pointerEvents="none">
          <Text style={styles.title}>E M B E R</Text>
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerDiamond}>◆</Text>
            <View style={styles.dividerLine} />
          </View>
          <Text style={styles.tagline}>Carry meaning. Create new.</Text>
        </View>

        {/* State indicator (dev) */}
        {__DEV__ && (
          <View style={styles.devIndicator} pointerEvents="none">
            <Text style={styles.devText}>
              State: {state}
            </Text>
          </View>
        )}

        {/* ── Embers Domain Entry ── */}
        <Pressable
          onPress={() => router.push('/(main)/collections' as any)}
          style={styles.createButton}
        >
          <Text style={styles.createButtonIcon}>🔥</Text>
          <Text style={styles.createButtonText}>Embers</Text>
          <Text style={styles.createButtonHint}>Browse, create, encounter</Text>
        </Pressable>

        {/* ── Sparks Domain Entry ── */}
        <Pressable
          onPress={() => router.push('/(main)/sparks' as any)}
          style={styles.sparkButton}
        >
          <Text style={styles.sparkButtonText}>Sparks</Text>
          <Text style={styles.sparkButtonHint}>Capture, browse, relate</Text>
        </Pressable>

        {/* ── Recent Activity Horizontal Scroll (only visible when no node is selected) ── */}
        {selectedNodeId === null && (
          <View style={styles.recentSection}>
            <View style={styles.recentHeaderRow}>
              <Text style={styles.recentSectionTitle}>Recent Activity</Text>
              <Pressable onPress={() => router.push('/(main)/recent' as any)}>
                <Text style={styles.seeAllText}>See all →</Text>
              </Pressable>
            </View>
            {recents.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.recentScrollContent}
              >
                {recents.map((item) => (
                  <Pressable
                    key={`${item.kind}-${item.id}`}
                    style={styles.recentCard}
                    onPress={() => handleOpenRecent(item)}
                  >
                    <View style={styles.recentCardHeader}>
                      <Text style={styles.recentCardType}>{item.type}</Text>
                      <Text style={styles.recentCardTime}>{item.time}</Text>
                    </View>
                    <Text style={styles.recentCardTitle} numberOfLines={2}>
                      {item.title}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.emptyRecentText}>
                No activity yet. Create an Ember or capture Sparks.
              </Text>
            )}
          </View>
        )}

        {/* Footer */}
        <Text style={styles.footer} pointerEvents="none">
          Hold core to reveal · Tap node to select · Pinch selected to enter
        </Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.deepCharcoal,
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xl,
  },

  // Header
  header: {
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  title: {
    fontSize: TYPOGRAPHY.sizes.title,
    fontWeight: TYPOGRAPHY.weights.light,
    letterSpacing: TYPOGRAPHY.letterSpacing.extraWide,
    color: COLORS.emberOrange,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  dividerLine: {
    width: 40,
    height: 1,
    backgroundColor: COLORS.emberOrange,
    opacity: 0.4,
  },
  dividerDiamond: {
    fontSize: 8,
    color: COLORS.emberOrange,
    opacity: 0.6,
  },
  tagline: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textSecondary,
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
  },

  // Direct Spark Ember button
  createButton: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl * 2,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.3)',
    backgroundColor: 'rgba(255, 107, 43, 0.08)',
    marginTop: SPACING.xl,
    gap: SPACING.xs,
  },
  createButtonIcon: {
    fontSize: 28,
  },
  createButtonText: {
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: '600',
    color: COLORS.emberOrange,
    letterSpacing: TYPOGRAPHY.letterSpacing.extraWide,
  },
  createButtonHint: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
  },

  // Spark pipeline button
  sparkButton: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 180, 100, 0.25)',
    backgroundColor: 'rgba(255, 180, 100, 0.06)',
    marginTop: SPACING.md,
    gap: SPACING.xs,
  },
  sparkButtonText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: '600',
    color: COLORS.textPrimary,
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
  },
  sparkButtonHint: {
    fontSize: 9,
    color: COLORS.textMuted,
    letterSpacing: 0.5,
    textAlign: 'center',
  },

  // Recent Embers list
  recentSection: {
    width: '100%',
    paddingHorizontal: SPACING.md,
    marginTop: 'auto',
    marginBottom: SPACING.lg,
  },
  recentHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.xs,
  },
  recentSectionTitle: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.textSecondary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  seeAllText: {
    fontSize: 9,
    fontWeight: '600',
    color: COLORS.emberOrange,
    letterSpacing: 0.5,
  },
  emptyRecentText: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    paddingHorizontal: SPACING.xs,
  },
  recentScrollContent: {
    paddingHorizontal: SPACING.xs,
    gap: SPACING.sm,
  },
  recentCard: {
    width: 144,
    height: 80,
    borderRadius: 8,
    backgroundColor: 'rgba(20, 20, 20, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.15)',
    padding: SPACING.sm,
    justifyContent: 'space-between',
  },
  recentCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recentCardType: {
    fontSize: 7,
    fontWeight: '700',
    color: COLORS.emberOrange,
    textTransform: 'uppercase',
    letterSpacing: 1.0,
  },
  recentCardTime: {
    fontSize: 7,
    color: COLORS.textMuted,
  },
  recentCardTitle: {
    fontSize: 10,
    color: COLORS.textPrimary,
    fontWeight: '500',
    lineHeight: 13,
  },

  // Dev indicator
  devIndicator: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 107, 43, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.2)',
    marginTop: SPACING.md,
  },
  devText: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.emberOrange,
    fontFamily: 'monospace',
  },

  // Footer
  footer: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.textMuted,
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
  },
});


