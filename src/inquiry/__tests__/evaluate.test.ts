// ─────────────────────────────────────────────
// Inquiry Engine — Executable Review Cases
//
// Spec §11 review cases (adapted to D1 / D2 / availability ≠ generation),
// plus library integrity and determinism. Run: npm test
// ─────────────────────────────────────────────

/// <reference types="node" />
// TypeScript 6 no longer auto-includes @types/*; this brings Node's types
// (node:test, node:assert) into the type-check program. Type-only: it does
// not affect the Metro bundle.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import type { CommittedAnswer, InquiryDecision, InquiryEvidence, InquiryState } from '../types.ts';
import {
  adoptConfiguration,
  chooseDesignPack,
  confirmReview,
  designPackStaleness,
  evaluateInquiry,
  nextQuestion,
} from '../evaluate.ts';
import { INQUIRY_QUESTIONS } from '../questions.ts';
import { CONDITION_CAPABILITIES, CONFIGURATIONS } from '../configurations.ts';

// ── Fixtures ─────────────────────────────────

let clock = 0;
const t = () => new Date(Date.UTC(2026, 9, 5, 0, 0, clock++)).toISOString();

function a(questionId: string, value: string, specification?: string): CommittedAnswer {
  return { questionId, value, specification, answeredAt: t() };
}

const EXPLORED = () => [a('q-purpose', 'Track my climbing sessions'), a('q-audience', 'Me')];

/** A complete, supportable Develop set: personal mobile app, session-only. */
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

/** Mobile, durable documents: two configurations qualify (files, SQLite). */
const MOBILE_DOCUMENTS = () => [
  a('q-reach', 'personal'),
  a('q-platform', 'mobile'),
  a('q-persistence', 'yes'),
  a('q-data-location', 'device'),
  a('q-data-shape', 'documents'),
  a('q-external-deps', 'none'),
  a('q-offline', 'yes'),
  a('q-accounts', 'none'),
  a('q-recovery', 'disposable'),
  a('q-constraints', 'none'),
];

function evalWith(answers: CommittedAnswer[], decisions: InquiryDecision[] = []): InquiryState {
  return evaluateInquiry({ answers, decisions });
}

/** Explore, choose, answer Develop; returns evidence + state (not yet adopted). */
function chosenWith(develop: CommittedAnswer[]): { evidence: InquiryEvidence; state: InquiryState } {
  const answers = [...EXPLORED()];
  const choice = chooseDesignPack(evalWith(answers), t());
  assert.ok(choice, 'Design Pack should be choosable after Explore');
  const evidence: InquiryEvidence = { answers: [...answers, ...develop], decisions: [choice] };
  return { evidence, state: evaluateInquiry(evidence) };
}

/** Full path to warrant for a given Develop set and configuration. */
function warrantedWith(develop: CommittedAnswer[], configurationId: string) {
  const { evidence, state } = chosenWith(develop);
  const adoption = adoptConfiguration(state, configurationId, t());
  assert.ok(adoption, `should be able to adopt ${configurationId}`);
  evidence.decisions.push(adoption);
  const adopted = evaluateInquiry(evidence);
  const review = confirmReview(adopted, t());
  assert.ok(review, 'review should be confirmable after valid adoption');
  evidence.decisions.push(review);
  return { evidence, state: evaluateInquiry(evidence) };
}

const blockerSubjects = (s: InquiryState) => s.designPack.blockers.map((b) => `${b.kind}:${b.subject}`);

// ── D1: Explore → availability ───────────────

