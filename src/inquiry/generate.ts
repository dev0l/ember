// ─────────────────────────────────────────────
// Inquiry Engine — Design Pack generator (Phase 3)
//
// generateDesignPack(evidence, subject, generatedAt) → markdown + provenance
//
// The minimum complete Design Pack (spec §9), produced ONLY from:
//   - InquiryState, which this function evaluates itself from the evidence
//     (so a stale or hand-built state can never be rendered);
//   - the authored content of the ADOPTED configuration;
//   - the authored question library (question and choice labels);
//   - `subject`: the Ember's title and original material, shown as identity
//     and context — never used as evidence.
//
// Refuses (no partial pack) unless the Inquiry is warranted. Unsupported
// paths therefore surface as their blockers, never as a guessed pack.
//
// What the pack may claim:
//   - recorded evidence: quoted verbatim, or as the chosen answer's label;
//   - authored Ember content for the adopted configuration, labelled as such;
//   - user acts (choice, adoption, review) as acts — not as verification.
// It never claims: semantic verification of free text, product features,
// acceptance scenarios, or names that need external registration.
// ─────────────────────────────────────────────

import type {
  Blocker,
  Capability,
  CommittedAnswer,
  Configuration,
  InquiryEvidence,
  InquiryQuestion,
  InquiryState,
  QuestionState,
  WarrantGap,
} from './types.ts';
import { CAPABILITY_LABELS } from './configurations.ts';
import { DEFAULT_LIBRARY, evaluateInquiry } from './evaluate.ts';
import type { InquiryLibrary } from './evaluate.ts';

/** Recorded as `design_packs.generator` for engine provenance. */
export const DESIGN_PACK_GENERATOR = 'inquiry-design-pack@1';

/** Identity and context for the pack. Not evidence. */
export interface DesignPackSubject {
  /** The Ember's title as the user named it. */
  title: string;
  /** The Ember's original material (spark text), shown verbatim as context. */
  originalMaterial?: string;
}

/** Structurally matches the services' engine DesignPackOrigin. */
export interface EngineDesignPackProvenance {
  provenance: 'engine';
  generator: string;
  libraryVersion: string;
  configurationId: string;
  evidenceFingerprint: string;
  reviewFingerprint: string;
}

export type DesignPackGeneration =
  | { ok: true; markdown: string; provenance: EngineDesignPackProvenance; state: InquiryState }
  | { ok: false; reason: string; gaps: WarrantGap[]; blockers: Blocker[]; state: InquiryState };

// ── Rendering helpers ────────────────────────

const quote = (text: string): string =>
  text
    .trim()
    .split(/\r?\n/)
    .map((line) => `> ${line}`)
    .join('\n');

const cell = (text: string): string => text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

const bullets = (lines: string[]): string => lines.map((l) => `- ${l}`).join('\n');

function choiceLabel(q: InquiryQuestion, answer: CommittedAnswer): string {
  return q.choices?.find((c) => c.value === answer.value)?.label ?? answer.value;
}

function textAnswer(state: InquiryState, questionId: string): string | undefined {
  const qs = state.questions.find((q) => q.id === questionId);
  return qs?.disposition === 'context' ? qs.answer?.value.trim() || undefined : undefined;
}

// ── Generator ────────────────────────────────

export function generateDesignPack(
  evidence: InquiryEvidence,
  subject: DesignPackSubject,
  generatedAt: string,
  library: InquiryLibrary = DEFAULT_LIBRARY,
): DesignPackGeneration {
  const state = evaluateInquiry(evidence, library);
  const dp = state.designPack;

  const refuse = (reason: string): DesignPackGeneration => ({
    ok: false,
    reason,
    gaps: dp.warrantGaps,
    blockers: dp.blockers,
    state,
  });

  if (!dp.generationAvailable) return refuse('The Design Pack is not warranted for the current evidence.');

  const cfg = library.configurations.find((c) => c.id === dp.adoptedConfigurationId);
  // Unreachable when warranted (adoption is validated against candidates and
  // content is assessed); kept so the generator never renders without them.
  if (!cfg) return refuse('The adopted configuration is not authored in this library.');
  if (!dp.handoffContent.producible) return refuse('The adopted configuration cannot produce the required handoff content.');

  const markdown = render(state, cfg, subject, generatedAt, library);
  return {
    ok: true,
    markdown,
    state,
    provenance: {
      provenance: 'engine',
      generator: DESIGN_PACK_GENERATOR,
      libraryVersion: state.libraryVersion,
      configurationId: cfg.id,
      evidenceFingerprint: state.fingerprints.evidence,
      reviewFingerprint: state.fingerprints.review,
    },
  };
}

