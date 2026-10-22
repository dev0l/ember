// ─────────────────────────────────────────────
// Create Ember — The Initiation
//
// "What does it mean for an Ember to come into existence?"
//
// A single flowing screen — not a wizard, not steps.
// A warm, gentle, scrollable surface that asks only
// enough to begin.
//
// Sections (all optional — nature defaults to 'open'):
//   1. "Give it a name, if one has arrived"
//   2. "Sparks participating in this Ember" — catch a new Spark
//      or bring lingering Sparks (true Spark entities)
//   3. "Files carried by this Ember" — distinct file references
//   4. "Any questions worth carrying?"
//   5. "In a few words..." — carried sentence
//   6. "Begin" — persist & enter
// ─────────────────────────────────────────────

import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  BackHandler,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';

import { COLORS, TYPOGRAPHY, SPACING } from '@/theme';
import {
  type EmberNature,
  type EmberSource,
  type EmberSeed,
  createEmberSeed,
} from '@/core';
import type { Spark } from '@/core/spark-types';
import { saveEmber } from '@/services/ember-storage';
import { listSparks, associateSparksWithEmber } from '@/services/spark-storage';
import { QuickCaptureModal } from '@/components/sparks/QuickCaptureModal';

// ── Source Chip ──────────────────────────────

interface SourceChipProps {
  source: EmberSource;
  onRemove: () => void;
}

function SourceChip({ source, onRemove }: SourceChipProps) {
  return (
    <View style={styles.sourceChip}>
      <Text style={styles.sourceChipText} numberOfLines={1}>
        {source.name}
      </Text>
      <Pressable onPress={onRemove} hitSlop={8}>
        <Text style={styles.sourceChipRemove}>✕</Text>
      </Pressable>
    </View>
  );
}

// ── Staged Spark Card ────────────────────────

interface StagedSparkCardProps {
  spark: Spark;
  onRemove: () => void;
}

function StagedSparkCard({ spark, onRemove }: StagedSparkCardProps) {
  return (
    <View style={styles.stagedSparkCard}>
      <View style={styles.stagedSparkTextGroup}>
        <Text style={styles.stagedSparkTitle} numberOfLines={1}>
          {spark.title}
        </Text>
        <Text style={styles.stagedSparkContent} numberOfLines={2}>
          {spark.content}
        </Text>
      </View>
      <Pressable onPress={onRemove} hitSlop={8} style={styles.stagedSparkRemoveBtn}>
        <Text style={styles.sourceChipRemove}>✕</Text>
      </Pressable>
    </View>
  );
}

// ── Create Screen ───────────────────────────

export interface CreateEmberScreenProps {
  hideHeader?: boolean;
  onCreated?: (seed: EmberSeed) => void;
  onCancel?: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
  /** Optional Spark captured from the stage header pill while CreateEmberScreen is open */
  externalStagedSpark?: Spark | null;
}

