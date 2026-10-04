// ─────────────────────────────────────────────
// Design Pack Generator
//
// EmberProject JSON → Markdown Design Pack
//
// "The JSON is for Ember to carry.
//  The Markdown is for Ember to communicate."
//
// This is deterministic string composition.
// No AI generates it. No pretense of understanding.
// It produces a useful representation from what
// has been established.
// ─────────────────────────────────────────────

import type { EmberProject, EmberAnswer } from '@/core/ember-project-types';
import { evaluatePropositions, QUESTION_LIBRARY, DIMENSIONS, PROPOSITION_LIBRARY } from '@/knowledge';

/**
 * Generates a Markdown Design Pack from the current EmberProject state.
 *
 * The generator distinguishes between:
 *   - Established: the user explicitly stated or selected this
 *   - Proposed: Ember inferred this from conditions
 *   - Open: not yet determined
 *
 * "That's already substantially better than a conventional generator
 *  that fills every heading because the template contains a heading."
 */
export function generateDesignPack(project: EmberProject): string {
  const sections: string[] = [];
  const conditions = project.conditions.map((c) => c.id);
  const evaluated = evaluatePropositions(conditions);

  // ── Header ──
  sections.push(`# Design Pack: ${project.name}`);
  sections.push('');
  sections.push(
    `> Generated from Ember session on ${formatDate(new Date().toISOString())}`,
  );
  sections.push(
    `> Version ${project.designPackVersion + 1} · ${project.conditions.length} conditions established · ${evaluated.length} propositions active`,
  );
  sections.push('');

  // ── Project Overview ──
  sections.push('## Project Overview');
  sections.push('');

  const purposeAnswer = findAnswer(project.answers, 'q-purpose');
  const audienceAnswer = findAnswer(project.answers, 'q-audience');
  const platformAnswer = findAnswer(project.answers, 'q-platform');

  if (project.name && project.name !== 'Untitled Ember') {
    sections.push(`**Name:** ${project.name}`);
  }
  if (purposeAnswer) {
    sections.push(`**Purpose:** ${purposeAnswer.rawResponse}`);
  }
  if (audienceAnswer) {
    sections.push(`**Audience:** ${audienceAnswer.rawResponse}`);
  }
  if (platformAnswer) {
    sections.push(`**Platform:** ${platformAnswer.value}`);
  }

  sections.push('');

  // ── Original Intent ──
  sections.push('## Original Intent');
  sections.push('');
  sections.push(
    '*The original Spark material that initiated this Ember:*',
  );
  sections.push('');
  sections.push(`> ${project.originalMaterial.replace(/\n/g, '\n> ')}`);
  sections.push('');

  // ── Established Conditions ──
  if (project.conditions.length > 0) {
    sections.push('## Established Conditions');
    sections.push('');
    sections.push(
      '*What has been determined through enquiry:*',
    );
    sections.push('');

    for (const condition of project.conditions) {
      const confidenceMarker =
        condition.confidence === 'established'
          ? '✓'
          : condition.confidence === 'proposed'
            ? '~'
            : '?';
      sections.push(
        `- ${confidenceMarker} **${condition.label}** *(${condition.confidence})*`,
      );
    }
    sections.push('');
  }

  // ── Proposed Architecture & Technology Stack ──
  if (evaluated.length > 0) {
    sections.push('## Proposed Architecture');
    sections.push('');

    // Group by category
    const frameworks = evaluated.filter(
      (e) => e.proposition.category === 'framework',
    );
    const storage = evaluated.filter(
      (e) => e.proposition.category === 'storage',
    );
    const architecture = evaluated.filter(
      (e) => e.proposition.category === 'architecture',
    );
    const conventions = evaluated.filter(
      (e) => e.proposition.category === 'convention',
    );

    if (frameworks.length > 0) {
      sections.push('### Framework');
      sections.push('');
      for (const { proposition, confidence, activeConflicts } of frameworks) {
        renderProposition(
          sections,
          proposition,
          confidence,
          activeConflicts,
        );
      }
    }

    if (storage.length > 0) {
      sections.push('### Storage');
      sections.push('');
      for (const { proposition, confidence, activeConflicts } of storage) {
        renderProposition(
          sections,
          proposition,
          confidence,
          activeConflicts,
        );
      }
    }

    if (architecture.length > 0) {
      sections.push('### Architecture');
      sections.push('');
      for (const {
        proposition,
        confidence,
        activeConflicts,
      } of architecture) {
        renderProposition(
          sections,
          proposition,
          confidence,
          activeConflicts,
        );
      }
    }

    if (conventions.length > 0) {
      sections.push('### Conventions');
      sections.push('');
      for (const { proposition, confidence, activeConflicts } of conventions) {
        renderProposition(
          sections,
          proposition,
          confidence,
          activeConflicts,
        );
      }
    }
  } else {
    sections.push('## Proposed Architecture');
    sections.push('');
    sections.push(
      '*No propositions are currently available for this configuration.*',
    );
    sections.push(
      '*Further enquiry may establish conditions that activate propositions.*',
    );
    sections.push('');
  }

  // ── Implementation Considerations ──
  const allConsiderations = evaluated.flatMap((e) =>
    e.proposition.considerations.map((c) => ({
      tech: e.proposition.name,
      note: c,
    })),
  );

  if (allConsiderations.length > 0) {
    sections.push('## Implementation Considerations');
    sections.push('');
    for (const { tech, note } of allConsiderations) {
      sections.push(`- **${tech}:** ${note}`);
    }
    sections.push('');
  }

  // ── Enquiry Record ──
  if (project.answers.length > 0) {
    sections.push('## Enquiry Record');
    sections.push('');
    sections.push('*What was asked and what was answered — the user\'s original words:*');
    sections.push('');

    for (const answer of project.answers) {
      const question = QUESTION_LIBRARY.find(
        (q) => q.id === answer.questionId,
      );
      const questionText = question?.text ?? answer.questionId;
      sections.push(`**Q: ${questionText}**`);
      sections.push('');
      sections.push(`> ${answer.rawResponse}`);
      sections.push('');
    }
  }

  // ── Open Questions ──
  if (project.openQuestions.length > 0) {
    sections.push('## Open Questions');
    sections.push('');
    sections.push('*Preserved — not tasks to close:*');
    sections.push('');
    for (const q of project.openQuestions) {
      sections.push(`- ${q}`);
    }
    sections.push('');
  }

  // ── Known Limitations ──
  sections.push('## Known Limitations');
  sections.push('');
  sections.push(
    'This Design Pack was generated deterministically from structured enquiry.',
  );
  sections.push(
    'It does not claim to have understood the project or intelligently crystallized it.',
  );
  sections.push(
    'It produces a useful representation from what has been established.',
  );
  sections.push('');

  const unansweredDimensions = getUnansweredDimensions(project);
  if (unansweredDimensions.length > 0) {
    sections.push(
      `**Unexplored dimensions:** ${unansweredDimensions.join(', ')}`,
    );
    sections.push('');
  }

  sections.push(
    '**Intelligence boundary:** This pack was generated without AI interpretation.',
  );
  sections.push(
    'Operations that would benefit from interpretation (expanding possibilities,',
  );
  sections.push(
    'questioning assumptions, recognizing tensions) are not yet available.',
  );
  sections.push('');

  // ── Footer ──
  sections.push('---');
  sections.push('');
  sections.push(
    `*Generated by Ember · ${formatDate(new Date().toISOString())} · Hand on Hearth 🪵🔥*`,
  );

  return sections.join('\n');
}

