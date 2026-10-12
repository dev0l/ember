// ─────────────────────────────────────────────
// Inquiry Engine — Coverage Perimeter (D2)
//
// Only configurations Ember has explicitly authored and can cover coherently:
// straightforward mobile/web software with local or session persistence.
//
// Requirements outside this perimeter (shared or cross-device state,
// authentication/access, external services, binding constraints, and
// combinations no single configuration covers) are captured honestly and
// surface as explicit blockers. They never receive guessed defaults.
//
// When several configurations qualify, NONE is preferred automatically:
// the user's adoption decision selects the working configuration.
// (Technology defaults remain an open product decision, D3.)
//
// Phase 3: each configuration also authors the handoff content it can
// actually provide — setup, starter organization, conventions, sequence,
// defaults, tradeoffs, limits, and per-capability guidance and checks.
// `satisfies` (coverage) and `provisions` (content) are separate claims:
// a Design Pack may only be generated when the adopted configuration
// authors content for every required capability (see handoff.ts).
// Capability content is included in a pack only when that capability is
// REQUIRED by the evidence — never as conditional prose ("when X is required").
// ─────────────────────────────────────────────

import type { Applicability, Capability, CapabilityProvision, Configuration } from './types.ts';

/**
 * Which capability each condition requires of a configuration.
 * Conditions absent here (reach, exclusions, context, "none" answers)
 * require no capability: they are recorded decisions, not coverage demands.
 */
export const CONDITION_CAPABILITIES: Record<string, Capability> = {
  'platform-mobile': 'target-mobile',
  'platform-web': 'target-web',
  'session-data-only': 'state-session',
  'durable-data-required': 'state-durable',
  'device-independent-data': 'data-local-device',
  'cross-device-data': 'data-cross-device',
  'shared-data': 'data-shared',
  'document-oriented-data': 'data-documents',
  'queryable-records': 'data-queryable',
  'external-service-required': 'external-service',
  'offline-outcome-required': 'offline-full',
  'offline-actions-required': 'offline-partial',
  'auth-required': 'auth',
  'recovery-required': 'recovery-export',
  'constraints-present': 'binding-constraint',
};

/** Human description of each capability, for blocker reporting. */
export const CAPABILITY_LABELS: Record<Capability, string> = {
  'target-mobile': 'a mobile target',
  'target-web': 'a web target',
  'state-session': 'session-only state',
  'state-durable': 'durable local data',
  'data-local-device': 'data kept on one device or browser',
  'data-cross-device': 'the same data across one person’s devices',
  'data-shared': 'data shared between people',
  'data-documents': 'document-oriented data',
  'data-queryable': 'queryable related records',
  'external-service': 'a dependency on an outside service',
  'offline-full': 'the whole first version working offline',
  'offline-partial': 'specific actions working offline',
  'auth': 'accounts and sign-in',
  'recovery-export': 'a recoverable copy of user data',
  'binding-constraint': 'a binding technical requirement',
};

// Single-platform configurations remain conditional candidates until the
// platform decision excludes them; the universal one requires both targets.
const BOTH: Applicability = { all: [{ condition: 'platform-mobile' }, { condition: 'platform-web' }] };
const NOT_WEB: Applicability = { not: { condition: 'platform-web' } };
const NOT_MOBILE: Applicability = { not: { condition: 'platform-mobile' } };

// ── Shared authored content ──────────────────
// Stack-level statements only. No domain features, entities or product names.

const NAMES_NOT_CHOSEN =
  'Names that require external uniqueness or registration (app identifiers, store listings, domains) are not chosen by this pack.';

const TS_CONVENTIONS = [
  'TypeScript in strict mode; no implicit any.',
  'Files and folders: kebab-case. Components and types: PascalCase. Functions and variables: camelCase.',
  'Screens and components never access storage directly; they go through the module named in the starter organization.',
  NAMES_NOT_CHOSEN,
];

const SEQUENCE_PREFIX = 'Set up the project and confirm the starter app runs on every supported target.';
const SEQUENCE_SUFFIX = [
  'Implement what the recorded purpose describes for the recorded audience. This pack specifies no features beyond that recorded text.',
  'Run every verification criterion in this pack before calling the first version complete.',
];

const EXPO_SETUP = [
  'Create the project with `npx create-expo-app@latest` (TypeScript template).',
  'Enable `"strict": true` in `tsconfig.json`.',
  'Confirm the starter app launches on a device or emulator for each mobile platform you ship to.',
];

const WEB_SETUP = [
  'Create the project with `npm create vite@latest` using the React + TypeScript template.',
  'Enable `"strict": true` in `tsconfig.json`.',
  'Confirm the starter app runs in each supported browser.',
];

