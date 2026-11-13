/// <reference types="node" />

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getQuestionDraft,
  resolveQuestionInputState,
  updateQuestionDraft,
  clearQuestionDraft,
  clearInquiryDrafts,
  clearAllInquiryDrafts,
  findPrecedingAnsweredQuestionId,
  resolveSessionBackStep,
} from '../inquiry-draft-store.ts';
import { serializeEmberMarkdown, parseEmberMarkdown } from '../ember-markdown.ts';
import { evaluateInquiry, nextQuestion, chooseDesignPack } from '../../inquiry/evaluate.ts';
import type { InquiryEvidence } from '../../inquiry/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Inquiry Draft Store — Preservation Across Ember Switches & Unmounts', () => {
  beforeEach(() => {
    clearAllInquiryDrafts();
  });

  test('preserves uncommitted Explore free-text input across session unmount and remount', () => {
    const inquiryId = 'ember-proj-alpha';
    const questionId = 'q-purpose';

    // User types uncommitted free text in Explore
    updateQuestionDraft(
      inquiryId,
      questionId,
      { currentAnswer: 'Offline acoustic bird-call field recorder for dawn chorus.' },
      { answerType: 'text' },
    );

    // Simulate Ember deselection / switching to another Ember and remounting EmberSessionScreen
    const rehydrated = resolveQuestionInputState(inquiryId, questionId, {
      answerType: 'text',
      committedValue: undefined,
    });

    assert.equal(
      rehydrated.currentAnswer,
      'Offline acoustic bird-call field recorder for dawn chorus.',
    );
    assert.equal(rehydrated.selectedChoice, null);
    assert.equal(rehydrated.specificationText, '');
  });

  test('preserves Develop choice selection and conditional specification text across option toggles and Ember switches', () => {
    const inquiryId = 'ember-proj-alpha';
    const questionId = 'q-external-deps';

    // 1. User selects a choice requiring specification ("required") and enters specification text
    updateQuestionDraft(
      inquiryId,
      questionId,
      { selectedChoice: 'required' },
      { answerType: 'choice' },
    );
    updateQuestionDraft(
      inquiryId,
      questionId,
      { specificationText: 'NOAA tide prediction endpoint' },
      { answerType: 'choice' },
    );

    // 2. User temporarily switches to a non-specification choice ("none"), then switches Embers
    updateQuestionDraft(
      inquiryId,
      questionId,
      { selectedChoice: 'none' },
      { answerType: 'choice' },
    );

    // Remounting after Ember switch restores "none" AND keeps specificationText intact if re-selected
    const afterSwitch = resolveQuestionInputState(inquiryId, questionId, {
      answerType: 'choice',
      committedValue: undefined,
    });
    assert.equal(afterSwitch.selectedChoice, 'none');
    assert.equal(afterSwitch.specificationText, 'NOAA tide prediction endpoint');

    // 3. Reselecting "required" reveals the preserved specification text
    const afterReselect = updateQuestionDraft(
      inquiryId,
      questionId,
      { selectedChoice: 'required' },
      { answerType: 'choice' },
    );
    assert.equal(afterReselect.selectedChoice, 'required');
    assert.equal(afterReselect.specificationText, 'NOAA tide prediction endpoint');
  });

  test('strictly separates uncommitted drafts from committed InquiryEvidence', () => {
    const inquiryId = 'ember-proj-alpha';

    // User types drafts for q-purpose and q-audience without pressing Save & Continue
    updateQuestionDraft(
      inquiryId,
      'q-purpose',
      { currentAnswer: 'Uncommitted draft purpose' },
      { answerType: 'text' },
    );
    updateQuestionDraft(
      inquiryId,
      'q-audience',
      { currentAnswer: 'Uncommitted draft audience' },
      { answerType: 'text' },
    );

    // Committed evidence remains empty; deterministic engine evaluation is completely unaffected
    const committedEvidence: InquiryEvidence = { answers: [], decisions: [] };
    const state = evaluateInquiry(committedEvidence);
    assert.equal(state.designPack.available, false);
    assert.deepEqual(state.explore.missingRequired, ['q-purpose', 'q-audience']);
    assert.equal(nextQuestion(state, 'explore')?.id, 'q-purpose');
  });

  test('preserves uncommitted edits when re-examining a committed answer in Investigation', () => {
    const inquiryId = 'ember-proj-alpha';
    const questionId = 'q-external-deps';
    const baseline = {
      answerType: 'choice' as const,
      committedValue: 'required',
      committedSpecification: 'Initial Weather API',
    };

    // Before any draft edit, resolves to the committed answer
    const initial = resolveQuestionInputState(inquiryId, questionId, baseline);
    assert.equal(initial.selectedChoice, 'required');
    assert.equal(initial.specificationText, 'Initial Weather API');

    // User edits only the specification text during Investigation, then switches Embers
    updateQuestionDraft(
      inquiryId,
      questionId,
      { specificationText: 'Updated Weather + Radar API' },
      baseline,
    );

    const rehydrated = resolveQuestionInputState(inquiryId, questionId, baseline);
    assert.equal(rehydrated.selectedChoice, 'required');
    assert.equal(rehydrated.specificationText, 'Updated Weather + Radar API');
  });
});

