/// <reference types="node" />

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import type { EmberSeed } from '../ember-types.ts';
import type { Spark } from '../spark-types.ts';
import {
  buildEmberOriginalMaterial,
  describeEmberDeletionSummary,
  buildEmberCompletionRecord,
} from '../ember-completion.ts';
import {
  evaluateInquiry,
  chooseDesignPack,
  adoptConfiguration,
  confirmReview,
} from '../../inquiry/evaluate.ts';
import type { CommittedAnswer, InquiryDecision } from '../../inquiry/types.ts';

function makeSeed(overrides?: Partial<EmberSeed>): EmberSeed {
  return {
    id: 'ember-test-1',
    nature: 'project',
    name: 'Field Notes Companion',
    questions: [],
    sources: [],
    createdAt: '2026-10-20T10:00:00.000Z',
    updatedAt: '2026-10-22T12:00:00.000Z',
    ...overrides,
  };
}

function makeSpark(id: string, title: string, content: string): Spark {
  return {
    id,
    title,
    content,
    inputType: 'text',
    status: 'ember-associated',
    emberId: 'ember-test-1',
    createdAt: '2026-10-21T09:30:00.000Z',
  };
}

describe('Ember Lifecycle — buildEmberOriginalMaterial', () => {
  test('returns undefined when neither legacy spark nor participating sparks exist', () => {
    const seed = makeSeed({ spark: undefined });
    assert.equal(buildEmberOriginalMaterial(seed, []), undefined);
  });

  test('preserves legacy seed.spark and appends non-duplicate participating sparks', () => {
    const seed = makeSeed({
      spark: 'Initial field observation about offline note capture.',
    });
    const sparks: Spark[] = [
      makeSpark(
        'sp-1',
        'Duplicate Initial',
        'Initial field observation about offline note capture.',
      ),
      makeSpark(
        'sp-2',
        'Second Spark',
        'Botanists need quick taxonomy tags while walking.',
      ),
    ];

    const material = buildEmberOriginalMaterial(seed, sparks);
    assert.equal(
      material,
      'Initial field observation about offline note capture.\n\nBotanists need quick taxonomy tags while walking.',
    );
  });
});

describe('Ember Lifecycle — describeEmberDeletionSummary', () => {
  test('undeveloped Ember states that participating Sparks return to Lingering Sparks', () => {
    const seed = makeSeed();
    const sparks = [
      makeSpark('sp-1', 'Spark A', 'First thought'),
      makeSpark('sp-2', 'Spark B', 'Second thought'),
    ];
    const emptyState = evaluateInquiry({ answers: [], decisions: [] });

    const summary = describeEmberDeletionSummary({
      seed,
      participatingSparks: sparks,
      inquiryState: emptyState,
      hasDesignPack: false,
    });

    assert.equal(summary.hasInquiryProgress, false);
    assert.equal(summary.hasDesignPack, false);
    assert.match(summary.message, /2 participating Sparks will not be deleted/);
    assert.match(summary.message, /return to Lingering Sparks/);
  });

  test('developed Ember with Inquiry answers reports progress and Spark release', () => {
    const seed = makeSeed();
    const sparks = [makeSpark('sp-1', 'Spark A', 'First thought')];
    const state = evaluateInquiry({
      answers: [
        {
          questionId: 'q-purpose',
          value: 'Capture field notes in the forest',
          answeredAt: '2026-10-22T10:00:00.000Z',
        },
      ],
      decisions: [],
    });

    const summary = describeEmberDeletionSummary({
      seed,
      participatingSparks: sparks,
      inquiryState: state,
      hasDesignPack: false,
    });

    assert.equal(summary.hasInquiryProgress, true);
    assert.equal(summary.hasDesignPack, false);
    assert.match(summary.title, /Delete Developed Ember/);
    assert.match(summary.message, /1 recorded answer/);
    assert.match(summary.message, /1 participating Spark will not be deleted/);
  });

  test('Ember with generated Design Pack reports Design Pack removal and Spark release', () => {
    const seed = makeSeed();
    const state = evaluateInquiry({ answers: [], decisions: [] });

    const summary = describeEmberDeletionSummary({
      seed,
      participatingSparks: [],
      inquiryState: state,
      hasDesignPack: true,
    });

    assert.equal(summary.hasInquiryProgress, true);
    assert.equal(summary.hasDesignPack, true);
    assert.match(summary.title, /Delete Ember & Design Pack/);
    assert.match(summary.message, /generated Design Pack/);
  });
});

