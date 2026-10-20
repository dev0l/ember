// ─────────────────────────────────────────────
// Edit Ember Screen
//
// Allows editing an existing Ember's fields:
//   name, spark, questions, carried sentence, nature.
// Loads the persisted EmberSeed, presents editable fields,
// and saves changes back to the Markdown file.
// ─────────────────────────────────────────────

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { COLORS, TYPOGRAPHY, SPACING } from '@/theme';
import {
  type EmberNature,
  type EmberSeed,
} from '@/core';
import { loadEmber, saveEmber } from '@/services/ember-storage';

export interface EditEmberScreenProps {
  emberId?: string;
  hideHeader?: boolean;
  onSaved?: (updated: EmberSeed) => void;
  onCancel?: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

export default function EditEmberScreen({
  emberId: propEmberId,
  hideHeader = false,
  onSaved,
  onCancel,
  onDirtyChange,
}: EditEmberScreenProps = {}) {
  const params = useLocalSearchParams<{ id: string }>();
  const id = propEmberId || params.id;

  const [seed, setSeed] = useState<EmberSeed | null>(null);
  const [nature, setNature] = useState<EmberNature>('open');
  const [name, setName] = useState('');
  const [spark, setSpark] = useState('');
  const [questionsText, setQuestionsText] = useState('');
  const [carriedSentence, setCarriedSentence] = useState('');

  // Load the existing Ember
  useEffect(() => {
    if (!id) return;
    const loaded = loadEmber(id);
    if (loaded) {
      setSeed(loaded);
      setNature(loaded.nature);
      setName(loaded.name || '');
      setSpark(loaded.spark || '');
      setQuestionsText(loaded.questions.join('\n'));
      setCarriedSentence(loaded.carriedSentence || '');
    }
  }, [id]);

  // Dirty-state detection comparing form fields against the loaded EmberSeed
  const isDirty = useMemo(() => {
    if (!seed) return false;
    const normalizedQuestions = questionsText
      .split('\n')
      .map((q) => q.trim())
      .filter((q) => q.length > 0)
      .join('\n');
    const originalQuestions = seed.questions
      .map((q) => q.trim())
      .filter((q) => q.length > 0)
      .join('\n');

    return (
      name.trim() !== (seed.name || '').trim() ||
      spark.trim() !== (seed.spark || '').trim() ||
      normalizedQuestions !== originalQuestions ||
      carriedSentence.trim() !== (seed.carriedSentence || '').trim()
    );
  }, [seed, name, spark, questionsText, carriedSentence]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const handleSave = useCallback(() => {
    if (!seed) return;

    try {
      const questions = questionsText
        .split('\n')
        .map((q) => q.trim())
        .filter((q) => q.length > 0);

      const updated: EmberSeed = {
        ...seed,
        nature,
        name: name.trim() || undefined,
        spark: spark.trim() || undefined,
        questions,
        carriedSentence: carriedSentence.trim() || undefined,
      };

      saveEmber(updated);
      onDirtyChange?.(false);

      if (__DEV__) {
        console.log(`🔥 [Ember] Updated: ${seed.id}`);
      }

      if (onSaved) {
        onSaved(updated);
        return;
      }

      // Fallback when opened as standalone route: go back to the ember view
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace({
          pathname: '/',
          params: { openEmberId: seed.id },
        } as any);
      }
    } catch (error) {
      Alert.alert('Something went wrong', 'Could not save changes.');
      if (__DEV__) {
        console.error('🔥 [Ember] Edit save error:', error);
      }
    }
  }, [seed, nature, name, spark, questionsText, carriedSentence, onSaved, onDirtyChange]);

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

  const handleCancel = useCallback(() => {
    if (!isDirty) {
      discardAndExit();
      return;
    }
    Alert.alert(
      'Discard Unsaved Changes?',
      'You have unsaved edits to this Ember. Discard your changes and return?',
      [
        { text: 'Keep Editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: discardAndExit,
        },
      ],
    );
  }, [isDirty, discardAndExit]);

  // Standalone Android hardware Back guard (when embedded, TerritoryStage handles BackHandler)
  useEffect(() => {
    if (hideHeader) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleCancel();
      return true;
    });
    return () => sub.remove();
  }, [hideHeader, handleCancel]);

  const Container = hideHeader ? View : SafeAreaView;

  if (!seed) {
    return (
      <Container style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Ember not found</Text>
        </View>
      </Container>
    );
  }

  return (
    <Container style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.headerBar}>
        <Pressable onPress={handleCancel} hitSlop={12}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Edit Ember</Text>
        <Pressable onPress={handleSave} hitSlop={12}>
          <Text style={styles.saveText}>Save</Text>
        </Pressable>
      </View>

      <View style={styles.divider} />

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
          {/* Nature preserved in data model but not user-editable —
              Ember cannot yet meaningfully honour the distinction */}

          {/* ── Name ── */}
          <View style={styles.section}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={setName}
              placeholder="Untitled"
              placeholderTextColor={COLORS.textMuted}
              returnKeyType="done"
            />
          </View>

          {/* ── Spark ── */}
          <View style={styles.section}>
            <Text style={styles.label}>Spark</Text>
            <TextInput
              style={[styles.textInput, styles.multilineInput]}
              value={spark}
              onChangeText={setSpark}
              placeholder="The initial seed..."
              placeholderTextColor={COLORS.textMuted}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* ── Questions ── */}
          <View style={styles.section}>
            <Text style={styles.label}>Questions Worth Preserving</Text>
            <Text style={styles.hint}>One per line</Text>
            <TextInput
              style={[styles.textInput, styles.multilineInput]}
              value={questionsText}
              onChangeText={setQuestionsText}
              placeholder="Questions to carry..."
              placeholderTextColor={COLORS.textMuted}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* ── Carried Sentence ── */}
          <View style={styles.section}>
            <Text style={styles.label}>Carried Sentence</Text>
            <Text style={styles.hint}>A compressed essence phrase</Text>
            <TextInput
              style={styles.textInput}
              value={carriedSentence}
              onChangeText={setCarriedSentence}
              placeholder="What is this becoming?"
              placeholderTextColor={COLORS.textMuted}
              returnKeyType="done"
            />
          </View>

          {/* ── Save Button ── */}
          <Pressable onPress={handleSave} style={styles.saveButton}>
            <Text style={styles.saveButtonText}>Save Changes</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Container>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.deepCharcoal,
  },
  flex: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: TYPOGRAPHY.sizes.md,
    color: COLORS.textSecondary,
  },

  // Header
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  cancelText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textSecondary,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
  },
  saveText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: '700',
    color: COLORS.emberOrange,
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

  // Section
  section: {
    marginBottom: SPACING.xl,
  },
  label: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
    textTransform: 'uppercase',
  },
  hint: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.textMuted,
    marginBottom: SPACING.xs,
    fontStyle: 'italic',
  },


  // Inputs
  textInput: {
    backgroundColor: COLORS.surfaceDark,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.12)',
    borderRadius: 10,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textPrimary,
  },
  multilineInput: {
    minHeight: 80,
    paddingTop: SPACING.sm + 2,
  },

  // Save
  saveButton: {
    alignSelf: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl * 2,
    borderRadius: 24,
    backgroundColor: COLORS.emberOrange,
    marginTop: SPACING.md,
  },
  saveButtonText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: '700',
    color: COLORS.deepCharcoal,
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
  },
});