const TARGET_MOBILE: CapabilityProvision = {
  guidance: ['Target iOS and/or Android through Expo; test on a physical device or emulator for each platform you ship to.'],
  checks: ['The first usable outcome works on a mobile device.'],
};

const TARGET_WEB: CapabilityProvision = {
  guidance: ['Target current versions of the major browsers; avoid APIs without broad support.'],
  checks: ['The first usable outcome works in each supported browser.'],
};

const STATE_SESSION_MOBILE: CapabilityProvision = {
  guidance: [
    'Hold working state in memory (component state or a small store); persist nothing.',
    'Make loss-on-close explicit in the interface wherever losing work would surprise someone.',
  ],
  checks: ['Closing and reopening the app starts from a clean state.'],
};

const STATE_SESSION_WEB: CapabilityProvision = {
  guidance: [
    'Hold working state in memory; persist nothing (no localStorage, IndexedDB or cookies for data).',
    'Make loss-on-reload explicit in the interface wherever losing work would surprise someone.',
  ],
  checks: ['Reloading the page starts from a clean state.'],
};

const DATA_LOCAL_DEVICE: CapabilityProvision = {
  guidance: ['Keep all data on the device or browser where it is created. Add no backend, synchronization or account infrastructure.'],
  checks: ['The app creates and reads its data with no account and no server.'],
};

const OFFLINE_FULL_MOBILE: CapabilityProvision = {
  guidance: ['Bundle everything the first usable outcome needs; make no network request on its path.'],
  checks: ['The first usable outcome works with the device offline (airplane mode).'],
};

const OFFLINE_PARTIAL_MOBILE: CapabilityProvision = {
  guidance: ['Make the actions named under Connectivity in the Requirements work without a network. Other actions may require one.'],
  checks: ['Each action named under Connectivity works with the device offline (airplane mode).'],
};

// ── Configurations ───────────────────────────

