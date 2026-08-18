// ─────────────────────────────────────────────
// Ember View
//
// "The user may see the Markdown directly during this prototype."
//
// Loads a persisted Ember by ID and renders its Markdown content.
// For the prototype, this shows the raw Markdown with warm styling.
// Later, this becomes the living surface where questions,
// annotations, and deeper exploration happen.
// ─────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { COLORS, TYPOGRAPHY, SPACING } from '@/theme';
import type { EmberSeed } from '@/core';
import { loadEmber, loadEmberMarkdown } from '@/services/ember-storage';

export default function EmberViewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [seed, setSeed] = useState<EmberSeed | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    const loadedSeed = loadEmber(id);
    const loadedMarkdown = loadEmberMarkdown(id);
    setSeed(loadedSeed);
    setMarkdown(loadedMarkdown);
    setLoading(false);
  }, [id]);

  const handleBack = useCallback(() => {
    // Go back to hub, not to create screen
    router.replace('/');
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={COLORS.emberOrange} size="large" />
          <Text style={styles.loadingText}>Loading Ember...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!seed || !markdown) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Ember not found</Text>
          <Pressable onPress={handleBack} style={styles.backButtonCenter}>
            <Text style={styles.backButtonText}>Return to Hub</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Display title from seed
  const title = seed.name || `Untitled ${seed.nature.charAt(0).toUpperCase() + seed.nature.slice(1)}`;

  // Remove frontmatter from display markdown
  const displayMarkdown = markdown.replace(/^---\n[\s\S]*?\n---\n*/, '');

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Header Bar ── */}
      <View style={styles.headerBar}>
        <Pressable onPress={handleBack} hitSlop={12}>
          <Text style={styles.backArrow}>←</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerNature}>
            {seed.nature.toUpperCase()}
          </Text>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* ── Divider ── */}
      <View style={styles.divider} />

      {/* ── Markdown Content ── */}
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Render markdown as styled text blocks */}
        {renderMarkdownBlocks(displayMarkdown)}

        {/* ── Meta Footer ── */}
        <View style={styles.metaFooter}>
          <Text style={styles.metaText}>
            Created {formatDate(seed.createdAt)}
          </Text>
          <Text style={styles.metaText}>
            ID: {seed.id}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Simple Markdown Renderer ────────────────
// A lightweight block renderer for the prototype.
// Not a full Markdown parser — just enough to make
// the persisted document readable and warm.

function renderMarkdownBlocks(markdown: string) {
  const lines = markdown.split('\n');
  const blocks: React.JSX.Element[] = [];
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // H1
    if (line.startsWith('# ')) {
      blocks.push(
        <Text key={key++} style={mdStyles.h1}>
          {line.replace(/^# /, '')}
        </Text>,
      );
      continue;
    }

    // H2
    if (line.startsWith('## ')) {
      blocks.push(
        <Text key={key++} style={mdStyles.h2}>
          {line.replace(/^## /, '')}
        </Text>,
      );
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      blocks.push(
        <View key={key++} style={mdStyles.blockquoteContainer}>
          <View style={mdStyles.blockquoteBorder} />
          <Text style={mdStyles.blockquote}>
            {renderInline(line.replace(/^> /, ''))}
          </Text>
        </View>,
      );
      continue;
    }

    // List item
    if (line.startsWith('- ')) {
      blocks.push(
        <View key={key++} style={mdStyles.listItem}>
          <Text style={mdStyles.listBullet}>•</Text>
          <Text style={mdStyles.listText}>
            {renderInline(line.replace(/^- /, ''))}
          </Text>
        </View>,
      );
      continue;
    }

    // Empty line — spacer
    if (line.trim() === '') {
      blocks.push(<View key={key++} style={mdStyles.spacer} />);
      continue;
    }

    // Regular paragraph
    blocks.push(
      <Text key={key++} style={mdStyles.paragraph}>
        {renderInline(line)}
      </Text>,
    );
  }

  return blocks;
}

/**
 * Renders inline formatting (bold, italic, links).
 * Very simple pattern matching for the prototype.
 */
function renderInline(text: string): string {
  // Strip markdown inline formatting for now — the text itself
  // is the content we care about in the prototype.
  // Remove bold markers
  let cleaned = text.replace(/\*\*(.+?)\*\*/g, '$1');
  // Remove italic markers
  cleaned = cleaned.replace(/\*(.+?)\*/g, '$1');
  // Simplify markdown links to display text
  cleaned = cleaned.replace(/\[(.+?)\]\(.+?\)/g, '$1');
  return cleaned;
}

function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

// ── Styles ──────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.deepCharcoal,
  },
  flex: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.md,
  },
  loadingText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textMuted,
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
  },
  errorText: {
    fontSize: TYPOGRAPHY.sizes.md,
    color: COLORS.textSecondary,
  },
  backButtonCenter: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.emberOrange,
    marginTop: SPACING.md,
  },
  backButtonText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.emberOrange,
  },

  // Header bar
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  backArrow: {
    fontSize: 20,
    color: COLORS.emberOrange,
    paddingHorizontal: SPACING.sm,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerNature: {
    fontSize: 8,
    fontWeight: '700',
    color: COLORS.emberOrange,
    letterSpacing: 2,
    opacity: 0.7,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: '500',
    color: COLORS.textPrimary,
    letterSpacing: TYPOGRAPHY.letterSpacing.normal,
  },
  headerSpacer: {
    width: 36, // Balance the back arrow
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 107, 43, 0.12)',
    marginHorizontal: SPACING.lg,
  },

  // Content
  contentContainer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xl * 3,
  },

  // Meta footer
  metaFooter: {
    marginTop: SPACING.xl * 2,
    paddingTop: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 107, 43, 0.08)',
    gap: SPACING.xs,
  },
  metaText: {
    fontSize: 9,
    color: COLORS.textMuted,
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
    fontFamily: 'monospace',
  },
});

// ── Markdown Styles ─────────────────────────

const mdStyles = StyleSheet.create({
  h1: {
    fontSize: 22,
    fontWeight: '300',
    color: COLORS.emberOrange,
    letterSpacing: TYPOGRAPHY.letterSpacing.extraWide,
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
  },
  h2: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textSecondary,
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
    textTransform: 'uppercase',
    marginBottom: SPACING.xs,
    marginTop: SPACING.lg,
  },
  paragraph: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textPrimary,
    lineHeight: 20,
    letterSpacing: TYPOGRAPHY.letterSpacing.normal,
  },
  blockquoteContainer: {
    flexDirection: 'row',
    marginVertical: SPACING.xs,
  },
  blockquoteBorder: {
    width: 2,
    backgroundColor: COLORS.emberOrange,
    borderRadius: 1,
    marginRight: SPACING.sm,
    opacity: 0.4,
  },
  blockquote: {
    flex: 1,
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 2,
    paddingLeft: SPACING.xs,
  },
  listBullet: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.emberOrange,
    marginRight: SPACING.sm,
    lineHeight: 20,
  },
  listText: {
    flex: 1,
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  spacer: {
    height: SPACING.xs,
  },
});
