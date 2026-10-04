// ─────────────────────────────────────────────
// Ember Bridge
//
// What happens when initiation crosses into enquiry?
//
// This function carries material from an EmberSeed
// (created through the warm initiation flow) into an
// EmberProject (the structured enquiry system).
//
// Each field mapping is an explicit decision.
// Where something transfers cleanly, we say so.
// Where something is lost or transformed, we name it.
// Where a question emerges, we preserve the question.
//
// "Build something, and allow the building to expose
//  where our philosophy is incomplete."
// ─────────────────────────────────────────────

import type { EmberSeed } from './ember-types';
import type { EmberProject } from './ember-project-types';

/**
 * Carries material from an EmberSeed into a new EmberProject.
 *
 * This is not a type conversion — it's a crossing.
 * The EmberSeed continues to exist. The EmberProject
 * begins with provenance to the seed.
 *
 * Decisions made here:
 *
 * - `name` → transfers directly. Simple.
 *
 * - `spark` → becomes `originalMaterial`. The spark is
 *   "what sparked this into existence." The original material
 *   is "content preserved from the origin." Close but not
 *   identical in meaning. We carry it anyway.
 *
 * - `questions` → become `openQuestions`. EmberSeed carries
 *   freeform question strings. EmberProject carries structured
 *   `openQuestions`. The words transfer. The structural
 *   difference is notable but not blocking.
 *
 * - `nature` → no direct equivalent in EmberProject. We include
 *   it in the original material as context rather than silently
 *   discarding it. This is a question: should EmberProject
 *   carry nature? We don't add the field — we note the gap.
 *
 * - `carriedSentence` → EmberProject has no equivalent field.
 *   We include it in the original material alongside nature.
 *   This is the most notable gap the bridge exposes.
 *   A carried sentence is compressed continuity — "what is
 *   this becoming?" The EmberProject has no place for that
 *   particular kind of knowing. Worth observing.
 *
 * - `sources` → EmberProject has no `sources` field.
 *   Source references (URIs, metadata) do not cross.
 *   This is a deliberate boundary for now — or possibly a gap.
 *   The seed retains them. The project does not inherit them.
 *
 * - Provenance: the seed's ID is carried as `seedId` on the
 *   EmberProject and also embedded as text in originalMaterial.
 *   The typed relationship now exists.
 *
 * What is lost in the crossing:
 *   - Source references (files, URIs)
 *   - The nature as a first-class field
 *   - The carried sentence as a first-class field
 *
 * What these losses might mean:
 *   They suggest that EmberProject may eventually want to carry
 *   more of what EmberSeed knows. But that's a question for after
 *   this bridge exists and has been encountered.
 */
export function emberSeedToProject(seed: EmberSeed): EmberProject {
  // ── Compose the original material ──
  // We weave context from the seed into readable text
  // rather than silently dropping fields that have no
  // EmberProject equivalent.
  const materialParts: string[] = [];

  // Provenance: where this came from
  materialParts.push(`[From Ember: ${seed.id}]`);

  // Nature: what kind of thing was beginning
  materialParts.push(`Nature: ${seed.nature}`);

  // Carried sentence: the compressed essence
  if (seed.carriedSentence) {
    materialParts.push(`Carried: "${seed.carriedSentence}"`);
  }

  // The spark itself: the initial seed material
  if (seed.spark) {
    materialParts.push('');
    materialParts.push(seed.spark);
  }

  // Source references: named but not transferred
  if (seed.sources.length > 0) {
    materialParts.push('');
    materialParts.push(
      `Sources referenced (${seed.sources.length}): ` +
        seed.sources.map((s) => s.name).join(', '),
    );
  }

  const originalMaterial = materialParts.join('\n');

  // ── Build the EmberProject ──
  const now = new Date().toISOString();
  const id = `ember-proj-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;

  return {
    id,
    seedId: seed.id,
    name: seed.name || 'Untitled Ember',
    status: 'developing',

    // No sparks were involved — this came from a seed
    sparkIds: [],

    // The seed's material, woven with context
    originalMaterial,

    // Enquiry begins empty — the seed's questions
    // transfer as open questions, not as answers
    answers: [],
    askedQuestionIds: [],
    conditions: [],
    activatedPropositions: [],

    // The seed's freeform questions carry directly
    openQuestions: [...seed.questions],

    createdAt: now,
    updatedAt: now,
    designPackVersion: 0,
  };
}
