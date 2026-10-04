// ─────────────────────────────────────────────
// Ember File Storage — SQLite Backend
//
// Replaces Markdown file persistence with relational storage.
//
// EmberSeed is stored in the `embers` table.
// `loadEmberMarkdown()` generates markdown from the structured data
// using the existing serializeEmberMarkdown() — the Ember View
// still renders this markdown directly.
//
// The `ember-markdown.ts` module is preserved for serialization.
// ─────────────────────────────────────────────

import type { EmberSeed, EmberSource } from '@/core/ember-types';
import { serializeEmberMarkdown } from './ember-markdown';
import { getDatabase } from './database';

// ── Save ──

export function saveEmber(seed: EmberSeed): string {
  const db = getDatabase();

  const updated: EmberSeed = {
    ...seed,
    updatedAt: new Date().toISOString(),
  };

  // IMPORTANT: Use INSERT ... ON CONFLICT DO UPDATE (upsert) rather than
  // INSERT OR REPLACE. REPLACE performs DELETE + INSERT, which with
  // ON DELETE CASCADE on inquiries.ember_id would destroy the inquiry
  // and all its answers when merely editing an Ember.
  db.runSync(
    `INSERT INTO embers
     (id, nature, name, spark_text, carried_sentence, questions, sources, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       nature = excluded.nature,
       name = excluded.name,
       spark_text = excluded.spark_text,
       carried_sentence = excluded.carried_sentence,
       questions = excluded.questions,
       sources = excluded.sources,
       updated_at = excluded.updated_at`,
    updated.id,
    updated.nature,
    updated.name ?? null,
    updated.spark ?? null,
    updated.carriedSentence ?? null,
    JSON.stringify(updated.questions),
    JSON.stringify(updated.sources),
    updated.createdAt,
    updated.updatedAt,
  );

  if (__DEV__) {
    console.log(`🔥 [Ember] Saved: ${updated.id}`);
  }

  return updated.id;
}

// ── Load ──

export function loadEmber(id: string): EmberSeed | null {
  const db = getDatabase();

  const row = db.getFirstSync<EmberRow>(
    `SELECT * FROM embers WHERE id = ?`,
    id,
  );

  if (!row) return null;
  return rowToEmberSeed(row);
}

// ── Load as Markdown (for Ember View display) ──

export function loadEmberMarkdown(id: string): string | null {
  const seed = loadEmber(id);
  if (!seed) return null;
  return serializeEmberMarkdown(seed);
}

// ── List ──

export function listEmbers(): EmberSeed[] {
  const db = getDatabase();

  const rows = db.getAllSync<EmberRow>(
    `SELECT * FROM embers ORDER BY updated_at DESC`,
  );

  return rows.map(rowToEmberSeed);
}

// ── Delete ──

export function deleteEmber(id: string): void {
  const db = getDatabase();
  // V2 schema has ON DELETE CASCADE for both spark_participations and inquiries,
  // but explicit cleanup provides safety for any edge cases
  db.runSync(`DELETE FROM spark_participations WHERE ember_id = ?`, id);
  db.runSync(`DELETE FROM embers WHERE id = ?`, id);

  if (__DEV__) {
    console.log(`🔥 [Ember] Deleted: ${id}`);
  }
}

// ── Helpers ──

interface EmberRow {
  id: string;
  nature: string;
  name: string | null;
  spark_text: string | null;
  carried_sentence: string | null;
  questions: string;
  sources: string;
  created_at: string;
  updated_at: string;
}

function rowToEmberSeed(row: EmberRow): EmberSeed {
  let questions: string[] = [];
  try {
    questions = JSON.parse(row.questions);
  } catch { /* empty */ }

  let sources: EmberSource[] = [];
  try {
    sources = JSON.parse(row.sources);
  } catch { /* empty */ }

  return {
    id: row.id,
    nature: row.nature as EmberSeed['nature'],
    name: row.name ?? undefined,
    spark: row.spark_text ?? undefined,
    questions,
    carriedSentence: row.carried_sentence ?? undefined,
    sources,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
