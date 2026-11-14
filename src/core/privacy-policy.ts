// ─────────────────────────────────────────────
// Ember Privacy Policy — Canonical Contract & Structured Content
//
// Single source of truth for the in-app Privacy Policy modal
// and external web policy alignment (https://www.dev0l.com/ember/privacy/).
// ─────────────────────────────────────────────

export const PRIVACY_POLICY_URL = 'https://www.dev0l.com/ember/privacy/';
export const PRIVACY_POLICY_CONTACT_EMAIL = 'marcus.mobark@gmail.com';
export const PRIVACY_POLICY_EFFECTIVE_DATE = 'November 14, 2026';
export const PRIVACY_POLICY_APP_VERSION = '0.1.0';
export const PRIVACY_POLICY_PACKAGE_ID = 'com.dev0l.ember';
export const PRIVACY_POLICY_DEVELOPER = 'dev0l';

export interface PrivacyPolicyHighlight {
  label: string;
  detail: string;
}

export interface PrivacyPolicySection {
  id: string;
  number: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
}

export const PRIVACY_POLICY_HIGHLIGHTS: readonly PrivacyPolicyHighlight[] = [
  {
    label: '100% On-Device Storage',
    detail:
      'Every Spark, Ember, Inquiry answer, and Design Pack lives exclusively in local SQLite and app-private storage on your device.',
  },
  {
    label: 'Zero Off-Device Transmission',
    detail:
      'Ember never transmits your creative material, personal information, or usage behavior to dev0l or any third-party server.',
  },
  {
    label: 'No Accounts, Ads, or Trackers',
    detail:
      'No sign-up, no analytics SDKs, no crash-reporting telemetry, and no advertising identifiers.',
  },
] as const;

export const PRIVACY_POLICY_SECTIONS: readonly PrivacyPolicySection[] = [
  {
    id: 'overview',
    number: '01',
    title: 'Overview & Core Privacy Posture',
    paragraphs: [
      'Ember (package ID: com.dev0l.ember), developed and published by dev0l, is built as a quiet, local-first creative instrument for catching fleeting Sparks and tending them into structured Embers and Design Packs.',
      'Your creative thoughts and architectural enquiries belong solely to you. Ember operates entirely offline on your device. Neither Ember nor any included software library collects, transmits, sells, or shares your personal data or creative content off your device.',
    ],
  },
  {
    id: 'on-device-data',
    number: '02',
    title: 'Information Stored Exclusively On Your Device',
    paragraphs: [
      'All content you create or import inside Ember is persisted exclusively within your device’s private, sandboxed application storage:',
    ],
    bullets: [
      'Sparks & Embers (Local SQLite Database — ember.db): Text of lingering and participating Sparks, Ember titles, carried sentences, questions, sources, and timestamps.',
      'Inquiry Evidence & Design Packs (Local SQLite & App-Private Files): Your answers to Explore and Develop questions, adopted technical configurations, unresolved notes, and generated Design Pack documents (.md).',
      'User-Initiated Local File Imports: When you explicitly choose to import a Markdown (.md) or text (.txt) file using Android’s system document picker (ACTION_OPEN_DOCUMENT), Ember reads only the file you select, stores the imported Ember locally on your device, and never uploads the file anywhere.',
      'Ephemeral In-Memory Drafts: Uncommitted text or option selections while exploring a question are held temporarily in local application memory and cleared when committed, cancelled, or when the app closes.',
    ],
  },
  {
    id: 'no-collection',
    number: '03',
    title: 'Information We Do Not Collect or Share',
    paragraphs: [
      'In accordance with Google Play’s Data Safety standards and international privacy frameworks (including GDPR and CCPA), dev0l declares that Ember does not collect, transmit off-device, or share with third parties any of the following:',
    ],
    bullets: [
      'Personal identifiers (name, email address, phone number, account credentials, or billing data).',
      'User-generated content (Sparks, Embers, Inquiry responses, or Design Packs).',
      'Analytics, telemetry, interaction logs, or crash diagnostics (no Firebase, Sentry, Amplitude, or third-party tracking SDKs are included).',
      'Device identifiers, advertising IDs, IP addresses, or precise/coarse geolocation data.',
    ],
  },
  {
    id: 'permissions',
    number: '04',
    title: 'Device Permissions & Technical Transparency',
    paragraphs: [
      'Ember requests only the minimum technical capabilities required by the local runtime:',
    ],
    bullets: [
      'VIBRATE: Used locally to provide subtle tactile feedback when interacting with mechanical plates and actions.',
      'READ_EXTERNAL_STORAGE / WRITE_EXTERNAL_STORAGE (Android 12 / API 32 and below only): Scoped legacy file-system declarations included by the local file module; on modern Android versions, file imports use the system Storage Access Framework without broad storage permissions.',
      'INTERNET / ACCESS_NETWORK_STATE: Standard Android manifest declarations inherited from the React Native / Expo runtime foundation. Ember’s production release performs zero remote network requests, over-the-air update checks (expo-updates is disabled), or background transmissions.',
    ],
  },
  {
    id: 'retention-deletion',
    number: '05',
    title: 'Data Retention, Deletion & Your Control',
    paragraphs: [
      'Because all data resides locally on your device, you hold complete and immediate sovereignty over its retention and deletion:',
    ],
    bullets: [
      'In-App Deletion: You can delete any individual Spark or Ember directly within the application at any time.',
      'Complete Erasure: Clearing Ember’s application storage in your Android system settings or uninstalling Ember permanently erases the local SQLite database (ember.db) and all app-private files from your device.',
      'No Server Copies to Request or Purge: Because dev0l never receives or stores your data on any external server, no off-device copies exist.',
    ],
  },
  {
    id: 'system-backup',
    number: '06',
    title: 'Android Operating System Auto-Backup',
    paragraphs: [
      'Ember uses Android’s standard application configuration (allowBackup="true"), which allows your device’s operating system to include app data in your personal Android / Google Drive device backup if you have system backups enabled on your phone.',
      'Any such backup is managed entirely between your device and your personal Google account under Google’s own privacy terms. dev0l has no access to, and cannot read or retrieve, your operating system backups.',
    ],
  },
  {
    id: 'children',
    number: '07',
    title: 'Children’s Privacy',
    paragraphs: [
      'Ember does not knowingly collect personal information from anyone, including children under the age of 13 (or the applicable age of digital consent in your jurisdiction). Because the application functions entirely offline without data collection or user accounts, no child’s personal data is ever transmitted to dev0l.',
    ],
  },
  {
    id: 'updates',
    number: '08',
    title: 'Changes to This Privacy Policy',
    paragraphs: [
      'If future versions of Ember introduce optional features that affect how data is handled, this Privacy Policy will be updated prior to release and the "Effective Date" will be revised accordingly. The canonical online version is always accessible at https://www.dev0l.com/ember/privacy/.',
    ],
  },
  {
    id: 'contact',
    number: '09',
    title: 'Contact Information',
    paragraphs: [
      `If you have any questions, concerns, or technical inquiries regarding this Privacy Policy or Ember’s local-first architecture, please contact the developer (${PRIVACY_POLICY_DEVELOPER}) at:`,
      PRIVACY_POLICY_CONTACT_EMAIL,
    ],
  },
] as const;
