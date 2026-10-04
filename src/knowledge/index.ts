// ─────────────────────────────────────────────
// Knowledge barrel export
// ─────────────────────────────────────────────
export { DIMENSIONS } from './dimensions';
export type { Dimension } from './dimensions';

export {
  QUESTION_LIBRARY,
  getFoundationalQuestions,
  getAvailableExploratoryQuestions,
} from './questions';
export type { AuthoredQuestion, QuestionChoice } from './questions';

export {
  PROPOSITION_LIBRARY,
  evaluatePropositions,
} from './propositions';
export type { AuthoredProposition } from './propositions';

export { DESIGN_PACK_SECTIONS } from './design-pack-schema';
export type { DesignPackSection } from './design-pack-schema';
