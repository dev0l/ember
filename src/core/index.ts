// Ember initiation model
export {
  EMBER_NATURE_LABELS,
  EMBER_NATURE_HINTS,
  createEmberSeed,
} from './ember-types';
export type {
  EmberNature,
  EmberSource,
  EmberSeed,
} from './ember-types';

// Ember bridge: initiation → enquiry crossing
export { emberSeedToProject } from './ember-bridge';

// Spark model
export { createTextSpark } from './spark-types';
export type { Spark, SparkStatus, SparkInputType } from './spark-types';

// Ember Project model
export { createEmberProject } from './ember-project-types';
export type {
  EmberProject,
  EmberProjectStatus,
  EmberAnswer,
  EstablishedCondition,
  ActivatedProposition,
  ConfidenceLevel,
} from './ember-project-types';

// Ember Lifecycle & Completion Assembly
export {
  buildEmberOriginalMaterial,
  describeEmberDeletionSummary,
  buildEmberCompletionRecord,
} from './ember-completion';
export type {
  EmberDeletionSummaryInput,
  EmberDeletionSummary,
  EmberCompletionInput,
} from './ember-completion';

// Privacy Policy contract & structured content
export {
  PRIVACY_POLICY_URL,
  PRIVACY_POLICY_CONTACT_EMAIL,
  PRIVACY_POLICY_EFFECTIVE_DATE,
  PRIVACY_POLICY_APP_VERSION,
  PRIVACY_POLICY_PACKAGE_ID,
  PRIVACY_POLICY_DEVELOPER,
  PRIVACY_POLICY_HIGHLIGHTS,
  PRIVACY_POLICY_SECTIONS,
} from './privacy-policy';
export type {
  PrivacyPolicyHighlight,
  PrivacyPolicySection,
} from './privacy-policy';