describe('D1 — Explore establishes availability', () => {
  test('fresh Inquiry: not available; Explore offers purpose first', () => {
    const s = evalWith([]);
    assert.equal(s.designPack.available, false);
    assert.deepEqual(s.designPack.missingForAvailability, ['q-purpose', 'q-audience']);
    assert.equal(nextQuestion(s, 'explore')?.id, 'q-purpose');
  });

  test('purpose alone is not enough', () => {
    const s = evalWith([a('q-purpose', 'Something')]);
    assert.equal(s.designPack.available, false);
    assert.deepEqual(s.designPack.missingForAvailability, ['q-audience']);
  });

  test('purpose + audience → Design Pack available', () => {
    assert.equal(evalWith(EXPLORED()).designPack.available, true);
  });

  test('important-to-preserve and uncertainty do not gate availability', () => {
    const s = evalWith([a('q-important-to-preserve', 'Calm'), a('q-uncertainty', 'Everything')]);
    assert.equal(s.designPack.available, false);
    assert.equal(evalWith(EXPLORED()).explore.openOptional.length, 2);
  });

  test('empty text does not establish purpose', () => {
    assert.equal(evalWith([a('q-purpose', '   '), a('q-audience', 'Me')]).designPack.available, false);
  });

  test('availability does not complete Explore: optional material still offered', () => {
    const s = evalWith(EXPLORED());
    assert.equal(s.designPack.available, true);
    assert.equal(nextQuestion(s, 'explore')?.id, 'q-important-to-preserve');
  });

  test('Develop questions are not outstanding before the Design Pack is chosen', () => {
    const s = evalWith(EXPLORED());
    assert.equal(s.designPack.chosen, false);
    assert.deepEqual(s.designPack.outstanding, []);
    assert.equal(nextQuestion(s, 'develop'), undefined);
  });

  test('choosing is only possible once available', () => {
    assert.equal(chooseDesignPack(evalWith([a('q-purpose', 'x')]), t()), null);
    assert.ok(chooseDesignPack(evalWith(EXPLORED()), t()));
  });

  test('a choice recorded while unavailable has no authority', () => {
    const forged: InquiryDecision = { kind: 'consequence-chosen', value: 'design-pack', decidedAt: t() };
    assert.equal(evalWith([a('q-purpose', 'x')], [forged]).designPack.chosen, false);
  });

  test('choosing the Design Pack begins Develop at initial reach', () => {
    const { state } = chosenWith([]);
    assert.equal(state.designPack.chosen, true);
    assert.equal(state.designPack.developing, true);
    assert.equal(nextQuestion(state, 'develop')?.id, 'q-reach');
  });
});

// ── Availability ≠ generation ────────────────

describe('Edit — availability is not generation availability', () => {
  test('available but not chosen → generation unavailable', () => {
    const s = evalWith(EXPLORED());
    assert.equal(s.designPack.available, true);
    assert.equal(s.designPack.generationAvailable, false);
    assert.deepEqual(s.designPack.warrantGaps, ['not-chosen']);
  });

  test('chosen with complete supportable requirements but not adopted → unavailable', () => {
    const { state } = chosenWith(MOBILE_SESSION());
    assert.deepEqual(state.designPack.outstanding, []);
    assert.deepEqual(state.designPack.blockers, []);
    assert.equal(state.designPack.generationAvailable, false);
    assert.deepEqual(state.designPack.warrantGaps, ['no-adopted-configuration', 'review-not-current']);
  });

  test('adopted but review not confirmed → unavailable', () => {
    const { evidence, state } = chosenWith(MOBILE_SESSION());
    evidence.decisions.push(adoptConfiguration(state, 'cfg-mobile-session', t())!);
    const s = evaluateInquiry(evidence);
    assert.equal(s.designPack.adoptionValid, true);
    assert.deepEqual(s.designPack.warrantGaps, ['review-not-current']);
    assert.equal(s.designPack.generationAvailable, false);
  });

  test('warranted → generation available, Develop no longer in progress', () => {
    const { state } = warrantedWith(MOBILE_SESSION(), 'cfg-mobile-session');
    assert.equal(state.designPack.warranted, true);
    assert.equal(state.designPack.generationAvailable, true);
    assert.equal(state.designPack.developing, false);
  });
});

// ── Spec §11 review cases ────────────────────