describe('Inquiry Draft Store — Isolation Between Inquiries & Cleanup Conditions', () => {
  beforeEach(() => {
    clearAllInquiryDrafts();
  });

  test('isolates drafts between different Inquiries on the same questionId', () => {
    const inquiryA = 'ember-proj-A';
    const inquiryB = 'ember-proj-B';

    updateQuestionDraft(
      inquiryA,
      'q-purpose',
      { currentAnswer: 'Ember A purpose draft' },
      { answerType: 'text' },
    );
    updateQuestionDraft(
      inquiryB,
      'q-purpose',
      { currentAnswer: 'Ember B purpose draft' },
      { answerType: 'text' },
    );

    assert.equal(
      resolveQuestionInputState(inquiryA, 'q-purpose', { answerType: 'text' }).currentAnswer,
      'Ember A purpose draft',
    );
    assert.equal(
      resolveQuestionInputState(inquiryB, 'q-purpose', { answerType: 'text' }).currentAnswer,
      'Ember B purpose draft',
    );
  });

  test('cleans up only the committed question draft on answer commit while preserving other drafts', () => {
    const inquiryId = 'ember-proj-A';

    updateQuestionDraft(
      inquiryId,
      'q-purpose',
      { currentAnswer: 'Draft purpose about to be committed' },
      { answerType: 'text' },
    );
    updateQuestionDraft(
      inquiryId,
      'q-uncertainty',
      { currentAnswer: 'Open question draft held for later' },
      { answerType: 'text' },
    );

    // Commit q-purpose
    clearQuestionDraft(inquiryId, 'q-purpose');

    assert.equal(getQuestionDraft(inquiryId, 'q-purpose'), undefined);
    // Subsequent re-examination of q-purpose hydrates from committed baseline, not stale draft
    assert.equal(
      resolveQuestionInputState(inquiryId, 'q-purpose', {
        answerType: 'text',
        committedValue: 'Committed final purpose',
      }).currentAnswer,
      'Committed final purpose',
    );
    // Unrelated question draft on the same inquiry remains intact
    assert.equal(
      getQuestionDraft(inquiryId, 'q-uncertainty')?.currentAnswer,
      'Open question draft held for later',
    );
  });

  test('cleans up all drafts for an Inquiry on reset or Ember deletion/completion without affecting other Inquiries', () => {
    const inquiryA = 'ember-proj-A';
    const inquiryB = 'ember-proj-B';

    updateQuestionDraft(
      inquiryA,
      'q-purpose',
      { currentAnswer: 'Draft A1' },
      { answerType: 'text' },
    );
    updateQuestionDraft(
      inquiryA,
      'q-external-deps',
      { selectedChoice: 'required', specificationText: 'Service A' },
      { answerType: 'choice' },
    );
    updateQuestionDraft(
      inquiryB,
      'q-purpose',
      { currentAnswer: 'Draft B1' },
      { answerType: 'text' },
    );

    // Decline & Reset Inquiry A (or Delete / Complete Ember A)
    clearInquiryDrafts(inquiryA);

    assert.equal(getQuestionDraft(inquiryA, 'q-purpose'), undefined);
    assert.equal(getQuestionDraft(inquiryA, 'q-external-deps'), undefined);
    assert.equal(
      getQuestionDraft(inquiryB, 'q-purpose')?.currentAnswer,
      'Draft B1',
    );
  });

  test('removes draft entry automatically when an unanswered question input is cleared back to empty', () => {
    const inquiryId = 'ember-proj-A';

    updateQuestionDraft(
      inquiryId,
      'q-purpose',
      { currentAnswer: 'Temporary thought' },
      { answerType: 'text' },
    );
    assert.ok(getQuestionDraft(inquiryId, 'q-purpose'));

    updateQuestionDraft(
      inquiryId,
      'q-purpose',
      { currentAnswer: '' },
      { answerType: 'text' },
    );
    assert.equal(getQuestionDraft(inquiryId, 'q-purpose'), undefined);
  });
});