export default function CreateEmberScreen({
  hideHeader = false,
  onCreated,
  onCancel,
  onDirtyChange,
  externalStagedSpark,
}: CreateEmberScreenProps = {}) {
  // Form state
  const [nature] = useState<EmberNature>('open');
  const [name, setName] = useState('');
  const [selectedSparks, setSelectedSparks] = useState<Spark[]>([]);
  const [questionsText, setQuestionsText] = useState('');
  const [carriedSentence, setCarriedSentence] = useState('');
  const [sources, setSources] = useState<EmberSource[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Contextual Spark capture & Lingering Spark picker modals
  const [showQuickCapture, setShowQuickCapture] = useState(false);
  const [showLingeringPicker, setShowLingeringPicker] = useState(false);
  const [lingeringSparks, setLingeringSparks] = useState<Spark[]>([]);

  // Incorporate any Spark caught via the TerritoryStage header pill while creating
  useEffect(() => {
    if (!externalStagedSpark) return;
    setSelectedSparks((prev) =>
      prev.some((s) => s.id === externalStagedSpark.id)
        ? prev
        : [...prev, externalStagedSpark],
    );
  }, [externalStagedSpark]);

  // Dirty-state detection for unsaved meaningful input
  const isDirty = useMemo(() => {
    return (
      name.trim().length > 0 ||
      selectedSparks.length > 0 ||
      questionsText.trim().length > 0 ||
      carriedSentence.trim().length > 0 ||
      sources.length > 0
    );
  }, [name, selectedSparks.length, questionsText, carriedSentence, sources.length]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // ── Contextual Spark Capture & Lingering Spark Selection ──
  const handleSparkCaptured = useCallback((spark: Spark) => {
    setSelectedSparks((prev) =>
      prev.some((s) => s.id === spark.id) ? prev : [...prev, spark],
    );
  }, []);

  const handleOpenLingeringPicker = useCallback(() => {
    const allLingering = listSparks('lingering');
    setLingeringSparks(allLingering);
    setShowLingeringPicker(true);
  }, []);

  const handleToggleLingeringSpark = useCallback((spark: Spark) => {
    setSelectedSparks((prev) =>
      prev.some((s) => s.id === spark.id)
        ? prev.filter((s) => s.id !== spark.id)
        : [...prev, spark],
    );
  }, []);

  const handleRemoveStagedSpark = useCallback((id: string) => {
    setSelectedSparks((prev) => prev.filter((s) => s.id !== id));
  }, []);

  // ── Pick a file reference ──
  const handlePickFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const newSource: EmberSource = {
          id: `src-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
          name: asset.name,
          uri: asset.uri,
          mimeType: asset.mimeType ?? undefined,
          addedAt: new Date().toISOString(),
        };
        setSources((prev) => [...prev, newSource]);
      }
    } catch (error) {
      if (__DEV__) {
        console.warn('🔥 [Ember] Document picker error:', error);
      }
    }
  }, []);

  const handleRemoveSource = useCallback((id: string) => {
    setSources((prev) => prev.filter((s) => s.id !== id));
  }, []);

  // ── Create & persist ──
  const handleBegin = useCallback(() => {
    setIsSaving(true);

    try {
      // Parse questions: each non-empty line becomes a question
      const questions = questionsText
        .split('\n')
        .map((q) => q.trim())
        .filter((q) => q.length > 0);

      const seed = createEmberSeed(nature, {
        name: name.trim() || undefined,
        questions,
        carriedSentence: carriedSentence.trim() || undefined,
        sources,
      });

      saveEmber(seed);

      // Associate any selected or newly caught Sparks with this Ember
      if (selectedSparks.length > 0) {
        associateSparksWithEmber(
          selectedSparks.map((s) => s.id),
          seed.id,
        );
      }

      if (__DEV__) {
        console.log(`🔥 [Ember] Created: ${seed.id} (${seed.nature}) with ${selectedSparks.length} spark(s)`);
      }

      onDirtyChange?.(false);

      if (onCreated) {
        onCreated(seed);
        return;
      }

      // Fallback when opened via standalone route: return to TerritoryStage with the new Ember selected
      router.replace({
        pathname: '/',
        params: { openEmberId: seed.id },
      } as any);
    } catch (error) {
      Alert.alert('Something went wrong', 'Could not create the Ember.');
      if (__DEV__) {
        console.error('🔥 [Ember] Create error:', error);
      }
    } finally {
      setIsSaving(false);
    }
  }, [nature, name, selectedSparks, questionsText, carriedSentence, sources, onCreated, onDirtyChange]);

  // ── Discard & exit ──
  const discardAndExit = useCallback(() => {
    onDirtyChange?.(false);
    if (onCancel) {
      onCancel();
      return;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }, [onCancel, onDirtyChange]);

  // ── Guarded Go back / Cancel ──
  const handleBack = useCallback(() => {
    if (!isDirty) {
      discardAndExit();
      return;
    }
    Alert.alert(
      'Discard Unsaved Ember?',
      selectedSparks.length > 0
        ? 'Discard this unfinished Ember? Any Sparks you caught will remain safely in Lingering Sparks.'
        : 'You have unsaved thoughts in this new Ember. Discard them and return?',
      [
        { text: 'Keep Editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: discardAndExit,
        },
      ],
    );
  }, [isDirty, selectedSparks.length, discardAndExit]);

  // Standalone Android hardware Back guard (when embedded, TerritoryStage handles BackHandler)
  useEffect(() => {
    if (hideHeader) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true;
    });
    return () => sub.remove();
  }, [hideHeader, handleBack]);

  const Container = hideHeader ? View : SafeAreaView;

  return (
    <Container style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header ── */}
          <Pressable onPress={handleBack} style={styles.backButton} hitSlop={8}>
            <Text style={styles.backText}>
              {hideHeader ? '← Cancel' : '← Back'}
            </Text>
          </Pressable>

          <View style={styles.header}>
            <Text style={styles.headerTitle}>Create Ember</Text>
            <View style={styles.headerDivider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerGlyph}>◆</Text>
              <View style={styles.dividerLine} />
            </View>
          </View>

          {/* ── Section 1: Name ── */}
          <View style={styles.section}>
            <Text style={styles.sectionQuestion}>
              Give it a name, if one has arrived
            </Text>
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={setName}
              placeholder="A name may emerge later..."
              placeholderTextColor={COLORS.textMuted}
              returnKeyType="done"
            />
          </View>

          {/* ── Section 2: Participating Sparks (Coherent Spark Identity) ── */}
          <View style={styles.section}>
            <Text style={styles.sectionQuestion}>
              What sparked this, or what thoughts are participating?
            </Text>
            <Text style={styles.sectionHint}>
              Sparks remain coherent entities whether caught now or brought from Lingering Sparks.
            </Text>

            {selectedSparks.length > 0 && (
              <View style={styles.stagedSparksContainer}>
                {selectedSparks.map((s) => (
                  <StagedSparkCard
                    key={s.id}
                    spark={s}
                    onRemove={() => handleRemoveStagedSpark(s.id)}
                  />
                ))}
              </View>
            )}

            <View style={styles.sparkActionRow}>
              <Pressable
                onPress={() => setShowQuickCapture(true)}
                style={styles.catchSparkButton}
              >
                <Text style={styles.catchSparkGlyph}>⌁</Text>
                <Text style={styles.catchSparkText}>+ Catch a Spark</Text>
              </Pressable>

              <Pressable
                onPress={handleOpenLingeringPicker}
                style={styles.bringSparkButton}
              >
                <Text style={styles.bringSparkText}>+ Bring Lingering Spark</Text>
              </Pressable>
            </View>
          </View>

          {/* ── Section 3: Carried Files (Distinct from Sparks) ── */}
          <View style={styles.section}>
            <Text style={styles.sectionQuestion}>
              Files carried by this Ember
            </Text>
            <Text style={styles.sectionHint}>
              Reference documents or materials carried alongside your Sparks.
            </Text>

            {sources.length > 0 && (
              <View style={styles.sourcesContainer}>
                {sources.map((src) => (
                  <SourceChip
                    key={src.id}
                    source={src}
                    onRemove={() => handleRemoveSource(src.id)}
                  />
                ))}
              </View>
            )}

            <Pressable
              onPress={handlePickFile}
              style={styles.bringFileButton}
            >
              <Text style={styles.bringFileText}>
                + Bring a file
              </Text>
            </Pressable>
          </View>

          {/* ── Section 4: Questions ── */}
          <View style={styles.section}>
            <Text style={styles.sectionQuestion}>
              Any questions worth carrying?
            </Text>
            <Text style={styles.sectionHint}>
              Not tasks — just things worth holding. One per line.
            </Text>
            <TextInput
              style={[styles.textInput, styles.multilineInput]}
              value={questionsText}
              onChangeText={setQuestionsText}
              placeholder="What are you curious about?&#10;What tension do you want to preserve?"
              placeholderTextColor={COLORS.textMuted}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* ── Section 5: Carried Sentence ── */}
          <View style={styles.section}>
            <Text style={styles.sectionQuestion}>In a few words...</Text>
            <Text style={styles.sectionHint}>
              A small phrase that carries the essence (6-10 words)
            </Text>
            <TextInput
              style={styles.textInput}
              value={carriedSentence}
              onChangeText={setCarriedSentence}
              placeholder="What is this becoming?"
              placeholderTextColor={COLORS.textMuted}
              returnKeyType="done"
            />
          </View>

          {/* ── Begin ── */}
          <Pressable
            onPress={handleBegin}
            disabled={isSaving}
            style={[
              styles.beginButton,
              isSaving && styles.beginButtonDisabled,
            ]}
          >
            {isSaving ? (
              <ActivityIndicator color={COLORS.deepCharcoal} size="small" />
            ) : (
              <Text style={styles.beginText}>
                Begin
              </Text>
            )}
          </Pressable>

          <Text style={styles.footerHint}>
            Everything is optional.{'\n'}
            You can always add more from inside the Ember.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Contextual Quick Capture Modal (Does not unmount CreateEmberScreen) ── */}
      <QuickCaptureModal
        visible={showQuickCapture}
        contextMode="attach"
        targetEmberLabel={name.trim() || 'New Ember'}
        onClose={() => setShowQuickCapture(false)}
        onCaptured={handleSparkCaptured}
      />

      {/* ── Lingering Sparks Picker Modal ── */}
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
            <Text style={styles.pickerTitle}>Bring Lingering Sparks</Text>
            <Text style={styles.pickerSubtitle}>
              Tap to toggle Sparks that should participate in this Ember
            </Text>

            <FlatList
              data={lingeringSparks}
              keyExtractor={(item) => item.id}
              style={styles.pickerList}
              ListEmptyComponent={
                <Text style={styles.emptySparksText}>
                  No lingering Sparks yet. Use &ldquo;+ Catch a Spark&rdquo; to capture one now.
                </Text>
              }
              renderItem={({ item }) => {
                const isSelected = selectedSparks.some((s) => s.id === item.id);
                return (
                  <Pressable
                    onPress={() => handleToggleLingeringSpark(item)}
                    style={[
                      styles.pickerSparkCard,
                      isSelected && styles.pickerSparkCardSelected,
                    ]}
                  >
                    <View style={styles.pickerSparkRow}>
                      <Text style={styles.pickerSparkTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={styles.pickerCheck}>
                        {isSelected ? '◆ SELECTED' : '+ BRING'}
                      </Text>
                    </View>
                    <Text style={styles.pickerSparkContent} numberOfLines={2}>
                      {item.content}
                    </Text>
                  </Pressable>
                );
              }}
            />

            <Pressable
              onPress={() => setShowLingeringPicker(false)}
              style={styles.pickerDoneBtn}
            >
              <Text style={styles.pickerDoneText}>Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </Container>
  );
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
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl * 2,
  },

  // Back
  backButton: {
    paddingVertical: SPACING.md,
    alignSelf: 'flex-start',
  },
  backText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.emberOrange,
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
    gap: SPACING.sm,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.sizes.title,
    fontWeight: TYPOGRAPHY.weights.light,
    color: COLORS.emberOrange,
    letterSpacing: TYPOGRAPHY.letterSpacing.extraWide,
  },
  headerDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  dividerLine: {
    width: 32,
    height: 1,
    backgroundColor: COLORS.emberOrange,
    opacity: 0.3,
  },
  dividerGlyph: {
    fontSize: 6,
    color: COLORS.emberOrange,
    opacity: 0.5,
  },

  // Section
  section: {
    marginBottom: SPACING.xl,
  },
  sectionQuestion: {
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: '500',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
    letterSpacing: TYPOGRAPHY.letterSpacing.normal,
  },
  sectionHint: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.textMuted,
    marginBottom: SPACING.sm,
    fontStyle: 'italic',
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
  },

  // Text inputs
  textInput: {
    backgroundColor: COLORS.surfaceDark,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.12)',
    borderRadius: 10,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textPrimary,
    letterSpacing: TYPOGRAPHY.letterSpacing.normal,
  },
  multilineInput: {
    minHeight: 80,
    paddingTop: SPACING.sm + 2,
  },

  // Staged Sparks
  stagedSparksContainer: {
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  stagedSparkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceDark,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.25)',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.emberOrange,
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  stagedSparkTextGroup: {
    flex: 1,
    gap: 2,
  },
  stagedSparkTitle: {
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  stagedSparkContent: {
    fontSize: 11,
    color: COLORS.textSecondary,
    lineHeight: 15,
  },
  stagedSparkRemoveBtn: {
    padding: 4,
  },
  sparkActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: 4,
  },
  catchSparkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: SPACING.xs + 2,
    paddingHorizontal: SPACING.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.emberOrange,
    backgroundColor: 'rgba(255, 107, 43, 0.12)',
  },
  catchSparkGlyph: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.emberOrange,
  },
  catchSparkText: {
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: '600',
    color: COLORS.emberOrange,
    letterSpacing: 0.4,
  },
  bringSparkButton: {
    paddingVertical: SPACING.xs + 2,
    paddingHorizontal: SPACING.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.25)',
    backgroundColor: 'rgba(255, 107, 43, 0.05)',
  },
  bringSparkText: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.textSecondary,
    letterSpacing: 0.4,
  },

  // Sources
  sourcesContainer: {
    marginBottom: SPACING.sm,
    gap: SPACING.xs,
  },
  sourceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 43, 0.08)',
    borderRadius: 8,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    gap: SPACING.sm,
  },
  sourceChipText: {
    flex: 1,
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.textSecondary,
  },
  sourceChipRemove: {
    fontSize: 12,
    color: COLORS.textMuted,
    paddingHorizontal: 4,
  },
  bringFileButton: {
    alignSelf: 'flex-start',
    paddingVertical: SPACING.xs + 2,
    paddingHorizontal: SPACING.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.2)',
    backgroundColor: 'rgba(255, 107, 43, 0.05)',
  },
  bringFileText: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.textSecondary,
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
  },

  // Begin
  beginButton: {
    alignSelf: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl * 2,
    borderRadius: 28,
    backgroundColor: COLORS.emberOrange,
    marginTop: SPACING.lg,
    minWidth: 160,
    alignItems: 'center',
  },
  beginButtonDisabled: {
    backgroundColor: 'rgba(255, 107, 43, 0.2)',
  },
  beginText: {
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: '700',
    color: COLORS.deepCharcoal,
    letterSpacing: TYPOGRAPHY.letterSpacing.extraWide,
  },

  // Footer
  footerHint: {
    textAlign: 'center',
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.textMuted,
    marginTop: SPACING.lg,
    lineHeight: 16,
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
  },

  // Lingering Spark Picker Modal
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
  emptySparksText: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingVertical: SPACING.lg,
    fontStyle: 'italic',
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
  pickerSparkCardSelected: {
    borderColor: COLORS.emberOrange,
    backgroundColor: 'rgba(255, 107, 43, 0.1)',
  },
  pickerSparkRow: {
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
  pickerCheck: {
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
  pickerDoneBtn: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    marginTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 107, 43, 0.12)',
  },
  pickerDoneText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: '600',
    color: COLORS.emberOrange,
  },
});