describe('Spec §11 review cases', () => {
  test('outcome and audience declared; platform unresolved → available, not warranted', () => {
    const { state } = chosenWith([a('q-reach', 'personal'), a('q-platform', 'uncertain')]);
    assert.equal(state.designPack.available, true);
    assert.ok(blockerSubjects(state).includes('unresolved-decision:q-platform'));
    assert.equal(state.designPack.warranted, false);
  });

  test('platform known; persistence unresolved → storage decision blocks warrant', () => {
    const develop = MOBILE_SESSION().map((x) => (x.questionId === 'q-persistence' ? a('q-persistence', 'uncertain') : x));
    const { state } = chosenWith(develop);
    assert.deepEqual(blockerSubjects(state), ['unresolved-decision:q-persistence']);
    assert.equal(state.designPack.canAdopt, false);
    assert.ok(state.designPack.warrantGaps.includes('unresolved-decisions'));
  });

  test('accounts excluded from this version; future interest preserved; no auth blocker', () => {
    const develop = MOBILE_SESSION().map((x) => (x.questionId === 'q-accounts' ? a('q-accounts', 'deferred') : x));
    const { state } = chosenWith(develop);
    assert.ok(state.conditions.includes('accounts-future'));
    assert.ok(!state.designPack.requiredCapabilities.includes('auth'));
    assert.deepEqual(state.designPack.blockers, []);
    assert.equal(state.questions.find((q) => q.id === 'q-accounts')?.disposition, 'excluded');
    assert.equal(state.questions.find((q) => q.id === 'q-access')?.applicable, false);
  });

  test('"no persistence" → no durable configuration; data shape and recovery not applicable', () => {
    const { state } = chosenWith(MOBILE_SESSION());
    const dp = state.designPack;
    assert.deepEqual(dp.candidates, ['cfg-mobile-session']);
    assert.equal(state.questions.find((q) => q.id === 'q-data-shape')?.disposition, 'not-applicable');
    assert.equal(state.questions.find((q) => q.id === 'q-recovery')?.disposition, 'not-applicable');
  });

  test('public reach, independent local data, no accounts → nothing invented', () => {
    const develop = MOBILE_SESSION().map((x) => (x.questionId === 'q-reach' ? a('q-reach', 'public') : x));
    const { state } = chosenWith(develop);
    const caps = state.designPack.requiredCapabilities;
    for (const invented of ['data-shared', 'data-cross-device', 'auth', 'external-service'] as const) {
      assert.ok(!caps.includes(invented), `should not require ${invented}`);
    }
    assert.deepEqual(state.designPack.blockers, []);
    assert.ok(warrantedWith(develop, 'cfg-mobile-session').state.designPack.warranted);
  });

  test('offline outcome required but an essential outside service exists → explicit blocker', () => {
    const develop = MOBILE_SESSION().map((x) =>
      x.questionId === 'q-external-deps' ? a('q-external-deps', 'named', 'Weather API') : x,
    );
    const { state } = chosenWith(develop);
    const boundary = state.designPack.blockers.find((b) => b.subject === 'external-service');
    assert.ok(boundary, 'external service must be a blocker');
    assert.equal(boundary.kind, 'knowledge-boundary');
    assert.equal(boundary.preservedText, 'Weather API');
    assert.deepEqual(state.designPack.candidates, []);
    assert.equal(state.designPack.warranted, false);
  });

  test('two platforms required (session) → covered without a manufactured conflict', () => {
    const develop = MOBILE_SESSION().map((x) =>
      x.questionId === 'q-platform' ? a('q-platform', 'both') : x.questionId === 'q-offline' ? a('q-offline', 'no') : x,
    );
    const { state } = chosenWith(develop);
    assert.deepEqual(state.designPack.blockers, []);
    assert.deepEqual(state.designPack.candidates, ['cfg-universal-session']);
  });

  test('two platforms + durable data → unsupported combination is an explicit blocker', () => {
    const develop = MOBILE_DOCUMENTS().map((x) =>
      x.questionId === 'q-platform' ? a('q-platform', 'both') : x.questionId === 'q-offline' ? a('q-offline', 'no') : x,
    );
    const { state } = chosenWith(develop);
    assert.deepEqual(blockerSubjects(state), ['uncovered-combination:configuration']);
    assert.deepEqual(state.designPack.candidates, []);
  });

  test('binding constraint recorded only as prose → preserved, never claimed satisfied', () => {
    const develop = MOBILE_SESSION().map((x) =>
      x.questionId === 'q-constraints' ? a('q-constraints', 'present', 'Must integrate with our Rails backend') : x,
    );
    const { state } = chosenWith(develop);
    const b = state.designPack.blockers.find((x) => x.subject === 'binding-constraint');
    assert.ok(b);
    assert.equal(b.preservedText, 'Must integrate with our Rails backend');
    assert.equal(state.designPack.warranted, false);
  });

  test('all questions answered but one consequential answer unresolved → not warranted', () => {
    const develop = MOBILE_SESSION().map((x) => (x.questionId === 'q-reach' ? a('q-reach', 'unresolved') : x));
    const { state } = chosenWith(develop);
    assert.deepEqual(state.designPack.outstanding, []);
    assert.equal(state.designPack.warranted, false);
    assert.ok(state.designPack.warrantGaps.includes('unresolved-decisions'));
  });

  test('user leaves midway → paused, not complete (state is purely a function of evidence)', () => {
    const { state } = chosenWith(MOBILE_SESSION().slice(0, 3));
    assert.equal(state.designPack.developing, true);
    assert.equal(state.designPack.warranted, false);
    assert.equal(nextQuestion(state, 'develop')?.id, 'q-data-location');
    // Resumption does not re-ask answered questions.
    assert.ok(!state.designPack.outstanding.includes('q-platform'));
  });

  test('warranted evidence changes after generation → earlier pack stale; adoption + review recalculated', () => {
    const { evidence, state } = warrantedWith(MOBILE_SESSION(), 'cfg-mobile-session');
    const packFingerprint = state.fingerprints.review; // recorded at generation (Phase 2)
    assert.equal(designPackStaleness(packFingerprint, state), 'current');

    evidence.answers.push(a('q-reach', 'group')); // a Develop answer changes
    const changed = evaluateInquiry(evidence);
    assert.equal(changed.designPack.adoptionValid, false);
    assert.equal(changed.designPack.reviewCurrent, false);
    assert.equal(changed.designPack.warranted, false);
    assert.ok(changed.designPack.warrantGaps.includes('adoption-invalid'));
    assert.equal(designPackStaleness(packFingerprint, changed), 'stale');
  });

  test('contextual Explore change after warrant requires re-review, not re-adoption', () => {
    const { evidence } = warrantedWith(MOBILE_SESSION(), 'cfg-mobile-session');
    evidence.answers.push(a('q-uncertainty', 'Whether I will actually use it'));
    const s = evaluateInquiry(evidence);
    assert.equal(s.designPack.adoptionValid, true);
    assert.equal(s.designPack.reviewCurrent, false);
    assert.deepEqual(s.designPack.warrantGaps, ['review-not-current']);
  });

  test('contextual questions remain open, all consequential requirements covered → warrant permitted', () => {
    const { state } = warrantedWith(MOBILE_SESSION(), 'cfg-mobile-session');
    assert.deepEqual(state.explore.openOptional, ['q-important-to-preserve', 'q-uncertainty']);
    assert.equal(state.designPack.warranted, true);
  });

  test('pack without recorded provenance → unknown staleness', () => {
    assert.equal(designPackStaleness(null, evalWith([])), 'unknown');
  });
});

