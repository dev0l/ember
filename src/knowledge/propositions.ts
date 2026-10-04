// ─────────────────────────────────────────────
// Authored Knowledge — Propositions
//
// "Ember doesn't need artificial intelligence to propose
//  something like React Native/Expo plus local persistence
//  as one technical configuration."
//
// Propositions declare:
//   - what they are
//   - when they're relevant (conditions)
//   - when they conflict (conditions)
//   - WHY (reasoning)
//
// "SQLite is proposed BECAUSE the project requires
//  structured local persistence, offline operation
//  and no remote account dependency."
// ─────────────────────────────────────────────

import type { ConfidenceLevel } from '@/core/ember-project-types';

/**
 * A technology or architectural proposition.
 *
 * Propositions remain plural — we don't collapse to one answer.
 * Ember carries alternatives with reasoning.
 */
export interface AuthoredProposition {
  /** Unique identifier */
  id: string;

  /** Technology or approach name */
  name: string;

  /** Category: framework, storage, architecture, convention */
  category: 'framework' | 'storage' | 'architecture' | 'convention';

  /** Brief description */
  description: string;

  /**
   * The reasoning — WHY this proposition exists.
   * This appears in the Design Pack.
   */
  reasoning: string;

  /**
   * Conditions that support this proposition.
   * More matching conditions = higher relevance.
   */
  supportingConditions: string[];

  /**
   * Conditions that conflict with this proposition.
   * Conflicts don't prevent activation — they create tensions
   * worth preserving in the Design Pack.
   */
  conflictingConditions: string[];

  /**
   * Alternative proposition IDs.
   * "You might also consider..."
   */
  alternativeIds: string[];

  /**
   * Implementation considerations — practical notes.
   */
  considerations: string[];
}

// ─────────────────────────────────────────────
// The Proposition Library
//
// Deliberately small. We author what we can defend.
// ─────────────────────────────────────────────

