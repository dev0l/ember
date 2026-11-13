// ─────────────────────────────────────────────
// Design Pack Use Screen
//
// "The Markdown is for Ember to communicate."
//
// Displays the generated Design Pack Markdown within the spatial
// continuity of TerritoryStage (or standalone fallback), with a
// reading & use posture supporting selectable text, one-tap clipboard
// copy, native sharing, and engine provenance metadata.
// ─────────────────────────────────────────────

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Share,
  TurboModuleRegistry,
  type TurboModule,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';

import { COLORS, TYPOGRAPHY, SPACING } from '@/theme';
import {
  loadEmber,
  loadInquiryRow,
  loadInquiryEvidence,
  loadLatestDesignPack,
  type DesignPackRecord,
} from '@/services';
import {
  evaluateInquiry,
  designPackStaleness,
} from '@/inquiry';

export interface DesignPackViewScreenProps {
  inquiryId?: string;
  emberTitle?: string;
  hideHeader?: boolean;
  isFocused?: boolean;
  refreshTrigger?: number;
  onBack?: () => void;
}

export default function DesignPackViewScreen({
  inquiryId: propInquiryId,
  emberTitle: propEmberTitle,
  hideHeader = false,
  isFocused = true,
  refreshTrigger = 0,
  onBack,
}: DesignPackViewScreenProps = {}) {
  const params = useLocalSearchParams<{ id: string }>();
  const id = propInquiryId || params.id;

  const [inquiry, setInquiry] = useState<{ id: string; emberId: string | null; name: string } | null>(null);
  const [resolvedEmberName, setResolvedEmberName] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [record, setRecord] = useState<DesignPackRecord | null>(null);
  const [staleness, setStaleness] = useState<'current' | 'stale' | 'unknown'>('unknown');
  const [copiedPack, setCopiedPack] = useState(false);

  const loadData = useCallback(() => {
    if (!id) return;
    const inq = loadInquiryRow(id);
    setInquiry(inq);

    if (inq?.emberId) {
      const seed = loadEmber(inq.emberId);
      setResolvedEmberName(seed?.name?.trim() || inq.name || null);
    } else {
      setResolvedEmberName(inq?.name || null);
    }

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
  }, [id]);

  useFocusEffect(loadData);

  useEffect(() => {
    loadData();
  }, [loadData, refreshTrigger]);

  useEffect(() => {
    if (isFocused) {
      loadData();
    }
  }, [isFocused, loadData]);

  const displayTitle = propEmberTitle || resolvedEmberName || inquiry?.name || 'Ember';

  const handleCopy = useCallback(async () => {
    if (!markdown) return;
    try {
      const nativeClipboard = TurboModuleRegistry.get<
        TurboModule & { setString?: (content: string) => void }
      >('Clipboard');
      if (nativeClipboard && typeof nativeClipboard.setString === 'function') {
        nativeClipboard.setString(markdown);
        setCopiedPack(true);
        setTimeout(() => setCopiedPack(false), 2400);
        return;
      }
      await Share.share({
        title: `Design Pack - ${displayTitle}`,
        message: markdown,
      });
    } catch {
      // Ignore cancellation or clipboard fallback errors
    }
  }, [markdown, displayTitle]);

  const handleExport = useCallback(async () => {
    if (!markdown) return;
    try {
      await Share.share({
        title: `Design Pack - ${displayTitle}`,
        message: markdown,
      });
    } catch (error) {
      if (__DEV__) {
        console.error('🔥 [Ember] Share error:', error);
      }
    }
  }, [markdown, displayTitle]);

  const handleBack = useCallback(() => {
    if (onBack) {
      onBack();
      return;
    }
    if (router.canGoBack()) {
      router.back();
    } else if (inquiry?.emberId) {
      router.replace({
        pathname: '/',
        params: { openEmberId: inquiry.emberId },
      } as any);
    } else {
      router.replace('/');
    }
  }, [onBack, inquiry?.emberId]);

  const Container = hideHeader ? View : SafeAreaView;

  if (!markdown) {
    return (
      <Container style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            No Design Pack generated yet.
          </Text>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>Return to Ember</Text>
          </Pressable>
        </View>
      </Container>
    );
  }

  return (
    <Container style={styles.container}>
      {/* ── Header / Embedded Use Bar ── */}
      {!hideHeader ? (
        <>
          <View style={styles.header}>
            <Pressable onPress={handleBack} hitSlop={12}>
              <Text style={styles.backArrow}>←</Text>
            </Pressable>
            <View style={styles.headerCenter}>
              <Text style={styles.headerLabel}>DESIGN PACK</Text>
              <Text style={styles.headerName} numberOfLines={1}>
                {displayTitle}
              </Text>
            </View>
            <View style={styles.headerActions}>
              <Pressable onPress={handleCopy} hitSlop={10} style={styles.headerActionBtn}>
                <Text style={styles.copyText}>
                  {copiedPack ? '✓ Copied' : 'Copy'}
                </Text>
              </Pressable>
              <Pressable onPress={handleExport} hitSlop={10} style={styles.headerActionBtn}>
                <Text style={styles.shareText}>Share</Text>
              </Pressable>
              <Pressable onPress={handleBack} hitSlop={10} style={styles.headerActionBtn}>
                <Text style={styles.enquiryText}>Ember</Text>
              </Pressable>
            </View>
          </View>
          <View style={styles.divider} />
        </>
      ) : (
        <View style={styles.embeddedUseBar}>
          <View style={styles.embeddedMetaGroup}>
            <Text style={styles.embeddedBadge}>
              PACK v{version} · {staleness === 'stale' ? 'STALE' : 'CURRENT'}
            </Text>
            {record?.configurationId && (
              <Text style={styles.embeddedConfigLabel} numberOfLines={1}>
                {record.configurationId}
              </Text>
            )}
          </View>
          <View style={styles.embeddedActions}>
            <Pressable
              onPress={handleCopy}
              hitSlop={8}
              style={[styles.usePill, copiedPack && styles.usePillCopied]}
            >
              <Text style={[styles.usePillText, copiedPack && styles.usePillTextCopied]}>
                {copiedPack ? '✓ Copied' : 'Copy Pack'}
              </Text>
            </Pressable>
            <Pressable onPress={handleExport} hitSlop={8} style={styles.usePillSecondary}>
              <Text style={styles.usePillSecondaryText}>Share</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ── Markdown Content (Selectable Long-Form Reader) ── */}
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {staleness === 'stale' && (
          <View style={styles.staleBanner}>
            <Text style={styles.staleBannerTitle}>STALE DESIGN PACK</Text>
            <Text selectable style={styles.staleBannerText}>
              Inquiry evidence has changed since this pack was generated. Return to Ember to review or generate a new pack when warranted.
            </Text>
          </View>
        )}

        {renderMarkdownBlocks(markdown)}

        {/* ── Footer ── */}
        <View style={styles.metaFooter}>
          {!hideHeader && (
            <View style={styles.footerActionsRow}>
              <Pressable onPress={handleCopy} style={styles.copyButtonLarge}>
                <Text style={styles.copyButtonLargeText}>
                  {copiedPack ? '✓ Copied to Clipboard' : 'Copy Design Pack'}
                </Text>
                <Text style={styles.exportButtonLargeHint}>
                  Copy full Markdown for use
                </Text>
              </Pressable>

              <Pressable onPress={handleExport} style={styles.exportButtonLarge}>
                <Text style={styles.exportButtonLargeText}>Share Design Pack</Text>
                <Text style={styles.exportButtonLargeHint}>Export persisted Markdown</Text>
              </Pressable>
            </View>
          )}

          {record?.provenance !== 'engine' && (
            <View style={styles.provenanceBox}>
              <Text selectable style={styles.provenanceTitle}>
                Version {version} · {record?.provenance === 'legacy' ? 'Legacy Proposition' : 'Persisted Markdown'}
              </Text>
              {record?.configurationId && (
                <Text selectable style={styles.provenanceDetail}>
                  Configuration: {record.configurationId}
                </Text>
              )}
              {record?.generator && (
                <Text selectable style={styles.provenanceDetail}>
                  Generator: {record.generator}
                </Text>
              )}
              {record?.recordedAt && (
                <Text selectable style={styles.provenanceDetail}>
                  Recorded: {new Date(record.recordedAt).toLocaleString()}
                </Text>
              )}
              <Text
                selectable
                style={[
                  styles.provenanceDetail,
                  staleness === 'stale' ? styles.staleDetail : styles.currentDetail,
                ]}
              >
                Status: {staleness === 'stale' ? 'Stale (evidence changed)' : staleness === 'current' ? 'Current with latest evidence' : 'Unknown staleness'}
              </Text>
            </View>
          )}

          <Pressable onPress={handleBack} style={styles.footerReturnButton}>
            <Text style={styles.footerReturnButtonText}>← Return to Ember</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Container>
  );
}

/**
 * Long-form Markdown block renderer for the Design Pack Use Screen.
 * Supports selectable text across all blocks: H1, H2, H3, blockquotes,
 * bullet lists, numbered steps, Markdown tables, fenced code blocks, and paragraphs.
 */
function renderMarkdownBlocks(md: string): React.ReactNode[] {
  const lines = md.split('\n');
  const blocks: React.ReactNode[] = [];
  let key = 0;
  let inCodeBlock = false;
  let codeLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        key++;
        blocks.push(
          <View key={key} style={mdStyles.codeBlock}>
            <Text selectable style={mdStyles.codeText}>
              {codeLines.join('\n')}
            </Text>
          </View>,
        );
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeLines = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (!trimmed || trimmed === '>') continue;

    // Skip Markdown table separator lines (e.g. |---|---|)
    if (/^\|[\s\-:|]+\|$/.test(trimmed)) {
      continue;
    }

    key++;

    if (trimmed.startsWith('# ')) {
      blocks.push(
        <Text key={key} selectable style={mdStyles.h1}>
          {trimmed.substring(2)}
        </Text>,
      );
    } else if (trimmed.startsWith('## ')) {
      blocks.push(
        <Text key={key} selectable style={mdStyles.h2}>
          {trimmed.substring(3)}
        </Text>,
      );
    } else if (trimmed.startsWith('### ')) {
      blocks.push(
        <Text key={key} selectable style={mdStyles.h3}>
          {trimmed.substring(4)}
        </Text>,
      );
    } else if (trimmed.startsWith('> ')) {
      blocks.push(
        <View key={key} style={mdStyles.blockquoteContainer}>
          <Text selectable style={mdStyles.blockquote}>
            {stripInline(trimmed.substring(2))}
          </Text>
        </View>,
      );
    } else if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cells = trimmed
        .slice(1, -1)
        .split('|')
        .map((c) => stripInline(c.trim()));
      const isHeaderRow =
        cells[0]?.toLowerCase() === 'decision' &&
        cells[1]?.toLowerCase() === 'recorded answer';
      blocks.push(
        <View
          key={key}
          style={[mdStyles.tableRow, isHeaderRow && mdStyles.tableHeaderRow]}
        >
          <Text
            selectable
            style={[mdStyles.tableCellLeft, isHeaderRow && mdStyles.tableHeaderText]}
          >
            {cells[0] ?? ''}
          </Text>
          <Text
            selectable
            style={[mdStyles.tableCellRight, isHeaderRow && mdStyles.tableHeaderText]}
          >
            {cells.slice(1).join(' · ')}
          </Text>
        </View>,
      );
    } else if (trimmed.startsWith('- ')) {
      blocks.push(
        <Text key={key} selectable style={mdStyles.listItem}>
          {'  •  '}
          {stripInline(trimmed.substring(2))}
        </Text>,
      );
    } else if (/^\d+\.\s+/.test(trimmed)) {
      blocks.push(
        <Text key={key} selectable style={mdStyles.numberedItem}>
          {stripInline(trimmed)}
        </Text>,
      );
    } else if (trimmed.startsWith('---')) {
      blocks.push(<View key={key} style={mdStyles.hr} />);
    } else if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
      blocks.push(
        <Text key={key} selectable style={mdStyles.bold}>
          {trimmed.replace(/\*\*/g, '')}
        </Text>,
      );
    } else {
      blocks.push(
        <Text key={key} selectable style={mdStyles.paragraph}>
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

  // Standalone Header
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
    paddingHorizontal: SPACING.xs,
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
  copyText: {
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: '700',
    color: COLORS.emberOrange,
  },
  shareText: {
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: '600',
    color: COLORS.textPrimary,
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

  // Embedded In-Plate Use Toolbar
  embeddedUseBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: '#161411',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 107, 43, 0.14)',
    gap: SPACING.sm,
  },
  embeddedMetaGroup: {
    flex: 1,
    gap: 2,
  },
  embeddedBadge: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.emberOrange,
    letterSpacing: 1.2,
  },
  embeddedConfigLabel: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 9,
    color: COLORS.textMuted,
  },
  embeddedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  usePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.emberOrange,
    backgroundColor: 'rgba(255, 107, 43, 0.14)',
  },
  usePillCopied: {
    borderColor: '#4ADE80',
    backgroundColor: 'rgba(74, 222, 128, 0.14)',
  },
  usePillText: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.emberOrange,
    letterSpacing: 0.6,
  },
  usePillTextCopied: {
    color: '#4ADE80',
  },
  usePillSecondary: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.25)',
    backgroundColor: 'rgba(255, 107, 43, 0.05)',
  },
  usePillSecondaryText: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 9,
    fontWeight: '600',
    color: COLORS.textSecondary,
    letterSpacing: 0.6,
  },
  returnEmberBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  returnEmberText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
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
  footerActionsRow: {
    width: '100%',
    gap: SPACING.sm,
  },
  copyButtonLarge: {
    backgroundColor: COLORS.emberOrange,
    borderRadius: 16,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
    gap: 4,
    width: '100%',
  },
  copyButtonLargeText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: '700',
    color: COLORS.deepCharcoal,
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
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
  footerReturnButton: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  footerReturnButtonText: {
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: '600',
    color: COLORS.textSecondary,
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
    marginTop: SPACING.sm,
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
  numberedItem: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 6,
    paddingLeft: SPACING.sm,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 107, 43, 0.1)',
    paddingVertical: 6,
    gap: SPACING.sm,
  },
  tableHeaderRow: {
    borderBottomColor: 'rgba(255, 107, 43, 0.28)',
    backgroundColor: 'rgba(255, 107, 43, 0.06)',
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  tableCellLeft: {
    flex: 1.1,
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.textPrimary,
    lineHeight: 17,
  },
  tableCellRight: {
    flex: 1,
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.textSecondary,
    lineHeight: 17,
  },
  tableHeaderText: {
    fontWeight: '700',
    color: COLORS.emberOrange,
  },
  codeBlock: {
    backgroundColor: '#12110E',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.2)',
    borderRadius: 8,
    padding: SPACING.md,
    marginVertical: SPACING.sm,
  },
  codeText: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: TYPOGRAPHY.sizes.xs,
    color: '#F5ECE0',
    lineHeight: 18,
  },
  hr: {
    height: 1,
    backgroundColor: 'rgba(255, 107, 43, 0.12)',
    marginVertical: SPACING.lg,
  },
});
