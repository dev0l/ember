// ─────────────────────────────────────────────
// Ember View
//
// "The user may see the Markdown directly during this prototype."
//
// Loads a persisted Ember by ID and renders its Markdown content,
// its Participating Sparks (with in-place Spark capture and
// lingering Spark participation), and its Inquiry progression.
// ─────────────────────────────────────────────

import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';

import { COLORS, TYPOGRAPHY, SPACING } from '@/theme';
import type { EmberSeed } from '@/core';
import type { Spark } from '@/core/spark-types';
import { loadEmber, deleteEmber } from '@/services/ember-storage';
import { serializeEmberMarkdown } from '@/services/ember-markdown';
import { listSparks, saveSpark, associateSparksWithEmber } from '@/services/spark-storage';
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

/**
 * Composes the verbatim originalMaterial passed to Design Pack generation.
 * Preserves legacy `seed.spark` text AND includes all participating Sparks,
 * while avoiding duplicate blocks when an older Ember copied its initial
 * participating Spark text into `seed.spark`.
 */
export function buildEmberOriginalMaterial(
  seed: EmberSeed,
  participatingSparks: Spark[],
): string | undefined {
  const seedSpark = seed.spark?.trim() ?? '';
  const sparkContents = participatingSparks
    .map((s) => s.content.trim())
    .filter((text) => text.length > 0);

  const blocks: string[] = [];
  if (seedSpark.length > 0) {
    blocks.push(seedSpark);
  }

  for (const text of sparkContents) {
    if (!seedSpark.includes(text) && !blocks.includes(text)) {
      blocks.push(text);
    }
  }

  return blocks.length > 0 ? blocks.join('\n\n') : undefined;
}

export interface EmberViewScreenProps {
  emberId?: string;
  hideHeader?: boolean;
  onBack?: () => void;
  onEdit?: () => void;
  onRemoved?: () => void;
  onOpenSession?: (inquiryId: string, movement: 'explore' | 'develop') => void;
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
  const [designPack, setDesignPack] = useState<{ version: number; staleness: 'current' | 'stale' | 'unknown' } | null>(null);
  const [loading, setLoading] = useState(true);

  // Contextual Spark capture & Lingering Spark picker modals
  const [showQuickCapture, setShowQuickCapture] = useState(false);
  const [showLingeringPicker, setShowLingeringPicker] = useState(false);
  const [lingeringSparks, setLingeringSparks] = useState<Spark[]>([]);

