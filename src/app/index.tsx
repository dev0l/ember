import { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS, TYPOGRAPHY, SPACING } from '@/theme';
import { useEmberStore } from '@/store';
import type { EmberNode } from '@/core';
import { EmberHub } from '@/components/ember-hub/EmberHub';

// ─────────────────────────────────────────────
// Home Hub Screen
// ─────────────────────────────────────────────

interface RecentEmberItem {
  id: string;
  title: string;
  type: string;
  time: string;
}

const RECENT_EMBERS: RecentEmberItem[] = [
  { id: '1', title: 'Hearth Orchestration Protocol', type: 'Framework', time: '2h ago' },
  { id: '2', title: 'Scout Reconnaissance Findings', type: 'Document', time: '5h ago' },
  { id: '3', title: 'Ember Spec Draft v0.3', type: 'Specification', time: '1d ago' },
  { id: '4', title: 'Concept Art Moodboard', type: 'Design', time: '3d ago' },
];

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
    label: 'Create Ember',
    subtitle: 'Start from a spark',
    icon: 'flame',
    offsetAngle: 270,   // Left
    offsetRadius: 1,
    enabled: true,
    route: '/(main)/create',
  },
];

export default function HubScreen() {
  const { state, selectedNodeId, setNodes } = useEmberStore();

  // Load home nodes on mount
  useEffect(() => {
    setNodes(HOME_NODES);
  }, [setNodes]);

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

        {/* ── Recent Embers Horizontal Scroll (only visible when no node is selected) ── */}
        {selectedNodeId === null && (
          <View style={styles.recentSection}>
            <Text style={styles.recentSectionTitle}>Recent Embers</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recentScrollContent}
            >
              {RECENT_EMBERS.map((item) => (
                <Pressable key={item.id} style={styles.recentCard}>
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

  // Recent Embers list
  recentSection: {
    width: '100%',
    paddingHorizontal: SPACING.md,
    marginTop: 'auto',
    marginBottom: SPACING.lg,
  },
  recentSectionTitle: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.textSecondary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
    paddingLeft: SPACING.xs,
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


