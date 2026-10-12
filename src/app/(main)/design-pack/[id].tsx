// ─────────────────────────────────────────────
// Design Pack View
//
// "The Markdown is for Ember to communicate."
//
// Displays the generated Design Pack Markdown with
// warm styling and engine provenance metadata.
// ─────────────────────────────────────────────

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';

import { COLORS, TYPOGRAPHY, SPACING } from '@/theme';
import {
  loadInquiryRow,
  loadInquiryEvidence,
  loadLatestDesignPack,
  type DesignPackRecord,
} from '@/services';
import {
  evaluateInquiry,
  designPackStaleness,
} from '@/inquiry';

export default function DesignPackViewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [inquiry, setInquiry] = useState<{ id: string; emberId: string | null; name: string } | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [record, setRecord] = useState<DesignPackRecord | null>(null);
  const [staleness, setStaleness] = useState<'current' | 'stale' | 'unknown'>('unknown');

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      const inq = loadInquiryRow(id);
      setInquiry(inq);

      const evidence = loadInquiryEvidence(id);
      const state = evaluateInquiry(evidence);

      const pack = loadLatestDesignPack(id);
      if (pack) {
        setMarkdown(pack.markdown);
        setVersion(pack.version);
        setRecord(pack.record);
        setStaleness(designPackStaleness(pack.record?.reviewFingerprint, state));
      } else {
        setMarkdown(null);
        setVersion(0);
        setRecord(null);
        setStaleness('unknown');
      }
    }, [id]),
  );

  const handleExport = useCallback(async () => {
    if (!markdown) return;
    try {
      await Share.share({
        title: inquiry?.name ? `Design Pack - ${inquiry.name}` : 'Ember Design Pack',
        message: markdown,
      });
    } catch (error) {
      if (__DEV__) {
        console.error('🔥 [Ember] Share error:', error);
      }
    }
  }, [markdown, inquiry?.name]);

  const handleEmber = useCallback(() => {
    if (!id) return;
    if (inquiry?.emberId) {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace(`/(main)/ember/${inquiry.emberId}` as any);
      }
    } else {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/');
      }
    }
  }, [id, inquiry?.emberId]);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else if (inquiry?.emberId) {
      router.replace(`/(main)/ember/${inquiry.emberId}` as any);
    } else {
      router.replace('/');
    }
  }, [inquiry?.emberId]);

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
            {inquiry?.name ?? 'Ember'}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable onPress={handleExport} hitSlop={12} style={styles.headerActionBtn}>
            <Text style={styles.shareText}>Share</Text>
          </Pressable>
          <Pressable onPress={handleEmber} hitSlop={12} style={styles.headerActionBtn}>
            <Text style={styles.enquiryText}>Ember</Text>
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
        {staleness === 'stale' && (
          <View style={styles.staleBanner}>
            <Text style={styles.staleBannerTitle}>STALE DESIGN PACK</Text>
            <Text style={styles.staleBannerText}>
              Inquiry evidence has changed since this pack was generated. Return to Ember to review or generate a new pack when warranted.
            </Text>
          </View>
        )}

        {renderMarkdownBlocks(markdown)}

        {/* ── Footer ── */}
        <View style={styles.metaFooter}>
          <Pressable onPress={handleExport} style={styles.exportButtonLarge}>
            <Text style={styles.exportButtonLargeText}>Share Design Pack</Text>
            <Text style={styles.exportButtonLargeHint}>Export persisted Markdown</Text>
          </Pressable>

          <View style={styles.provenanceBox}>
            <Text style={styles.provenanceTitle}>
              Version {version} · {record?.provenance === 'engine' ? 'Engine Generated' : record?.provenance === 'legacy' ? 'Legacy Proposition' : 'Persisted Markdown'}
            </Text>
            {record?.configurationId && (
              <Text style={styles.provenanceDetail}>
                Configuration: {record.configurationId}
              </Text>
            )}
            {record?.generator && (
              <Text style={styles.provenanceDetail}>
                Generator: {record.generator}
              </Text>
            )}
            {record?.recordedAt && (
              <Text style={styles.provenanceDetail}>
                Recorded: {new Date(record.recordedAt).toLocaleString()}
              </Text>
            )}
            <Text style={[styles.provenanceDetail, staleness === 'stale' ? styles.staleDetail : styles.currentDetail]}>
              Status: {staleness === 'stale' ? 'Stale (evidence changed)' : staleness === 'current' ? 'Current with latest evidence' : 'Unknown staleness'}
            </Text>
          </View>
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
    gap: SPACING.sm,
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

  staleBanner: {
    backgroundColor: 'rgba(255, 179, 71, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 179, 71, 0.3)',
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    gap: 4,
  },
  staleBannerTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFB347',
    letterSpacing: 1,
  },
  staleBannerText: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.textSecondary,
    lineHeight: 18,
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

  provenanceBox: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 10,
    padding: SPACING.md,
    gap: 4,
  },
  provenanceTitle: {
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  provenanceDetail: {
    fontSize: 10,
    color: COLORS.textMuted,
    lineHeight: 16,
  },
  currentDetail: {
    color: '#4ADE80',
  },
  staleDetail: {
    color: '#FFB347',
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