// ── D2: perimeter and blockers ───────────────

describe('D2 — authored perimeter; outside it, explicit blockers', () => {
  const swap = (qid: string, value: string, spec?: string) =>
    MOBILE_DOCUMENTS().map((x) => (x.questionId === qid ? a(qid, value, spec) : x));

  for (const [qid, value, cap] of [
    ['q-data-location', 'shared', 'data-shared'],
    ['q-data-location', 'cross-device', 'data-cross-device'],
    ['q-accounts', 'required', 'auth'],
  ] as const) {
    test(`${qid}=${value} → knowledge-boundary blocker (${cap}), no guessed default`, () => {
      const { state } = chosenWith(swap(qid, value));
      assert.ok(blockerSubjects(state).includes(`knowledge-boundary:${cap}`));
      assert.deepEqual(state.designPack.candidates, []);
      assert.equal(state.designPack.canAdopt, false);
    });
  }

  test('multiple qualifying configurations → no automatic preference; adoption selects', () => {
    const { evidence, state } = chosenWith(MOBILE_DOCUMENTS());
    assert.deepEqual(state.designPack.candidates, ['cfg-mobile-files', 'cfg-mobile-sqlite']);
    assert.equal(state.designPack.adoptedConfigurationId, undefined);
    assert.equal(state.designPack.canAdopt, true);
    evidence.decisions.push(adoptConfiguration(state, 'cfg-mobile-sqlite', t())!);
    assert.equal(evaluateInquiry(evidence).designPack.adoptedConfigurationId, 'cfg-mobile-sqlite');
  });

  test('queryable records narrow coverage to SQLite', () => {
    const { state } = chosenWith(swap('q-data-shape', 'records'));
    assert.deepEqual(state.designPack.candidates, ['cfg-mobile-sqlite']);
  });

  test('a non-candidate configuration cannot be adopted', () => {
    const { state } = chosenWith(MOBILE_SESSION());
    assert.equal(adoptConfiguration(state, 'cfg-mobile-sqlite', t()), null);
  });

  test('a forged adoption with a stale fingerprint has no authority', () => {
    const { evidence } = chosenWith(MOBILE_SESSION());
    evidence.decisions.push({
      kind: 'configuration-adopted', value: 'cfg-mobile-session', evidenceFingerprint: 'stale', decidedAt: t(),
    });
    const s = evaluateInquiry(evidence);
    assert.equal(s.designPack.adoptionValid, false);
    assert.ok(s.designPack.warrantGaps.includes('adoption-invalid'));
  });

  test('web + offline outcome → not authored for web → explicit blocker', () => {
    const develop = MOBILE_SESSION().map((x) => (x.questionId === 'q-platform' ? a('q-platform', 'web') : x));
    const { state } = chosenWith(develop);
    assert.deepEqual(blockerSubjects(state), ['uncovered-combination:configuration']);
  });

  test('web, durable, recoverable, online-only → IndexedDB covers it', () => {
    const develop = MOBILE_DOCUMENTS().map((x) =>
      x.questionId === 'q-platform' ? a('q-platform', 'web')
      : x.questionId === 'q-offline' ? a('q-offline', 'no')
      : x.questionId === 'q-recovery' ? a('q-recovery', 'recoverable')
      : x,
    );
    assert.ok(warrantedWith(develop, 'cfg-web-indexeddb').state.designPack.warranted);
  });
});

