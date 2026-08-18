// ─────────────────────────────────────────────
// Create Ember — The Initiation
//
// "What does it mean for an Ember to come into existence?"
//
// A single flowing screen — not a wizard, not steps.
// A warm, gentle, scrollable surface that asks only
// enough to begin.
//
// Sections (all optional except nature):
//   1. "What is beginning?" — nature selection
//   2. "Give it a name, if one has arrived"
//   3. "Is there anything you want to bring with you?"
//   4. "Any questions worth carrying?"
//   5. "In a few words..." — carried sentence
//   6. "Begin" — persist & enter
// ─────────────────────────────────────────────

import { useState, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';

import { COLORS, TYPOGRAPHY, SPACING } from '@/theme';
import {
  type EmberNature,
  type EmberSource,
  EMBER_NATURE_LABELS,
  EMBER_NATURE_HINTS,
  createEmberSeed,
} from '@/core';
import { saveEmber } from '@/services/ember-storage';

// ── Nature Selection ────────────────────────

const NATURES: EmberNature[] = ['project', 'idea', 'principle', 'open'];

interface NaturePillProps {
  nature: EmberNature;
  selected: boolean;
  onPress: () => void;
}

function NaturePill({ nature, selected, onPress }: NaturePillProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.naturePill, selected && styles.naturePillSelected]}
    >
      <Text
        style={[
          styles.naturePillLabel,
          selected && styles.naturePillLabelSelected,
        ]}
      >
        {EMBER_NATURE_LABELS[nature]}
      </Text>
      {selected && (
        <Text style={styles.naturePillHint}>
          {EMBER_NATURE_HINTS[nature]}
        </Text>
      )}
    </Pressable>
  );
}

// ── Source Chip ──────────────────────────────

interface SourceChipProps {
  source: EmberSource;
  onRemove: () => void;
}

function SourceChip({ source, onRemove }: SourceChipProps) {
  return (
    <View style={styles.sourceChip}>
      <Text style={styles.sourceChipText} numberOfLines={1}>
        📎 {source.name}
      </Text>
      <Pressable onPress={onRemove} hitSlop={8}>
        <Text style={styles.sourceChipRemove}>✕</Text>
      </Pressable>
    </View>
  );
}

// ── Create Screen ───────────────────────────

export default function CreateEmberScreen() {
  // Form state
  const [nature, setNature] = useState<EmberNature | null>(null);
  const [name, setName] = useState('');
  const [spark, setSpark] = useState('');
  const [questionsText, setQuestionsText] = useState('');
  const [carriedSentence, setCarriedSentence] = useState('');
  const [sources, setSources] = useState<EmberSource[]>([]);
  const [isSaving, setIsSaving] = useState(false);

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
    if (!nature) {
      Alert.alert('What is beginning?', 'Choose a nature for your Ember.');
      return;
    }

    setIsSaving(true);

    try {
      // Parse questions: each non-empty line becomes a question
      const questions = questionsText
        .split('\n')
        .map((q) => q.trim())
        .filter((q) => q.length > 0);

      const seed = createEmberSeed(nature, {
        name: name.trim() || undefined,
        spark: spark.trim() || undefined,
        questions,
        carriedSentence: carriedSentence.trim() || undefined,
        sources,
      });

      saveEmber(seed);

      if (__DEV__) {
        console.log(`🔥 [Ember] Created: ${seed.id} (${seed.nature})`);
      }

      // Navigate to the Ember view
      router.replace(`/(main)/ember/${seed.id}` as any);
    } catch (error) {
      Alert.alert('Something went wrong', 'Could not create the Ember.');
      if (__DEV__) {
        console.error('🔥 [Ember] Create error:', error);
      }
    } finally {
      setIsSaving(false);
    }
  }, [nature, name, spark, questionsText, carriedSentence, sources]);

  // ── Go back ──
  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }, []);

  return (
    <SafeAreaView style={styles.container}>
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
          <Pressable onPress={handleBack} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>

          <View style={styles.header}>
            <Text style={styles.headerTitle}>Create Ember</Text>
            <View style={styles.headerDivider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerGlyph}>◆</Text>
              <View style={styles.dividerLine} />
            </View>
          </View>

          {/* ── Section 1: Nature ── */}
          <View style={styles.section}>
            <Text style={styles.sectionQuestion}>What is beginning?</Text>
            <View style={styles.natureGrid}>
              {NATURES.map((n) => (
                <NaturePill
                  key={n}
                  nature={n}
                  selected={nature === n}
                  onPress={() => setNature(n)}
                />
              ))}
            </View>
          </View>

          {/* ── Section 2: Name ── */}
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

          {/* ── Section 3: Spark / Source ── */}
          <View style={styles.section}>
            <Text style={styles.sectionQuestion}>
              Is there anything you want to bring with you?
            </Text>

            <TextInput
              style={[styles.textInput, styles.multilineInput]}
              value={spark}
              onChangeText={setSpark}
              placeholder="A thought, a seed, something that sparked this..."
              placeholderTextColor={COLORS.textMuted}
              multiline
              textAlignVertical="top"
            />

            {/* Source references */}
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
                📄 Bring a file
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
            disabled={!nature || isSaving}
            style={[
              styles.beginButton,
              (!nature || isSaving) && styles.beginButtonDisabled,
            ]}
          >
            {isSaving ? (
              <ActivityIndicator color={COLORS.deepCharcoal} size="small" />
            ) : (
              <Text
                style={[
                  styles.beginText,
                  !nature && styles.beginTextDisabled,
                ]}
              >
                Begin
              </Text>
            )}
          </Pressable>

          <Text style={styles.footerHint}>
            Everything except nature is optional.{'\n'}
            You can always add more from inside the Ember.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    marginBottom: SPACING.sm,
    letterSpacing: TYPOGRAPHY.letterSpacing.normal,
  },
  sectionHint: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.textMuted,
    marginBottom: SPACING.sm,
    fontStyle: 'italic',
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
  },

  // Nature pills
  natureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  naturePill: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.25)',
    backgroundColor: 'rgba(255, 107, 43, 0.05)',
    minWidth: 80,
    alignItems: 'center',
  },
  naturePillSelected: {
    borderColor: COLORS.emberOrange,
    backgroundColor: 'rgba(255, 107, 43, 0.15)',
  },
  naturePillLabel: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
  },
  naturePillLabelSelected: {
    color: COLORS.emberOrange,
  },
  naturePillHint: {
    fontSize: 9,
    color: COLORS.textMuted,
    marginTop: 2,
    textAlign: 'center',
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

  // Sources
  sourcesContainer: {
    marginTop: SPACING.sm,
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
    marginTop: SPACING.sm,
    alignSelf: 'flex-start',
    paddingVertical: SPACING.xs,
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
  beginTextDisabled: {
    color: COLORS.textMuted,
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
});
