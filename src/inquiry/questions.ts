// ─────────────────────────────────────────────
// Inquiry Engine — Authored Questionnaire (library v1)
//
// The bounded D1 questionnaire for software-product/project construction.
// NOT a universal Inquiry taxonomy.
//
// Explore:  purpose · audience/context · important-to-preserve · uncertainty
// Develop:  initial reach · platform · persistence · data location/sharing ·
//           [data shape] · external dependencies · connectivity · accounts ·
//           [access] · [recovery] · binding technical constraints
//           ([...] = conditional; appears only when applicable)
//
// Lineage rule: question ids and choice values are preserved from the
// previous library ONLY where the authored meaning is unchanged. Where
// meaning changed, a new id or value is used, so older evidence becomes
// prior material instead of silently regaining authority.
// ─────────────────────────────────────────────

import type { InquiryQuestion } from './types.ts';

export const INQUIRY_LIBRARY_VERSION = 'inquiry-library@1';

export const INQUIRY_QUESTIONS: InquiryQuestion[] = [
  // ── Explore ────────────────────────────────

  {
    id: 'q-purpose', // preserved
    movement: 'explore',
    role: 'required',
    text: 'What are you hoping this makes possible?',
    answerType: 'text',
    placeholder: 'Describe what you imagine this enabling...',
    establishesOnText: ['purpose-established'],
  },
  {
    id: 'q-audience', // preserved
    movement: 'explore',
    role: 'required',
    text: 'Who or what is it for?',
    answerType: 'text',
    placeholder: 'Who would use this? Just you, a group, everyone?',
    establishesOnText: ['audience-established'],
  },
  {
    id: 'q-important-to-preserve', // preserved
    movement: 'explore',
    role: 'optional',
    text: 'What already feels important to preserve?',
    answerType: 'text',
    placeholder: 'Any constraints, values, or non-negotiables...',
  },
  {
    id: 'q-uncertainty', // preserved
    movement: 'explore',
    role: 'optional',
    text: 'What are you most uncertain about?',
    answerType: 'text',
    placeholder: 'What feels unclear or risky...',
  },

  // ── Develop Design Pack ────────────────────

  {
    // New id: "scale" mixed audience breadth with load. Reach is narrower.
    id: 'q-reach',
    movement: 'develop',
    role: 'required',
    text: 'Who is the first release intended to reach?',
    answerType: 'choice',
    choices: [
      { label: 'Just me', value: 'personal', disposition: 'decided', establishes: ['reach-personal'] },
      { label: 'A known group', value: 'group', disposition: 'decided', establishes: ['reach-group'] },
      { label: 'The public', value: 'public', disposition: 'decided', establishes: ['reach-public'] },
      { label: 'Not sure yet', value: 'unresolved', disposition: 'unresolved', establishes: [] },
    ],
  },
  {
    id: 'q-platform', // preserved (values unchanged in meaning)
    movement: 'develop',
    role: 'required',
    text: 'Where should the first version be usable?',
    answerType: 'choice',
    choices: [
      { label: 'Mobile app (phone/tablet)', value: 'mobile', disposition: 'decided', establishes: ['platform-mobile'] },
      { label: 'Web application (browser)', value: 'web', disposition: 'decided', establishes: ['platform-web'] },
      { label: 'Both mobile and web', value: 'both', disposition: 'decided', establishes: ['platform-mobile', 'platform-web'] },
      { label: 'Not sure yet', value: 'uncertain', disposition: 'unresolved', establishes: [] },
    ],
  },
  {
    id: 'q-persistence', // preserved (yes/no/uncertain unchanged in meaning)
    movement: 'develop',
    role: 'required',
    text: 'Does information need to remain available after the app closes?',
    answerType: 'choice',
    choices: [
      { label: 'Yes — data must survive closing the app', value: 'yes', disposition: 'decided', establishes: ['durable-data-required'] },
      { label: 'No — it only needs to last while in use', value: 'no', disposition: 'decided', establishes: ['session-data-only'] },
      { label: 'Not sure yet', value: 'uncertain', disposition: 'unresolved', establishes: [] },
    ],
  },
  {
    id: 'q-data-location', // new
    movement: 'develop',
    role: 'required',
    text: 'Who needs to see the same information?',
    answerType: 'choice',
    choices: [
      { label: 'Only on the device or browser where it is created', value: 'device', disposition: 'decided', establishes: ['device-independent-data'] },
      { label: 'The same person across several devices', value: 'cross-device', disposition: 'decided', establishes: ['cross-device-data'] },
      { label: 'Several people, shared between them', value: 'shared', disposition: 'decided', establishes: ['shared-data'] },
      { label: 'Not sure yet', value: 'unresolved', disposition: 'unresolved', establishes: [] },
    ],
  },
  {
    id: 'q-data-shape', // new, conditional
    movement: 'develop',
    role: 'required',
    text: 'Is it independent documents, or related records you need to search or query across?',
    answerType: 'choice',
    applicableWhen: { condition: 'durable-data-required' },
    choices: [
      { label: 'Independent documents', value: 'documents', disposition: 'decided', establishes: ['document-oriented-data'] },
      { label: 'Related records that need searching or querying', value: 'records', disposition: 'decided', establishes: ['queryable-records'] },
      { label: 'A mix of both', value: 'mixed', disposition: 'decided', establishes: ['document-oriented-data', 'queryable-records'] },
      { label: 'Not sure yet', value: 'unresolved', disposition: 'unresolved', establishes: [] },
    ],
  },
  {
    id: 'q-external-deps', // new
    movement: 'develop',
    role: 'required',
    text: 'Does the first usable version depend on any outside service to work?',
    answerType: 'choice',
    choices: [
      { label: 'No — it is self-contained', value: 'none', disposition: 'decided', establishes: ['self-contained-outcome'] },
      { label: 'Yes — it needs a named service', value: 'named', disposition: 'decided', establishes: ['external-service-required'], requiresSpecification: true },
      { label: 'Not sure yet', value: 'unresolved', disposition: 'unresolved', establishes: [] },
    ],
  },
  {
    id: 'q-offline', // preserved id; 'partial' retired (meaning changed → 'subset')
    movement: 'develop',
    role: 'required',
    text: 'Should it work without an internet connection?',
    answerType: 'choice',
    choices: [
      { label: 'Yes — the whole first version must work offline', value: 'yes', disposition: 'decided', establishes: ['offline-outcome-required'] },
      { label: 'Specific actions must work offline', value: 'subset', disposition: 'decided', establishes: ['offline-actions-required'], requiresSpecification: true },
      { label: 'No — an internet connection is expected', value: 'no', disposition: 'excluded', establishes: ['offline-out-of-scope'] },
      { label: 'Not sure yet', value: 'unresolved', disposition: 'unresolved', establishes: [] },
    ],
  },
  {
    id: 'q-accounts', // preserved (none/required/deferred unchanged in meaning)
    movement: 'develop',
    role: 'required',
    text: 'Do people need accounts or login in this version?',
    answerType: 'choice',
    choices: [
      { label: 'No accounts needed', value: 'none', disposition: 'decided', establishes: ['no-auth-this-version'] },
      { label: 'Yes — people need to sign in', value: 'required', disposition: 'decided', establishes: ['auth-required'] },
      { label: 'Not in this version, maybe later', value: 'deferred', disposition: 'excluded', establishes: ['no-auth-this-version', 'accounts-future'] },
      { label: 'Not sure yet', value: 'unresolved', disposition: 'unresolved', establishes: [] },
    ],
  },
  {
    id: 'q-access', // new, conditional
    movement: 'develop',
    role: 'required',
    text: 'Who may see or change whose information?',
    answerType: 'choice',
    applicableWhen: { condition: 'auth-required' },
    choices: [
      { label: 'Each person only their own private information', value: 'private', disposition: 'decided', establishes: ['access-private'] },
      { label: 'A group shares information', value: 'group', disposition: 'decided', establishes: ['access-group'] },
      { label: 'Anyone can view; only some can change', value: 'public-read', disposition: 'decided', establishes: ['access-public-read'] },
      { label: 'Something else', value: 'other', disposition: 'decided', establishes: ['access-other'], requiresSpecification: true },
      { label: 'Not sure yet', value: 'unresolved', disposition: 'unresolved', establishes: [] },
    ],
  },
  {
    id: 'q-recovery', // new, conditional
    movement: 'develop',
    role: 'required',
    text: 'If the device or browser data were lost, would that matter?',
    answerType: 'choice',
    applicableWhen: { condition: 'durable-data-required' },
    choices: [
      { label: 'No — it can be re-created or is disposable', value: 'disposable', disposition: 'decided', establishes: ['recovery-not-needed'] },
      { label: 'Yes — a recoverable copy is needed', value: 'recoverable', disposition: 'decided', establishes: ['recovery-required'] },
      { label: 'Not sure yet', value: 'unresolved', disposition: 'unresolved', establishes: [] },
    ],
  },
  {
    id: 'q-constraints', // new
    movement: 'develop',
    role: 'required',
    text: 'Is any existing platform, service or technical requirement binding for this version?',
    answerType: 'choice',
    choices: [
      { label: 'No binding requirements', value: 'none', disposition: 'decided', establishes: ['constraints-none'] },
      { label: 'Yes — there are binding requirements', value: 'present', disposition: 'decided', establishes: ['constraints-present'], requiresSpecification: true },
      { label: 'Not sure yet', value: 'unresolved', disposition: 'unresolved', establishes: [] },
    ],
  },
];