  // Reload data whenever id changes or screen comes into focus
  const loadData = useCallback(() => {
    if (!id) return;
    setLoading(true);
    const loadedSeed = loadEmber(id);

    // Find Sparks that participate in this Ember
    const associated = listSparks('ember-associated')
      .filter((s) => s.emberId === id);
    setParticipatingSparks(associated);

    if (loadedSeed) {
      // If a legacy Ember's `seed.spark` is identical to the joined content of its
      // participating Sparks, omit the redundant `## Spark` markdown block so the
      // thought is rendered once in Participating Sparks. If `seed.spark` holds
      // distinct legacy text, keep it visible.
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

    // Ensure an Inquiry exists for this Ember and evaluate its engine state
    const inq = ensureInquiryForEmber(id, loadedSeed?.name);
    setInquiryInfo(inq);

    const evidence = loadInquiryEvidence(inq.id);
    const state = evaluateInquiry(evidence);
    setInquiryState(state);

    // Load latest Design Pack if one exists
    const pack = loadLatestDesignPack(inq.id);
    if (pack) {
      const staleness = designPackStaleness(pack.record?.reviewFingerprint, state);
      setDesignPack({ version: pack.version, staleness });
    } else {
      setDesignPack(null);
    }

    setLoading(false);
  }, [id]);

  useFocusEffect(loadData);

  useEffect(() => {
    loadData();
  }, [loadData, refreshTrigger]);

  // Proactively reload when isFocused flips to true within the stage
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
      // Immediately evaluate and refresh state
      const evidence = loadInquiryEvidence(inquiryInfo.id);
      const updated = evaluateInquiry(evidence);
      setInquiryState(updated);
      // Open session directly into Develop movement
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

  // ── Generate Design Pack: available only when warranted (once per Inquiry in this release) ──
  const handleGenerateFromEmber = useCallback(() => {
    if (!inquiryInfo || !inquiryState || !seed || designPack) return;
    const evidence = loadInquiryEvidence(inquiryInfo.id);
    const originalMaterial = buildEmberOriginalMaterial(seed, participatingSparks);

    const result = generateDesignPack(
      evidence,
      {
        title: seed.name || 'Untitled Ember',
        originalMaterial,
      },
      new Date().toISOString(),
    );

    if (!result.ok) {
      Alert.alert('Generation refused', result.reason);
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

      setDesignPack({ version: nextVersion, staleness: 'current' });
      onCloseSession?.();
      router.push({
        pathname: '/(main)/design-pack/[id]',
        params: { id: inquiryInfo.id },
      } as any);
    } catch (error) {
      Alert.alert('Generation failed', 'Something went wrong saving the Design Pack.');
      if (__DEV__) console.error('🔥 [Ember] Design Pack generation error:', error);
    }
  }, [inquiryInfo, inquiryState, seed, participatingSparks, designPack, onCloseSession]);

  // ── Remove Ember ──
  // Guardian amendment: only undeveloped Embers can be removed cleanly.
  // Developed Embers encounter the relational boundary.
  const handleRemove = useCallback(() => {
    if (!seed || !id) return;

    const hasLineage = Boolean(
      (inquiryState && inquiryState.questions.some(q => q.answer !== undefined)) ||
      designPack !== null,
    );

    if (hasLineage) {
      // This Ember has an associated Inquiry with answers or packs — removal is relationally non-trivial
      Alert.alert(
        'Removal boundary',
        'This Ember has been developed into an Inquiry. Removing an Ember with existing Inquiry lineage requires answering questions about what happens to conditions, propositions, and any generated artifacts.\n\nThis boundary has become relationally non-trivial. Removal for developed Embers is deferred to the database cycle.',
        [{ text: 'OK' }],
      );
      return;
    }

    Alert.alert(
      'Remove Ember',
      `Remove this Ember?${participatingSparks.length > 0 ? ` ${participatingSparks.length} participating Spark${participatingSparks.length > 1 ? 's' : ''} will return to Lingering.` : ''}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            // Release participating Sparks to lingering
            for (const spark of participatingSparks) {
              saveSpark({ ...spark, status: 'lingering', emberId: undefined });
            }
            // Delete the EmberSeed
            deleteEmber(id);
            onSparksChanged?.();
            if (onRemoved) {
              onRemoved();
              return;
            }
            // Navigate away
            router.replace('/');
          },
        },
      ],
    );
  }, [seed, id, inquiryState, designPack, participatingSparks, onSparksChanged, onRemoved]);

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

  // Display title from seed
  const title = seed.name || `Untitled ${seed.nature.charAt(0).toUpperCase() + seed.nature.slice(1)}`;

  // Remove frontmatter from display markdown
  const displayMarkdown = markdown.replace(/^---\n[\s\S]*?\n---\n*/, '');

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
          <Text style={styles.embeddedNature}>
            {seed.nature ? seed.nature.toUpperCase() : 'EMBER'}
            {participatingSparks.length > 0
              ? ` · ${participatingSparks.length} SPARK${participatingSparks.length > 1 ? 'S' : ''}`
              : ''}
          </Text>
          <Pressable onPress={handleEdit} hitSlop={12} style={styles.embeddedEditButton}>
            <Text style={styles.embeddedEditText}>Edit Ember →</Text>
          </Pressable>
        </View>
      )}

      {/* ── Markdown Content ── */}
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Render markdown as styled text blocks */}
        {renderMarkdownBlocks(displayMarkdown)}

        {/* ── Participating Sparks ── */}
        <View style={styles.sparksSection}>
          <View style={styles.sparksSectionHeader}>
            <Text style={styles.sparksSectionTitle}>
              PARTICIPATING SPARKS · {participatingSparks.length}
            </Text>
          </View>

          {participatingSparks.length > 0 ? (
            participatingSparks.map((spark) => (
              <View key={spark.id} style={styles.sparkItem}>
                <Text style={styles.sparkItemTitle} numberOfLines={1}>
                  {spark.title}
                </Text>
                <Text style={styles.sparkItemContent}>
                  {spark.content}
                </Text>
                <Text style={styles.sparkItemDate}>
                  {formatDate(spark.createdAt)}
                </Text>
              </View>
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
              onPress={() => router.push({
                pathname: '/(main)/design-pack/[id]',
                params: { id: inquiryInfo!.id },
              } as any)}
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

        {/* ── Remove Ember ── */}
        <Pressable onPress={handleRemove} style={styles.removeButton}>
          <Text style={styles.removeButtonText}>
            Remove Ember
          </Text>
        </Pressable>
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
    </Container>
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
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 107, 43, 0.08)',
  },
  embeddedNature: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.emberOrange,
    letterSpacing: 1.2,
  },
  embeddedEditButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  embeddedEditText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
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

  // Participating Sparks
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
    backgroundColor: COLORS.surfaceDark,
    borderRadius: 8,
    padding: SPACING.md,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(255, 180, 100, 0.3)',
    gap: 3,
  },
  sparkItemTitle: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: '600',
    color: COLORS.textPrimary,
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
    paddingVertical: 5,
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
    paddingVertical: 5,
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

  // Generate button (slightly different emphasis)
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

  // Remove
  removeButton: {
    alignItems: 'center',
    marginTop: SPACING.xl * 2,
    marginBottom: SPACING.xl,
    paddingVertical: SPACING.sm,
  },
  removeButtonText: {
    fontSize: 10,
    color: COLORS.textMuted,
    letterSpacing: 1,
    opacity: 0.5,
  },

  // Picker Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
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
    maxWidth: 360,
    maxHeight: '72%',
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
