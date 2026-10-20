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
  Share,
  TurboModuleRegistry,
  type TurboModule,
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
  CONDITION_CAPABILITIES,
  type InquiryQuestion,
  type InquiryChoice,
  type Movement,
  type InquiryState,
  type QuestionState,
  type Capability,
} from '@/inquiry';
import {
  loadInquiryEvidence,
  saveAnswer,
  recordDecision,
  resetUncommittedInquiry,
} from '@/services/inquiry-storage';
import { loadLatestDesignPack } from '@/services/ember-project-storage';

export interface EmberSessionScreenProps {
  inquiryId?: string;
  initialMovement?: Movement;
  hideHeader?: boolean;
  onBack?: () => void;
  onMovementChange?: (movement: Movement) => void;
  onInvestigationStateChange?: (isInvestigating: boolean) => void;
  onCloseSession?: () => void;
}

export default function EmberSessionScreen({
  inquiryId: propInquiryId,
  initialMovement: propMovement,
  hideHeader = false,
  onBack,
  onMovementChange,
  onInvestigationStateChange,
  onCloseSession,
}: EmberSessionScreenProps = {}) {
  const params = useLocalSearchParams<{
    id: string;
    movement?: string;
  }>();

  const inquiryId = propInquiryId || params.id;
  const initialMovement: Movement = propMovement || (params.movement as Movement) || 'explore';
  const [movement, setMovement] = useState<Movement>(initialMovement);

  // Evidence and Engine State
  const [evidence, setEvidence] = useState(() => (inquiryId ? loadInquiryEvidence(inquiryId) : { answers: [], decisions: [] }));

  // Guided Investigation state (targeted question resolution & user-chosen investigation)
  const [investigatingQuestionId, setInvestigatingQuestionId] = useState<string | null>(null);
  const [isInvestigating, setIsInvestigating] = useState(false);

  // Recognition Moment state when Investigation resolves blockers into configuration availability
  const [awaitingAdoptionRecognition, setAwaitingAdoptionRecognition] = useState(false);
  const [adoptionRecognized, setAdoptionRecognized] = useState(false);

  // Copy feedback for authored coverage boundary explanations
  const [copiedBoundaryKey, setCopiedBoundaryKey] = useState<string | null>(null);

  useEffect(() => {
    if (inquiryId) {
      setEvidence(loadInquiryEvidence(inquiryId));
      setInvestigatingQuestionId(null);
      setIsInvestigating(false);
      setAwaitingAdoptionRecognition(false);
      setAdoptionRecognized(false);
      setCopiedBoundaryKey(null);
    }
  }, [inquiryId]);

  useEffect(() => {
    if (propMovement) {
      setMovement(propMovement);
      setInvestigatingQuestionId(null);
      setIsInvestigating(false);
      setAwaitingAdoptionRecognition(false);
      setAdoptionRecognized(false);
      setCopiedBoundaryKey(null);
    }
  }, [propMovement]);

  const inquiryState: InquiryState = useMemo(() => {
    return evaluateInquiry(evidence, DEFAULT_LIBRARY);
  }, [evidence]);

  // Release boundary: once the first Design Pack is generated, the Inquiry is complete for this release
  const hasGeneratedPack = useMemo(() => {
    if (!inquiryId) return false;
    return loadLatestDesignPack(inquiryId) !== null;
  }, [inquiryId, evidence]);

  const questionById = useMemo(() => {
    return new Map(DEFAULT_LIBRARY.questions.map((q) => [q.id, q]));
  }, []);

  // Forward-moving next question from evaluator, or targeted investigation question
  const nextUnansweredQuestion: InquiryQuestion | undefined = useMemo(() => {
    if (hasGeneratedPack) return undefined;
    return nextQuestion(inquiryState, movement, DEFAULT_LIBRARY);
  }, [inquiryState, movement, hasGeneratedPack]);

  const investigatingQuestion: InquiryQuestion | undefined = useMemo(() => {
    if (!investigatingQuestionId || hasGeneratedPack) return undefined;
    return questionById.get(investigatingQuestionId);
  }, [investigatingQuestionId, questionById, hasGeneratedPack]);

  const activeQuestion: InquiryQuestion | undefined = investigatingQuestion ?? nextUnansweredQuestion;

  const activeQuestionState: QuestionState | undefined = useMemo(() => {
    if (!activeQuestion) return undefined;
    return inquiryState.questions.find((q) => q.id === activeQuestion.id);
  }, [activeQuestion, inquiryState.questions]);

  // Track when Inquiry enters an active blocker/investigation threshold so resolving it
  // triggers the deliberate Configuration Available recognition moment before adoption.
  useEffect(() => {
    if (
      !hasGeneratedPack &&
      movement === 'develop' &&
      inquiryState.designPack.chosen &&
      inquiryState.designPack.blockers.length > 0
    ) {
      setAwaitingAdoptionRecognition(true);
      setAdoptionRecognized(false);
    }
  }, [
    hasGeneratedPack,
    movement,
    inquiryState.designPack.chosen,
    inquiryState.designPack.blockers.length,
  ]);

  // Screen-sensitive Investigating posture (drives the third plate rail label without adding a new engine movement)
  const isScreenInvestigating = useMemo(() => {
    if (hasGeneratedPack) return false;
    if (investigatingQuestionId !== null || isInvestigating) return true;
    if (
      movement === 'develop' &&
      inquiryState.designPack.chosen &&
      !nextUnansweredQuestion &&
      inquiryState.designPack.blockers.length > 0
    ) {
      return true;
    }
    return false;
  }, [
    hasGeneratedPack,
    investigatingQuestionId,
    isInvestigating,
    movement,
    inquiryState.designPack.chosen,
    nextUnansweredQuestion,
    inquiryState.designPack.blockers.length,
  ]);

  useEffect(() => {
    onInvestigationStateChange?.(isScreenInvestigating);
  }, [isScreenInvestigating, onInvestigationStateChange]);

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
    if (onBack) {
      onBack();
      return;
    }
    if (hasReturnedRef.current) return;
    hasReturnedRef.current = true;
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }, [onBack]);

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

    // If resolving or re-examining a question from Investigation, require explicit
    // recognition when configuration coverage becomes available before adoption.
    if (investigatingQuestionId !== null) {
      setAwaitingAdoptionRecognition(true);
      setAdoptionRecognized(false);
    }

    // Clear targeted investigation question so any newly unlocked conditional
    // questions flow forward via nextQuestion, or return to the threshold.
    setInvestigatingQuestionId(null);
    setIsInvestigating(false);

    // Reset inputs
    setCurrentAnswer('');
    setSelectedChoice(null);
    setSpecificationText('');
  }, [inquiryId, activeQuestion, selectedChoice, currentAnswer, specificationText, investigatingQuestionId]);

  // Copy coverage boundary explanation to clipboard (with Share fallback)
  const handleCopyBoundaryExplanation = useCallback(async (key: string, text: string) => {
    try {
      const nativeClipboard = TurboModuleRegistry.get<
        TurboModule & { setString?: (content: string) => void }
      >('Clipboard');
      if (nativeClipboard && typeof nativeClipboard.setString === 'function') {
        nativeClipboard.setString(text);
        setCopiedBoundaryKey(key);
        setTimeout(() => {
          setCopiedBoundaryKey((prev) => (prev === key ? null : prev));
        }, 2200);
        return;
      }
      await Share.share({ message: text });
    } catch {
      // Ignore cancellation or clipboard fallback errors
    }
  }, []);

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

  // Actionable crossing from Explore endpoint or Movement Available modal: choose Design Pack
  const handleModalChooseDesignPack = useCallback(() => {
    const decision = chooseDesignPack(inquiryState, new Date().toISOString());
    if (decision) {
      recordDecision(inquiryId, decision);
      setEvidence(loadInquiryEvidence(inquiryId));
      setShowMovements(false);
      setInvestigatingQuestionId(null);
      setIsInvestigating(false);
      setMovement('develop');
      onMovementChange?.('develop');
    }
  }, [inquiryId, inquiryState, onMovementChange]);

  // Decline & Reset Inquiry (available before first Design Pack generation)
  const handleDeclineAndReset = useCallback(() => {
    if (!inquiryId || hasGeneratedPack) return;
    Alert.alert(
      'Decline & Reset Inquiry',
      'Discard all recorded answers and decisions in this Inquiry? The Ember itself will remain untouched, and you can start a fresh Inquiry from the beginning.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard & Reset',
          style: 'destructive',
          onPress: () => {
            const ok = resetUncommittedInquiry(inquiryId);
            if (ok) {
              if (onCloseSession) {
                onCloseSession();
              } else {
                returnToEmber();
              }
            }
          },
        },
      ],
    );
  }, [inquiryId, hasGeneratedPack, onCloseSession, returnToEmber]);

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

  const adoptedConfigObj = useMemo(() => {
    if (!inquiryState.designPack.adoptedConfigurationId) return undefined;
    return DEFAULT_LIBRARY.configurations.find(
      (c) => c.id === inquiryState.designPack.adoptedConfigurationId,
    );
  }, [inquiryState.designPack.adoptedConfigurationId]);

  // Recorded Explore context & uncertainty for Investigation and Review views
  const recordedPurpose = useMemo(() => {
    const q = inquiryState.questions.find((qs) => qs.id === 'q-purpose');
    return q?.disposition === 'context' ? q.answer?.value.trim() : undefined;
  }, [inquiryState.questions]);

  const recordedAudience = useMemo(() => {
    const q = inquiryState.questions.find((qs) => qs.id === 'q-audience');
    return q?.disposition === 'context' ? q.answer?.value.trim() : undefined;
  }, [inquiryState.questions]);

  const recordedUncertainty = useMemo(() => {
    const q = inquiryState.questions.find((qs) => qs.id === 'q-uncertainty');
    return q?.disposition === 'context' ? q.answer?.value.trim() : undefined;
  }, [inquiryState.questions]);

  // Blocker classification & originating-question traceability
  const unresolvedBlockers = useMemo(() => {
    return inquiryState.designPack.blockers.filter((b) => b.kind === 'unresolved-decision');
  }, [inquiryState.designPack.blockers]);

  const knowledgeBoundaryBlockers = useMemo(() => {
    return inquiryState.designPack.blockers
      .filter((b) => b.kind === 'knowledge-boundary')
      .map((b) => {
        const cap = b.subject as Capability;
        const sourceConditions = Object.keys(CONDITION_CAPABILITIES).filter(
          (c) => CONDITION_CAPABILITIES[c] === cap && inquiryState.conditions.includes(c),
        );
        const sourceQState = inquiryState.questions.find(
          (q) => q.applicable && q.established.some((c) => sourceConditions.includes(c)),
        );
        const sourceQuestion = sourceQState ? questionById.get(sourceQState.id) : undefined;
        const answerLabel =
          sourceQuestion && sourceQState?.answer
            ? sourceQuestion.choices?.find((c) => c.value === sourceQState.answer?.value)?.label ??
              sourceQState.answer.value
            : undefined;
        return {
          blocker: b,
          sourceQuestion,
          sourceQState,
          answerLabel,
        };
      });
  }, [inquiryState.designPack.blockers, inquiryState.conditions, inquiryState.questions, questionById]);

  const uncoveredCombinationBlockers = useMemo(() => {
    return inquiryState.designPack.blockers.filter((b) => b.kind === 'uncovered-combination');
  }, [inquiryState.designPack.blockers]);

  const capabilityEstablishingQuestions = useMemo(() => {
    return inquiryState.questions
      .filter(
        (q) =>
          q.movement === 'develop' &&
          q.applicable &&
          q.established.some((c) => Boolean(CONDITION_CAPABILITIES[c])),
      )
      .map((q) => {
        const authored = questionById.get(q.id);
        const label =
          authored && q.answer
            ? authored.choices?.find((c) => c.value === q.answer?.value)?.label ?? q.answer.value
            : undefined;
        return { state: q, authored, label };
      });
  }, [inquiryState.questions, questionById]);

  const Container = hideHeader ? View : SafeAreaView;

  return (
    <Container style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        {/* Header bar */}
        {!hideHeader && (
          <View style={styles.headerBar}>
            <Pressable onPress={returnToEmber} hitSlop={12}>
              <Text style={styles.backArrow}>←</Text>
            </Pressable>
            <Text style={styles.headerTitle}>
              {isScreenInvestigating
                ? 'Investigating'
                : movement === 'explore'
                ? 'Explore'
                : 'Develop'}
            </Text>
            <Pressable onPress={returnToEmber} hitSlop={12}>
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          </View>
        )}

        <ScrollView
          contentContainerStyle={styles.phaseContent}
          keyboardShouldPersistTaps="handled"
        >
          {activeQuestion ? (
            <>
              {/* Progress indicator */}
              <View style={styles.progressRow}>
                <Text style={styles.progressText}>
                  {investigatingQuestion
                    ? activeQuestionState?.disposition === 'unresolved'
                      ? 'Investigating · Open Decision'
                      : 'Investigating · Re-examining Scope'
                    : movement === 'explore'
                    ? activeQuestion.role === 'required'
                      ? 'Explore · Foundation'
                      : 'Explore · Optional'
                    : 'Develop · Requirement'}
                </Text>
                {investigatingQuestion ? (
                  <Pressable onPress={() => setInvestigatingQuestionId(null)} hitSlop={8}>
                    <Text style={styles.cancelInvestigateText}>← Back to Threshold</Text>
                  </Pressable>
                ) : (
                  <Text style={styles.progressCount}>
                    {activeQuestion.role === 'optional' ? 'Optional' : 'Required'}
                  </Text>
                )}
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
                <Text style={styles.primaryButtonText}>
                  {investigatingQuestion ? 'Save Resolution' : 'Save & Continue'}
                </Text>
              </Pressable>
            </>
          ) : hasGeneratedPack ? (
            /* Completed Inquiry for this release */
            <View style={styles.finishContainer}>
              <Text style={styles.finishTitle}>Inquiry Complete</Text>
              <Text style={styles.finishBody}>
                A warranted Design Pack has been generated for this Inquiry. For this release, completed Inquiries remain preserved as recorded.
              </Text>
              <Pressable onPress={returnToEmber} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Return to Ember</Text>
              </Pressable>
            </View>
          ) : isInvestigating ? (
            /* ── User-Chosen Guided Investigation View ── */
            <View style={styles.investigationContainer}>
              <Text style={styles.investigationBadge}>USER-CHOSEN INVESTIGATION</Text>
              <Text style={styles.finishTitle}>Investigate Recorded Scope</Text>
              <Text style={styles.finishBody}>
                You may pause and return after researching outside Ember, or select any question below to update your recorded answer. Changing a technical requirement will re-verify configuration adoption and review.
              </Text>

              {recordedUncertainty && (
                <View style={styles.uncertaintyCallout}>
                  <Text style={styles.uncertaintyLabel}>RECORDED UNCERTAINTY</Text>
                  <Text style={styles.uncertaintyText}>“{recordedUncertainty}”</Text>
                </View>
              )}

              {/* Explore Context & Open Material */}
              <View style={styles.investigationGroup}>
                <Text style={styles.investigationGroupTitle}>EXPLORE · INTENT & UNCERTAINTIES</Text>
                {inquiryState.questions
                  .filter((q) => q.movement === 'explore' && q.applicable)
                  .map((q) => {
                    const authored = questionById.get(q.id);
                    if (!authored) return null;
                    const valueText = q.answer?.value.trim();
                    return (
                      <Pressable
                        key={q.id}
                        onPress={() => setInvestigatingQuestionId(q.id)}
                        style={styles.investigationItemCard}
                      >
                        <Text style={styles.investigationQuestionText}>{authored.text}</Text>
                        <Text style={styles.investigationAnswerText} numberOfLines={2}>
                          {valueText ? valueText : 'Not recorded — tap to add'}
                        </Text>
                        <Text style={styles.investigationActionLink}>Tap to update →</Text>
                      </Pressable>
                    );
                  })}
              </View>

              {/* Develop Technical Decisions */}
              <View style={styles.investigationGroup}>
                <Text style={styles.investigationGroupTitle}>DEVELOP · TECHNICAL REQUIREMENTS</Text>
                {inquiryState.questions
                  .filter((q) => q.movement === 'develop' && q.applicable)
                  .map((q) => {
                    const authored = questionById.get(q.id);
                    if (!authored) return null;
                    const choiceLabel = q.answer
                      ? authored.choices?.find((c) => c.value === q.answer?.value)?.label ??
                        q.answer.value
                      : 'Unanswered';
                    const spec = q.answer?.specification?.trim();
                    return (
                      <Pressable
                        key={q.id}
                        onPress={() => setInvestigatingQuestionId(q.id)}
                        style={styles.investigationItemCard}
                      >
                        <Text style={styles.investigationQuestionText}>{authored.text}</Text>
                        <Text style={styles.investigationAnswerText}>
                          {choiceLabel}
                          {spec ? ` (${spec})` : ''}
                        </Text>
                        <Text style={styles.investigationActionLink}>Tap to re-examine →</Text>
                      </Pressable>
                    );
                  })}
              </View>

              <Pressable
                onPress={() => setIsInvestigating(false)}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>Done Investigating</Text>
              </Pressable>

              <Pressable onPress={returnToEmber} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Pause & Return to Ember</Text>
              </Pressable>

              <Pressable onPress={handleDeclineAndReset} style={styles.declineButton}>
                <Text style={styles.declineButtonText}>Decline & Reset Inquiry</Text>
              </Pressable>
            </View>
          ) : movement === 'develop' && inquiryState.designPack.chosen ? (
            /* Develop finished: Investigation / Blockers, Adoption & Review confirmation thresholds */
            <View style={styles.finishContainer}>
              {inquiryState.designPack.blockers.length > 0 ? (
                <View style={styles.investigationContainer}>
                  {/* 1. Engine-Required Investigation: Open Decisions ("Not sure yet") */}
                  {unresolvedBlockers.length > 0 && (
                    <View style={styles.investigationGroup}>
                      <Text style={styles.investigationBadge}>ENGINE-REQUIRED INVESTIGATION</Text>
                      <Text style={styles.finishTitle}>Open Decisions to Investigate</Text>
                      <Text style={styles.finishBody}>
                        These decisions were marked “Not sure yet” and would change the construction. You may pause to investigate outside Ember and return when ready, or resolve an open decision below:
                      </Text>

                      {recordedUncertainty && (
                        <View style={styles.uncertaintyCallout}>
                          <Text style={styles.uncertaintyLabel}>RECORDED UNCERTAINTY (EXPLORE)</Text>
                          <Text selectable style={styles.uncertaintyText}>“{recordedUncertainty}”</Text>
                        </View>
                      )}

                      {unresolvedBlockers.map((b) => {
                        const authored = questionById.get(b.subject);
                        return (
                          <Pressable
                            key={b.subject}
                            onPress={() => setInvestigatingQuestionId(b.subject)}
                            style={styles.openDecisionCard}
                          >
                            <Text style={styles.openDecisionBadge}>OPEN DECISION · NOT SURE YET</Text>
                            <Text style={styles.investigationQuestionText}>
                              {authored?.text ?? b.subject}
                            </Text>
                            <Text style={styles.investigationDetailText}>{b.detail}</Text>
                            <Text style={styles.configAdoptAction}>Tap to resolve decision →</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}

                  {/* 2. Honest Authored Coverage Boundaries */}
                  {(knowledgeBoundaryBlockers.length > 0 || uncoveredCombinationBlockers.length > 0) && (
                    <View style={styles.investigationGroup}>
                      <Text style={styles.boundaryBadge}>AUTHORED COVERAGE BOUNDARY</Text>
                      <Text selectable style={styles.boundaryHeading}>
                        Beyond Current Configuration Perimeter
                      </Text>
                      <Text selectable style={styles.finishBody}>
                        Your recorded requirements are valid, but reach beyond the self-contained local configurations authored in Ember’s current library. Do not change truthful requirements merely to satisfy the engine. Only if your intended first-version scope changes, you may re-examine the decision below:
                      </Text>

                      {knowledgeBoundaryBlockers.map(({ blocker, sourceQuestion, answerLabel }, idx) => {
                        const copyKey = `kb-${idx}`;
                        const copyText = [
                          blocker.detail,
                          sourceQuestion ? `Question: ${sourceQuestion.text}` : undefined,
                          answerLabel
                            ? `Recorded answer: ${answerLabel}${
                                blocker.preservedText ? ` (“${blocker.preservedText}”)` : ''
                              }`
                            : undefined,
                        ]
                          .filter(Boolean)
                          .join('\n');

                        return (
                          <View key={copyKey} style={styles.blockerCard}>
                            <Text selectable style={styles.blockerTitle}>
                              {blocker.detail}
                            </Text>
                            {sourceQuestion && (
                              <Text selectable style={styles.blockerDetail}>
                                Question: {sourceQuestion.text}
                              </Text>
                            )}
                            {answerLabel && (
                              <Text selectable style={styles.blockerDetail}>
                                Recorded answer: {answerLabel}
                                {blocker.preservedText ? ` (“${blocker.preservedText}”)` : ''}
                              </Text>
                            )}
                            <View style={styles.boundaryActionRow}>
                              <Pressable
                                onPress={() => handleCopyBoundaryExplanation(copyKey, copyText)}
                                hitSlop={8}
                                style={styles.boundaryCopyBtn}
                              >
                                <Text style={styles.boundaryCopyText}>
                                  {copiedBoundaryKey === copyKey
                                    ? '✓ Copied to clipboard'
                                    : 'Copy explanation'}
                                </Text>
                              </Pressable>
                              {sourceQuestion && (
                                <Pressable
                                  onPress={() => setInvestigatingQuestionId(sourceQuestion.id)}
                                  hitSlop={8}
                                >
                                  <Text style={styles.investigationActionLink}>
                                    Re-examine first-version scope →
                                  </Text>
                                </Pressable>
                              )}
                            </View>
                          </View>
                        );
                      })}

                      {uncoveredCombinationBlockers.map((b, idx) => {
                        const copyKey = `uc-${idx}`;
                        const copyText = [
                          b.detail,
                          'Contributing decisions for this combination:',
                          ...capabilityEstablishingQuestions.map(
                            ({ state: qs, authored, label }) =>
                              `- ${authored?.text ?? qs.id}: ${label ?? 'Unanswered'}`,
                          ),
                        ].join('\n');

                        return (
                          <View key={copyKey} style={styles.blockerCard}>
                            <Text selectable style={styles.blockerTitle}>
                              {b.detail}
                            </Text>
                            <Text selectable style={styles.blockerDetail}>
                              Contributing decisions for this combination:
                            </Text>
                            {capabilityEstablishingQuestions.map(({ state: qs, authored, label }) => (
                              <View key={qs.id} style={styles.combinationQuestionRow}>
                                <Text selectable style={styles.investigationQuestionText}>
                                  {authored?.text ?? qs.id}
                                </Text>
                                <Text selectable style={styles.investigationAnswerText}>
                                  {label}
                                </Text>
                                <Pressable
                                  onPress={() => setInvestigatingQuestionId(qs.id)}
                                  hitSlop={6}
                                >
                                  <Text style={styles.investigationActionLink}>
                                    Tap to re-examine first-version scope →
                                  </Text>
                                </Pressable>
                              </View>
                            ))}
                            <View style={styles.boundaryActionRow}>
                              <Pressable
                                onPress={() => handleCopyBoundaryExplanation(copyKey, copyText)}
                                hitSlop={8}
                                style={styles.boundaryCopyBtn}
                              >
                                <Text style={styles.boundaryCopyText}>
                                  {copiedBoundaryKey === copyKey
                                    ? '✓ Copied to clipboard'
                                    : 'Copy explanation'}
                                </Text>
                              </Pressable>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}

                  <Pressable onPress={returnToEmber} style={styles.secondaryButton}>
                    <Text style={styles.secondaryButtonText}>Pause & Return to Ember</Text>
                  </Pressable>

                  <Pressable onPress={handleDeclineAndReset} style={styles.declineButton}>
                    <Text style={styles.declineButtonText}>Decline & Reset Inquiry</Text>
                  </Pressable>
                </View>
              ) : !inquiryState.designPack.adoptionValid ? (
                inquiryState.designPack.canAdopt &&
                awaitingAdoptionRecognition &&
                !adoptionRecognized ? (
                  /* Deliberate Recognition Moment when Investigation makes a configuration available */
                  <View style={styles.recognitionSection}>
                    <Text style={styles.recognitionBadge}>CONFIGURATION AVAILABLE</Text>
                    <Text style={styles.finishTitle}>Architecture Coverage Reached</Text>
                    <Text style={styles.finishBody}>
                      Your investigation resolved the open blockers.{' '}
                      {candidateConfigs.length === 1
                        ? '1 authored architecture configuration now satisfies your recorded requirements.'
                        : `${candidateConfigs.length} authored architecture configurations now satisfy your recorded requirements.`}
                    </Text>

                    <View style={styles.recognitionCard}>
                      <Text style={styles.recognitionCardLabel}>
                        QUALIFYING CONFIGURATION{candidateConfigs.length !== 1 ? 'S' : ''}
                      </Text>
                      {candidateConfigs.map((cfg) => (
                        <View key={cfg.id} style={styles.recognitionConfigRow}>
                          <Text style={styles.configName}>{cfg.name}</Text>
                          <Text style={styles.configSummary}>{cfg.summary}</Text>
                        </View>
                      ))}
                    </View>

                    <Text style={styles.finishHint}>
                      Choose whether to proceed to configuration adoption or continue investigating your recorded scope first.
                    </Text>

                    <Pressable
                      onPress={() => setAdoptionRecognized(true)}
                      style={styles.primaryButton}
                    >
                      <Text style={styles.primaryButtonText}>
                        Proceed to Configuration Adoption
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => setIsInvestigating(true)}
                      style={[styles.secondaryButton, { marginTop: SPACING.sm }]}
                    >
                      <Text style={styles.secondaryButtonText}>Continue Investigating</Text>
                    </Pressable>

                    <Pressable onPress={returnToEmber} style={styles.tertiaryButton}>
                      <Text style={styles.tertiaryButtonText}>Pause & Return to Ember</Text>
                    </Pressable>

                    <Pressable onPress={handleDeclineAndReset} style={styles.declineButton}>
                      <Text style={styles.declineButtonText}>Decline & Reset Inquiry</Text>
                    </Pressable>
                  </View>
                ) : (
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

                    <Pressable
                      onPress={() => setIsInvestigating(true)}
                      style={[styles.secondaryButton, { marginTop: SPACING.md }]}
                    >
                      <Text style={styles.secondaryButtonText}>Investigate Further</Text>
                    </Pressable>

                    <Pressable onPress={handleDeclineAndReset} style={styles.declineButton}>
                      <Text style={styles.declineButtonText}>Decline & Reset Inquiry</Text>
                    </Pressable>
                  </View>
                )
              ) : !inquiryState.designPack.reviewCurrent ? (
                <View style={styles.reviewSection}>
                  <Text style={styles.finishTitle}>Confirm Design Scope</Text>
                  <Text style={styles.finishHint}>
                    Adopted Configuration: {adoptedConfigObj?.name ?? inquiryState.designPack.adoptedConfigurationId}
                  </Text>

                  {/* Concise Scope Summary for Review */}
                  <View style={styles.scopeSummaryCard}>
                    {recordedPurpose && (
                      <View style={styles.scopeSummaryRow}>
                        <Text style={styles.scopeSummaryLabel}>PURPOSE</Text>
                        <Text style={styles.scopeSummaryValue} numberOfLines={2}>
                          {recordedPurpose}
                        </Text>
                      </View>
                    )}
                    {recordedAudience && (
                      <View style={styles.scopeSummaryRow}>
                        <Text style={styles.scopeSummaryLabel}>AUDIENCE</Text>
                        <Text style={styles.scopeSummaryValue} numberOfLines={2}>
                          {recordedAudience}
                        </Text>
                      </View>
                    )}
                    {recordedUncertainty && (
                      <View style={styles.scopeSummaryRow}>
                        <Text style={styles.scopeSummaryLabel}>OPEN UNCERTAINTY</Text>
                        <Text style={styles.scopeSummaryValue} numberOfLines={2}>
                          {recordedUncertainty}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.scopeSummaryMeta}>
                      {inquiryState.designPack.requiredCapabilities.length} required capabilities covered ·{' '}
                      {inquiryState.questions.filter((q) => q.movement === 'develop' && q.applicable).length} technical decisions recorded
                    </Text>
                  </View>

                  <Text style={styles.finishBody}>
                    Confirm that the recorded purpose, audience, decisions, and open material contain no known unrepresented consequential issue for the first version.
                  </Text>

                  <Pressable
                    onPress={handleConfirmReview}
                    style={styles.primaryButton}
                  >
                    <Text style={styles.primaryButtonText}>Confirm Review</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setIsInvestigating(true)}
                    style={[styles.secondaryButton, { marginTop: SPACING.sm }]}
                  >
                    <Text style={styles.secondaryButtonText}>Investigate Further</Text>
                  </Pressable>

                  <Pressable onPress={returnToEmber} style={styles.tertiaryButton}>
                    <Text style={styles.tertiaryButtonText}>Pause & Return to Ember</Text>
                  </Pressable>

                  <Pressable onPress={handleDeclineAndReset} style={styles.declineButton}>
                    <Text style={styles.declineButtonText}>Decline & Reset Inquiry</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.reviewSection}>
                  <Text style={styles.finishTitle}>Develop Warranted</Text>
                  <Text style={styles.finishHint}>
                    Adopted Configuration: {adoptedConfigObj?.name ?? inquiryState.designPack.adoptedConfigurationId}
                  </Text>
                  <Text style={styles.finishBody}>
                    Your technical enquiry is complete and warranted for Design Pack generation from the Ember view.
                  </Text>
                  <Pressable onPress={returnToEmber} style={styles.primaryButton}>
                    <Text style={styles.primaryButtonText}>Return to Ember</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setIsInvestigating(true)}
                    style={[styles.secondaryButton, { marginTop: SPACING.sm }]}
                  >
                    <Text style={styles.secondaryButtonText}>Investigate Further</Text>
                  </Pressable>
                  <Pressable onPress={handleDeclineAndReset} style={styles.declineButton}>
                    <Text style={styles.declineButtonText}>Decline & Reset Inquiry</Text>
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
              {!hasGeneratedPack && inquiryState.questions.some((q) => q.answer !== undefined) && (
                <Pressable onPress={handleDeclineAndReset} style={styles.declineButton}>
                  <Text style={styles.declineButtonText}>Decline & Reset Inquiry</Text>
                </Pressable>
              )}
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
                        <Text key={idx} selectable style={styles.movementConflict}>
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
    </Container>
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
  cancelInvestigateText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.emberOrange,
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
  tertiaryButton: {
    alignSelf: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.xs,
  },
  tertiaryButtonText: {
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  declineButton: {
    alignSelf: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.sm,
  },
  declineButtonText: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.textMuted,
    textDecorationLine: 'underline',
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

  // Guided Investigation & Open Decisions
  investigationContainer: {
    width: '100%',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
  },
  investigationBadge: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.emberOrange,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 107, 43, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.25)',
  },
  uncertaintyCallout: {
    width: '100%',
    backgroundColor: 'rgba(255, 107, 43, 0.06)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.18)',
    padding: SPACING.md,
    gap: 4,
  },
  uncertaintyLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.emberOrange,
    letterSpacing: 1.2,
  },
  uncertaintyText: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  investigationGroup: {
    width: '100%',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  investigationGroupTitle: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  investigationItemCard: {
    width: '100%',
    backgroundColor: COLORS.surfaceDark,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.16)',
    padding: SPACING.md,
    gap: 4,
  },
  openDecisionCard: {
    width: '100%',
    backgroundColor: COLORS.surfaceDark,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.35)',
    padding: SPACING.md,
    gap: 6,
  },
  openDecisionBadge: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.emberOrange,
    letterSpacing: 1.1,
  },
  investigationQuestionText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: '600',
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  investigationAnswerText: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  investigationDetailText: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.textMuted,
    lineHeight: 16,
  },
  investigationActionLink: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.emberOrange,
    marginTop: 2,
  },

  // Coverage Boundary cards
  boundaryBadge: {
    alignSelf: 'center',
    fontSize: 9,
    fontWeight: '700',
    color: '#F5A623',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(245, 166, 35, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.3)',
  },
  boundaryHeading: {
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: '600',
    color: '#F5A623',
    textAlign: 'center',
  },
  boundaryActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  boundaryCopyBtn: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.35)',
    backgroundColor: 'rgba(245, 166, 35, 0.08)',
  },
  boundaryCopyText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#F5A623',
  },
  combinationQuestionRow: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    gap: 2,
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

  // Configuration Available Recognition Moment
  recognitionSection: {
    width: '100%',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  recognitionBadge: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.emberOrange,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 107, 43, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.25)',
  },
  recognitionCard: {
    width: '100%',
    backgroundColor: COLORS.surfaceDark,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.22)',
    padding: SPACING.md,
    gap: SPACING.sm,
    marginVertical: SPACING.xs,
  },
  recognitionCardLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.emberOrange,
    letterSpacing: 1.2,
  },
  recognitionConfigRow: {
    gap: 2,
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

  // Review section & Scope Summary
  reviewSection: {
    width: '100%',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  scopeSummaryCard: {
    width: '100%',
    backgroundColor: COLORS.surfaceDark,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.18)',
    padding: SPACING.md,
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  scopeSummaryRow: {
    gap: 2,
  },
  scopeSummaryLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.emberOrange,
    letterSpacing: 1.2,
  },
  scopeSummaryValue: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.textPrimary,
    lineHeight: 18,
  },
  scopeSummaryMeta: {
    fontSize: 10,
    color: COLORS.textMuted,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 107, 43, 0.1)',
    paddingTop: SPACING.xs,
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