describe('Ember Lifecycle — buildEmberCompletionRecord', () => {
  test('early-stage Ember includes only persisted identity and Sparks without inventing Inquiry history', () => {
    const seed = makeSeed({
      carriedSentence: 'Quiet notes carried from the trail.',
      questions: ['How should sketches attach to a note?'],
    });
    const sparks = [
      makeSpark('sp-1', 'Trail Marker', 'Saw lichen patterns on north-facing bark.'),
    ];
    const emptyState = evaluateInquiry({ answers: [], decisions: [] });

    const record = buildEmberCompletionRecord({
      seed,
      participatingSparks: sparks,
      inquiryState: emptyState,
      designPack: null,
    });

    assert.match(record, /# Field Notes Companion/);
    assert.match(record, /## What This Ember Carries/);
    assert.match(record, /\*Quiet notes carried from the trail\.\*/);
    assert.match(record, /## Participating Sparks/);
    assert.match(record, /### Trail Marker \(2026-10-21\)/);
    assert.match(record, /Saw lichen patterns on north-facing bark\./);
    assert.match(record, /## Questions Worth Holding/);
    assert.match(record, /- How should sketches attach to a note\?/);

    // Must not invent Exploration, Inquiry, or Design Pack sections
    assert.doesNotMatch(record, /## Exploration/);
    assert.doesNotMatch(record, /## Inquiry & Development/);
    assert.doesNotMatch(record, /## Generated Design Pack/);
  });

  test('developed Ember with Design Pack includes Exploration, Inquiry answers, adopted configuration, and Design Pack', () => {
    const seed = makeSeed();
    const sparks = [
      makeSpark('sp-1', 'Offline Sync', 'Must work without cellular signal.'),
    ];

    const answers: CommittedAnswer[] = [
      { questionId: 'q-purpose', value: 'Record botanical observations offline.', answeredAt: '2026-10-22T10:01:00Z' },
      { questionId: 'q-audience', value: 'Solo field researchers.', answeredAt: '2026-10-22T10:02:00Z' },
      { questionId: 'q-reach', value: 'personal', answeredAt: '2026-10-22T10:03:00Z' },
      { questionId: 'q-platform', value: 'mobile', answeredAt: '2026-10-22T10:04:00Z' },
      { questionId: 'q-persistence', value: 'yes', answeredAt: '2026-10-22T10:05:00Z' },
      { questionId: 'q-data-location', value: 'device', answeredAt: '2026-10-22T10:06:00Z' },
      { questionId: 'q-data-shape', value: 'records', answeredAt: '2026-10-22T10:07:00Z' },
      { questionId: 'q-external-deps', value: 'none', answeredAt: '2026-10-22T10:08:00Z' },
      { questionId: 'q-offline', value: 'yes', answeredAt: '2026-10-22T10:09:00Z' },
      { questionId: 'q-accounts', value: 'none', answeredAt: '2026-10-22T10:10:00Z' },
      { questionId: 'q-recovery', value: 'recoverable', answeredAt: '2026-10-22T10:11:00Z' },
      { questionId: 'q-constraints', value: 'none', answeredAt: '2026-10-22T10:12:00Z' },
    ];

    const decisions: InquiryDecision[] = [];
    let state = evaluateInquiry({ answers, decisions });
    const dChoose = chooseDesignPack(state, '2026-10-22T10:13:00Z');
    assert.ok(dChoose);
    decisions.push(dChoose);

    state = evaluateInquiry({ answers, decisions });
    const candidateId = state.designPack.candidates[0];
    assert.ok(candidateId);
    const dAdopt = adoptConfiguration(state, candidateId, '2026-10-22T10:14:00Z');
    assert.ok(dAdopt);
    decisions.push(dAdopt);

    state = evaluateInquiry({ answers, decisions });
    const dConfirm = confirmReview(state, '2026-10-22T10:15:00Z');
    assert.ok(dConfirm);
    decisions.push(dConfirm);

    state = evaluateInquiry({ answers, decisions });

    const record = buildEmberCompletionRecord({
      seed,
      participatingSparks: sparks,
      inquiryState: state,
      designPack: {
        version: 1,
        markdown: '# Field Notes Companion — Design Pack\n\nPersisted pack body.',
        configurationId: candidateId,
        staleness: 'current',
      },
    });

    assert.match(record, /## Exploration/);
    assert.match(record, /Record botanical observations offline\./);
    assert.match(record, /Solo field researchers\./);
    assert.match(record, /## Inquiry & Development/);
    assert.match(record, new RegExp(`Adopted Configuration:.*${candidateId}`));
    assert.match(record, /Warranted & Review Confirmed/);
    assert.match(record, /## Generated Design Pack \(v1\)/);
    assert.match(record, /Persisted pack body\./);
  });
});
