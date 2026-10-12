// Services barrel
export {
  serializeEmberMarkdown,
  parseEmberMarkdown,
} from './ember-markdown';

export {
  saveEmber,
  loadEmber,
  loadEmberMarkdown,
  listEmbers,
  deleteEmber,
} from './ember-storage';

// Spark storage
export {
  saveSpark,
  loadSpark,
  listSparks,
  deleteSpark,
  associateSparksWithEmber,
} from './spark-storage';

// Ember Project storage
export {
  saveProject,
  loadProject,
  loadProjectByEmberId,
  listProjects,
  deleteProject,
  saveDesignPack,
  loadDesignPack,
  loadLatestDesignPack,
  loadDesignPackRecords,
  loadDesignPackRecord,
  LEGACY_GENERATOR,
} from './ember-project-storage';
export type {
  DesignPackProvenance,
  DesignPackOrigin,
  DesignPackRecord,
} from './ember-project-storage';

// Inquiry decisions and answers (schema v3, engine authority)
export {
  recordDecision,
  loadDecisions,
  saveAnswer,
  loadAnswers,
  loadInquiryEvidence,
  ensureInquiryForEmber,
  loadInquiryRow,
} from './inquiry-storage';