export const PROPOSITION_LIBRARY: AuthoredProposition[] = [
  // ── Frameworks ──────────────────

  {
    id: 'prop-expo-rn',
    name: 'React Native / Expo',
    category: 'framework',
    description:
      'Cross-platform mobile framework using React and JavaScript/TypeScript.',
    reasoning:
      'Proposed because the project targets mobile platforms. Expo provides managed build infrastructure, over-the-air updates, and a rich library ecosystem without requiring native development expertise.',
    supportingConditions: ['platform-mobile'],
    conflictingConditions: ['platform-web'],
    alternativeIds: ['prop-web-react'],
    considerations: [
      'Expo SDK provides camera, file system, audio, and device APIs out of the box.',
      'TypeScript is supported and recommended for type safety.',
      'Can eject to bare React Native if native modules are needed.',
      'Testing on physical devices requires Expo Go or development builds.',
    ],
  },
  {
    id: 'prop-web-react',
    name: 'React Web Application',
    category: 'framework',
    description:
      'Web-based application using React, deployable to any modern browser.',
    reasoning:
      'Proposed because the project targets web browsers. React provides component-based architecture and a large ecosystem.',
    supportingConditions: ['platform-web'],
    conflictingConditions: ['platform-mobile', 'offline-required'],
    alternativeIds: ['prop-expo-rn'],
    considerations: [
      'Can be deployed as a static site or with a server backend.',
      'Progressive Web App (PWA) capabilities can provide some offline support.',
      'No app store distribution — users access via URL.',
      'Responsive design needed for mobile browser usage.',
    ],
  },

  // ── Storage ──────────────────

  {
    id: 'prop-local-files',
    name: 'Structured Local Files (JSON/Markdown)',
    category: 'storage',
    description:
      'Persist data as structured files in the device\'s local storage.',
    reasoning:
      'Proposed because the project requires persistence without remote infrastructure. Local files are human-readable, portable, and sufficient while the data model remains relatively simple.',
    supportingConditions: [
      'requires-persistence',
      'no-auth',
      'scale-individual',
      'offline-required',
    ],
    conflictingConditions: ['scale-public'],
    alternativeIds: ['prop-sqlite'],
    considerations: [
      'No server, no account, no cloud infrastructure required.',
      'Files can be inspected and modified by the user.',
      'May become insufficient if querying across many documents is needed.',
      'Expo file-system API handles read/write on mobile.',
    ],
  },
  {
    id: 'prop-sqlite',
    name: 'SQLite (Local Database)',
    category: 'storage',
    description:
      'Embedded relational database for structured local persistence.',
    reasoning:
      'Proposed because the project requires structured local persistence with querying, relationships, or larger data volumes. SQLite provides relational capabilities without requiring a server.',
    supportingConditions: [
      'requires-persistence',
      'offline-required',
    ],
    conflictingConditions: [],
    alternativeIds: ['prop-local-files'],
    considerations: [
      'Appropriate when data grows beyond simple file-per-record.',
      'Supports queries, indexes, relationships, and migrations.',
      'expo-sqlite available in Expo ecosystem.',
      'Data is not human-readable without tooling.',
    ],
  },

  // ── Architecture ──────────────────

  {
    id: 'prop-local-first',
    name: 'Local-First Architecture',
    category: 'architecture',
    description:
      'All data and core functionality reside on the device. No mandatory server.',
    reasoning:
      'Proposed because the project requires offline capability and has no server dependency. Data sovereignty remains with the user.',
    supportingConditions: [
      'offline-required',
      'offline-preferred',
      'no-auth',
      'scale-individual',
    ],
    conflictingConditions: [
      'online-required',
      'auth-required',
      'scale-public',
    ],
    alternativeIds: [],
    considerations: [
      'The app is fully functional without internet.',
      'No recurring infrastructure costs.',
      'Syncing between devices requires additional architecture later.',
      'Backups are the user\'s responsibility unless we add export.',
    ],
  },

  // ── Conventions ──────────────────

  {
    id: 'prop-typescript',
    name: 'TypeScript with Strict Mode',
    category: 'convention',
    description: 'Statically typed JavaScript for reliability and documentation.',
    reasoning:
      'Proposed as a general best practice for any project beyond prototype scale. Catches errors at compile time and serves as living documentation.',
    supportingConditions: [], // Always reasonable to propose
    conflictingConditions: [],
    alternativeIds: [],
    considerations: [
      'Strict mode catches common mistakes early.',
      'Path aliases (@/) improve import readability.',
      'Type definitions serve as inline documentation.',
    ],
  },
  {
    id: 'prop-feature-folders',
    name: 'Feature-Based Folder Structure',
    category: 'convention',
    description:
      'Organize code by feature/domain rather than by technical role.',
    reasoning:
      'Proposed because feature-based organization scales better than role-based (components/, services/, utils/) as the project grows.',
    supportingConditions: [],
    conflictingConditions: [],
    alternativeIds: [],
    considerations: [
      'Each feature folder contains its own types, components, and logic.',
      'Shared infrastructure lives in core/ or common/.',
      'Reduces cross-feature coupling.',
    ],
  },
];

/**
 * Evaluate which propositions are relevant given active conditions.
 *
 * Returns propositions sorted by relevance (most supporting conditions matched first).
 * Includes conflict information for the Design Pack to render.
 */
export function evaluatePropositions(
  activeConditions: string[],
): Array<{
  proposition: AuthoredProposition;
  confidence: ConfidenceLevel;
  matchingSupports: string[];
  activeConflicts: string[];
}> {
  const results = [];

  for (const prop of PROPOSITION_LIBRARY) {
    const matchingSupports = prop.supportingConditions.filter((c) =>
      activeConditions.includes(c),
    );
    const activeConflicts = prop.conflictingConditions.filter((c) =>
      activeConditions.includes(c),
    );

    // Include if at least one supporting condition matches
    // OR if the proposition has no conditions (always relevant, like TypeScript)
    const isRelevant =
      matchingSupports.length > 0 ||
      prop.supportingConditions.length === 0;

    if (!isRelevant) continue;

    // Determine confidence
    let confidence: ConfidenceLevel;
    if (activeConflicts.length > 0) {
      confidence = 'proposed'; // Tensions exist
    } else if (matchingSupports.length >= 2) {
      confidence = 'established'; // Strong support
    } else {
      confidence = 'proposed'; // Some support
    }

    results.push({
      proposition: prop,
      confidence,
      matchingSupports,
      activeConflicts,
    });
  }

  // Sort: more matching supports first, then alphabetically
  results.sort((a, b) => {
    const diff = b.matchingSupports.length - a.matchingSupports.length;
    if (diff !== 0) return diff;
    return a.proposition.name.localeCompare(b.proposition.name);
  });

  return results;
}
