// ─────────────────────────────────────────────
// Inquiry Engine — Phase 3 Tests: Handoff & Generation
//
// Tests for:
//   - assessHandoffContent (requiredHandoffContentCanBeProduced)
//   - evaluateInquiry with handoff-content-unavailable warrant gap
//   - generateDesignPack producing Spec §9 markdown & engine provenance
//   - generateDesignPack refusal when unwarranted
// ─────────────────────────────────────────────

/// <reference types="node" />

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import type { CommittedAnswer, Configuration, InquiryDecision, InquiryEvidence, InquiryState } from '../types.ts';
import {
  adoptConfiguration,
  chooseDesignPack,
  confirmReview,
  evaluateInquiry,
  DEFAULT_LIBRARY,
} from '../evaluate.ts';
import { CONFIGURATIONS } from '../configurations.ts';
import { assessHandoffContent } from '../handoff.ts';
import { generateDesignPack, DESIGN_PACK_GENERATOR } from '../generate.ts';

let clock = 0;
const t = () => new Date(Date.UTC(2026, 9, 7, 12, 0, clock++)).toISOString();

function a(questionId: string, value: string, specification?: string): CommittedAnswer {
  return { questionId, value, specification, answeredAt: t() };
}

const EXPLORED = () => [
  a('q-purpose', 'Build a personal task manager'),
  a('q-audience', 'Solo developers'),
  a('q-important-to-preserve', 'Keep keyboard shortcuts intact'),
  a('q-uncertainty', 'Whether sync is needed later'),
];

const MOBILE_SESSION = () => [
  a('q-reach', 'personal'),
  a('q-platform', 'mobile'),
  a('q-persistence', 'no'),
  a('q-data-location', 'device'),
  a('q-external-deps', 'none'),
  a('q-offline', 'yes'),
  a('q-accounts', 'none'),
  a('q-constraints', 'none'),
];

function warrantedWith(develop: CommittedAnswer[], configurationId: string) {
  const answers = [...EXPLORED()];
  const choice = chooseDesignPack(evaluateInquiry({ answers, decisions: [] }), t())!;
  assert.ok(choice);
  const evidence: InquiryEvidence = { answers: [...answers, ...develop], decisions: [choice] };
  const stateAfterDevelop = evaluateInquiry(evidence);
  const adoption = adoptConfiguration(stateAfterDevelop, configurationId, t())!;
  assert.ok(adoption);
  evidence.decisions.push(adoption);
  const stateAfterAdoption = evaluateInquiry(evidence);
  const review = confirmReview(stateAfterAdoption, t())!;
  assert.ok(review);
  evidence.decisions.push(review);
  return { evidence, state: evaluateInquiry(evidence) };
}

describe('Phase 3 — Handoff Content Producibility', () => {
  test('all 6 authored configurations have producible handoff content for all capabilities they satisfy', () => {
    for (const cfg of CONFIGURATIONS) {
      const assessment = assessHandoffContent(cfg, cfg.satisfies);
      assert.equal(assessment.assessed, true);
      assert.equal(assessment.producible, true, `${cfg.id} should produce all satisfied capabilities: missing [${assessment.missing.join(', ')}]`);
      assert.deepEqual(assessment.missing, []);
    }
  });

  test('missing base content marks handoff as not producible', () => {
    const baseCfg = CONFIGURATIONS[0];
    const strippedCfg: Configuration = {
      ...baseCfg,
      starterLayout: [], // base part missing
    };
    const assessment = assessHandoffContent(strippedCfg, ['target-mobile']);
    assert.equal(assessment.producible, false);
    assert.ok(assessment.missing.includes('starter-layout'));
  });

  test('missing capability provision marks handoff as not producible', () => {
    const baseCfg = CONFIGURATIONS[0];
    const strippedCfg: Configuration = {
      ...baseCfg,
      provisions: {
        ...baseCfg.provisions,
        'target-mobile': undefined, // missing provision for required capability
      },
    };
    const assessment = assessHandoffContent(strippedCfg, ['target-mobile']);
    assert.equal(assessment.producible, false);
    assert.ok(assessment.missing.includes('capability:target-mobile'));
  });

  test('evaluation yields handoff-content-unavailable warrant gap when adopted configuration cannot produce required content', () => {
    const { evidence } = warrantedWith(MOBILE_SESSION(), 'cfg-mobile-session');
    // Replace library configuration with a deficient one
    const flawedCfg: Configuration = {
      ...CONFIGURATIONS[0],
      provisions: {}, // no provisions
    };
    const customLibrary = {
      ...DEFAULT_LIBRARY,
      configurations: [flawedCfg],
    };

    // Re-evaluate with deficient library configuration
    const state = evaluateInquiry(evidence, customLibrary);
    assert.equal(state.designPack.handoffContent.producible, false);
    assert.ok(state.designPack.warrantGaps.includes('handoff-content-unavailable'));
    assert.equal(state.designPack.warranted, false);
    assert.equal(state.designPack.generationAvailable, false);
  });
});

