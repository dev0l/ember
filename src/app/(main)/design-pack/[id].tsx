// ─────────────────────────────────────────────
// Design Pack View
//
// "The Markdown is for Ember to communicate."
//
// Displays the generated Design Pack Markdown with
// warm styling. Includes regenerate capability.
// ─────────────────────────────────────────────

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';

import { COLORS, TYPOGRAPHY, SPACING } from '@/theme';
import type { EmberProject } from '@/core/ember-project-types';
import { generateDesignPack } from '@/engine/design-pack-generator';
import {
  loadProject,
  saveProject,
  loadLatestDesignPack,
  saveDesignPack,
} from '@/services/ember-project-storage';

export default function DesignPackViewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [project, setProject] = useState<EmberProject | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      const loaded = loadProject(id);
      setProject(loaded);

      const pack = loadLatestDesignPack(id);
      if (pack) {
        setMarkdown(pack.markdown);
        setVersion(pack.version);
      }
    }, [id]),
  );

  // Guard: regeneration is only meaningful if state has changed since last generation.
  // The generator is deterministic — same state produces same output.
  // Currently: no mechanism changes answers after generation in the normal flow.
  // Future: re-exploration would add answers, making regeneration meaningful.
  const canRegenerate = project
    ? project.answers.length > 0 && project.designPackVersion > 0 &&
      // Simple heuristic: answer count exceeds what was likely present at generation.
      // Since we don't store generation context, compare against the current pack.
      // For now, generate a fresh pack and compare — if identical, suppress.
      false // Regeneration not yet meaningful in current flow
    : false;

  const handleRegenerate = useCallback(() => {
    if (!project || !id) return;

    try {
      const md = generateDesignPack(project);

      // Guard: if the output is identical to the current pack, don't create a new version
      if (md === markdown) {
        Alert.alert(
          'No changes detected',
          'The Design Pack would be identical to the current version. New answers or exploration would make regeneration meaningful.',
        );
        return;
      }

      const newVersion = project.designPackVersion + 1;

      saveDesignPack(id, newVersion, md);

      const updated: EmberProject = {
        ...project,
        status: 'generated',
        designPackVersion: newVersion,
        updatedAt: new Date().toISOString(),
      };
      saveProject(updated);

      setProject(updated);
      setMarkdown(md);
      setVersion(newVersion);
    } catch (error) {
      Alert.alert('Error', 'Failed to regenerate Design Pack.');
      if (__DEV__) {
        console.error('🔥 [Ember] Regenerate error:', error);
      }
    }
  }, [project, id, markdown]);

  const handleExport = useCallback(async () => {
    if (!markdown) return;
    try {
      await Share.share({
        title: project?.name ? `Design Pack - ${project.name}` : 'Ember Design Pack',
        message: markdown,
      });
    } catch (error) {
      if (__DEV__) {
        console.error('🔥 [Ember] Share error:', error);
      }
    }
  }, [markdown, project?.name]);

  const handleEmber = useCallback(() => {
    if (!id) return;
    if (project?.seedId) {
      // Ember View is already on the stack underneath — pop back to it
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace(`/(main)/ember/${project.seedId}` as any);
      }
    } else {
      // Legacy: direct access to session
      router.push({
        pathname: '/(main)/ember-session/[id]',
        params: { id },
      } as any);
    }
  }, [id, project?.seedId]);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }, []);

  if (!markdown) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            No Design Pack generated yet.
          </Text>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable onPress={handleBack} hitSlop={12}>
          <Text style={styles.backArrow}>←</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerLabel}>DESIGN PACK</Text>
          <Text style={styles.headerName} numberOfLines={1}>
            {project?.name ?? 'Ember'}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable onPress={handleExport} hitSlop={12} style={styles.headerActionBtn}>
            <Text style={styles.shareText}>Share</Text>
          </Pressable>
          <Pressable onPress={handleEmber} hitSlop={12} style={styles.headerActionBtn}>
            <Text style={styles.enquiryText}>Ember</Text>
          </Pressable>
          <Pressable onPress={handleRegenerate} hitSlop={12} style={styles.headerActionBtn}>
            <Text style={styles.regenerateText}>Regen</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.divider} />

      {/* ── Markdown Content ── */}
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {renderMarkdownBlocks(markdown)}

        {/* ── Footer ── */}
        <View style={styles.metaFooter}>
          <Pressable onPress={handleExport} style={styles.exportButtonLarge}>
            <Text style={styles.exportButtonLargeText}>Share Design Pack</Text>
            <Text style={styles.exportButtonLargeHint}>Export persisted Markdown</Text>
          </Pressable>
          <Text style={styles.metaText}>
            Version {version} · Generated by Ember · Persisted Markdown
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * Simple Markdown block renderer for the prototype.
 * Handles: H1, H2, H3, blockquotes, lists, bold, italic, paragraphs.
 */
