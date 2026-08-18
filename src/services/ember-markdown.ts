// ─────────────────────────────────────────────
// Ember Markdown Serialization
//
// Converts EmberSeed ↔ Markdown.
//
// The Markdown structure is inspired by Hermes intake pulses:
//   frontmatter, source links, what landed, questions to preserve,
//   texture, language seeds — but adapted for Ember's initiation.
//
// The user may see this Markdown directly during the prototype.
// Later, application screens can render selected parts without
// exposing the file itself.
// ─────────────────────────────────────────────

import type { EmberSeed, EmberNature, EmberSource } from '@/core/ember-types';

/**
 * Serializes an EmberSeed into a structured Markdown document.
 *
 * Layout inspired by Hermes intake pulse template:
 *   frontmatter → title/spark → questions → carried sentence → sources
 */
export function serializeEmberMarkdown(seed: EmberSeed): string {
  const sections: string[] = [];

  // ── Frontmatter ──
  sections.push(buildFrontmatter(seed));

  // ── Title / Nature ──
  const title = seed.name || untitledLabel(seed.nature);
  sections.push(`# ${title}`);
  sections.push('');
  sections.push(`> *What is beginning?* ${capitalize(seed.nature)}.`);
  sections.push('');

  // ── Spark ──
  if (seed.spark && seed.spark.trim()) {
    sections.push('## Spark');
    sections.push('');
    sections.push(seed.spark.trim());
    sections.push('');
  }

  // ── Questions Worth Preserving ──
  if (seed.questions.length > 0) {
    sections.push('## Questions Worth Preserving');
    sections.push('');
    for (const q of seed.questions) {
      if (q.trim()) {
        sections.push(`- ${q.trim()}`);
      }
    }
    sections.push('');
  }

  // ── Carried Sentence ──
  if (seed.carriedSentence && seed.carriedSentence.trim()) {
    sections.push('## Carried Sentence');
    sections.push('');
    sections.push(`*${seed.carriedSentence.trim()}*`);
    sections.push('');
  }

  // ── Sources ──
  if (seed.sources.length > 0) {
    sections.push('## Sources');
    sections.push('');
    for (const src of seed.sources) {
      sections.push(`- [${src.name}](${src.uri}) — added ${formatDate(src.addedAt)}`);
    }
    sections.push('');
  }

  return sections.join('\n');
}

/**
 * Parses an Ember Markdown document back into an EmberSeed.
 *
 * This is a pragmatic parser for the prototype — not a full
 * Markdown AST parser. It reads the frontmatter and sections
 * we produce in serializeEmberMarkdown.
 */
export function parseEmberMarkdown(markdown: string): EmberSeed {
  const frontmatter = extractFrontmatter(markdown);
  const body = removeFrontmatter(markdown);

  // Parse title from first H1
  const titleMatch = body.match(/^# (.+)$/m);
  const name = titleMatch?.[1]?.trim();

  // Parse spark section
  const spark = extractSection(body, 'Spark');

  // Parse questions
  const questionsRaw = extractSection(body, 'Questions Worth Preserving');
  const questions = questionsRaw
    ? questionsRaw
        .split('\n')
        .filter((line) => line.startsWith('- '))
        .map((line) => line.replace(/^- /, '').trim())
    : [];

  // Parse carried sentence
  const carriedRaw = extractSection(body, 'Carried Sentence');
  const carriedSentence = carriedRaw
    ? carriedRaw.replace(/^\*/, '').replace(/\*$/, '').trim()
    : undefined;

  // Parse sources
  const sourcesRaw = extractSection(body, 'Sources');
  const sources: EmberSource[] = [];
  if (sourcesRaw) {
    const sourceLines = sourcesRaw
      .split('\n')
      .filter((line) => line.startsWith('- '));
    for (const line of sourceLines) {
      const match = line.match(/\[(.+?)\]\((.+?)\)\s*—\s*added\s*(.+)/);
      if (match) {
        sources.push({
          id: generateSourceId(),
          name: match[1],
          uri: match[2],
          addedAt: match[3],
        });
      }
    }
  }

  return {
    id: frontmatter.id || 'unknown',
    nature: (frontmatter.nature as EmberNature) || 'open',
    name: name && !name.startsWith('Untitled') ? name : undefined,
    spark: spark || undefined,
    questions,
    carriedSentence,
    sources,
    createdAt: frontmatter.created || new Date().toISOString(),
    updatedAt: frontmatter.updated || new Date().toISOString(),
  };
}

// ── Internal Helpers ──────────────────────────

function buildFrontmatter(seed: EmberSeed): string {
  const lines = [
    '---',
    `id: ${seed.id}`,
    `nature: ${seed.nature}`,
  ];

  if (seed.name) {
    lines.push(`name: ${seed.name}`);
  }

  lines.push(`created: ${seed.createdAt}`);
  lines.push(`updated: ${seed.updatedAt}`);
  lines.push('---');
  lines.push('');

  return lines.join('\n');
}

function extractFrontmatter(
  markdown: string,
): Record<string, string> {
  const match = markdown.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const result: Record<string, string> = {};
  const lines = match[1].split('\n');
  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();
      result[key] = value;
    }
  }
  return result;
}

function removeFrontmatter(markdown: string): string {
  return markdown.replace(/^---\n[\s\S]*?\n---\n*/, '');
}

function extractSection(body: string, heading: string): string | null {
  // Match the section between ## Heading and the next ## or end
  const regex = new RegExp(
    `## ${escapeRegex(heading)}\\n\\n([\\s\\S]*?)(?=\\n## |$)`,
  );
  const match = body.match(regex);
  return match ? match[1].trim() : null;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toISOString().split('T')[0];
  } catch {
    return isoString;
  }
}

function untitledLabel(nature: EmberNature): string {
  const labels: Record<EmberNature, string> = {
    project: 'Untitled Project',
    idea: 'Untitled Idea',
    principle: 'Untitled Principle',
    open: 'Untitled Ember',
  };
  return labels[nature];
}

function generateSourceId(): string {
  return `src-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
}