describe('Phase 3 — Design Pack Generator', () => {
  test('warranted inquiry generates complete Spec §9 markdown and engine provenance', () => {
    const { evidence } = warrantedWith(MOBILE_SESSION(), 'cfg-mobile-session');
    const result = generateDesignPack(evidence, { title: 'Focus Track', originalMaterial: 'Voice spark from park' }, '2026-10-07T14:00:00Z');

    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.equal(result.provenance.provenance, 'engine');
    assert.equal(result.provenance.generator, DESIGN_PACK_GENERATOR);
    assert.equal(result.provenance.configurationId, 'cfg-mobile-session');
    assert.ok(result.provenance.evidenceFingerprint.length > 0);
    assert.ok(result.provenance.reviewFingerprint.length > 0);

    // Verify all 7 Spec §9 sections are present in markdown
    assert.ok(result.markdown.includes('# Design Pack — Focus Track'));
    assert.ok(result.markdown.includes('## 1. Intent and scope'));
    assert.ok(result.markdown.includes('## 2. Requirements'));
    assert.ok(result.markdown.includes('## 3. Working configuration'));
    assert.ok(result.markdown.includes('## 4. Construction guidance'));
    assert.ok(result.markdown.includes('## 5. Verification criteria'));
    assert.ok(result.markdown.includes('## 6. Context and open material'));
    assert.ok(result.markdown.includes('## 7. Evidence and limits'));

    // Verbatim text preservation
    assert.ok(result.markdown.includes('Build a personal task manager'));
    assert.ok(result.markdown.includes('Solo developers'));
    assert.ok(result.markdown.includes('Voice spark from park'));
    assert.ok(result.markdown.includes('Keep keyboard shortcuts intact'));
    assert.ok(result.markdown.includes('Whether sync is needed later'));

    // Proved configuration and checks
    assert.ok(result.markdown.includes('Expo (React Native) · session state'));
    assert.ok(result.markdown.includes('Closing and reopening the app starts from a clean state.'));
  });

  test('generator refuses with reason and gaps when called on unwarranted inquiry', () => {
    const answers = [...EXPLORED()]; // explored only, not chosen or developed
    const evidence: InquiryEvidence = { answers, decisions: [] };

    const result = generateDesignPack(evidence, { title: 'Unwarranted Ember' }, '2026-10-07T14:00:00Z');
    assert.equal(result.ok, false);
    if (result.ok) return;

    assert.equal(result.reason, 'The Design Pack is not warranted for the current evidence.');
    assert.ok(result.gaps.includes('not-chosen'));
  });

  test('generator refuses when adopted configuration cannot produce required handoff content', () => {
    const { evidence } = warrantedWith(MOBILE_SESSION(), 'cfg-mobile-session');
    const flawedCfg: Configuration = {
      ...CONFIGURATIONS[0],
      setup: [], // missing setup
    };
    const customLibrary = {
      ...DEFAULT_LIBRARY,
      configurations: [flawedCfg],
    };

    const result = generateDesignPack(evidence, { title: 'Flawed Library' }, '2026-10-07T14:00:00Z', customLibrary);
    assert.equal(result.ok, false);
    if (result.ok) return;

    assert.equal(result.reason, 'The Design Pack is not warranted for the current evidence.');
    assert.ok(result.gaps.includes('handoff-content-unavailable'));
  });
});
