// ─────────────────────────────────────────────
// Authored Knowledge — Dimensions
//
// "We're not categorizing the project.
//  We're establishing its conditions."
//
// Dimensions are the axes along which Ember explores
// a project. Each dimension groups related questions
// and conditions.
// ─────────────────────────────────────────────

/**
 * A dimension of enquiry.
 *
 * Dimensions aren't project categories — they're lenses.
 * A project doesn't "have a persistence type." It has
 * conditions that make persistence relevant or irrelevant.
 */
export interface Dimension {
  id: string;
  label: string;
  description: string;
}

/**
 * The dimensions Ember currently understands.
 *
 * This is deliberately small. We author what we can defend.
 * "No proposition is currently available for this configuration"
 * is vastly better than inventing an answer.
 */
export const DIMENSIONS: Dimension[] = [
  {
    id: 'purpose',
    label: 'Purpose',
    description: 'What the project makes possible',
  },
  {
    id: 'audience',
    label: 'Audience',
    description: 'Who or what this is for',
  },
  {
    id: 'platform',
    label: 'Platform',
    description: 'Where the project lives and runs',
  },
  {
    id: 'persistence',
    label: 'Persistence',
    description: 'Whether and how information survives',
  },
  {
    id: 'connectivity',
    label: 'Connectivity',
    description: 'Whether the project requires network access',
  },
  {
    id: 'identity',
    label: 'Identity',
    description: 'Whether users need accounts or authentication',
  },
  {
    id: 'scale',
    label: 'Scale',
    description: 'Individual use, small group, or larger',
  },
];