export const CONFIGURATIONS: Configuration[] = [
  {
    id: 'cfg-mobile-session',
    name: 'Expo (React Native) · session state',
    summary: 'A self-contained mobile app holding its state in memory while in use.',
    satisfies: ['target-mobile', 'state-session', 'data-local-device', 'offline-full', 'offline-partial'],
    prerequisites: NOT_WEB,
    defaults: ['Expo (React Native) with Expo Router, as created by the default Expo template.', 'TypeScript in strict mode.'],
    tradeoffs: ['The simplest mobile configuration: nothing persists, so there is no storage, migration or recovery work — and nothing survives closing the app.'],
    limits: ['Nothing is kept after the app closes.'],
    setup: EXPO_SETUP,
    starterLayout: [
      'app/              screens and navigation (Expo Router)',
      'src/components/   reusable UI',
      'src/state/        in-memory state holders',
      'assets/           images and fonts',
    ],
    conventions: TS_CONVENTIONS,
    sequence: [SEQUENCE_PREFIX, 'Create the in-memory state holders in `src/state/`.', ...SEQUENCE_SUFFIX],
    guidance: ['Keep the first version self-contained: one app, no server.'],
    checks: ['The app installs and launches from a clean install.'],
    provisions: {
      'target-mobile': TARGET_MOBILE,
      'state-session': STATE_SESSION_MOBILE,
      'data-local-device': DATA_LOCAL_DEVICE,
      'offline-full': OFFLINE_FULL_MOBILE,
      'offline-partial': OFFLINE_PARTIAL_MOBILE,
    },
  },
  {
    id: 'cfg-mobile-files',
    name: 'Expo (React Native) · structured local files',
    summary: 'A self-contained mobile app storing independent documents as local files.',
    satisfies: ['target-mobile', 'state-durable', 'data-local-device', 'data-documents', 'offline-full', 'offline-partial', 'recovery-export'],
    prerequisites: NOT_WEB,
    defaults: [
      'Expo (React Native) with Expo Router, as created by the default Expo template.',
      'TypeScript in strict mode.',
      'expo-file-system for document storage, one JSON file per document.',
    ],
    tradeoffs: ['Files suit independent documents and need no schema. If related records later need searching or querying, SQLite is the authored alternative.'],
    limits: ['Data exists only on this device; uninstalling the app removes it unless it was exported.'],
    setup: [...EXPO_SETUP, 'Install expo-file-system (`npx expo install expo-file-system`).'],
    starterLayout: [
      'app/              screens and navigation (Expo Router)',
      'src/components/   reusable UI',
      'src/storage/      document read/write — the only module that touches files',
      'assets/           images and fonts',
    ],
    conventions: [...TS_CONVENTIONS, 'One document per file, named by a generated id; never derive file names from user-entered text.'],
    sequence: [SEQUENCE_PREFIX, 'Implement document save/load in `src/storage/`.', ...SEQUENCE_SUFFIX],
    guidance: ['Keep the first version self-contained: one app, no server.'],
    checks: ['The app installs and launches from a clean install.'],
    provisions: {
      'target-mobile': TARGET_MOBILE,
      'state-durable': {
        guidance: ['Load saved documents at startup and save changes as they happen.'],
        checks: ['Documents survive closing and reopening the app.'],
      },
      'data-local-device': DATA_LOCAL_DEVICE,
      'data-documents': {
        guidance: [
          'Store each document as a structured (JSON) file in the app document directory.',
          'Write safely — write to a temporary file, then replace — so an interrupted save cannot corrupt a document.',
        ],
        checks: ['A saved document reopens intact.'],
      },
      'offline-full': OFFLINE_FULL_MOBILE,
      'offline-partial': OFFLINE_PARTIAL_MOBILE,
      'recovery-export': {
        guidance: ['Provide export of documents to a user-chosen location (system share sheet) and import from such a copy.'],
        checks: ['An exported copy can be imported and restores the documents.'],
      },
    },
  },
  {
    id: 'cfg-mobile-sqlite',
    name: 'Expo (React Native) · SQLite',
    summary: 'A self-contained mobile app storing related records in an on-device database.',
    satisfies: ['target-mobile', 'state-durable', 'data-local-device', 'data-documents', 'data-queryable', 'offline-full', 'offline-partial', 'recovery-export'],
    prerequisites: NOT_WEB,
    defaults: [
      'Expo (React Native) with Expo Router, as created by the default Expo template.',
      'TypeScript in strict mode.',
      'expo-sqlite for on-device storage.',
    ],
    tradeoffs: ['Covers documents and related records, at the cost of schema and migration work. Structured files are simpler when documents are independent.'],
    limits: ['Data exists only on this device; uninstalling the app removes it unless it was exported.'],
    setup: [...EXPO_SETUP, 'Install expo-sqlite (`npx expo install expo-sqlite`).'],
    starterLayout: [
      'app/              screens and navigation (Expo Router)',
      'src/components/   reusable UI',
      'src/db/           schema, migrations and queries — the only module that touches the database',
      'assets/           images and fonts',
    ],
    conventions: [...TS_CONVENTIONS, 'Tables and columns: snake_case. Schema changes only through numbered migrations.'],
    sequence: [SEQUENCE_PREFIX, 'Create the schema and its first migration in `src/db/`.', ...SEQUENCE_SUFFIX],
    guidance: ['Keep the first version self-contained: one app, no server.'],
    checks: ['The app installs and launches from a clean install.'],
    provisions: {
      'target-mobile': TARGET_MOBILE,
      'state-durable': {
        guidance: ['Open the database at startup; write changes in transactions as they happen.'],
        checks: ['Records survive closing and reopening the app.'],
      },
      'data-local-device': DATA_LOCAL_DEVICE,
      'data-documents': {
        guidance: ['Store each document as a row (structured columns, or a serialized body with the fields you look up by as columns).'],
        checks: ['A saved document reopens intact.'],
      },
      'data-queryable': {
        guidance: [
          'Model related records as tables with foreign keys; index the fields you query by.',
          'Version the schema and migrate forward; never silently drop data.',
        ],
        checks: [
          'Queries return correct results across related records.',
          'Upgrading the schema keeps existing records.',
        ],
      },
      'offline-full': OFFLINE_FULL_MOBILE,
      'offline-partial': OFFLINE_PARTIAL_MOBILE,
      'recovery-export': {
        guidance: ['Provide export of the database (or its records) to a user-chosen location and import from such a copy.'],
        checks: ['An exported copy can be imported and restores the records.'],
      },
    },
  },
  {
    id: 'cfg-web-session',
    name: 'React web · session state',
    summary: 'A self-contained browser app holding its state in memory while open.',
    satisfies: ['target-web', 'state-session', 'data-local-device'],
    prerequisites: NOT_MOBILE,
    defaults: ['React with Vite, as created by the React + TypeScript template.', 'TypeScript in strict mode.'],
    tradeoffs: ['The simplest web configuration: nothing persists, so there is no storage work — and nothing survives a reload.'],
    limits: ['Nothing is kept after the page is reloaded or closed.', 'Hosting is not specified by this pack; any static host serves the built files.'],
    setup: WEB_SETUP,
    starterLayout: [
      'src/pages/        top-level views',
      'src/components/   reusable UI',
      'src/state/        in-memory state holders',
      'public/           static assets',
    ],
    conventions: TS_CONVENTIONS,
    sequence: [SEQUENCE_PREFIX, 'Create the in-memory state holders in `src/state/`.', ...SEQUENCE_SUFFIX],
    guidance: ['Keep the first version self-contained: a static site, no server-side code.'],
    checks: ['The production build (`npm run build`) serves and runs from static hosting.'],
    provisions: {
      'target-web': TARGET_WEB,
      'state-session': STATE_SESSION_WEB,
      'data-local-device': DATA_LOCAL_DEVICE,
    },
  },
  {
    id: 'cfg-web-indexeddb',
    name: 'React web · IndexedDB',
    summary: 'A self-contained browser app storing data locally in IndexedDB.',
    satisfies: ['target-web', 'state-durable', 'data-local-device', 'data-documents', 'data-queryable', 'recovery-export'],
    prerequisites: NOT_MOBILE,
    defaults: [
      'React with Vite, as created by the React + TypeScript template.',
      'TypeScript in strict mode.',
      'IndexedDB through the browser API (a thin wrapper library is optional).',
    ],
    tradeoffs: ['Data stays in one browser with no server copy; clearing site data or the browser evicting storage removes it.'],
    limits: [
      'Browser storage can be evicted; this pack does not promise permanent retention.',
      'Hosting is not specified by this pack; any static host serves the built files.',
    ],
    setup: WEB_SETUP,
    starterLayout: [
      'src/pages/        top-level views',
      'src/components/   reusable UI',
      'src/storage/      IndexedDB schema and access — the only module that touches storage',
      'public/           static assets',
    ],
    conventions: [...TS_CONVENTIONS, 'Object stores and indexes: camelCase. Schema changes only by raising the database version.'],
    sequence: [SEQUENCE_PREFIX, 'Create the database, object stores and indexes in `src/storage/`.', ...SEQUENCE_SUFFIX],
    guidance: ['Keep the first version self-contained: a static site, no server-side code.'],
    checks: ['The production build (`npm run build`) serves and runs from static hosting.'],
    provisions: {
      'target-web': TARGET_WEB,
      'state-durable': {
        guidance: ['Open the database on load; write changes in transactions as they happen.'],
        checks: ['Data survives reloading the page and restarting the browser.'],
      },
      'data-local-device': DATA_LOCAL_DEVICE,
      'data-documents': {
        guidance: ['Store each document as a record in an object store, keyed by a generated id.'],
        checks: ['A saved document reopens intact.'],
      },
      'data-queryable': {
        guidance: ['Define object stores and indexes for the fields you query by; raise the database version to migrate.'],
        checks: [
          'Queries by indexed fields return correct results.',
          'A database version upgrade keeps existing records.',
        ],
      },
      'recovery-export': {
        guidance: ['Provide export to a downloadable file and import from such a file.'],
        checks: ['An exported file can be imported and restores the data.'],
      },
    },
  },
  {
    id: 'cfg-universal-session',
    name: 'Expo universal (mobile + web) · session state',
    summary: 'One Expo codebase targeting mobile and web, holding state in memory while in use.',
    satisfies: ['target-mobile', 'target-web', 'state-session', 'data-local-device'],
    prerequisites: BOTH,
    defaults: [
      'Expo (React Native) with Expo Router and web support, as created by the default Expo template.',
      'TypeScript in strict mode.',
    ],
    tradeoffs: ['One codebase reaches both targets; platform-specific behaviour must be checked on each.'],
    limits: [
      'Nothing is kept after the app closes or the page reloads.',
      'Mobile and web run the same code but share no data with each other.',
    ],
    setup: [...EXPO_SETUP, 'Confirm the starter app also runs in a browser (`npx expo start --web`).'],
    starterLayout: [
      'app/              screens and navigation (Expo Router), shared by mobile and web',
      'src/components/   reusable UI',
      'src/state/        in-memory state holders',
      'assets/           images and fonts',
    ],
    conventions: [...TS_CONVENTIONS, 'Platform-specific code only in `*.web.tsx` / `*.native.tsx` files.'],
    sequence: [SEQUENCE_PREFIX, 'Create the in-memory state holders in `src/state/`.', ...SEQUENCE_SUFFIX],
    guidance: ['Verify that every component used has a web equivalent.'],
    checks: ['The app launches on a mobile device and in a browser from the same codebase.'],
    provisions: {
      'target-mobile': TARGET_MOBILE,
      'target-web': TARGET_WEB,
      'state-session': {
        guidance: [
          'Hold working state in memory; persist nothing on either target.',
          'Make loss-on-close (and loss-on-reload on web) explicit wherever losing work would surprise someone.',
        ],
        checks: ['Closing the app, or reloading the page, starts from a clean state on both targets.'],
      },
      'data-local-device': DATA_LOCAL_DEVICE,
    },
  },
];
