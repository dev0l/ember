// ─────────────────────────────────────────────
// Ember View
//
// "The user may see the Markdown directly during this prototype."
//
// Loads a persisted Ember by ID and renders its Constellation
// signature, Markdown content, Participating Sparks (with in-place
// Spark capture, lingering Spark participation, and inline
// release/delete confirmation), and Inquiry progression.
// ─────────────────────────────────────────────

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Modal,
  FlatList,
  Share,
  TurboModuleRegistry,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';

import { COLORS, TYPOGRAPHY, SPACING } from '@/theme';
import {
  buildEmberOriginalMaterial,
  describeEmberDeletionSummary,
  buildEmberCompletionRecord,
  type EmberSeed,
} from '@/core';
import type { Spark } from '@/core/spark-types';
import { loadEmber, deleteEmber } from '@/services/ember-storage';
import { serializeEmberMarkdown } from '@/services/ember-markdown';
import {
  listSparks,
  saveSpark,
  associateSparksWithEmber,
  releaseSparkFromEmber,
  deleteSpark,
} from '@/services/spark-storage';
import {
  loadLatestDesignPack,
  saveDesignPack,
} from '@/services/ember-project-storage';
import {
  loadInquiryEvidence,
  ensureInquiryForEmber,
  recordDecision,
} from '@/services/inquiry-storage';
import {
  DEFAULT_LIBRARY,
  evaluateInquiry,
  chooseDesignPack,
  generateDesignPack,
  designPackStaleness,
  DESIGN_PACK_GENERATOR,
  type InquiryState,
} from '@/inquiry';
import { QuickCaptureModal } from '@/components/sparks/QuickCaptureModal';
import {
  EmberConstellationGlyph,
  type ConstellationStage,
} from '@/components/plates/EmberConstellationGlyph';

export { buildEmberOriginalMaterial };

export interface EmberViewScreenProps {
  emberId?: string;
  hideHeader?: boolean;
  onBack?: () => void;
  onEdit?: () => void;
  onRemoved?: () => void;
  onOpenSession?: (inquiryId: string, movement: 'explore' | 'develop') => void;
  onOpenDesignPack?: (inquiryId: string) => void;
  onCloseSession?: () => void;
  onSparksChanged?: () => void;
  refreshTrigger?: number;
  isFocused?: boolean;
}

