// ─────────────────────────────────────────────
// Ember Lifecycle & Completion Assembly
//
// Pure functions for assembling verbatim starting material,
// stage-aware deletion descriptions, and honest Markdown
// completion records strictly from persisted state.
//
// Zero native dependencies so these invariants are directly
// verifiable under `node --test`.
// ─────────────────────────────────────────────

import type { EmberSeed } from './ember-types.ts';
import { EMBER_NATURE_LABELS } from './ember-types.ts';
import type { Spark } from './spark-types.ts';
import type { InquiryState } from '../inquiry/types.ts';
import { INQUIRY_QUESTIONS } from '../inquiry/questions.ts';
import { CONFIGURATIONS } from '../inquiry/configurations.ts';

/**
 * Composes the verbatim originalMaterial passed to Design Pack generation.
 * Preserves legacy `seed.spark` text AND includes all participating Sparks,
 * while avoiding duplicate blocks when an older Ember copied its initial
 * participating Spark text into `seed.spark`.
 */
export function buildEmberOriginalMaterial(
  seed: EmberSeed,
  participatingSparks: Spark[],
): string | undefined {
  const seedSpark = seed.spark?.trim() ?? '';
  const sparkContents = participatingSparks
    .map((s) => s.content.trim())
    .filter((text) => text.length > 0);

  const blocks: string[] = [];
  if (seedSpark.length > 0) {
    blocks.push(seedSpark);
  }

  for (const text of sparkContents) {
    if (!seedSpark.includes(text) && !blocks.includes(text)) {
      blocks.push(text);
    }
  }

  return blocks.length > 0 ? blocks.join('\n\n') : undefined;
}

export interface EmberDeletionSummaryInput {
  seed: EmberSeed;
  participatingSparks: Spark[];
  inquiryState?: InquiryState | null;
  hasDesignPack?: boolean;
}

export interface EmberDeletionSummary {
  title: string;
  hasInquiryProgress: boolean;
  hasDesignPack: boolean;
  message: string;
}

/**
 * Produces an honest, stage-aware confirmation message for deleting an Ember.
 * Deleting an Ember removes its seed, Inquiry progress, and any generated Design Pack,
 * while always releasing participating Sparks back to Lingering Sparks.
 */
export function describeEmberDeletionSummary(
  input: EmberDeletionSummaryInput,
): EmberDeletionSummary {
  const { seed, participatingSparks, inquiryState, hasDesignPack = false } = input;
  const emberTitle =
    seed.name?.trim() ||
    `Untitled ${EMBER_NATURE_LABELS[seed.nature] ?? 'Ember'}`;

  const answeredCount = inquiryState
    ? inquiryState.questions.filter((q) => q.answer !== undefined).length
    : 0;
  const hasDecisions = Boolean(
    inquiryState &&
      (inquiryState.designPack.chosen ||
        Boolean(inquiryState.designPack.adoptedConfigurationId) ||
        inquiryState.designPack.reviewCurrent),
  );
  const hasInquiryProgress = answeredCount > 0 || hasDecisions || hasDesignPack;

  const sparkClause =
    participatingSparks.length === 0
      ? 'No participating Sparks are attached.'
      : participatingSparks.length === 1
      ? 'Its 1 participating Spark will not be deleted — it will return to Lingering Sparks.'
      : `Its ${participatingSparks.length} participating Sparks will not be deleted — they will return to Lingering Sparks.`;

  if (hasDesignPack) {
    return {
      title: 'Delete Ember & Design Pack?',
      hasInquiryProgress: true,
      hasDesignPack: true,
      message: `Permanently delete "${emberTitle}", its recorded Inquiry evidence, and its generated Design Pack?\n\n${sparkClause}`,
    };
  }

  if (hasInquiryProgress) {
    return {
      title: 'Delete Developed Ember?',
      hasInquiryProgress: true,
      hasDesignPack: false,
      message: `Permanently delete "${emberTitle}" and its recorded Inquiry progress (${answeredCount} recorded answer${answeredCount === 1 ? '' : 's'})?\n\n${sparkClause}`,
    };
  }

  return {
    title: 'Delete Ember?',
    hasInquiryProgress: false,
    hasDesignPack: false,
    message: `Permanently delete "${emberTitle}" from your Embers collection?\n\n${sparkClause}`,
  };
}

export interface EmberCompletionInput {
  seed: EmberSeed;
  participatingSparks: Spark[];
  inquiryState?: InquiryState | null;
  designPack?: {
    version: number;
    markdown: string;
    configurationId?: string;
    recordedAt?: string;
    staleness?: 'current' | 'stale' | 'unknown';
  } | null;
}

/**
 * Assembles an honest Markdown completion record strictly from persisted Ember,
 * Spark, Inquiry, and Design Pack material.
 *
 * Never fabricates unrecorded history or stages. Sections are included if and
 * only if corresponding persisted material exists.
 */
