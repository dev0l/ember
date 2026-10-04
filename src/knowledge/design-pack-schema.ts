// ─────────────────────────────────────────────
// Authored Knowledge — Design Pack Schema
//
// Section definitions for the generated Design Pack.
// Each section knows what state it needs to render.
//
// "The Design Pack is a view of that state."
// ─────────────────────────────────────────────

/**
 * A section in the Design Pack output.
 */
export interface DesignPackSection {
  id: string;
  title: string;
  description: string;
  /** Whether this section is always included or only when relevant */
  inclusion: 'always' | 'when-relevant';
}

/**
 * The sections that make up a Design Pack.
 * Order matters — this is the rendering order.
 */
export const DESIGN_PACK_SECTIONS: DesignPackSection[] = [
  {
    id: 'project-overview',
    title: 'Project Overview',
    description: 'Name, purpose, audience, platform — established facts.',
    inclusion: 'always',
  },
  {
    id: 'original-intent',
    title: 'Original Intent',
    description: 'The user\'s original Spark material, preserved.',
    inclusion: 'always',
  },
  {
    id: 'established-conditions',
    title: 'Established Conditions',
    description: 'What has been determined through enquiry.',
    inclusion: 'always',
  },
  {
    id: 'proposed-architecture',
    title: 'Proposed Architecture',
    description: 'Technology propositions with reasoning.',
    inclusion: 'when-relevant',
  },
  {
    id: 'technology-stack',
    title: 'Technology Stack',
    description: 'Specific technologies, with confidence levels.',
    inclusion: 'when-relevant',
  },
  {
    id: 'considerations',
    title: 'Implementation Considerations',
    description: 'Practical notes for each proposition.',
    inclusion: 'when-relevant',
  },
  {
    id: 'open-questions',
    title: 'Open Questions',
    description: 'Questions preserved — not tasks to close.',
    inclusion: 'when-relevant',
  },
  {
    id: 'limitations',
    title: 'Known Limitations',
    description: 'What this Design Pack does not address.',
    inclusion: 'always',
  },
];
