import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { COLORS, TYPOGRAPHY, SPACING } from '@/theme';
import { listEmbers } from '@/services/ember-storage';
import { listProjects } from '@/services/ember-project-storage';

interface RecentItem {
  id: string;
  title: string;
  type: string;
  kind: 'seed' | 'project';
  date: string;
  updatedAt: string;
  hasDesignPack: boolean;
  subtitle?: string;
  seedId?: string;
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

export default function RecentScreen() {
  const [items, setItems] = useState<RecentItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      const seeds = listEmbers();
      const projects = listProjects();

      const seedItems: RecentItem[] = seeds.map((s) => ({
        id: s.id,
        title: s.name || 'Untitled Ember',
        type: s.nature.toUpperCase(),
        kind: 'seed',
        date: formatRelativeDate(s.updatedAt),
        updatedAt: s.updatedAt,
        hasDesignPack: false,
        subtitle: s.carriedSentence || s.spark || undefined,
      }));

      const projectItems: RecentItem[] = projects.map((p) => ({
        id: p.id,
        title: p.name || 'Untitled Project',
        type: p.designPackVersion > 0 ? `DESIGN PACK v${p.designPackVersion}` : 'ENQUIRY',
        kind: 'project',
        date: formatRelativeDate(p.updatedAt),
        updatedAt: p.updatedAt,
        hasDesignPack: p.designPackVersion > 0 || p.status === 'generated',
        subtitle: `${p.conditions.length} conditions · ${p.answers.length} answers`,
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

      setItems(combined);
    }, []),
  );

  const handleOpenItem = useCallback((item: RecentItem) => {
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

  if (items.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No recent activity</Text>
          <Text style={styles.emptyText}>
            Create an Ember or capture Sparks to begin your journey.
          </Text>
          <Pressable
            onPress={() => router.push('/(main)/create' as any)}
            style={styles.emptyButton}
          >
            <Text style={styles.emptyButtonText}>Create Ember</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => `${item.kind}-${item.id}`}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => handleOpenItem(item)}
          >
            <View style={styles.cardHeader}>
              <Text
                style={[
                  styles.cardType,
                  item.hasDesignPack && styles.cardTypePack,
                ]}
              >
                {item.type}
              </Text>
              <Text style={styles.cardDate}>{item.date}</Text>
            </View>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.title}
            </Text>
            {item.subtitle ? (
              <Text style={styles.cardSubtitle} numberOfLines={2}>
                {item.subtitle}
              </Text>
            ) : null}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.deepCharcoal,
  },
  listContent: {
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  card: {
    backgroundColor: COLORS.surfaceDark,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.12)',
    borderRadius: 10,
    padding: SPACING.md,
    gap: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardType: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.emberOrange,
    textTransform: 'uppercase',
    letterSpacing: 1.0,
  },
  cardTypePack: {
    color: '#ffb366',
  },
  cardDate: {
    fontSize: 9,
    color: COLORS.textMuted,
  },
  cardTitle: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  cardSubtitle: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },
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
});
