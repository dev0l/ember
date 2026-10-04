// ─────────────────────────────────────────────
// Ember Session Screen
//
// The enquiry interface. Where Sparks become attended to.
//
// Flow:
//   1. Foundational questions (3, always asked)
//   2. Choice: "Explore further" / "Generate from here"
//   3. Exploratory questions (conditional, voluntary)
//   4. Generate Design Pack
//
// Entry: always with an existing EmberProject ID.
// The crossing from EmberSeed → EmberProject happens
// in ember/[id].tsx before navigating here.
//
// "We don't necessarily need twenty-seven questions
//  before allowing the poor human to proceed." 😂
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
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { COLORS, TYPOGRAPHY, SPACING } from '@/theme';
import type {
  EmberProject,
  EmberAnswer,
  EstablishedCondition,
} from '@/core/ember-project-types';
import {
  getFoundationalQuestions,
  getAvailableExploratoryQuestions,
  QUESTION_LIBRARY,
} from '@/knowledge/questions';
import type { AuthoredQuestion, QuestionChoice } from '@/knowledge/questions';
import { evaluatePropositions, PROPOSITION_LIBRARY } from '@/knowledge/propositions';
import { generateDesignPack } from '@/engine/design-pack-generator';
import {
  saveProject,
  loadProject,
  saveDesignPack,
} from '@/services/ember-project-storage';


type SessionPhase =
  | 'foundational'
  | 'choice'
  | 'exploratory'
  | 'generating';