describe('Spark Participation Picker — Available Embers Freshness', () => {
  test('SparksScreen binds Choose an Ember picker to refreshed availableEmbers state rather than inline zero-arg listEmbers()', () => {
    const sparksScreenPath = path.resolve(__dirname, '../../app/(main)/sparks/index.tsx');
    const source = fs.readFileSync(sparksScreenPath, 'utf8');

    // Must not pass inline zero-arg listEmbers() to FlatList (which React Compiler memoizes once on initial mount)
    assert.doesNotMatch(source, /data=\{listEmbers\(\)\}/);

    // Must bind FlatList to explicit availableEmbers state and refresh it in loadData and handleOpenEmberPicker
    assert.match(source, /data=\{availableEmbers\}/);
    assert.match(source, /const\s+handleOpenEmberPicker\s*=\s*useCallback\(\(\)\s*=>\s*\{[\s\S]*?setAvailableEmbers\(listEmbers\(\)\);\s*setShowEmberPicker\(true\);/);
  });
});

describe('P2 Coherence — Bounded Most-Recent-Answer Fallback & Inner Back Hierarchy', () => {
  test('findPrecedingAnsweredQuestionId returns undefined on the first question and the single immediately preceding answered question on subsequent questions', () => {
    const emptyState = evaluateInquiry({ answers: [], decisions: [] });
    const firstExplore = nextQuestion(emptyState, 'explore');
    assert.equal(firstExplore?.id, 'q-purpose');

    assert.equal(
      findPrecedingAnsweredQuestionId(
        emptyState.questions.map((q) => ({
          id: q.id,
          movement: q.movement,
          applicable: q.applicable,
          hasAnswer: q.answer !== undefined,
        })),
        'explore',
        firstExplore!.id,
      ),
      undefined,
    );

    // After answering q-purpose, next question is q-audience and preceding is q-purpose
    const afterPurposeState = evaluateInquiry({
      answers: [
        {
          questionId: 'q-purpose',
          value: 'Local field journal',
          answeredAt: '2026-10-28T10:00:00Z',
        },
      ],
      decisions: [],
    });
    const secondExplore = nextQuestion(afterPurposeState, 'explore');
    assert.equal(secondExplore?.id, 'q-audience');

    assert.equal(
      findPrecedingAnsweredQuestionId(
        afterPurposeState.questions.map((q) => ({
          id: q.id,
          movement: q.movement,
          applicable: q.applicable,
          hasAnswer: q.answer !== undefined,
        })),
        'explore',
        secondExplore!.id,
      ),
      'q-purpose',
    );
  });

  test('findPrecedingAnsweredQuestionId skips non-applicable conditional questions in Develop', () => {
    const exploreEvidence: InquiryEvidence = {
      answers: [
        { questionId: 'q-purpose', value: 'Purpose', answeredAt: '2026-10-28T10:00:00Z' },
        { questionId: 'q-audience', value: 'Audience', answeredAt: '2026-10-28T10:01:00Z' },
      ],
      decisions: [],
    };
    const chooseDecision = chooseDesignPack(
      evaluateInquiry(exploreEvidence),
      '2026-10-28T10:01:30Z',
    )!;

    // Answer q-persistence = 'no' (so conditional q-data-shape is NOT applicable) and q-data-location = 'device'
    const developState = evaluateInquiry({
      answers: [
        ...exploreEvidence.answers,
        { questionId: 'q-reach', value: 'personal', answeredAt: '2026-10-28T10:02:00Z' },
        { questionId: 'q-platform', value: 'mobile', answeredAt: '2026-10-28T10:03:00Z' },
        { questionId: 'q-persistence', value: 'no', answeredAt: '2026-10-28T10:04:00Z' },
        { questionId: 'q-data-location', value: 'device', answeredAt: '2026-10-28T10:05:00Z' },
      ],
      decisions: [chooseDecision],
    });

    const currentDevelop = nextQuestion(developState, 'develop');
    assert.equal(currentDevelop?.id, 'q-external-deps');

    // Immediately preceding applicable answered question before q-external-deps is q-data-location (skipping non-applicable q-data-shape)
    assert.equal(
      findPrecedingAnsweredQuestionId(
        developState.questions.map((q) => ({
          id: q.id,
          movement: q.movement,
          applicable: q.applicable,
          hasAnswer: q.answer !== undefined,
        })),
        'develop',
        currentDevelop!.id,
      ),
      'q-data-location',
    );
  });

  test('resolveSessionBackStep steps through question -> investigation -> unhandled outer return', () => {
    // 1. Inside an investigating question opened from user-chosen investigation
    const step1 = resolveSessionBackStep({
      investigatingQuestionId: 'q-storage',
      revisitingPreviousQuestionId: null,
      isInvestigating: true,
    });
    assert.equal(step1.handled, true);
    assert.deepEqual(step1.nextState, {
      investigatingQuestionId: null,
      revisitingPreviousQuestionId: null,
      isInvestigating: true,
    });

    // 2. Next back press exits user-chosen investigation list back to threshold
    const step2 = resolveSessionBackStep(step1.nextState);
    assert.equal(step2.handled, true);
    assert.deepEqual(step2.nextState, {
      investigatingQuestionId: null,
      revisitingPreviousQuestionId: null,
      isInvestigating: false,
    });

    // 3. Next back press at the root of the session delegates to outer TerritoryStage (focusEmber)
    const step3 = resolveSessionBackStep(step2.nextState);
    assert.equal(step3.handled, false);
  });

  test('resolveSessionBackStep cancels revisitingPreviousQuestionId before exiting the session', () => {
    const step = resolveSessionBackStep({
      investigatingQuestionId: null,
      revisitingPreviousQuestionId: 'q-purpose',
      isInvestigating: false,
    });
    assert.equal(step.handled, true);
    assert.deepEqual(step.nextState, {
      investigatingQuestionId: null,
      revisitingPreviousQuestionId: null,
      isInvestigating: false,
    });
  });

  test('parseEmberMarkdown preserves user-given names starting with "Untitled"', () => {
    const md = serializeEmberMarkdown({
      id: 'ember-untitled-test',
      nature: 'open',
      name: 'Untitled Symphony No. 1',
      questions: ['How should the overture begin?'],
      sources: [],
      createdAt: '2026-10-28T10:00:00Z',
      updatedAt: '2026-10-28T10:00:00Z',
    });
    const parsed = parseEmberMarkdown(md);
    assert.ok(parsed);
    assert.equal(parsed.name, 'Untitled Symphony No. 1');
  });

  test('explicit Cancel on a revisited answer discards uncommitted revision and restores committed baseline, while ordinary Back preserves draft work', () => {
    clearAllInquiryDrafts();
    const inquiryId = 'ember-proj-cancel-vs-back';
    const committedPurpose = 'Original committed purpose';

    // 1. User revisits q-purpose and types a temporary revision
    updateQuestionDraft(
      inquiryId,
      'q-purpose',
      { currentAnswer: 'Temporary uncommitted revision' },
      { answerType: 'text', committedValue: committedPurpose },
    );

    // 2. Ordinary Back (resolveSessionBackStep) exits revisit view without destroying draft work
    const backStep = resolveSessionBackStep({
      investigatingQuestionId: null,
      revisitingPreviousQuestionId: 'q-purpose',
      isInvestigating: false,
    });
    assert.equal(backStep.handled, true);
    assert.equal(backStep.nextState.revisitingPreviousQuestionId, null);
    assert.equal(
      resolveQuestionInputState(inquiryId, 'q-purpose', {
        answerType: 'text',
        committedValue: committedPurpose,
      }).currentAnswer,
      'Temporary uncommitted revision',
    );

    // 3. Explicit Cancel (clearQuestionDraft) genuinely discards the uncommitted revision
    // so subsequent revisits restore the committed answer baseline
    clearQuestionDraft(inquiryId, 'q-purpose');
    assert.equal(getQuestionDraft(inquiryId, 'q-purpose'), undefined);
    assert.equal(
      resolveQuestionInputState(inquiryId, 'q-purpose', {
        answerType: 'text',
        committedValue: committedPurpose,
      }).currentAnswer,
      committedPurpose,
    );
  });

  test('EmberSessionScreen wires explicit Cancel to handleCancelQuestionRevision (clearQuestionDraft) while keeping handleInternalBack non-destructive', () => {
    const sessionScreenPath = path.resolve(
      __dirname,
      '../../app/(main)/ember-session/[id].tsx',
    );
    const source = fs.readFileSync(sessionScreenPath, 'utf8');

    assert.match(
      source,
      /const\s+handleCancelQuestionRevision\s*=\s*useCallback\(\(\)\s*=>\s*\{[\s\S]*?clearQuestionDraft\(inquiryId,\s*activeQuestionId\);/,
    );
    assert.match(source, /onPress=\{handleCancelQuestionRevision\}/);
  });
});

describe('UI, Navigation & Interaction Vocabulary Coherence', () => {
  test('QuickCaptureModal is a single-action capture that persists the Spark and closes immediately without a secondary screen', () => {
    const quickCapturePath = path.resolve(
      __dirname,
      '../../components/sparks/QuickCaptureModal.tsx',
    );
    const source = fs.readFileSync(quickCapturePath, 'utf8');

    // No intermediate capturedSpark post-capture state
    assert.doesNotMatch(source, /capturedSpark/);
    // handleCatch saves spark, invokes onCaptured, and immediately closes
    assert.match(
      source,
      /const\s+handleCatch\s*=\s*useCallback\(\(\)\s*=>\s*\{[\s\S]*?saveSpark\(spark\);[\s\S]*?onCaptured\?\.\(spark\);[\s\S]*?onClose\(\);/,
    );
  });

  test('SparksScreen removes inline capture form, provides connected sub-plate bar, and branches single vs. multi-Spark promotion', () => {
    const sparksScreenPath = path.resolve(__dirname, '../../app/(main)/sparks/index.tsx');
    const source = fs.readFileSync(sparksScreenPath, 'utf8');

    // Legacy inline captureSection is removed
    assert.doesNotMatch(source, /styles\.captureSection/);
    // Connected sub-plate bar provides + Capture Spark entry point
    assert.match(source, /\+ Capture Spark/);
    assert.match(source, /styles\.embeddedSubBar/);

    // Single-Spark immediate promotion vs. Multi-Spark pre-staged CreateEmberScreen routing
    assert.match(
      source,
      /const\s+promoteSingleSparkToEmber\s*=\s*useCallback\(\s*\(spark:\s*Spark\)\s*=>\s*\{[\s\S]*?createEmberSeed\('open',\s*\{\s*name:\s*spark\.title,?\s*\}\);[\s\S]*?saveEmber\(seed\);[\s\S]*?associateSparksWithEmber\(\[spark\.id\],\s*seed\.id\);/,
    );
    assert.match(
      source,
      /if\s*\(selected\.length\s*===\s*1\)\s*\{[\s\S]*?promoteSingleSparkToEmber\(selected\[0\]\);/,
    );
    assert.match(
      source,
      /if\s*\(onCreateEmberWithSparks\)\s*\{[\s\S]*?onCreateEmberWithSparks\(selected\);/,
    );

    // Single-tap inspects any Spark in default mode; long-press enters/toggles selection on lingering Sparks
    assert.match(source, /onPress=\{\(\)\s*=>\s*handleCardPress\(item\)\}/);
    assert.match(source, /onLongPress=\{\(\)\s*=>\s*handleCardLongPress\(item\)\}/);
  });

  test('PlateRail and PlateCover support vertical swipe gestures alongside tap, wired in TerritoryStage', () => {
    const plateRailPath = path.resolve(__dirname, '../../components/plates/PlateRail.tsx');
    const plateCoverPath = path.resolve(__dirname, '../../components/plates/PlateCover.tsx');
    const territoryStagePath = path.resolve(
      __dirname,
      '../../components/plates/TerritoryStage.tsx',
    );

    const railSource = fs.readFileSync(plateRailPath, 'utf8');
    const coverSource = fs.readFileSync(plateCoverPath, 'utf8');
    const stageSource = fs.readFileSync(territoryStagePath, 'utf8');

    assert.match(railSource, /onSwipeUp\?:\s*\(\)\s*=>\s*void/);
    assert.match(railSource, /onSwipeDown\?:\s*\(\)\s*=>\s*void/);
    assert.match(coverSource, /onSwipeUp\?:\s*\(\)\s*=>\s*void/);
    assert.match(coverSource, /onSwipeDown\?:\s*\(\)\s*=>\s*void/);
    assert.match(stageSource, /initialStagedSparks=\{initialCreateSparks\}/);
  });

  test('EmberViewScreen, CollectionsScreen, EmberSessionScreen, and EditEmberScreen honour connected sub-plate and modal contracts', () => {
    const emberViewPath = path.resolve(__dirname, '../../app/(main)/ember/[id].tsx');
    const collectionsPath = path.resolve(__dirname, '../../app/(main)/collections/index.tsx');
    const sessionPath = path.resolve(__dirname, '../../app/(main)/ember-session/[id].tsx');
    const editEmberPath = path.resolve(__dirname, '../../app/(main)/ember/edit/[id].tsx');

    const emberViewSource = fs.readFileSync(emberViewPath, 'utf8');
    const collectionsSource = fs.readFileSync(collectionsPath, 'utf8');
    const sessionSource = fs.readFileSync(sessionPath, 'utf8');
    const editSource = fs.readFileSync(editEmberPath, 'utf8');

    // EmberViewScreen: live posture label and interactive Participating Spark inspection/release modal
    assert.match(emberViewSource, /EMBER · READY TO EXPLORE/);
    assert.match(emberViewSource, /WARRANTED · READY TO GENERATE/);
    assert.match(emberViewSource, /Release to Lingering/);

    // CollectionsScreen: long-press quick-action modal on Ember cards
    assert.match(collectionsSource, /onLongPress=\{\(\)\s*=>\s*setActionEmber\(item\)\}/);

    // EmberSessionScreen: legacy showMovements modal is removed
    assert.doesNotMatch(sessionSource, /showMovements/);

    // EditEmberScreen: bottom Cancel button is hidden when hideHeader is true
    assert.match(editSource, /\{!hideHeader\s*&&\s*\(\s*<Pressable\s+onPress=\{handleCancel\}\s+style=\{styles\.cancelButton\}>/);
  });

  test('Mechanical Orchestra Evolution: Skia Constellation Glyph, PlateFieldCanvas, Continuous Pan Scrubbing, Quiet Cards & Inline Confirmation Bars', () => {
    const glyphPath = path.resolve(
      __dirname,
      '../../components/plates/EmberConstellationGlyph.tsx',
    );
    const fieldCanvasPath = path.resolve(
      __dirname,
      '../../components/plates/PlateFieldCanvas.tsx',
    );
    const plateCoverPath = path.resolve(__dirname, '../../components/plates/PlateCover.tsx');
    const plateRailPath = path.resolve(__dirname, '../../components/plates/PlateRail.tsx');
    const territoryStagePath = path.resolve(
      __dirname,
      '../../components/plates/TerritoryStage.tsx',
    );
    const sparksScreenPath = path.resolve(__dirname, '../../app/(main)/sparks/index.tsx');
    const sessionScreenPath = path.resolve(
      __dirname,
      '../../app/(main)/ember-session/[id].tsx',
    );

    const glyphSource = fs.readFileSync(glyphPath, 'utf8');
    const fieldCanvasSource = fs.readFileSync(fieldCanvasPath, 'utf8');
    const coverSource = fs.readFileSync(plateCoverPath, 'utf8');
    const railSource = fs.readFileSync(plateRailPath, 'utf8');
    const stageSource = fs.readFileSync(territoryStagePath, 'utf8');
    const sparksSource = fs.readFileSync(sparksScreenPath, 'utf8');
    const sessionSource = fs.readFileSync(sessionScreenPath, 'utf8');

    // Skia Constellation Glyph & PlateFieldCanvas
    assert.match(glyphSource, /@shopify\/react-native-skia/);
    assert.match(fieldCanvasSource, /@shopify\/react-native-skia/);

    // Continuous finger-tracked Pan gestures on PlateCover and PlateRail
    assert.match(coverSource, /Gesture\.Pan\(\)/);
    assert.match(railSource, /Gesture\.Pan\(\)/);

    // TerritoryStage retires redundant [SPLIT] header button/badge and provides inline confirmation bar
    assert.doesNotMatch(stageSource, /styles\.headerSplitBadge/);
    assert.match(stageSource, /pendingDiscardGuard/);

    // SparksScreen removes instructional footer clutter from resting cards and renders inline confirmation bar
    assert.doesNotMatch(sparksSource, /Tap to inspect · Hold to select/);
    assert.match(sparksSource, /confirmingBatchDelete/);

    // EmberSessionScreen provides collapsible Source Constellation Drawer
    assert.match(sessionSource, /showSourceDrawer/);
  });
});