function render(
  state: InquiryState,
  cfg: Configuration,
  subject: DesignPackSubject,
  generatedAt: string,
  library: InquiryLibrary,
): string {
  const byId = new Map(library.questions.map((q) => [q.id, q]));
  const dp = state.designPack;
  const required: Capability[] = dp.requiredCapabilities;
  const develop = state.questions.filter((q) => q.movement === 'develop');
  const active = develop.filter(
    (q): q is QuestionState & { answer: CommittedAnswer } =>
      q.applicable && !!q.answer && (q.disposition === 'decided' || q.disposition === 'excluded'),
  );
  const notApplicable = develop.filter((q) => q.disposition === 'not-applicable');
  const excluded = active.filter((q) => q.disposition === 'excluded');
  const reach = active.find((q) => q.id === 'q-reach');

  const purpose = textAnswer(state, 'q-purpose') ?? '';
  const audience = textAnswer(state, 'q-audience') ?? '';
  const preserve = textAnswer(state, 'q-important-to-preserve');
  const uncertainty = textAnswer(state, 'q-uncertainty');
  const title = subject.title.trim() || 'Untitled Ember';

  const provided = (pick: (p: { guidance: string[]; checks: string[] }) => string[]) =>
    required.flatMap((cap) => pick(cfg.provisions[cap]!));

  const out: string[] = [];

  out.push(`# Design Pack — ${title}`);
  out.push('');
  out.push(
    '> A construction handoff for a declared first version, generated by Ember from recorded Inquiry evidence and the authored content of one adopted configuration. It is not an exhaustive product specification. See **7. Evidence and limits**.',
  );
  out.push('');

  // 1. Intent and scope
  out.push('## 1. Intent and scope');
  out.push('');
  out.push(`**Ember:** ${title}`);
  out.push('');
  out.push(`**${byId.get('q-purpose')!.text}** — recorded purpose, verbatim:`);
  out.push('');
  out.push(quote(purpose));
  out.push('');
  out.push(`**${byId.get('q-audience')!.text}** — recorded audience, verbatim:`);
  out.push('');
  out.push(quote(audience));
  out.push('');
  if (reach) out.push(`**Initial reach:** ${choiceLabel(byId.get(reach.id)!, reach.answer)}`);
  out.push('');
  out.push('**Explicitly excluded from this version:**');
  out.push('');
  out.push(
    excluded.length
      ? bullets(excluded.map((q) => `${byId.get(q.id)!.text} — ${choiceLabel(byId.get(q.id)!, q.answer)}`))
      : '- Nothing was explicitly excluded.',
  );
  out.push('');

  // 2. Requirements
  out.push('## 2. Requirements');
  out.push('');
  out.push('Recorded Develop decisions, as answered:');
  out.push('');
  out.push('| Decision | Recorded answer |');
  out.push('|---|---|');
  for (const q of active) {
    const authored = byId.get(q.id)!;
    const spec = q.answer.specification?.trim();
    const answer = choiceLabel(authored, q.answer) + (spec ? ` — specified: “${spec}”` : '');
    out.push(`| ${cell(authored.text)} | ${cell(answer)} |`);
  }
  out.push('');
  if (notApplicable.length) {
    out.push('**Not applicable to this evidence:**');
    out.push('');
    out.push(bullets(notApplicable.map((q) => byId.get(q.id)!.text)));
    out.push('');
  }
  out.push(`**Required capabilities:** ${required.map((c) => CAPABILITY_LABELS[c]).join('; ')}.`);
  out.push('');

  // 3. Working configuration
  out.push('## 3. Working configuration');
  out.push('');
  out.push(`**${cfg.name}** (\`${cfg.id}\`)`);
  out.push('');
  out.push(cfg.summary);
  out.push('');
  out.push('Adopted by the user. It covers every required capability listed above.');
  const others = dp.candidates.filter((id) => id !== cfg.id);
  out.push('');
  out.push(
    others.length
      ? `**Also qualified, not adopted:** ${others
          .map((id) => library.configurations.find((c) => c.id === id)?.name ?? id)
          .join('; ')}.`
      : '**Also qualified, not adopted:** none.',
  );
  out.push('');
  out.push('**Authored defaults** — supplied by Ember for this configuration, not established by the user:');
  out.push('');
  out.push(cfg.defaults.length ? bullets(cfg.defaults) : '- No defaults are authored for this configuration.');
  out.push('');
  out.push('**Tradeoffs:**');
  out.push('');
  out.push(cfg.tradeoffs.length ? bullets(cfg.tradeoffs) : '- No tradeoffs are authored for this configuration.');
  out.push('');

  // 4. Construction guidance
  out.push('## 4. Construction guidance');
  out.push('');
  out.push('### Setup');
  out.push('');
  out.push(bullets(cfg.setup));
  out.push('');
  out.push('### Starter organization');
  out.push('');
  out.push('```text');
  out.push(...cfg.starterLayout);
  out.push('```');
  out.push('');
  out.push('No feature or domain names appear here; add them from the recorded purpose as you build.');
  out.push('');
  out.push('### Conventions');
  out.push('');
  out.push(bullets(cfg.conventions));
  out.push('');
  out.push('### Guidance');
  out.push('');
  out.push(bullets([...cfg.guidance, ...provided((p) => p.guidance)]));
  out.push('');
  out.push('### Implementation sequence');
  out.push('');
  out.push(cfg.sequence.map((s, i) => `${i + 1}. ${s}`).join('\n'));
  out.push('');

  // 5. Verification criteria
  out.push('## 5. Verification criteria');
  out.push('');
  out.push('Technical checks derived from the recorded requirements and the adopted configuration:');
  out.push('');
  out.push(bullets([...cfg.checks, ...provided((p) => p.checks)]));
  out.push('');
  out.push(
    'Product-level acceptance is anchored in the recorded purpose and audience (section 1). Ember has not derived product-specific acceptance scenarios from them.',
  );
  out.push('');

  // 6. Context and open material
  out.push('## 6. Context and open material');
  out.push('');
  out.push(`**${byId.get('q-important-to-preserve')!.text}**`);
  out.push('');
  out.push(preserve ? quote(preserve) : '_Not recorded._');
  out.push('');
  out.push(`**${byId.get('q-uncertainty')!.text}**`);
  out.push('');
  out.push(uncertainty ? quote(uncertainty) : '_Not recorded._');
  out.push('');
  const original = subject.originalMaterial?.trim();
  if (original) {
    out.push('**Original material** (from the Ember, verbatim):');
    out.push('');
    out.push(quote(original));
    out.push('');
  }
  if (state.conditions.includes('accounts-future')) {
    out.push('**Recorded as possible later:** accounts (excluded from this version).');
    out.push('');
  }
  if (state.priorMaterial.length) {
    out.push(
      `**Prior material:** ${state.priorMaterial.length} earlier answer(s) are retained with this Inquiry and were not used as evidence for this pack.`,
    );
    out.push('');
  }

  // 7. Evidence and limits
  out.push('## 7. Evidence and limits');
  out.push('');
  out.push(
    bullets([
      `Generated by \`${DESIGN_PACK_GENERATOR}\` from Inquiry library \`${state.libraryVersion}\` at ${generatedAt}.`,
      `Working configuration: \`${cfg.id}\`.`,
      `Evidence fingerprint: \`${state.fingerprints.evidence}\` · review fingerprint: \`${state.fingerprints.review}\`.`,
      'The user chose this Design Pack, adopted the working configuration against the recorded requirements, and confirmed review against the recorded evidence.',
      'Review boundary: the user confirmed that the recorded purpose, audience, decisions and open material contain no known unrepresented consequential issue. Ember did not verify free text semantically.',
      'No AI interpretation: every statement is either recorded evidence (quoted, or shown as the chosen answer) or authored Ember content for the adopted configuration.',
      ...cfg.limits,
      'If the evidence changes after generation, this pack still describes the evidence it was generated from; it is not updated.',
    ]),
  );
  out.push('');

  return out.join('\n');
}