// ── Conditional applicability ────────────────

describe('Conditional questions appear only when applicable', () => {
  test('durable data → data shape and recovery become outstanding', () => {
    const { state } = chosenWith([a('q-reach', 'personal'), a('q-platform', 'mobile'), a('q-persistence', 'yes')]);
    assert.ok(state.designPack.outstanding.includes('q-data-shape'));
    assert.ok(state.designPack.outstanding.includes('q-recovery'));
  });

  test('access appears only when accounts are required', () => {
    const without = chosenWith(MOBILE_SESSION()).state;
    assert.equal(without.questions.find((q) => q.id === 'q-access')?.applicable, false);
    const withAuth = chosenWith([a('q-accounts', 'required')]).state;
    assert.ok(withAuth.designPack.outstanding.includes('q-access'));
  });

  test('a changed answer makes a dependent answer inactive prior material', () => {
    const { evidence } = chosenWith(MOBILE_DOCUMENTS());
    evidence.answers.push(a('q-persistence', 'no'));
    const s = evaluateInquiry(evidence);
    assert.equal(s.questions.find((q) => q.id === 'q-data-shape')?.disposition, 'not-applicable');
    assert.ok(!s.conditions.includes('document-oriented-data'));
    const prior = s.priorMaterial.filter((p) => p.reason === 'not-applicable').map((p) => p.answer.questionId);
    assert.deepEqual(prior.sort(), ['q-data-shape', 'q-recovery']);
  });

  test('a choice requiring specification without it is incomplete and outstanding', () => {
    const { state } = chosenWith([a('q-offline', 'subset')]);
    assert.equal(state.questions.find((q) => q.id === 'q-offline')?.disposition, 'incomplete');
    assert.ok(state.designPack.outstanding.includes('q-offline'));
    assert.ok(!state.conditions.includes('offline-actions-required'));
  });
});

// ── Legacy evidence ──────────────────────────

