export { emberTransition, canTransition, validEvents } from './ember-machine';
export { TIMING, THRESHOLDS, PROGRESS } from './constants';
export type {
  EmberState,
  EmberEvent,
  EmberNode,
  EmberCollection,
  EmberDocument,
  EmberDocumentMetadata,
} from './types';

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
