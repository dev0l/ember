// ─────────────────────────────────────────────
// Inquiry Engine — public surface
//
// Phase 1: pure semantic engine. Not yet wired to UI or persistence.
// ─────────────────────────────────────────────

export type * from './types.ts';
export { INQUIRY_LIBRARY_VERSION, INQUIRY_QUESTIONS } from './questions.ts';
export { CONFIGURATIONS, CONDITION_CAPABILITIES, CAPABILITY_LABELS } from './configurations.ts';
export { fingerprint, stableStringify } from './fingerprint.ts';
export {
  DEFAULT_LIBRARY,
  DESIGN_PACK_CONSEQUENCE,
  evaluateInquiry,
  testApplicability,
  nextQuestion,
  chooseDesignPack,
  adoptConfiguration,
  confirmReview,
  designPackStaleness,
} from './evaluate.ts';
export type { InquiryLibrary } from './evaluate.ts';
export { assessHandoffContent, HANDOFF_NOT_ASSESSED } from './handoff.ts';
export {
  generateDesignPack,
  DESIGN_PACK_GENERATOR,
} from './generate.ts';
export type {
  DesignPackSubject,
  EngineDesignPackProvenance,
  DesignPackGeneration,
} from './generate.ts';