export default function EmberSessionScreen() {
  const params = useLocalSearchParams<{
    id: string;
    startPhase?: string;
  }>();

  // ── Derived question lists ──
  const foundationalQuestions = useMemo(
    () => getFoundationalQuestions(),
    [],
  );

  const initialLoadedProject = useMemo(() => {
    if (params.id) {
      return loadProject(params.id);
    }
    return null;
  }, [params.id]);

  // ── Session State ──
  const [project, setProject] = useState<EmberProject | null>(initialLoadedProject);

  const [phase, setPhase] = useState<SessionPhase>(() => {
    // Direct entry into exploratory phase (from Ember View's "Explore Further")
    if (
      params.startPhase === 'exploratory' &&
      initialLoadedProject &&
      initialLoadedProject.answers.length >= foundationalQuestions.length
    ) {
      return 'exploratory';
    }
    if (
      initialLoadedProject &&
      initialLoadedProject.answers.length >= foundationalQuestions.length
    ) {
      return 'choice';
    }
    return 'foundational';
  });

  // Track current question index within current phase
  const [questionIndex, setQuestionIndex] = useState(() => {
    if (!initialLoadedProject) return 0;
    if (initialLoadedProject.answers.length < foundationalQuestions.length) {
      return initialLoadedProject.answers.length;
    }
    return 0;
  });
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);

  const exploratoryQuestions = useMemo(() => {
    if (!project) return [];
    const conditions = project.conditions.map((c) => c.id);
    return getAvailableExploratoryQuestions(
      project.askedQuestionIds,
      conditions,
    );
  }, [project]);

  // ── Current question ──
  const currentQuestion: AuthoredQuestion | null = useMemo(() => {
    if (phase === 'foundational') {
      return foundationalQuestions[questionIndex] ?? null;
    }
    if (phase === 'exploratory') {
      return exploratoryQuestions[questionIndex] ?? null;
    }
    return null;
  }, [phase, questionIndex, foundationalQuestions, exploratoryQuestions]);

  // ── Handle generate ──
  const handleGenerate = useCallback(
    (proj?: EmberProject) => {
      const p = proj ?? project;
      if (!p) return;

      setPhase('generating');

      try {
        const markdown = generateDesignPack(p);
        const version = p.designPackVersion + 1;

        saveDesignPack(p.id, version, markdown);

        const updated: EmberProject = {
          ...p,
          status: 'generated',
          designPackVersion: version,
          updatedAt: new Date().toISOString(),
        };
        saveProject(updated);
        setProject(updated);

        // Navigate to the Design Pack view
        router.replace({
          pathname: '/(main)/design-pack/[id]',
          params: { id: p.id },
        } as any);
      } catch (error) {
        Alert.alert(
          'Generation failed',
          'Something went wrong generating the Design Pack.',
        );
        setPhase('choice');
        if (__DEV__) {
          console.error('🔥 [Ember] Design Pack generation error:', error);
        }
      }
    },
    [project],
  );

  // ── Handle answer submission ──
  const handleAnswerSubmit = useCallback(() => {
    if (!project || !currentQuestion) return;

    const isChoice =
      currentQuestion.answerType === 'choice' ||
      currentQuestion.answerType === 'multi-choice';
    const rawResponse = isChoice
      ? selectedChoice ?? ''
      : currentAnswer.trim();

    if (!rawResponse) return;

    // Build the answer
    const answer: EmberAnswer = {
      questionId: currentQuestion.id,
      rawResponse,
      dimensionId: currentQuestion.dimensionId,
      value: rawResponse,
      answeredAt: new Date().toISOString(),
    };

    // Establish conditions from choice answers
    const newConditions: EstablishedCondition[] = [];
    if (isChoice && currentQuestion.choices) {
      const choice = currentQuestion.choices.find(
        (c) => c.value === selectedChoice,
      );
      if (choice) {
        for (const condId of choice.establishesConditions) {
          newConditions.push({
            id: condId,
            label: condId.replace(/-/g, ' '),
            confidence: 'established',
            sourceAnswerIds: [currentQuestion.id],
          });
        }
      }
    }

    // Update project
    const updatedProject: EmberProject = {
      ...project,
      answers: [...project.answers, answer],
      askedQuestionIds: [
        ...project.askedQuestionIds,
        currentQuestion.id,
      ],
      conditions: [...project.conditions, ...newConditions],
      updatedAt: new Date().toISOString(),
    };

    // Evaluate propositions with new conditions
    const conditions = updatedProject.conditions.map((c) => c.id);
    const evaluated = evaluatePropositions(conditions);
    updatedProject.activatedPropositions = evaluated.map((e) => ({
      propositionId: e.proposition.id,
      confidence: e.confidence,
      activatingConditionIds: e.matchingSupports,
      conflictingConditionIds: e.activeConflicts,
    }));

    saveProject(updatedProject);
    setProject(updatedProject);

    // Reset answer state
    setCurrentAnswer('');
    setSelectedChoice(null);

    // Advance to next question or return to Ember
    if (phase === 'foundational') {
      if (questionIndex + 1 < foundationalQuestions.length) {
        setQuestionIndex(questionIndex + 1);
      } else if (updatedProject.seedId) {
        // Return to the Ember View — Develop is complete
        router.back();
      } else {
        setPhase('choice');
      }
    } else if (phase === 'exploratory') {
      // Re-evaluate available questions after this answer
      const nextAvailable = getAvailableExploratoryQuestions(
        updatedProject.askedQuestionIds,
        conditions,
      );
      if (nextAvailable.length > 0) {
        setQuestionIndex(0);
      } else if (updatedProject.seedId) {
        // Return to the Ember View — Explore is complete
        router.back();
      } else {
        handleGenerate(updatedProject);
      }
    }
  }, [
    project,
    currentQuestion,
    currentAnswer,
    selectedChoice,
    phase,
    questionIndex,
    foundationalQuestions,
    exploratoryQuestions,
    handleGenerate,
  ]);

  // ── Handle explore further ──
  const handleExploreFurther = useCallback(() => {
    if (exploratoryQuestions.length === 0) {
      handleGenerate();
      return;
    }
    setQuestionIndex(0);
    setPhase('exploratory');
  }, [exploratoryQuestions, handleGenerate]);

  // ── Guard: If exploratory phase has no available questions left ──
  useEffect(() => {
    if (phase === 'exploratory' && exploratoryQuestions.length === 0 && project) {
      if (project.seedId) {
        // Return to Ember View — no further exploration available
        router.back();
      } else {
        handleGenerate(project);
      }
    }
  }, [phase, exploratoryQuestions, project, handleGenerate]);

  // ── Movement Available — Experimental Surface ──
  // "What movements are available from here?"
  //
  // This is instrumentation, not domain truth.
  // The threshold of 2 conditions is deliberately arbitrary —
  // enough to make the surface encounterable, not enough
  // to claim we know what readiness means.
  //
  // Uncertainty conditions (platform-uncertain, persistence-uncertain,
  // auth-deferred) are represented honestly as established conditions,
  // not as absence or failure.
  const MOVEMENT_THRESHOLD = 2; // Experimental — not domain truth

  const [showMovements, setShowMovements] = useState(false);

  const movementState = useMemo(() => {
    if (!project) return null;

    const conditions = project.conditions;
    const conditionIds = conditions.map(c => c.id);
    const evaluated = evaluatePropositions(conditionIds);

    // Distinguish condition-driven propositions from unconditional ones
    const conditionDriven = evaluated.filter(
      e => e.proposition.supportingConditions.length > 0,
    );
    const unconditional = evaluated.filter(
      e => e.proposition.supportingConditions.length === 0,
    );

    // Which conditions actually participate in proposition evaluation?
    const allReferencedConditions = new Set(
      PROPOSITION_LIBRARY.flatMap(p => [
        ...p.supportingConditions,
        ...p.conflictingConditions,
      ]),
    );
    const consumed = conditions.filter(c => allReferencedConditions.has(c.id));
    const unconsumed = conditions.filter(c => !allReferencedConditions.has(c.id));

    // Experimental threshold for Design Pack being "meaningfully available"
    const designPackMeaningful = conditions.length >= MOVEMENT_THRESHOLD;

    return {
      conditions,
      consumed,
      unconsumed,
      conditionDriven,
      unconditional,
      designPackMeaningful,
    };
  }, [project]);

  // ── Render: Question Phase (Foundational or Exploratory) ──
  if (
    (phase === 'foundational' || phase === 'exploratory') &&
    currentQuestion
  ) {
    const totalInPhase =
      phase === 'foundational'
        ? foundationalQuestions.length
        : exploratoryQuestions.length;

    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.flex}
        >
          <ScrollView
            contentContainerStyle={styles.phaseContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Progress indicator */}
            <View style={styles.progressRow}>
              <Text style={styles.progressText}>
                {phase === 'foundational'
                  ? 'Foundation'
                  : 'Exploring further'}
              </Text>
              <Text style={styles.progressCount}>
                {questionIndex + 1} / {totalInPhase}
              </Text>
            </View>

            {/* Question */}
            <Text style={styles.questionText}>
              {currentQuestion.text}
            </Text>

            {/* Answer input */}
            {currentQuestion.answerType === 'text' ? (
              <TextInput
                style={[styles.textInput, styles.multilineInput]}
                value={currentAnswer}
                onChangeText={setCurrentAnswer}
                placeholder={
                  currentQuestion.placeholder ?? 'Your thoughts...'
                }
                placeholderTextColor={COLORS.textMuted}
                multiline
                textAlignVertical="top"
                autoFocus
              />
            ) : (
              <View style={styles.choicesContainer}>
                {currentQuestion.choices?.map(
                  (choice: QuestionChoice) => (
                    <Pressable
                      key={choice.value}
                      onPress={() => setSelectedChoice(choice.value)}
                      style={[
                        styles.choicePill,
                        selectedChoice === choice.value &&
                          styles.choicePillSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.choicePillText,
                          selectedChoice === choice.value &&
                            styles.choicePillTextSelected,
                        ]}
                      >
                        {choice.label}
                      </Text>
                    </Pressable>
                  ),
                )}
              </View>
            )}

            {/* Submit */}
            <Pressable
              onPress={handleAnswerSubmit}
              style={[
                styles.primaryButton,
                !(currentAnswer.trim() || selectedChoice) &&
                  styles.buttonDisabled,
              ]}
              disabled={!(currentAnswer.trim() || selectedChoice)}
            >
              <Text style={styles.primaryButtonText}>Continue</Text>
            </Pressable>

            {/* ── Movement Available (Experimental) ── */}
            {movementState && movementState.conditions.length > 0 && (
              <Pressable
                onPress={() => setShowMovements(true)}
                style={styles.movementIndicator}
              >
                <Text style={styles.movementIndicatorText}>
                  {movementState.conditions.length} condition{movementState.conditions.length !== 1 ? 's' : ''} established
                </Text>
                <Text style={styles.movementIndicatorHint}>
                  {movementState.conditionDriven.length > 0
                    ? `${movementState.conditionDriven.length} proposition${movementState.conditionDriven.length !== 1 ? 's' : ''} active`
                    : 'No propositions yet'}
                  {' · tap to see'}
                </Text>
              </Pressable>
            )}

            {/* Movement Modal */}
            <Modal
              visible={showMovements}
              transparent
              animationType="slide"
              onRequestClose={() => setShowMovements(false)}
            >
              <View style={styles.movementOverlay}>
                <View style={styles.movementModal}>
                  <ScrollView>
                    <Text style={styles.movementTitle}>
                      What has been established
                    </Text>

                    {/* Conditions — consumed by the engine */}
                    {movementState && movementState.consumed.length > 0 && (
                      <View style={styles.movementSection}>
                        <Text style={styles.movementSectionLabel}>
                          Conditions the engine can evaluate
                        </Text>
                        {movementState.consumed.map(c => (
                          <Text key={c.id} style={styles.movementCondition}>
                            ✓ {c.label}
                          </Text>
                        ))}
                      </View>
                    )}

                    {/* Conditions — not consumed (including uncertainty) */}
                    {movementState && movementState.unconsumed.length > 0 && (
                      <View style={styles.movementSection}>
                        <Text style={styles.movementSectionLabel}>
                          Established but not yet evaluated
                        </Text>
                        <Text style={styles.movementSectionHint}>
                          Honest positions — the engine has no authored knowledge about what these imply
                        </Text>
                        {movementState.unconsumed.map(c => (
                          <Text key={c.id} style={styles.movementConditionMuted}>
                            ~ {c.label}
                          </Text>
                        ))}
                      </View>
                    )}

                    {/* Active propositions */}
                    {movementState && movementState.conditionDriven.length > 0 && (
                      <View style={styles.movementSection}>
                        <Text style={styles.movementSectionLabel}>
                          Propositions from conditions
                        </Text>
                        {movementState.conditionDriven.map(e => (
                          <View key={e.proposition.id} style={styles.movementProposition}>
                            <Text style={styles.movementPropositionName}>
                              {e.confidence === 'established' ? '✓' : '~'} {e.proposition.name}
                            </Text>
                            <Text style={styles.movementPropositionReason}>
                              {e.proposition.reasoning}
                            </Text>
                            {e.activeConflicts.length > 0 && (
                              <Text style={styles.movementConflict}>
                                ⚠ Tension: {e.activeConflicts.join(', ')}
                              </Text>
                            )}
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Unconditional propositions */}
                    {movementState && movementState.unconditional.length > 0 && (
                      <View style={styles.movementSection}>
                        <Text style={styles.movementSectionLabel}>
                          Always available
                        </Text>
                        {movementState.unconditional.map(e => (
                          <Text key={e.proposition.id} style={styles.movementConditionMuted}>
                            {e.proposition.name}
                          </Text>
                        ))}
                      </View>
                    )}

                    {/* Available movements */}
                    <View style={[styles.movementSection, styles.movementDivider]}>
                      <Text style={styles.movementSectionLabel}>
                        Available movements
                      </Text>
                      <View style={styles.movementItem}>
                        <Text style={[
                          styles.movementItemName,
                          movementState?.designPackMeaningful && styles.movementItemAvailable,
                        ]}>
                          {movementState?.designPackMeaningful ? '◆' : '◇'} Design Pack
                        </Text>
                        <Text style={styles.movementItemHint}>
                          {movementState?.designPackMeaningful
                            ? `${movementState.conditionDriven.length} condition-driven proposition${movementState.conditionDriven.length !== 1 ? 's' : ''} would be included`
                            : `Fewer than ${MOVEMENT_THRESHOLD} conditions — not yet meaningfully grounded`}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.movementFooter}>
                      This surface is experimental. The threshold is instrumentation, not domain truth.
                    </Text>
                  </ScrollView>

                  <Pressable
                    onPress={() => setShowMovements(false)}
                    style={styles.movementClose}
                  >
                    <Text style={styles.movementCloseText}>Close</Text>
                  </Pressable>
                </View>
              </View>
            </Modal>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Render: Choice Phase ──
  if (phase === 'choice') {
    const hasMoreQuestions = exploratoryQuestions.length > 0;

    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.phaseContent}>
          <Text style={styles.phaseTitle}>
            Foundation established
          </Text>
          <Text style={styles.phaseSubtitle}>
            {project?.conditions.length ?? 0} conditions ·{' '}
            {project?.activatedPropositions.length ?? 0} propositions
            active
          </Text>

          <View style={styles.choiceSection}>
            {hasMoreQuestions && (
              <Pressable
                onPress={handleExploreFurther}
                style={styles.choiceButton}
              >
                <Text style={styles.choiceButtonTitle}>
                  Explore further
                </Text>
                <Text style={styles.choiceButtonHint}>
                  {exploratoryQuestions.length} more question
                  {exploratoryQuestions.length !== 1 ? 's' : ''}{' '}
                  available
                </Text>
              </Pressable>
            )}

            <Pressable
              onPress={() => handleGenerate()}
              style={[
                styles.choiceButton,
                styles.choiceButtonPrimary,
              ]}
            >
              <Text style={styles.choiceButtonTitlePrimary}>
                {project?.designPackVersion ? 'Regenerate Design Pack' : 'Generate Design Pack'}
              </Text>
              <Text style={styles.choiceButtonHintPrimary}>
                From what has been established so far
              </Text>
            </Pressable>

            {project && project.designPackVersion > 0 && (
              <Pressable
                onPress={() => {
                  router.push({
                    pathname: '/(main)/design-pack/[id]',
                    params: { id: project.id },
                  } as any);
                }}
                style={styles.choiceButton}
              >
                <Text style={styles.choiceButtonTitle}>
                  View Current Design Pack (v{project.designPackVersion})
                </Text>
                <Text style={styles.choiceButtonHint}>
                  Inspect the latest generated Markdown
                </Text>
              </Pressable>
            )}
          </View>

          {/* Quick summary of what's been established */}
          {project && project.answers.length > 0 && (
            <View style={styles.summarySection}>
              <Text style={styles.summaryTitle}>
                What you've shared:
              </Text>
              {project.answers.map((answer) => {
                const q = QUESTION_LIBRARY.find(
                  (qu) => qu.id === answer.questionId,
                );
                return (
                  <View key={answer.questionId} style={styles.summaryItem}>
                    <Text style={styles.summaryQuestion}>
                      {q?.text ?? answer.questionId}
                    </Text>
                    <Text style={styles.summaryAnswer}>
                      {answer.rawResponse}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Render: Generating ──
  if (phase === 'generating') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.generatingContainer}>
          <Text style={styles.generatingText}>
            Generating Design Pack...
          </Text>
          <Text style={styles.generatingSubtext}>
            Mapping conditions to propositions
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return null;
}

// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.deepCharcoal,
  },
  flex: {
    flex: 1,
  },

  // Phase content
  phaseContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl * 2,
    paddingBottom: SPACING.xl * 3,
  },
  phaseTitle: {
    fontSize: TYPOGRAPHY.sizes.xl,
    fontWeight: '300',
    color: COLORS.emberOrange,
    letterSpacing: TYPOGRAPHY.letterSpacing.extraWide,
    marginBottom: SPACING.xs,
  },
  phaseSubtitle: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textMuted,
    marginBottom: SPACING.xl * 2,
  },

  // Material preview
  materialPreview: {
    backgroundColor: COLORS.surfaceDark,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.xl,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.emberOrange,
  },
  materialLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: SPACING.xs,
  },
  materialText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
    fontStyle: 'italic',
  },

  // Input
  inputSection: {
    marginBottom: SPACING.xl,
  },
  inputLabel: {
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: '500',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  inputHint: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    marginBottom: SPACING.md,
  },
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
    minHeight: 100,
    paddingTop: SPACING.sm + 2,
  },

  // Progress
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  progressText: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  progressCount: {
    fontSize: 9,
    color: COLORS.textMuted,
  },

  // Question
  questionText: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: '300',
    color: COLORS.textPrimary,
    lineHeight: 30,
    marginBottom: SPACING.xl,
    letterSpacing: TYPOGRAPHY.letterSpacing.normal,
  },

  // Choices
  choicesContainer: {
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  choicePill: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.15)',
    backgroundColor: COLORS.surfaceDark,
  },
  choicePillSelected: {
    borderColor: COLORS.emberOrange,
    backgroundColor: 'rgba(255, 107, 43, 0.12)',
  },
  choicePillText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textSecondary,
  },
  choicePillTextSelected: {
    color: COLORS.emberOrange,
    fontWeight: '600',
  },

  // Buttons
  primaryButton: {
    alignSelf: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl * 2,
    borderRadius: 24,
    backgroundColor: COLORS.emberOrange,
    marginTop: SPACING.lg,
  },
  primaryButtonText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: '700',
    color: COLORS.deepCharcoal,
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
  },
  buttonDisabled: {
    opacity: 0.4,
  },

  // Choice phase
  choiceSection: {
    gap: SPACING.md,
    marginBottom: SPACING.xl * 2,
  },
  choiceButton: {
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.2)',
    backgroundColor: COLORS.surfaceDark,
    gap: SPACING.xs,
  },
  choiceButtonPrimary: {
    borderColor: COLORS.emberOrange,
    backgroundColor: 'rgba(255, 107, 43, 0.1)',
  },
  choiceButtonTitle: {
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  choiceButtonTitlePrimary: {
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: '600',
    color: COLORS.emberOrange,
  },
  choiceButtonHint: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.textMuted,
  },
  choiceButtonHintPrimary: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.textSecondary,
  },

  // Summary
  summarySection: {
    gap: SPACING.md,
  },
  summaryTitle: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  summaryItem: {
    gap: 2,
  },
  summaryQuestion: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
  summaryAnswer: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },

  // Generating
  generatingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.md,
  },
  generatingText: {
    fontSize: TYPOGRAPHY.sizes.md,
    color: COLORS.emberOrange,
    fontWeight: '300',
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
  },
  generatingSubtext: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.textMuted,
  },

  // Movement Available (Experimental)
  movementIndicator: {
    marginTop: SPACING.xl * 2,
    padding: SPACING.md,
    backgroundColor: 'rgba(255, 107, 43, 0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.12)',
    alignItems: 'center',
    gap: 4,
  },
  movementIndicatorText: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.emberOrange,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  movementIndicatorHint: {
    fontSize: 10,
    color: COLORS.textMuted,
  },

  // Movement Modal
  movementOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  movementModal: {
    backgroundColor: COLORS.deepCharcoal,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingTop: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 107, 43, 0.2)',
  },
  movementTitle: {
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: '300',
    color: COLORS.emberOrange,
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
    marginBottom: SPACING.lg,
  },
  movementSection: {
    marginBottom: SPACING.lg,
    gap: SPACING.xs,
  },
  movementSectionLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  movementSectionHint: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    marginBottom: SPACING.xs,
  },
  movementCondition: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textPrimary,
    paddingVertical: 2,
  },
  movementConditionMuted: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textMuted,
    paddingVertical: 2,
  },
  movementProposition: {
    backgroundColor: COLORS.surfaceDark,
    borderRadius: 10,
    padding: SPACING.sm,
    gap: 4,
  },
  movementPropositionName: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  movementPropositionReason: {
    fontSize: 11,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },
  movementConflict: {
    fontSize: 10,
    color: '#F5A623',
    fontStyle: 'italic',
  },
  movementDivider: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 107, 43, 0.1)',
    paddingTop: SPACING.lg,
  },
  movementItem: {
    gap: 4,
  },
  movementItemName: {
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  movementItemAvailable: {
    color: COLORS.emberOrange,
  },
  movementItemHint: {
    fontSize: 11,
    color: COLORS.textMuted,
    lineHeight: 16,
  },
  movementFooter: {
    fontSize: 9,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: SPACING.md,
    marginBottom: SPACING.md,
  },
  movementClose: {
    alignSelf: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xl * 2,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.3)',
    marginTop: SPACING.md,
  },
  movementCloseText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
});