export default function EmberViewScreen({
  emberId: propEmberId,
  hideHeader = false,
  onBack,
  onEdit,
  onRemoved,
  onOpenSession,
  onOpenDesignPack,
  onCloseSession,
  onSparksChanged,
  refreshTrigger = 0,
  isFocused = true,
}: EmberViewScreenProps = {}) {
  const params = useLocalSearchParams<{ id: string }>();
  const id = propEmberId || params.id;
  const [seed, setSeed] = useState<EmberSeed | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [participatingSparks, setParticipatingSparks] = useState<Spark[]>([]);
  const [inquiryInfo, setInquiryInfo] = useState<{ id: string; emberId: string; name: string } | null>(null);
  const [inquiryState, setInquiryState] = useState<InquiryState | null>(null);
  const [designPack, setDesignPack] = useState<{
    version: number;
    staleness: 'current' | 'stale' | 'unknown';
    markdown: string;
    configurationId?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  // Contextual Spark capture & Lingering Spark picker modals
  const [showQuickCapture, setShowQuickCapture] = useState(false);
  const [showLingeringPicker, setShowLingeringPicker] = useState(false);
  const [lingeringSparks, setLingeringSparks] = useState<Spark[]>([]);

  // Minimal Ember Completion modal state + inline confirmation
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [copiedCompletion, setCopiedCompletion] = useState(false);
  const [confirmingCompleteClear, setConfirmingCompleteClear] = useState(false);

  // Inline stage-aware Delete Ember confirmation card
  const [confirmingDeleteEmber, setConfirmingDeleteEmber] = useState(false);

  // Participating Spark inspection, inline edit & inline release/delete modal state
  const [inspectedSpark, setInspectedSpark] = useState<Spark | null>(null);
  const [isEditingSpark, setIsEditingSpark] = useState(false);
  const [editSparkTitle, setEditSparkTitle] = useState('');
  const [editSparkContent, setEditSparkContent] = useState('');
  const [sparkInlineConfirm, setSparkInlineConfirm] = useState<'release' | 'delete' | null>(null);
  const [generationNotice, setGenerationNotice] = useState<string | null>(null);

  const loadData = useCallback(() => {
    if (!id) return;
    setLoading(true);
    const loadedSeed = loadEmber(id);

    const associated = listSparks('ember-associated')
      .filter((s) => s.emberId === id);
    setParticipatingSparks(associated);

    if (loadedSeed) {
      const joinedAssociated = associated.map((s) => s.content.trim()).join('\n\n');
      const isDuplicateLegacySpark =
        Boolean(loadedSeed.spark?.trim()) &&
        associated.length > 0 &&
        loadedSeed.spark!.trim() === joinedAssociated;

      const seedForMarkdown = isDuplicateLegacySpark
        ? { ...loadedSeed, spark: undefined }
        : loadedSeed;

      setSeed(loadedSeed);
      setMarkdown(serializeEmberMarkdown(seedForMarkdown));
    } else {
      setSeed(null);
      setMarkdown(null);
    }

    const inq = ensureInquiryForEmber(id, loadedSeed?.name);
    setInquiryInfo(inq);

    const evidence = loadInquiryEvidence(inq.id);
    const state = evaluateInquiry(evidence);
    setInquiryState(state);

    const pack = loadLatestDesignPack(inq.id);
    if (pack) {
      const staleness = designPackStaleness(pack.record?.reviewFingerprint, state);
      setDesignPack({
        version: pack.version,
        staleness,
        markdown: pack.markdown,
        configurationId: pack.record?.configurationId,
      });
    } else {
      setDesignPack(null);
    }

    setConfirmingDeleteEmber(false);
    setGenerationNotice(null);
    setLoading(false);
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

  const handleBack = useCallback(() => {
    if (onBack) {
      onBack();
      return;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }, [onBack]);

  const handleEdit = useCallback(() => {
    if (onEdit) {
      onEdit();
      return;
    }
    if (id) {
      router.push(`/(main)/ember/edit/${id}` as any);
    }
  }, [id, onEdit]);

  // ── Attach a newly caught Spark to this Ember ──
  const handleSparkCapturedForEmber = useCallback(
    (spark: Spark) => {
      if (!id) return;
      associateSparksWithEmber([spark.id], id);
      loadData();
      onSparksChanged?.();
    },
    [id, loadData, onSparksChanged],
  );

  // ── Attach an existing lingering Spark to this Ember ──
  const handleOpenLingeringPicker = useCallback(() => {
    setLingeringSparks(listSparks('lingering'));
    setShowLingeringPicker(true);
  }, []);

  const handleAttachLingeringSpark = useCallback(
    (sparkId: string) => {
      if (!id) return;
      associateSparksWithEmber([sparkId], id);
      setShowLingeringPicker(false);
      loadData();
      onSparksChanged?.();
    },
    [id, loadData, onSparksChanged],
  );

  // ── Inspect, Edit, Release or Delete a Participating Spark ──
  const openSparkInspector = useCallback((spark: Spark) => {
    setInspectedSpark(spark);
    setIsEditingSpark(false);
    setEditSparkTitle(spark.title);
    setEditSparkContent(spark.content);
    setSparkInlineConfirm(null);
  }, []);

  const closeSparkInspector = useCallback(() => {
    setInspectedSpark(null);
    setIsEditingSpark(false);
    setSparkInlineConfirm(null);
  }, []);

  const handleSaveInspectedSparkEdit = useCallback(() => {
    if (!inspectedSpark || !editSparkContent.trim()) return;
    const nextTitle =
      editSparkTitle.trim() || editSparkContent.trim().split('\n')[0].slice(0, 48);
    const updated: Spark = {
      ...inspectedSpark,
      title: nextTitle,
      content: editSparkContent.trim(),
    };
    saveSpark(updated);
    setInspectedSpark(updated);
    setIsEditingSpark(false);
    loadData();
    onSparksChanged?.();
  }, [inspectedSpark, editSparkTitle, editSparkContent, loadData, onSparksChanged]);

  const executeReleaseInspectedSpark = useCallback(() => {
    if (!inspectedSpark) return;
    releaseSparkFromEmber(inspectedSpark.id);
    closeSparkInspector();
    loadData();
    onSparksChanged?.();
  }, [inspectedSpark, closeSparkInspector, loadData, onSparksChanged]);

  const executeDeleteInspectedSpark = useCallback(() => {
    if (!inspectedSpark) return;
    deleteSpark(inspectedSpark.id);
    closeSparkInspector();
    loadData();
    onSparksChanged?.();
  }, [inspectedSpark, closeSparkInspector, loadData, onSparksChanged]);

  // ── Explore: deliberate entry into Explore movement ──
  const handleExplore = useCallback(() => {
    if (!inquiryInfo) return;
    if (onOpenSession) {
      onOpenSession(inquiryInfo.id, 'explore');
      return;
    }
    router.push({
      pathname: '/(main)/ember-session/[id]',
      params: { id: inquiryInfo.id, movement: 'explore' },
    } as any);
  }, [inquiryInfo, onOpenSession]);

  // ── Choose Design Pack: deliberate user choice once available ──
  const handleChooseDesignPack = useCallback(() => {
    if (!inquiryInfo || !inquiryState) return;
    const decision = chooseDesignPack(inquiryState, new Date().toISOString());
    if (decision) {
      recordDecision(inquiryInfo.id, decision);
      const evidence = loadInquiryEvidence(inquiryInfo.id);
      const updated = evaluateInquiry(evidence);
      setInquiryState(updated);
      if (onOpenSession) {
        onOpenSession(inquiryInfo.id, 'develop');
        return;
      }
      router.push({
        pathname: '/(main)/ember-session/[id]',
        params: { id: inquiryInfo.id, movement: 'develop' },
      } as any);
    }
  }, [inquiryInfo, inquiryState, onOpenSession]);

  // ── Develop: deliberate entry into Develop movement ──
  const handleDevelop = useCallback(() => {
    if (!inquiryInfo) return;
    if (onOpenSession) {
      onOpenSession(inquiryInfo.id, 'develop');
      return;
    }
    router.push({
      pathname: '/(main)/ember-session/[id]',
      params: { id: inquiryInfo.id, movement: 'develop' },
    } as any);
  }, [inquiryInfo, onOpenSession]);

  // ── Open Design Pack within TerritoryStage (or standalone fallback) ──
  const handleViewDesignPack = useCallback(() => {
    if (!inquiryInfo) return;
    if (onOpenDesignPack) {
      onOpenDesignPack(inquiryInfo.id);
      return;
    }
    router.push({
      pathname: '/(main)/design-pack/[id]',
      params: { id: inquiryInfo.id },
    } as any);
  }, [inquiryInfo, onOpenDesignPack]);

  // ── Generate Design Pack: available only when warranted ──
  const handleGenerateFromEmber = useCallback(() => {
    if (!inquiryInfo || !inquiryState || !seed || designPack) return;
    const latestSeed = (id ? loadEmber(id) : null) ?? seed;
    const latestSparks = id
      ? listSparks('ember-associated').filter((s) => s.emberId === id)
      : participatingSparks;
    const evidence = loadInquiryEvidence(inquiryInfo.id);
    const originalMaterial = buildEmberOriginalMaterial(latestSeed, latestSparks);

    const result = generateDesignPack(
      evidence,
      {
        title: latestSeed.name || 'Untitled Ember',
        originalMaterial,
      },
      new Date().toISOString(),
    );

    if (!result.ok) {
      setGenerationNotice(result.reason);
      return;
    }

    try {
      const nextVersion = 1;
      saveDesignPack(inquiryInfo.id, nextVersion, result.markdown, {
        provenance: 'engine',
        generator: DESIGN_PACK_GENERATOR,
        libraryVersion: result.state.libraryVersion,
        configurationId: result.state.designPack.adoptedConfigurationId!,
        evidenceFingerprint: result.state.fingerprints.evidence,
        reviewFingerprint: result.state.fingerprints.review,
      });

      setDesignPack({
        version: nextVersion,
        staleness: 'current',
        markdown: result.markdown,
        configurationId: result.state.designPack.adoptedConfigurationId!,
      });
      if (onOpenDesignPack) {
        onOpenDesignPack(inquiryInfo.id);
        return;
      }
      onCloseSession?.();
      router.push({
        pathname: '/(main)/design-pack/[id]',
        params: { id: inquiryInfo.id },
      } as any);
    } catch (error) {
      setGenerationNotice('Something went wrong saving the Design Pack.');
      if (__DEV__) console.error('🔥 [Ember] Design Pack generation error:', error);
    }
  }, [
    id,
    inquiryInfo,
    inquiryState,
    seed,
    participatingSparks,
    designPack,
    onOpenDesignPack,
    onCloseSession,
  ]);

  // ── Assembled Completion Record (derived strictly from persisted material) ──
  const completionMarkdown = useMemo(() => {
    if (!seed || !showCompleteModal) return '';
    return buildEmberCompletionRecord({
      seed,
      participatingSparks,
      inquiryState,
      designPack: designPack
        ? {
            version: designPack.version,
            markdown: designPack.markdown,
            configurationId: designPack.configurationId,
          }
        : null,
    });
  }, [seed, showCompleteModal, participatingSparks, inquiryState, designPack]);

  const handleOpenCompleteModal = useCallback(() => {
    setCopiedCompletion(false);
    setConfirmingCompleteClear(false);
    setShowCompleteModal(true);
  }, []);

  const handleCopyCompletion = useCallback(async () => {
    if (!completionMarkdown) return;
    try {
      const nativeClipboard = TurboModuleRegistry.get('Clipboard') as {
        setString?: (content: string) => void;
      } | null;
      if (nativeClipboard?.setString) {
        nativeClipboard.setString(completionMarkdown);
        setCopiedCompletion(true);
        setTimeout(() => setCopiedCompletion(false), 2500);
        return;
      }
      await Share.share({
        title: `${seed?.name || 'Ember'} — Completion Record`,
        message: completionMarkdown,
      });
    } catch {
      // Ignore cancellation
    }
  }, [completionMarkdown, seed]);

  const handleShareCompletion = useCallback(async () => {
    if (!completionMarkdown) return;
    try {
      await Share.share({
        title: `${seed?.name || 'Ember'} — Completion Record`,
        message: completionMarkdown,
      });
    } catch {
      // User cancelled share sheet
    }
  }, [completionMarkdown, seed]);

  const executeCompleteAndClear = useCallback(() => {
    if (!seed || !id) return;
    setShowCompleteModal(false);
    setConfirmingCompleteClear(false);
    deleteEmber(id);
    onSparksChanged?.();
    if (onRemoved) {
      onRemoved();
      return;
    }
    router.replace('/');
  }, [seed, id, onSparksChanged, onRemoved]);

  // ── Stage-Aware Deletion Summary & Execution ──
  const deletionSummary = useMemo(() => {
    if (!seed) return null;
    return describeEmberDeletionSummary({
      seed,
      participatingSparks,
      inquiryState,
      hasDesignPack: Boolean(designPack),
    });
  }, [seed, participatingSparks, inquiryState, designPack]);

  const executeDeleteEmber = useCallback(() => {
    if (!seed || !id) return;
    setConfirmingDeleteEmber(false);
    deleteEmber(id);
    onSparksChanged?.();
    if (onRemoved) {
      onRemoved();
      return;
    }
    router.replace('/');
  }, [seed, id, onSparksChanged, onRemoved]);

  const Container = hideHeader ? View : SafeAreaView;

  if (loading) {
    return (
      <Container style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={COLORS.emberOrange} size="large" />
          <Text style={styles.loadingText}>Loading Ember...</Text>
        </View>
      </Container>
    );
  }

  if (!seed || !markdown) {
    return (
      <Container style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Ember not found</Text>
          <Pressable onPress={handleBack} style={styles.backButtonCenter}>
            <Text style={styles.backButtonText}>Return to Hub</Text>
          </Pressable>
        </View>
      </Container>
    );
  }

  const title = seed.name || `Untitled ${seed.nature.charAt(0).toUpperCase() + seed.nature.slice(1)}`;
  const displayMarkdown = markdown.replace(/^---\n[\s\S]*?\n---\n*/, '');

  let constellationStage: ConstellationStage = 'seed';
  if (designPack) {
    constellationStage = 'pack';
  } else if (inquiryState?.designPack.generationAvailable) {
    constellationStage = 'warranted';
  } else if (inquiryState?.designPack.chosen) {
    constellationStage = 'developing';
  } else if (inquiryState && inquiryState.questions.some((q) => q.answer !== undefined)) {
    constellationStage = 'exploring';
  }

  const postureHeadline = designPack
    ? `DESIGN PACK v${designPack.version} · ${
        designPack.staleness === 'stale' ? 'STALE' : 'CURRENT'
      }`
    : inquiryState?.designPack.generationAvailable
    ? 'WARRANTED · READY TO GENERATE'
    : inquiryState?.designPack.chosen
    ? inquiryState.designPack.blockers.length > 0
      ? `INVESTIGATING · ${inquiryState.designPack.blockers.length} BLOCKER${
          inquiryState.designPack.blockers.length === 1 ? '' : 'S'
        }`
      : !inquiryState.designPack.adoptionValid
      ? 'DEVELOP · CONFIGURATION AVAILABLE'
      : !inquiryState.designPack.reviewCurrent
      ? 'DEVELOP · SCOPE REVIEW'
      : `DEVELOPING · ${inquiryState.designPack.outstanding.length} REMAINING`
    : inquiryState?.designPack.available
    ? 'EXPLORED · DESIGN PACK AVAILABLE'
    : inquiryState && inquiryState.questions.some((q) => q.answer !== undefined)
    ? 'EXPLORING · IN PROGRESS'
    : 'EMBER · READY TO EXPLORE';

  return (
    <Container style={styles.container}>
      {/* ── Header Bar ── */}
      {!hideHeader ? (
        <>
          <View style={styles.headerBar}>
            <Pressable onPress={handleBack} hitSlop={12}>
              <Text style={styles.backArrow}>←</Text>
            </Pressable>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {title}
              </Text>
            </View>
            <Pressable onPress={handleEdit} hitSlop={12}>
              <Text style={styles.editButton}>Edit</Text>
            </Pressable>
          </View>
          <View style={styles.divider} />
        </>
      ) : (
        <View style={styles.embeddedHeader}>
          <Text style={styles.embeddedNature} numberOfLines={1}>
            {postureHeadline}
          </Text>
          <Pressable onPress={handleEdit} hitSlop={8} style={styles.embeddedEditButton}>
            <Text style={styles.embeddedEditText}>Edit Ember</Text>
          </Pressable>
        </View>
      )}

      {/* ── Content Scroll ── */}
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Living Constellation Signature & Lineage Banner ── */}
        <View style={styles.constellationBanner}>
          <EmberConstellationGlyph
            sparkCount={participatingSparks.length}
            stage={constellationStage}
            size={56}
            animated={isFocused}
          />
          <View style={styles.constellationBannerTextCol}>
            <Text style={styles.constellationStageLabel}>{postureHeadline}</Text>
            <Text style={styles.constellationMetaLine}>
              ✦ {participatingSparks.length} participating spark
              {participatingSparks.length === 1 ? '' : 's'}
              {seed.questions.length > 0
                ? ` · ${seed.questions.length} question${
                    seed.questions.length === 1 ? '' : 's'
                  }`
                : ''}
            </Text>
          </View>
        </View>

        {/* Render markdown as styled text blocks */}
        {renderMarkdownBlocks(displayMarkdown)}

        {/* ── Participating Sparks (Quiet Cards at Rest) ── */}
        <View style={styles.sparksSection}>
          <View style={styles.sparksSectionHeader}>
            <Text style={styles.sparksSectionTitle}>
              PARTICIPATING SPARKS · {participatingSparks.length}
            </Text>
          </View>

          {participatingSparks.length > 0 ? (
            participatingSparks.map((spark) => (
              <Pressable
                key={spark.id}
                onPress={() => openSparkInspector(spark)}
                onLongPress={() => openSparkInspector(spark)}
                delayLongPress={240}
                style={styles.sparkItem}
              >
                <View style={styles.sparkItemHeaderRow}>
                  <View style={styles.sparkItemTitleGroup}>
                    <Text style={styles.sparkItemGlyph}>✦</Text>
                    <Text style={styles.sparkItemTitle} numberOfLines={1}>
                      {spark.title}
                    </Text>
                  </View>
                  <Text style={styles.sparkItemDate}>
                    {formatDate(spark.createdAt)}
                  </Text>
                </View>
                {spark.content.trim() !== spark.title.trim() && (
                  <Text style={styles.sparkItemContent} numberOfLines={3}>
                    {spark.content}
                  </Text>
                )}
              </Pressable>
            ))
          ) : (
            <Text style={styles.emptySparksHint}>
              No participating Sparks yet. Catch a thought or bring a lingering Spark into this Ember.
            </Text>
          )}

          {!designPack && (
            <View style={styles.emberSparkActions}>
              <Pressable
                onPress={() => setShowQuickCapture(true)}
                style={styles.catchInEmberBtn}
              >
                <Text style={styles.catchInEmberGlyph}>⌁</Text>
                <Text style={styles.catchInEmberText}>+ Catch Spark</Text>
              </Pressable>

              <Pressable
                onPress={handleOpenLingeringPicker}
                style={styles.bringInEmberBtn}
              >
                <Text style={styles.bringInEmberText}>+ Bring Lingering Spark</Text>
              </Pressable>
            </View>
          )}
        </View>

        {generationNotice && (
          <View style={styles.inlineNoticeBox}>
            <Text style={styles.inlineNoticeText}>{generationNotice}</Text>
          </View>
        )}

        {/* ── Inquiry Progression (Reconciled Movement Order: Explore → Develop → Generate) ── */}
        <View style={styles.developSection}>
          <View style={styles.developDivider} />

          {/* 1. Explore Movement */}
          {inquiryState && (
            !designPack && inquiryState.explore.missingRequired.length > 0 ? (
              <Pressable onPress={handleExplore} style={styles.developButton}>
                <Text style={styles.developButtonText}>
                  Explore
                </Text>
                <Text style={styles.developButtonHint}>
                  Establish purpose and audience
                </Text>
              </Pressable>
            ) : !designPack && inquiryState.explore.openOptional.length > 0 ? (
              <Pressable onPress={handleExplore} style={styles.developButton}>
                <Text style={styles.developButtonText}>
                  Exploring
                </Text>
                <Text style={styles.developButtonHint}>
                  Purpose established · optional questions available
                </Text>
              </Pressable>
            ) : !designPack ? (
              <Pressable onPress={handleExplore} style={styles.developButton}>
                <Text style={styles.completedText}>✓ Explored</Text>
                <Text style={styles.developButtonHint}>
                  Purpose and audience established · tap to inspect
                </Text>
              </Pressable>
            ) : (
              <View style={styles.completedMovement}>
                <Text style={styles.completedText}>✓ Explored</Text>
                <Text style={styles.completedHint}>
                  Purpose and audience established
                </Text>
              </View>
            )
          )}

          {/* 2. Design Pack Consequence (Available & Actionable) */}
          {!designPack && inquiryState?.designPack.available && !inquiryState.designPack.chosen && (
            <Pressable onPress={handleChooseDesignPack} style={[styles.developButton, styles.generateButton]}>
              <Text style={styles.generateButtonText}>
                Design Pack Available
              </Text>
              <Text style={styles.developButtonHint}>
                Tap to choose Design Pack and begin Develop
              </Text>
            </Pressable>
          )}

          {/* 3. Develop Movement (only once Design Pack chosen) */}
          {inquiryState?.designPack.chosen && (
            !designPack && inquiryState.designPack.developing ? (
              <Pressable onPress={handleDevelop} style={styles.developButton}>
                <Text style={styles.developButtonText}>
                  {inquiryState.designPack.outstanding.length === 0 &&
                  inquiryState.designPack.blockers.length > 0
                    ? 'Investigating'
                    : 'Developing'}
                </Text>
                <Text style={styles.developButtonHint}>
                  {(() => {
                    const unresolvedCount = inquiryState.designPack.blockers.filter(
                      (b) => b.kind === 'unresolved-decision',
                    ).length;
                    if (inquiryState.designPack.outstanding.length > 0) {
                      return `${inquiryState.designPack.outstanding.length} requirement${
                        inquiryState.designPack.outstanding.length !== 1 ? 's' : ''
                      } outstanding`;
                    }
                    if (unresolvedCount > 0) {
                      return `${unresolvedCount} open decision${
                        unresolvedCount !== 1 ? 's' : ''
                      } to investigate`;
                    }
                    if (inquiryState.designPack.blockers.length > 0) {
                      return 'Authored coverage boundary reached · tap to inspect';
                    }
                    if (!inquiryState.designPack.adoptionValid) {
                      return 'Configuration available · tap to adopt or investigate';
                    }
                    return 'Review confirmation required';
                  })()}
                </Text>
              </Pressable>
            ) : !designPack ? (
              <Pressable onPress={handleDevelop} style={styles.developButton}>
                <Text style={styles.completedText}>✓ Developed</Text>
                <Text style={styles.developButtonHint}>
                  Warranted for{' '}
                  {DEFAULT_LIBRARY.configurations.find(
                    (c) => c.id === inquiryState.designPack.adoptedConfigurationId,
                  )?.name ?? inquiryState.designPack.adoptedConfigurationId}{' '}
                  · tap to inspect or investigate
                </Text>
              </Pressable>
            ) : (
              <View style={styles.completedMovement}>
                <Text style={styles.completedText}>✓ Developed</Text>
                <Text style={styles.completedHint}>
                  Warranted for{' '}
                  {DEFAULT_LIBRARY.configurations.find(
                    (c) => c.id === inquiryState.designPack.adoptedConfigurationId,
                  )?.name ?? inquiryState.designPack.adoptedConfigurationId}
                </Text>
              </View>
            )
          )}

          {/* 4. Generate Design Pack (Warranted & not yet generated for this release) */}
          {!designPack && inquiryState?.designPack.generationAvailable && (
            <Pressable onPress={handleGenerateFromEmber} style={[styles.developButton, styles.generateButton]}>
              <Text style={styles.generateButtonText}>
                Generate Design Pack
              </Text>
              <Text style={styles.developButtonHint}>
                Warranted from established requirements
              </Text>
            </Pressable>
          )}

          {/* 5. View Design Pack */}
          {designPack && (
            <Pressable
              onPress={handleViewDesignPack}
              style={styles.developButton}
            >
              <Text style={styles.completedText}>
                ✓ Design Pack v{designPack.version}
              </Text>
              <Text style={styles.developButtonHint}>
                {designPack.staleness === 'stale'
                  ? 'Evidence changed since generation · tap to view'
                  : 'Inquiry complete · tap to view'}
              </Text>
            </Pressable>
          )}

          {/* 6. Complete Ember (prominent once Design Pack is generated) */}
          {designPack && (
            <Pressable
              onPress={handleOpenCompleteModal}
              style={[styles.developButton, styles.completeEmberMainButton]}
            >
              <Text style={styles.completeEmberMainText}>
                Complete Ember
              </Text>
              <Text style={styles.developButtonHint}>
                Conclude this Ember · inspect & copy completion record
              </Text>
            </Pressable>
          )}
        </View>

        {/* ── Meta Footer ── */}
        <View style={styles.metaFooter}>
          <Text style={styles.metaText}>
            Created {formatDate(seed.createdAt)}
          </Text>
          <Text style={styles.metaText}>
            ID: {seed.id}
          </Text>
        </View>

        {/* ── Lifecycle Actions: Complete or Inline Stage-Aware Delete Ember ── */}
        <View style={styles.lifecycleFooter}>
          {!designPack && (
            <Pressable onPress={handleOpenCompleteModal} style={styles.completeFooterButton}>
              <Text style={styles.completeFooterButtonText}>
                Complete Ember
              </Text>
            </Pressable>
          )}

          {!confirmingDeleteEmber ? (
            <Pressable
              onPress={() => setConfirmingDeleteEmber(true)}
              style={styles.removeButton}
            >
              <Text style={styles.removeButtonText}>Delete Ember</Text>
            </Pressable>
          ) : (
            <View style={styles.inlineDeleteEmberBox}>
              <Text style={styles.inlineDeleteEmberTitle}>Delete this Ember?</Text>
              {deletionSummary && (
                <Text style={styles.inlineDeleteEmberBody}>
                  {deletionSummary.message}
                </Text>
              )}
              <View style={styles.inlineConfirmActions}>
                <Pressable
                  onPress={() => setConfirmingDeleteEmber(false)}
                  style={styles.inlineCancelBtn}
                >
                  <Text style={styles.inlineCancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={executeDeleteEmber}
                  style={styles.inlineDangerConfirmBtn}
                >
                  <Text style={styles.inlineDangerConfirmBtnText}>
                    Delete Ember
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Contextual Quick Capture Modal ── */}
      <QuickCaptureModal
        visible={showQuickCapture}
        contextMode="attach"
        targetEmberLabel={title}
        onClose={() => setShowQuickCapture(false)}
        onCaptured={handleSparkCapturedForEmber}
      />

      {/* ── Bring Lingering Spark Picker Modal ── */}
      <Modal
        visible={showLingeringPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLingeringPicker(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowLingeringPicker(false)}
        >
          <Pressable style={styles.pickerSheet} onPress={() => {}}>
            <Text style={styles.pickerTitle}>Bring a Lingering Spark</Text>
            <Text style={styles.pickerSubtitle}>
              Select a lingering Spark to participate in {title}
            </Text>

            <FlatList
              data={lingeringSparks}
              keyExtractor={(item) => item.id}
              style={styles.pickerList}
              ListEmptyComponent={
                <Text style={styles.emptySparksHint}>
                  No lingering Sparks available. Use &ldquo;+ Catch Spark&rdquo; to capture one now.
                </Text>
              }
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => handleAttachLingeringSpark(item.id)}
                  style={styles.pickerSparkCard}
                >
                  <View style={styles.pickerSparkHeader}>
                    <Text style={styles.pickerSparkTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.pickerSparkAction}>+ PARTICIPATE</Text>
                  </View>
                  <Text style={styles.pickerSparkContent} numberOfLines={2}>
                    {item.content}
                  </Text>
                </Pressable>
              )}
            />

            <Pressable
              onPress={() => setShowLingeringPicker(false)}
              style={styles.pickerCloseBtn}
            >
              <Text style={styles.pickerCloseText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Participating Spark Inspection, Edit & Inline Confirmation Sheet ── */}
      <Modal
        visible={!!inspectedSpark}
        transparent
        animationType="fade"
        onRequestClose={closeSparkInspector}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={closeSparkInspector}
        >
          <Pressable style={styles.pickerSheet} onPress={() => {}}>
            {inspectedSpark && (
              <>
                <View style={styles.inspectorHeaderRow}>
                  <Text style={styles.completeBadge}>✦ PARTICIPATING SPARK</Text>
                  {!isEditingSpark && !designPack && (
                    <Pressable
                      onPress={() => {
                        setIsEditingSpark(true);
                        setSparkInlineConfirm(null);
                      }}
                      hitSlop={8}
                      style={styles.inspectorEditPill}
                    >
                      <Text style={styles.inspectorEditPillText}>Edit</Text>
                    </Pressable>
                  )}
                </View>

                {isEditingSpark ? (
                  <View style={styles.inspectorEditContainer}>
                    <TextInput
                      style={styles.inspectorTitleInput}
                      value={editSparkTitle}
                      onChangeText={setEditSparkTitle}
                      placeholder="Spark title"
                      placeholderTextColor={COLORS.textMuted}
                    />
                    <TextInput
                      style={styles.inspectorContentInput}
                      value={editSparkContent}
                      onChangeText={setEditSparkContent}
                      placeholder="Spark thought..."
                      placeholderTextColor={COLORS.textMuted}
                      multiline
                      textAlignVertical="top"
                    />
                    <View style={styles.inlineConfirmActions}>
                      <Pressable
                        onPress={() => {
                          setIsEditingSpark(false);
                          setEditSparkTitle(inspectedSpark.title);
                          setEditSparkContent(inspectedSpark.content);
                        }}
                        style={styles.inlineCancelBtn}
                      >
                        <Text style={styles.inlineCancelBtnText}>Cancel</Text>
                      </Pressable>
                      <Pressable
                        onPress={handleSaveInspectedSparkEdit}
                        style={styles.inlinePrimaryConfirmBtn}
                      >
                        <Text style={styles.inlinePrimaryConfirmBtnText}>
                          Save Spark
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <>
                    <Text selectable style={styles.pickerTitle}>
                      {inspectedSpark.title}
                    </Text>
                    <Text style={styles.pickerSubtitle}>
                      Captured {formatDate(inspectedSpark.createdAt)}
                    </Text>

                    <ScrollView
                      style={styles.completeRecordScroll}
                      contentContainerStyle={styles.completeRecordContent}
                      showsVerticalScrollIndicator
                    >
                      <Text selectable style={styles.sparkItemContent}>
                        {inspectedSpark.content}
                      </Text>
                    </ScrollView>

                    {!designPack && (
                      <>
                        {sparkInlineConfirm === 'release' ? (
                          <View style={styles.inlineWarmConfirmBox}>
                            <Text style={styles.inlineWarmConfirmTitle}>
                              Release back to Lingering Sparks?
                            </Text>
                            <Text style={styles.inlineWarmConfirmSub}>
                              Detaches &ldquo;{inspectedSpark.title}&rdquo; from {title}. Neither is deleted.
                            </Text>
                            <View style={styles.inlineConfirmActions}>
                              <Pressable
                                onPress={() => setSparkInlineConfirm(null)}
                                style={styles.inlineCancelBtn}
                              >
                                <Text style={styles.inlineCancelBtnText}>Cancel</Text>
                              </Pressable>
                              <Pressable
                                onPress={executeReleaseInspectedSpark}
                                style={styles.inlinePrimaryConfirmBtn}
                              >
                                <Text style={styles.inlinePrimaryConfirmBtnText}>
                                  Release
                                </Text>
                              </Pressable>
                            </View>
                          </View>
                        ) : sparkInlineConfirm === 'delete' ? (
                          <View style={styles.inlineDeleteEmberBox}>
                            <Text style={styles.inlineDeleteEmberTitle}>
                              Delete Participating Spark?
                            </Text>
                            <Text style={styles.inlineDeleteEmberBody}>
                              Permanently deletes &ldquo;{inspectedSpark.title}&rdquo; and removes it from {title}.
                            </Text>
                            <View style={styles.inlineConfirmActions}>
                              <Pressable
                                onPress={() => setSparkInlineConfirm(null)}
                                style={styles.inlineCancelBtn}
                              >
                                <Text style={styles.inlineCancelBtnText}>Cancel</Text>
                              </Pressable>
                              <Pressable
                                onPress={executeDeleteInspectedSpark}
                                style={styles.inlineDangerConfirmBtn}
                              >
                                <Text style={styles.inlineDangerConfirmBtnText}>
                                  Delete Spark
                                </Text>
                              </Pressable>
                            </View>
                          </View>
                        ) : (
                          <View style={styles.inspectedSparkActions}>
                            <Pressable
                              onPress={() => setSparkInlineConfirm('release')}
                              style={styles.releaseInEmberBtn}
                            >
                              <Text style={styles.releaseInEmberBtnTitle}>
                                Release to Lingering
                              </Text>
                              <Text style={styles.releaseInEmberBtnHint}>
                                Detach from {title} · keep both Spark and Ember
                              </Text>
                            </Pressable>

                            <Pressable
                              onPress={() => setSparkInlineConfirm('delete')}
                              style={styles.deleteInEmberBtn}
                            >
                              <Text style={styles.deleteInEmberBtnText}>
                                Delete Spark
                              </Text>
                            </Pressable>
                          </View>
                        )}
                      </>
                    )}
                  </>
                )}

                <Pressable
                  onPress={closeSparkInspector}
                  style={styles.pickerCloseBtn}
                >
                  <Text style={styles.pickerCloseText}>Close</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Complete Ember Modal (with Inline Confirmation) ── */}
      <Modal
        visible={showCompleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCompleteModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowCompleteModal(false)}
        >
          <Pressable style={styles.completeSheet} onPress={() => {}}>
            <Text style={styles.completeBadge}>✦ COMPLETE EMBER</Text>
            <Text style={styles.completeTitle} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.completeSubtitle}>
              Assembled strictly from persisted material. Copy or share this record before completing and clearing the Ember from the active workspace.
            </Text>

            <ScrollView
              style={styles.completeRecordScroll}
              contentContainerStyle={styles.completeRecordContent}
              showsVerticalScrollIndicator
            >
              <Text selectable style={styles.completeRecordText}>
                {completionMarkdown}
              </Text>
            </ScrollView>

            <View style={styles.completeExportRow}>
              <Pressable
                onPress={handleCopyCompletion}
                style={[
                  styles.completeExportBtn,
                  copiedCompletion && styles.completeExportBtnCopied,
                ]}
              >
                <Text
                  style={[
                    styles.completeExportBtnText,
                    copiedCompletion && styles.completeExportBtnTextCopied,
                  ]}
                >
                  {copiedCompletion ? '✓ Copied to Clipboard' : 'Copy Record'}
                </Text>
              </Pressable>

              <Pressable
                onPress={handleShareCompletion}
                style={styles.completeExportBtn}
              >
                <Text style={styles.completeExportBtnText}>Share Record</Text>
              </Pressable>
            </View>

            {!confirmingCompleteClear ? (
              <Pressable
                onPress={() => setConfirmingCompleteClear(true)}
                style={styles.completeConfirmBtn}
              >
                <Text style={styles.completeConfirmBtnText}>
                  Complete & Clear from Workspace
                </Text>
                <Text style={styles.completeConfirmBtnHint}>
                  {participatingSparks.length > 0
                    ? `${participatingSparks.length} participating Spark${participatingSparks.length === 1 ? '' : 's'} return${participatingSparks.length === 1 ? 's' : ''} to Lingering`
                    : 'Removes active Ember record and returns to Embers'}
                </Text>
              </Pressable>
            ) : (
              <View style={styles.inlineWarmConfirmBox}>
                <Text style={styles.inlineWarmConfirmTitle}>
                  Complete & Clear &ldquo;{title}&rdquo;?
                </Text>
                <Text style={styles.inlineWarmConfirmSub}>
                  {participatingSparks.length > 0
                    ? `Clears the active workspace record and returns ${participatingSparks.length} participating Spark${
                        participatingSparks.length === 1 ? '' : 's'
                      } to Lingering Sparks.`
                    : 'Clears the active workspace record and returns to Embers.'}
                </Text>
                <View style={styles.inlineConfirmActions}>
                  <Pressable
                    onPress={() => setConfirmingCompleteClear(false)}
                    style={styles.inlineCancelBtn}
                  >
                    <Text style={styles.inlineCancelBtnText}>Keep Open</Text>
                  </Pressable>
                  <Pressable
                    onPress={executeCompleteAndClear}
                    style={styles.inlinePrimaryConfirmBtn}
                  >
                    <Text style={styles.inlinePrimaryConfirmBtnText}>
                      Complete & Clear
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

            <Pressable
              onPress={() => setShowCompleteModal(false)}
              style={styles.pickerCloseBtn}
            >
              <Text style={styles.pickerCloseText}>Keep Working on Ember</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </Container>
  );
}

// ── Simple Markdown Renderer ────────────────

function renderMarkdownBlocks(markdown: string) {
  const lines = markdown.split('\n');
  const blocks: React.JSX.Element[] = [];
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('# ')) {
      blocks.push(
        <Text key={key++} style={mdStyles.h1}>
          {line.replace(/^# /, '')}
        </Text>,
      );
      continue;
    }

    if (line.startsWith('## ')) {
      blocks.push(
        <Text key={key++} style={mdStyles.h2}>
          {line.replace(/^## /, '')}
        </Text>,
      );
      continue;
    }

    if (line.trim() === '>') {
      blocks.push(<View key={key++} style={mdStyles.spacer} />);
      continue;
    }

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

    if (line.trim() === '') {
      blocks.push(<View key={key++} style={mdStyles.spacer} />);
      continue;
    }

    blocks.push(
      <Text key={key++} style={mdStyles.paragraph}>
        {renderInline(line)}
      </Text>,
    );
  }

  return blocks;
}

function renderInline(text: string): string {
  let cleaned = text.replace(/\*\*(.+?)\*\*/g, '$1');
  cleaned = cleaned.replace(/\*(.+?)\*/g, '$1');
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
  headerTitle: {
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: '500',
    color: COLORS.textPrimary,
    letterSpacing: TYPOGRAPHY.letterSpacing.normal,
  },
  editButton: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: '700',
    color: COLORS.emberOrange,
    paddingHorizontal: SPACING.xs,
  },
  embeddedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: '#1A1713',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 107, 43, 0.14)',
  },
  embeddedNature: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 1.2,
  },
  embeddedEditButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.25)',
    backgroundColor: 'rgba(255, 107, 43, 0.05)',
  },
  embeddedEditText: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 9,
    fontWeight: '600',
    color: COLORS.textSecondary,
    letterSpacing: 0.6,
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
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xl * 3,
  },

  // Constellation Signature Banner
  constellationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 77, 0.16)',
    backgroundColor: '#161511',
    marginBottom: SPACING.sm,
  },
  constellationBannerTextCol: {
    flex: 1,
    gap: 3,
  },
  constellationStageLabel: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.emberGold,
    letterSpacing: 1.1,
  },
  constellationMetaLine: {
    fontSize: 11,
    color: '#BAA28A',
    letterSpacing: 0.3,
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

  // Participating Sparks (Quiet Cards)
  sparksSection: {
    marginTop: SPACING.xl,
    gap: SPACING.sm,
  },
  sparksSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sparksSectionTitle: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 1.5,
  },
  emptySparksHint: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  sparkItem: {
    backgroundColor: '#161511',
    borderRadius: 10,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 77, 0.14)',
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(255, 180, 100, 0.45)',
    gap: 5,
  },
  sparkItemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  sparkItemTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flex: 1,
  },
  sparkItemGlyph: {
    fontSize: 10,
    color: COLORS.emberGold,
  },
  sparkItemTitle: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: '600',
    color: COLORS.textPrimary,
    flex: 1,
  },
  inspectedSparkActions: {
    gap: SPACING.xs + 2,
    marginTop: SPACING.sm,
  },
  releaseInEmberBtn: {
    backgroundColor: '#1E1B16',
    borderWidth: 1,
    borderColor: '#4A3727',
    borderRadius: 10,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    gap: 2,
  },
  releaseInEmberBtnTitle: {
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: '600',
    color: '#F5ECE0',
  },
  releaseInEmberBtnHint: {
    fontSize: 10,
    color: '#8F7A65',
  },
  deleteInEmberBtn: {
    paddingVertical: SPACING.xs + 2,
    alignItems: 'center',
  },
  deleteInEmberBtnText: {
    fontSize: 11,
    color: '#D97757',
    letterSpacing: 0.4,
  },
  sparkItemContent: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },
  sparkItemDate: {
    fontSize: 9,
    color: COLORS.textMuted,
  },
  emberSparkActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: 4,
  },
  catchInEmberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.35)',
    backgroundColor: 'rgba(255, 107, 43, 0.08)',
  },
  catchInEmberGlyph: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.emberOrange,
  },
  catchInEmberText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.emberOrange,
  },
  bringInEmberBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.2)',
    backgroundColor: 'rgba(255, 107, 43, 0.04)',
  },
  bringInEmberText: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  inlineNoticeBox: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 87, 0.4)',
    backgroundColor: '#241411',
  },
  inlineNoticeText: {
    fontSize: 12,
    color: '#FFD8CE',
  },

  // Develop further (bridge)
  developSection: {
    marginTop: SPACING.xl * 2,
    alignItems: 'center',
    gap: SPACING.md,
  },
  developDivider: {
    width: 40,
    height: 1,
    backgroundColor: COLORS.emberOrange,
    opacity: 0.2,
  },
  developButton: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.25)',
    backgroundColor: 'rgba(255, 107, 43, 0.06)',
    gap: SPACING.xs,
  },
  developButtonText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: '600',
    color: COLORS.emberOrange,
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
  },
  developButtonHint: {
    fontSize: 9,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    letterSpacing: 0.5,
  },

  // Completed movement indicators
  completedMovement: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    gap: 2,
  },
  completedText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: '600',
    color: COLORS.emberOrange,
    opacity: 0.8,
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
  },
  completedHint: {
    fontSize: 9,
    color: COLORS.textMuted,
    letterSpacing: 0.5,
  },

  // Generate button
  generateButton: {
    borderColor: 'rgba(255, 107, 43, 0.4)',
    backgroundColor: 'rgba(255, 107, 43, 0.1)',
  },
  generateButtonText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: '700',
    color: COLORS.emberOrange,
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
  },

  // Complete Ember (main progression button when Design Pack exists)
  completeEmberMainButton: {
    borderColor: 'rgba(255, 179, 71, 0.45)',
    backgroundColor: 'rgba(255, 179, 71, 0.1)',
  },
  completeEmberMainText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: '700',
    color: COLORS.emberGold,
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
  },

  // Lifecycle footer (Complete or Inline Delete Ember)
  lifecycleFooter: {
    marginTop: SPACING.xl,
    marginBottom: SPACING.xl,
    alignItems: 'center',
    gap: SPACING.sm,
    width: '100%',
  },
  completeFooterButton: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 179, 71, 0.28)',
    backgroundColor: 'rgba(255, 179, 71, 0.05)',
  },
  completeFooterButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.emberGold,
    letterSpacing: 0.8,
  },
  removeButton: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  removeButtonText: {
    fontSize: 10,
    color: COLORS.textMuted,
    letterSpacing: 1,
    opacity: 0.65,
  },

  // Inline Confirmation Boxes (Replacing OS Alert.alert)
  inlineDeleteEmberBox: {
    width: '100%',
    backgroundColor: '#241411',
    borderWidth: 1,
    borderColor: 'rgba(229, 124, 98, 0.45)',
    borderRadius: 12,
    padding: SPACING.md,
    gap: 8,
    marginTop: 6,
  },
  inlineDeleteEmberTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFD8CE',
  },
  inlineDeleteEmberBody: {
    fontSize: 11,
    color: '#D8C2B0',
    lineHeight: 16,
  },
  inlineWarmConfirmBox: {
    width: '100%',
    backgroundColor: '#1E1812',
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 77, 0.4)',
    borderRadius: 10,
    padding: SPACING.md,
    gap: 6,
    marginTop: 6,
  },
  inlineWarmConfirmTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F5ECE0',
  },
  inlineWarmConfirmSub: {
    fontSize: 11,
    color: '#C4B19B',
    lineHeight: 16,
  },
  inlineConfirmActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
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
  inlineDangerConfirmBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#C84B31',
  },
  inlineDangerConfirmBtnText: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF5E6',
  },
  inlinePrimaryConfirmBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.emberOrange,
  },
  inlinePrimaryConfirmBtnText: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.deepCharcoal,
  },

  // Inspector Edit Styles
  inspectorHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  inspectorEditPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.3)',
    backgroundColor: 'rgba(255, 107, 43, 0.08)',
  },
  inspectorEditPillText: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.emberOrange,
  },
  inspectorEditContainer: {
    gap: SPACING.sm,
    marginVertical: 4,
  },
  inspectorTitleInput: {
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
  inspectorContentInput: {
    backgroundColor: '#12110E',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.3)',
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textPrimary,
    minHeight: 92,
    maxHeight: 160,
  },

  // Complete Ember Modal Sheet
  completeSheet: {
    backgroundColor: '#171511',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#6B482E',
    padding: SPACING.lg,
    width: '100%',
    maxWidth: 380,
    maxHeight: '84%',
    gap: SPACING.sm,
  },
  completeBadge: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.emberGold,
    letterSpacing: 1.4,
  },
  completeTitle: {
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: '600',
    color: '#F5ECE0',
  },
  completeSubtitle: {
    fontSize: 11,
    color: '#8F7A65',
    lineHeight: 16,
  },
  completeRecordScroll: {
    maxHeight: 240,
    backgroundColor: '#12110E',
    borderWidth: 1,
    borderColor: '#3A2B1E',
    borderRadius: 8,
    marginVertical: 4,
  },
  completeRecordContent: {
    padding: SPACING.md,
  },
  completeRecordText: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 11,
    color: '#D8CFC2',
    lineHeight: 17,
  },
  completeExportRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  completeExportBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.35)',
    backgroundColor: 'rgba(255, 107, 43, 0.08)',
  },
  completeExportBtnCopied: {
    borderColor: 'rgba(255, 179, 71, 0.6)',
    backgroundColor: 'rgba(255, 179, 71, 0.14)',
  },
  completeExportBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.emberOrange,
  },
  completeExportBtnTextCopied: {
    color: COLORS.emberGold,
  },
  completeConfirmBtn: {
    alignItems: 'center',
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 179, 71, 0.45)',
    backgroundColor: 'rgba(255, 179, 71, 0.12)',
    marginTop: 2,
    gap: 2,
  },
  completeConfirmBtnText: {
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: '700',
    color: COLORS.emberGold,
    letterSpacing: 0.4,
  },
  completeConfirmBtnHint: {
    fontSize: 9,
    color: '#A8947D',
    fontStyle: 'italic',
  },

  // Picker Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.74)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  pickerSheet: {
    backgroundColor: '#171511',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#6B482E',
    padding: SPACING.lg,
    width: '100%',
    maxWidth: 368,
    maxHeight: '78%',
  },
  pickerTitle: {
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: '600',
    color: '#F5ECE0',
    marginBottom: 4,
  },
  pickerSubtitle: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: '#8F7A65',
    marginBottom: SPACING.md,
  },
  pickerList: {
    maxHeight: 280,
  },
  pickerSparkCard: {
    backgroundColor: '#12110E',
    borderWidth: 1,
    borderColor: '#3A2B1E',
    borderRadius: 8,
    padding: SPACING.sm + 2,
    marginBottom: SPACING.xs + 2,
    gap: 4,
  },
  pickerSparkHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerSparkTitle: {
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: '600',
    color: '#F5ECE0',
    flex: 1,
    marginRight: 8,
  },
  pickerSparkAction: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.emberOrange,
    letterSpacing: 0.8,
  },
  pickerSparkContent: {
    fontSize: 11,
    color: COLORS.textSecondary,
    lineHeight: 15,
  },
  pickerCloseBtn: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    marginTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 107, 43, 0.12)',
  },
  pickerCloseText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textMuted,
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
    marginTop: SPACING.xs,
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