// ── Internal Helpers ──────────────────────────

function renderProposition(
  sections: string[],
  prop: {
    name: string;
    description: string;
    reasoning: string;
    alternativeIds: string[];
  },
  confidence: string,
  activeConflicts: string[],
): void {
  const marker = confidence === 'established' ? '✓' : '~';
  sections.push(`**${marker} ${prop.name}** *(${confidence})*`);
  sections.push('');
  sections.push(prop.description);
  sections.push('');
  sections.push(prop.reasoning);
  sections.push('');

  if (activeConflicts.length > 0) {
    sections.push(
      `> ⚠️ *Tension: conflicts with conditions: ${activeConflicts.join(', ')}*`,
    );
    sections.push('');
  }

  if (prop.alternativeIds.length > 0) {
    const altNames = prop.alternativeIds.map((id) => {
      const alt = PROPOSITION_LIBRARY.find((p) => p.id === id);
      return alt ? alt.name : id;
    });
    sections.push(
      `*Alternatives worth considering: ${altNames.join(', ')}*`,
    );
    sections.push('');
  }
}

function findAnswer(
  answers: EmberAnswer[],
  questionId: string,
): EmberAnswer | undefined {
  return answers.find((a) => a.questionId === questionId);
}

function getUnansweredDimensions(project: EmberProject): string[] {
  const answeredDimensions = new Set(
    project.answers.map((a) => a.dimensionId),
  );
  return DIMENSIONS.map((d) => d.id).filter((id) => !answeredDimensions.has(id));
}

function formatDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return isoString;
  }
}