describe('Legacy evidence never silently regains authority', () => {
  test('retired question and retired value become prior material', () => {
    const s = evalWith([...EXPLORED(), a('q-scale', 'public'), a('q-offline', 'partial')]);
    const reasons = Object.fromEntries(s.priorMaterial.map((p) => [p.answer.questionId, p.reason]));
    assert.equal(reasons['q-scale'], 'unknown-question');
    assert.equal(reasons['q-offline'], 'unrecognized-value');
    assert.equal(s.questions.find((q) => q.id === 'q-offline')?.disposition, 'unanswered');
  });

  test('legacy answers do not choose the Design Pack or warrant anything', () => {
    const s = evalWith([...EXPLORED(), a('q-platform', 'mobile'), a('q-persistence', 'yes')]);
    assert.equal(s.designPack.chosen, false);
    assert.equal(s.designPack.generationAvailable, false);
  });
});

// ── Determinism & integrity ──────────────────

describe('Determinism and library integrity', () => {
  test('same evidence in any order → identical fingerprints and state', () => {
    const answers = [...EXPLORED(), ...MOBILE_SESSION()];
    const s1 = evalWith(answers);
    const s2 = evalWith([...answers].reverse());
    assert.deepEqual(s1.fingerprints, s2.fingerprints);
    assert.deepEqual(s1.conditions, s2.conditions);
  });

  test('neither availability nor warrant depends on answer count', () => {
    // Many optional answers, no purpose: still unavailable.
    const s = evalWith([a('q-important-to-preserve', 'a'), a('q-uncertainty', 'b'), ...MOBILE_SESSION()]);
    assert.equal(s.designPack.available, false);
  });

  test('question ids are unique', () => {
    const ids = INQUIRY_QUESTIONS.map((q) => q.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  test('applicability references only earlier questions\' conditions', () => {
    const seen = new Set<string>();
    const refs = (p: unknown): string[] => {
      const o = p as Record<string, unknown>;
      if ('condition' in o) return [o.condition as string];
      if ('all' in o) return (o.all as unknown[]).flatMap(refs);
      if ('any' in o) return (o.any as unknown[]).flatMap(refs);
      if ('not' in o) return refs(o.not);
      return [];
    };
    for (const q of INQUIRY_QUESTIONS) {
      if (q.applicableWhen) {
        for (const c of refs(q.applicableWhen)) assert.ok(seen.has(c), `${q.id} references later/unknown condition ${c}`);
      }
      for (const ch of q.choices ?? []) ch.establishes.forEach((c) => seen.add(c));
      (q.establishesOnText ?? []).forEach((c) => seen.add(c));
    }
  });

  test('every capability-bearing condition is established by some choice', () => {
    const established = new Set(INQUIRY_QUESTIONS.flatMap((q) => (q.choices ?? []).flatMap((c) => c.establishes)));
    for (const c of Object.keys(CONDITION_CAPABILITIES)) assert.ok(established.has(c), `orphan condition ${c}`);
  });

  test('D1 split: Explore and Develop own exactly the authored questions', () => {
    const by = (m: string) => INQUIRY_QUESTIONS.filter((q) => q.movement === m).map((q) => q.id);
    assert.deepEqual(by('explore'), ['q-purpose', 'q-audience', 'q-important-to-preserve', 'q-uncertainty']);
    assert.deepEqual(by('develop'), [
      'q-reach', 'q-platform', 'q-persistence', 'q-data-location', 'q-data-shape', 'q-external-deps',
      'q-offline', 'q-accounts', 'q-access', 'q-recovery', 'q-constraints',
    ]);
    const conditional = INQUIRY_QUESTIONS.filter((q) => q.applicableWhen).map((q) => q.id);
    assert.deepEqual(conditional, ['q-data-shape', 'q-access', 'q-recovery']);
  });

  test('every choice-bearing Develop question offers an unresolved option', () => {
    for (const q of INQUIRY_QUESTIONS.filter((x) => x.movement === 'develop')) {
      assert.ok(q.choices?.some((c) => c.disposition === 'unresolved'), `${q.id} lacks an unresolved option`);
    }
  });

  test('every configuration has guidance and checks', () => {
    for (const cfg of CONFIGURATIONS) {
      assert.ok(cfg.guidance.length > 0 && cfg.checks.length > 0, cfg.id);
    }
  });
});