function renderMarkdownBlocks(md: string): React.ReactNode[] {
  const lines = md.split('\n');
  const blocks: React.ReactNode[] = [];
  let key = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    key++;

    if (trimmed.startsWith('# ')) {
      blocks.push(
        <Text key={key} style={mdStyles.h1}>
          {trimmed.substring(2)}
        </Text>,
      );
    } else if (trimmed.startsWith('## ')) {
      blocks.push(
        <Text key={key} style={mdStyles.h2}>
          {trimmed.substring(3)}
        </Text>,
      );
    } else if (trimmed.startsWith('### ')) {
      blocks.push(
        <Text key={key} style={mdStyles.h3}>
          {trimmed.substring(4)}
        </Text>,
      );
    } else if (trimmed.startsWith('> ')) {
      blocks.push(
        <View key={key} style={mdStyles.blockquoteContainer}>
          <Text style={mdStyles.blockquote}>
            {stripInline(trimmed.substring(2))}
          </Text>
        </View>,
      );
    } else if (trimmed.startsWith('- ')) {
      blocks.push(
        <Text key={key} style={mdStyles.listItem}>
          {'  •  '}
          {stripInline(trimmed.substring(2))}
        </Text>,
      );
    } else if (trimmed.startsWith('---')) {
      blocks.push(<View key={key} style={mdStyles.hr} />);
    } else if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
      blocks.push(
        <Text key={key} style={mdStyles.bold}>
          {trimmed.replace(/\*\*/g, '')}
        </Text>,
      );
    } else {
      blocks.push(
        <Text key={key} style={mdStyles.paragraph}>
          {stripInline(trimmed)}
        </Text>,
      );
    }
  }

  return blocks;
}

function stripInline(text: string): string {
  let s = text;
  s = s.replace(/\*\*(.+?)\*\*/g, '$1');
  s = s.replace(/\*(.+?)\*/g, '$1');
  s = s.replace(/\[(.+?)\]\(.+?\)/g, '$1');
  return s;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.deepCharcoal,
  },
  flex: { flex: 1 },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.md,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.sizes.md,
    color: COLORS.textSecondary,
  },
  backButton: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.emberOrange,
  },
  backButtonText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.emberOrange,
  },

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
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.emberOrange,
    letterSpacing: 1.5,
  },
  headerName: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  headerActionBtn: {
    paddingHorizontal: SPACING.xs,
    paddingVertical: SPACING.xs,
  },
  shareText: {
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: '700',
    color: COLORS.emberOrange,
  },
  enquiryText: {
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  regenerateText: {
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 107, 43, 0.12)',
    marginHorizontal: SPACING.lg,
  },

  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xl * 3,
  },

  metaFooter: {
    marginTop: SPACING.xl * 2,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 107, 43, 0.08)',
    alignItems: 'center',
    gap: SPACING.md,
  },
  exportButtonLarge: {
    backgroundColor: 'rgba(255, 107, 43, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.3)',
    borderRadius: 16,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
    gap: 4,
    width: '100%',
  },
  exportButtonLargeText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: '700',
    color: COLORS.emberOrange,
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
  },
  exportButtonLargeHint: {
    fontSize: 9,
    color: COLORS.textMuted,
    letterSpacing: 0.5,
  },
  metaText: {
    fontSize: 9,
    color: COLORS.textMuted,
    letterSpacing: 0.5,
  },
});

const mdStyles = StyleSheet.create({
  h1: {
    fontSize: TYPOGRAPHY.sizes.xl,
    fontWeight: '300',
    color: COLORS.emberOrange,
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
    marginBottom: SPACING.md,
    marginTop: SPACING.lg,
  },
  h2: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginTop: SPACING.xl,
    marginBottom: SPACING.sm,
  },
  h3: {
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginTop: SPACING.lg,
    marginBottom: SPACING.xs,
  },
  paragraph: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: SPACING.sm,
  },
  bold: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  blockquoteContainer: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.emberOrange,
    paddingLeft: SPACING.md,
    marginBottom: SPACING.sm,
    marginLeft: SPACING.xs,
  },
  blockquote: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  listItem: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 4,
    paddingLeft: SPACING.sm,
  },
  hr: {
    height: 1,
    backgroundColor: 'rgba(255, 107, 43, 0.12)',
    marginVertical: SPACING.lg,
  },
});
