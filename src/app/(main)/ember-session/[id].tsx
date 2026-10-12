// ─────────────────────────────────────────────
// Ember Session Screen
//
// The enquiry interface. Where Sparks and Embers become attended to.
//
// Driven entirely by the pure Inquiry semantic engine:
//   - Explore movement: establish purpose, audience/context, optional reflections
//   - Develop movement: establish reach, platform, storage, offline, access, constraints
//   - Candidate configuration adoption & review confirmation
//   - Movement Available modal: human-readable progression inspection rebased on InquiryState
// ─────────────────────────────────────────────

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
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
import {
  DEFAULT_LIBRARY,
  evaluateInquiry,
  nextQuestion,
  chooseDesignPack,
  adoptConfiguration,
  confirmReview,
  CAPABILITY_LABELS,
  type InquiryQuestion,
  type InquiryChoice,
  type Movement,
  type InquiryState,
} from '@/inquiry';
import {
  loadInquiryEvidence,
  saveAnswer,
  recordDecision,
} from '@/services/inquiry-storage';

export default function EmberSessionScreen() {
  const params = useLocalSearchParams<{
    id: string;
    movement?: string;
  }>();

  const inquiryId = params.id;
  const initialMovement: Movement = (params.movement as Movement) || 'explore';
  const [movement, setMovement] = useState<Movement>(initialMovement);

  // Evidence and Engine State
  const [evidence, setEvidence] = useState(() => loadInquiryEvidence(inquiryId));
  const inquiryState: InquiryState = useMemo(() => {
    return evaluateInquiry(evidence, DEFAULT_LIBRARY);
  }, [evidence]);

  // Current question driven by evaluator
  const activeQuestion: InquiryQuestion | undefined = useMemo(() => {
    return nextQuestion(inquiryState, movement, DEFAULT_LIBRARY);
  }, [inquiryState, movement]);

  // Form input state
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [specificationText, setSpecificationText] = useState('');

  // Synchronize inputs when activeQuestion changes
  useEffect(() => {
    if (activeQuestion) {
      const existingAnswer = inquiryState.questions.find(q => q.id === activeQuestion.id)?.answer;
      if (existingAnswer) {
        if (activeQuestion.answerType === 'text') {
          setCurrentAnswer(existingAnswer.value);
        } else {
          setSelectedChoice(existingAnswer.value);
          setSpecificationText(existingAnswer.specification || '');
        }
      } else {
        setCurrentAnswer('');
        setSelectedChoice(null);
        setSpecificationText('');
      }
    }
  }, [activeQuestion, inquiryState.questions]);

  // Movement Available modal state
  const [showMovements, setShowMovements] = useState(false);

  // Guarded single return to Ember View
  const hasReturnedRef = useRef(false);
  const returnToEmber = useCallback(() => {
    if (hasReturnedRef.current) return;
    hasReturnedRef.current = true;
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }, []);

  // Submit answer
  const handleAnswerSubmit = useCallback(() => {
    if (!activeQuestion) return;

    const isChoice = activeQuestion.answerType === 'choice';
    const value = isChoice ? (selectedChoice ?? '') : currentAnswer.trim();
    if (!value) return;

    const chosenChoice = isChoice ? activeQuestion.choices?.find(c => c.value === value) : undefined;
    if (chosenChoice?.requiresSpecification && !specificationText.trim()) {
      Alert.alert('Specification required', 'Please provide additional details for this choice.');
      return;
    }

    saveAnswer(inquiryId, activeQuestion.id, value, {
      specification: chosenChoice?.requiresSpecification ? specificationText.trim() : undefined,
      rawResponse: isChoice ? chosenChoice?.label : value,
      answeredAt: new Date().toISOString(),
    });

    // Refresh evidence
    const nextEvidence = loadInquiryEvidence(inquiryId);
    setEvidence(nextEvidence);

    // Reset inputs
    setCurrentAnswer('');
    setSelectedChoice(null);
    setSpecificationText('');

    // If in Explore and purpose + audience just became established, return or stay?
    // User can continue exploring optional questions, or return.
  }, [inquiryId, activeQuestion, selectedChoice, currentAnswer, specificationText]);

  // Adopt configuration act
  const handleAdoptConfig = useCallback((cfgId: string) => {
    const decision = adoptConfiguration(inquiryState, cfgId, new Date().toISOString());
    if (decision) {
      recordDecision(inquiryId, decision);
      setEvidence(loadInquiryEvidence(inquiryId));
    }
  }, [inquiryId, inquiryState]);

  // Confirm review act
  const handleConfirmReview = useCallback(() => {
    const decision = confirmReview(inquiryState, new Date().toISOString());
    if (decision) {
      recordDecision(inquiryId, decision);
      setEvidence(loadInquiryEvidence(inquiryId));
      // Warrant is achieved! Return to Ember View
      returnToEmber();
    }
  }, [inquiryId, inquiryState, returnToEmber]);

  // Actionable crossing from Movement Available modal: choose Design Pack
  const handleModalChooseDesignPack = useCallback(() => {
    const decision = chooseDesignPack(inquiryState, new Date().toISOString());
    if (decision) {
      recordDecision(inquiryId, decision);
      setEvidence(loadInquiryEvidence(inquiryId));
      setShowMovements(false);
      setMovement('develop');
    }
  }, [inquiryId, inquiryState]);

  // Selected choice object for rendering specification input
  const activeChoiceObj: InquiryChoice | undefined = useMemo(() => {
    if (!activeQuestion || !selectedChoice) return undefined;
    return activeQuestion.choices?.find(c => c.value === selectedChoice);
  }, [activeQuestion, selectedChoice]);

  // Candidate configurations for adoption
  const candidateConfigs = useMemo(() => {
    return DEFAULT_LIBRARY.configurations.filter(c =>
      inquiryState.designPack.candidates.includes(c.id),
    );
  }, [inquiryState.designPack.candidates]);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        {/* Header bar */}
        <View style={styles.headerBar}>
          <Pressable onPress={returnToEmber} hitSlop={12}>
            <Text style={styles.backArrow}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>
            {movement === 'explore' ? 'Explore' : 'Develop'}
          </Text>
          <Pressable onPress={returnToEmber} hitSlop={12}>
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.phaseContent}
          keyboardShouldPersistTaps="handled"
        >
          {activeQuestion ? (
            <>
              {/* Progress indicator */}
              <View style={styles.progressRow}>
                <Text style={styles.progressText}>
                  {movement === 'explore'
                    ? activeQuestion.role === 'required'
                      ? 'Explore · Foundation'
                      : 'Explore · Optional'
                    : 'Develop · Requirement'}
                </Text>
                <Text style={styles.progressCount}>
                  {activeQuestion.role === 'optional' ? 'Optional' : 'Required'}
                </Text>
              </View>

              {/* Question text */}
              <Text style={styles.questionText}>
                {activeQuestion.text}
              </Text>

              {/* Question input */}
              {activeQuestion.answerType === 'text' ? (
                <TextInput
                  style={[styles.textInput, styles.multilineInput]}
                  value={currentAnswer}
                  onChangeText={setCurrentAnswer}
                  placeholder={activeQuestion.placeholder ?? 'Your thoughts...'}
                  placeholderTextColor={COLORS.textMuted}
                  multiline
                  textAlignVertical="top"
                  autoFocus
                />
              ) : (
                <View style={styles.choicesContainer}>
                  {activeQuestion.choices?.map((choice) => (
                    <Pressable
                      key={choice.value}
                      onPress={() => setSelectedChoice(choice.value)}
                      style={[
                        styles.choicePill,
                        selectedChoice === choice.value && styles.choicePillSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.choicePillText,
                          selectedChoice === choice.value && styles.choicePillTextSelected,
                        ]}
                      >
                        {choice.label}
                      </Text>
                    </Pressable>
                  ))}

                  {/* Specification text input if selected choice requires specification */}
                  {activeChoiceObj?.requiresSpecification && (
                    <View style={styles.specContainer}>
                      <Text style={styles.specLabel}>Please specify:</Text>
                      <TextInput
                        style={styles.textInput}
                        value={specificationText}
                        onChangeText={setSpecificationText}
                        placeholder="Name or details..."
                        placeholderTextColor={COLORS.textMuted}
                        autoFocus
                      />
                    </View>
                  )}
                </View>
              )}

              {/* Submit */}
              <Pressable
                onPress={handleAnswerSubmit}
                style={[
                  styles.primaryButton,
                  !(
                    (activeQuestion.answerType === 'text' && currentAnswer.trim()) ||
                    (activeQuestion.answerType === 'choice' &&
                      selectedChoice &&
                      (!activeChoiceObj?.requiresSpecification || specificationText.trim()))
                  ) && styles.buttonDisabled,
                ]}
                disabled={
                  !(
                    (activeQuestion.answerType === 'text' && currentAnswer.trim()) ||
                    (activeQuestion.answerType === 'choice' &&
                      selectedChoice &&
                      (!activeChoiceObj?.requiresSpecification || specificationText.trim()))
                  )
                }
              >
                <Text style={styles.primaryButtonText}>Save & Continue</Text>
              </Pressable>
            </>
          ) : movement === 'develop' && inquiryState.designPack.chosen ? (
            /* Develop finished: Adoption & Review confirmation steps */
            <View style={styles.finishContainer}>
              {inquiryState.designPack.blockers.length > 0 ? (
                <View style={styles.blockerCard}>
                  <Text style={styles.blockerTitle}>Active Technical Blockers</Text>
                  {inquiryState.designPack.blockers.map((b, idx) => (
                    <Text key={idx} style={styles.blockerDetail}>
                      • {b.detail}
                    </Text>
                  ))}
                </View>
              ) : !inquiryState.designPack.adoptedConfigurationId ? (
                <View style={styles.adoptionSection}>
                  <Text style={styles.finishTitle}>Adopt Architecture Configuration</Text>
                  <Text style={styles.finishHint}>
                    The following authored configurations satisfy your requirements:
                  </Text>
                  {candidateConfigs.map((cfg) => (
                    <Pressable
                      key={cfg.id}
                      onPress={() => handleAdoptConfig(cfg.id)}
                      style={styles.configCard}
                    >
                      <Text style={styles.configName}>{cfg.name}</Text>
                      <Text style={styles.configSummary}>{cfg.summary}</Text>
                      <Text style={styles.configAdoptAction}>Tap to adopt</Text>
                    </Pressable>
                  ))}
                </View>
              ) : !inquiryState.designPack.reviewCurrent ? (
                <View style={styles.reviewSection}>
                  <Text style={styles.finishTitle}>Confirm Design Scope</Text>
                  <Text style={styles.finishHint}>
                    Adopted Configuration: {inquiryState.designPack.adoptedConfigurationId}
                  </Text>
                  <Text style={styles.finishBody}>
                    Confirm that recorded technical requirements accurately reflect the initial version.
                  </Text>
                  <Pressable
                    onPress={handleConfirmReview}
                    style={styles.primaryButton}
                  >
                    <Text style={styles.primaryButtonText}>Confirm Review</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.reviewSection}>
                  <Text style={styles.finishTitle}>Develop Warranted</Text>
                  <Text style={styles.finishBody}>
                    Your technical enquiry is complete and warranted for Design Pack generation.
                  </Text>
                  <Pressable onPress={returnToEmber} style={styles.primaryButton}>
                    <Text style={styles.primaryButtonText}>Return to Ember</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ) : (
            /* Explore movement finished or all questions answered */
            <View style={styles.finishContainer}>
              <Text style={styles.finishTitle}>Explore Movement Complete</Text>
              <Text style={styles.finishBody}>
                {inquiryState.designPack.available
                  ? 'Purpose and audience established. Design Pack is now available.'
                  : 'You have answered all available questions in this movement.'}
              </Text>
              {inquiryState.designPack.available && !inquiryState.designPack.chosen && (
                <Pressable
                  onPress={handleModalChooseDesignPack}
                  style={[styles.primaryButton, { marginTop: SPACING.md }]}
                >
                  <Text style={styles.primaryButtonText}>Choose Design Pack & Begin Develop</Text>
                </Pressable>
              )}
              <Pressable
                onPress={returnToEmber}
                style={[styles.secondaryButton, { marginTop: SPACING.md }]}
              >
                <Text style={styles.secondaryButtonText}>Return to Ember</Text>
              </Pressable>
            </View>
          )}

          {/* ── Movement Available Inspection Surface ── */}
          {inquiryState.conditions.length > 0 && (
            <Pressable
              onPress={() => setShowMovements(true)}
              style={styles.movementIndicator}
            >
              <Text style={styles.movementIndicatorText}>
                {inquiryState.conditions.length} condition{inquiryState.conditions.length !== 1 ? 's' : ''} established
              </Text>
              <Text style={styles.movementIndicatorHint}>
                {inquiryState.designPack.warranted
                  ? 'Warranted · tap to inspect'
                  : inquiryState.designPack.available
                  ? 'Design Pack available · tap to inspect'
                  : 'Tap to inspect progression'}
              </Text>
            </Pressable>
          )}

          {/* ── Movement Modal (Rebased onto InquiryState) ── */}
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

                  {/* Conditions section */}
                  <View style={styles.movementSection}>
                    <Text style={styles.movementSectionLabel}>
                      Established Conditions ({inquiryState.conditions.length})
                    </Text>
                    {inquiryState.conditions.map((cond) => (
                      <Text key={cond} style={styles.movementCondition}>
                        ✓ {cond.replace(/-/g, ' ')}
                      </Text>
                    ))}
                  </View>

                  {/* Required capabilities */}
                  {inquiryState.designPack.requiredCapabilities.length > 0 && (
                    <View style={styles.movementSection}>
                      <Text style={styles.movementSectionLabel}>
                        Required Capabilities
                      </Text>
                      {inquiryState.designPack.requiredCapabilities.map((cap) => (
                        <Text key={cap} style={styles.movementCondition}>
                          • {CAPABILITY_LABELS[cap] ?? cap}
                        </Text>
                      ))}
                    </View>
                  )}

                  {/* Blockers */}
                  {inquiryState.designPack.blockers.length > 0 && (
                    <View style={styles.movementSection}>
                      <Text style={styles.movementSectionLabel}>
                        Blockers
                      </Text>
                      {inquiryState.designPack.blockers.map((b, idx) => (
                        <Text key={idx} style={styles.movementConflict}>
                          ⚠ {b.detail}
                        </Text>
                      ))}
                    </View>
                  )}

                  {/* Available Movement */}
                  <View style={[styles.movementSection, styles.movementDivider]}>
                    <Text style={styles.movementSectionLabel}>
                      Available Movements
                    </Text>
                    <View style={styles.movementItem}>
                      <Text
                        style={[
                          styles.movementItemName,
                          inquiryState.designPack.available && styles.movementItemAvailable,
                        ]}
                      >
                        {inquiryState.designPack.available ? '◆' : '◇'} Design Pack
                      </Text>
                      <Text style={styles.movementItemHint}>
                        {inquiryState.designPack.warranted
                          ? 'Warranted for generation.'
                          : inquiryState.designPack.chosen
                          ? 'Chosen · developing technical requirements.'
                          : inquiryState.designPack.available
                          ? 'Available from established purpose and audience.'
                          : 'Explore purpose and audience to make available.'}
                      </Text>
                    </View>

                    {/* Actionable crossing inside modal */}
                    {inquiryState.designPack.available && !inquiryState.designPack.chosen && (
                      <Pressable
                        onPress={handleModalChooseDesignPack}
                        style={[styles.primaryButton, { marginTop: SPACING.md }]}
                      >
                        <Text style={styles.primaryButtonText}>
                          Choose Design Pack & Begin Develop
                        </Text>
                      </Pressable>
                    )}
                  </View>

                  <Text style={styles.movementFooter}>
                    Truthful engine assessment from current evidence.
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

// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.deepCharcoal,
  },
  flex: {
    flex: 1,
  },

  // Header
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 107, 43, 0.1)',
  },
  backArrow: {
    fontSize: 20,
    color: COLORS.emberOrange,
    paddingHorizontal: SPACING.sm,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
    letterSpacing: TYPOGRAPHY.letterSpacing.normal,
  },
  doneText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: '600',
    color: COLORS.emberOrange,
    paddingHorizontal: SPACING.sm,
  },

  // Phase content
  phaseContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xl * 3,
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
    minHeight: 120,
    paddingTop: SPACING.sm + 2,
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

  // Specification input
  specContainer: {
    marginTop: SPACING.md,
    gap: SPACING.xs,
  },
  specLabel: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.textMuted,
    fontWeight: '500',
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
  secondaryButton: {
    alignSelf: 'center',
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.xl,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.3)',
  },
  secondaryButtonText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: '600',
    color: COLORS.emberOrange,
  },
  buttonDisabled: {
    opacity: 0.4,
  },

  // Finish container
  finishContainer: {
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.xl,
  },
  finishTitle: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: '600',
    color: COLORS.emberOrange,
    textAlign: 'center',
  },
  finishHint: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  finishBody: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Blocker card
  blockerCard: {
    backgroundColor: 'rgba(230, 80, 50, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(230, 80, 50, 0.3)',
    padding: SPACING.md,
    gap: SPACING.xs,
    width: '100%',
  },
  blockerTitle: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: '700',
    color: '#FF6B6B',
  },
  blockerDetail: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },

  // Config adoption cards
  adoptionSection: {
    width: '100%',
    gap: SPACING.md,
  },
  configCard: {
    backgroundColor: COLORS.surfaceDark,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.2)',
    padding: SPACING.md,
    gap: 4,
  },
  configName: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  configSummary: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.textMuted,
    lineHeight: 16,
  },
  configAdoptAction: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.emberOrange,
    marginTop: 4,
  },

  // Review section
  reviewSection: {
    width: '100%',
    alignItems: 'center',
    gap: SPACING.sm,
  },

  // Movement indicator
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
  movementCondition: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textPrimary,
    paddingVertical: 2,
  },
  movementConflict: {
    fontSize: 11,
    color: '#F5A623',
    lineHeight: 16,
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