export function buildEmberCompletionRecord(
  input: EmberCompletionInput,
): string {
  const { seed, participatingSparks, inquiryState, designPack } = input;
  const lines: string[] = [];

  const title =
    seed.name?.trim() ||
    `Untitled ${EMBER_NATURE_LABELS[seed.nature] ?? 'Ember'}`;
  const natureLabel = EMBER_NATURE_LABELS[seed.nature] ?? seed.nature;

  // ── 1. Identity Header ──
  lines.push(`# ${title}`);
  lines.push('');
  lines.push(`> **Ember Completion Record** · Nature: ${natureLabel}`);
  lines.push('');
  lines.push(`- **Ember ID:** \`${seed.id}\``);
  lines.push(`- **Created:** ${formatIsoDate(seed.createdAt)}`);
  lines.push('');

  // ── 2. What This Ember Carries (Carried Sentence) ──
  const carriedSentence = seed.carriedSentence?.trim();
  if (carriedSentence) {
    lines.push('## What This Ember Carries');
    lines.push('');
    lines.push(`*${carriedSentence}*`);
    lines.push('');
  }

  // ── 3. Participating Sparks & Starting Material ──
  const seedSpark = seed.spark?.trim() ?? '';
  const joinedSparks = participatingSparks
    .map((s) => s.content.trim())
    .join('\n\n');
  const hasDistinctSeedSpark =
    seedSpark.length > 0 &&
    (participatingSparks.length === 0 || seedSpark !== joinedSparks);

  if (hasDistinctSeedSpark || participatingSparks.length > 0) {
    lines.push('## Participating Sparks');
    lines.push('');

    if (hasDistinctSeedSpark) {
      lines.push('### Starting Seed');
      lines.push('');
      lines.push(seedSpark);
      lines.push('');
    }

    for (const spark of participatingSparks) {
      const sparkHeading = spark.title?.trim() || 'Untitled Spark';
      lines.push(`### ${sparkHeading} (${formatIsoDate(spark.createdAt)})`);
      lines.push('');
      lines.push(spark.content.trim());
      lines.push('');
    }
  }

  // ── 4. Questions Worth Holding ──
  const heldQuestions = seed.questions
    .map((q) => q.trim())
    .filter((q) => q.length > 0);
  if (heldQuestions.length > 0) {
    lines.push('## Questions Worth Holding');
    lines.push('');
    for (const q of heldQuestions) {
      lines.push(`- ${q}`);
    }
    lines.push('');
  }

  // ── 5. Carried Files / Sources ──
  if (seed.sources.length > 0) {
    lines.push('## Carried Files');
    lines.push('');
    for (const src of seed.sources) {
      lines.push(`- **${src.name}** (\`${src.uri}\`)`);
    }
    lines.push('');
  }

  // ── 6. Recorded Exploration Context ──
  if (inquiryState) {
    const exploreAnswered = inquiryState.questions.filter(
      (q) => q.movement === 'explore' && q.applicable && q.answer !== undefined,
    );

    if (exploreAnswered.length > 0) {
      lines.push('## Exploration');
      lines.push('');
      for (const qs of exploreAnswered) {
        const authored = INQUIRY_QUESTIONS.find((item) => item.id === qs.id);
        const prompt = authored?.text ?? qs.id;
        lines.push(`### ${prompt}`);
        lines.push('');
        lines.push(qs.answer!.value.trim());
        lines.push('');
      }
    }

    // ── 7. Recorded Development & Inquiry Decisions ──
    const developAnswered = inquiryState.questions.filter(
      (q) => q.movement === 'develop' && q.applicable && q.answer !== undefined,
    );
    const adoptedConfig = inquiryState.designPack.adoptedConfigurationId
      ? CONFIGURATIONS.find(
          (c) => c.id === inquiryState.designPack.adoptedConfigurationId,
        )
      : undefined;

    if (
      developAnswered.length > 0 ||
      adoptedConfig ||
      inquiryState.designPack.chosen
    ) {
      lines.push('## Inquiry & Development');
      lines.push('');

      if (adoptedConfig) {
        lines.push(
          `- **Adopted Configuration:** ${adoptedConfig.name} (\`${adoptedConfig.id}\`)`,
        );
      } else if (inquiryState.designPack.adoptedConfigurationId) {
        lines.push(
          `- **Adopted Configuration:** \`${inquiryState.designPack.adoptedConfigurationId}\``,
        );
      }

      if (inquiryState.designPack.warranted) {
        lines.push('- **Inquiry Status:** Warranted & Review Confirmed');
      } else if (inquiryState.designPack.chosen) {
        lines.push('- **Inquiry Status:** In Development');
      }
      lines.push('');

      if (developAnswered.length > 0) {
        lines.push('### Recorded Answers');
        lines.push('');
        for (const qs of developAnswered) {
          const authored = INQUIRY_QUESTIONS.find((item) => item.id === qs.id);
          const prompt = authored?.text ?? qs.id;
          const choice = authored?.choices?.find(
            (c) => c.value === qs.answer!.value,
          );
          const answerLabel = choice ? choice.label : qs.answer!.value;
          const dispositionTag =
            qs.disposition === 'unresolved'
              ? ' *(Unresolved)*'
              : qs.disposition === 'excluded'
              ? ' *(Excluded for this version)*'
              : '';

          lines.push(`- **${prompt}** — ${answerLabel}${dispositionTag}`);
          if (qs.answer!.specification?.trim()) {
            lines.push(`  - *Specification:* ${qs.answer!.specification.trim()}`);
          }
        }
        lines.push('');
      }

      if (inquiryState.designPack.blockers.length > 0) {
        lines.push('### Open Decisions & Coverage Boundaries');
        lines.push('');
        for (const blocker of inquiryState.designPack.blockers) {
          lines.push(`- ${blocker.detail}`);
        }
        lines.push('');
      }
    }
  }

  // ── 8. Generated Design Pack ──
  if (designPack && designPack.markdown.trim().length > 0) {
    lines.push('---');
    lines.push('');
    const stalenessSuffix =
      designPack.staleness === 'stale'
        ? ' · Stale (evidence changed after generation)'
        : '';
    lines.push(
      `## Generated Design Pack (v${designPack.version}${stalenessSuffix})`,
    );
    lines.push('');
    lines.push(designPack.markdown.trim());
    lines.push('');
  }

  return lines.join('\n').trimEnd() + '\n';
}

function formatIsoDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toISOString().split('T')[0];
  } catch {
    return iso;
  }
}
