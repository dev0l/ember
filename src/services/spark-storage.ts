// ─────────────────────────────────────────────
// Spark Storage — SQLite Backend
//
// Replaces JSON file persistence with relational storage.
//
// Spark.status is DERIVED from spark_participations:
//   zero participations → 'lingering'
//   one+ participations → 'ember-associated'
//
// Spark.emberId is DERIVED from the first participation.
// (Application currently constrains to max one participation.)
//
// The Spark type interface is preserved exactly for callers.
// ─────────────────────────────────────────────

import type { Spark } from '@/core/spark-types';
import { getDatabase } from './database';

// ── Save / Upsert ──

export function saveSpark(spark: Spark): void {
  const db = getDatabase();

  db.runSync(
    `INSERT OR REPLACE INTO sparks (id, title, content, input_type, audio_uri, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    spark.id,
    spark.title,
    spark.content,
    spark.inputType,
    spark.audioUri ?? null,
    spark.createdAt,
  );

  // If the caller passes emberId (e.g. from old handleRemove releasing sparks),
  // and it's being set to undefined/lingering, clear participations
  if (spark.status === 'lingering' || !spark.emberId) {
    db.runSync(
      `DELETE FROM spark_participations WHERE spark_id = ?`,
      spark.id,
    );
  }
}

// ── Load ──

export function loadSpark(id: string): Spark | null {
  const db = getDatabase();

  const row = db.getFirstSync<{
    id: string;
    title: string;
    content: string;
    input_type: string;
    audio_uri: string | null;
    created_at: string;
  }>(
    `SELECT * FROM sparks WHERE id = ?`,
    id,
  );

  if (!row) return null;

  // Derive participation
  const participation = db.getFirstSync<{ ember_id: string }>(
    `SELECT ember_id FROM spark_participations WHERE spark_id = ? LIMIT 1`,
    id,
  );

  return rowToSpark(row, participation?.ember_id ?? undefined);
}

// ── List ──

export function listSparks(
  status?: Spark['status'],
): Spark[] {
  const db = getDatabase();

  // Get all sparks with their participation (LEFT JOIN)
  const rows = db.getAllSync<{
    id: string;
    title: string;
    content: string;
    input_type: string;
    audio_uri: string | null;
    created_at: string;
    ember_id: string | null;
  }>(
    `SELECT s.*, sp.ember_id
     FROM sparks s
     LEFT JOIN spark_participations sp ON s.id = sp.spark_id
     ORDER BY s.created_at DESC`,
  );

  const sparks: Spark[] = [];
  for (const row of rows) {
    const derivedStatus = row.ember_id ? 'ember-associated' : 'lingering';
    if (!status || derivedStatus === status) {
      sparks.push(rowToSpark(row, row.ember_id ?? undefined));
    }
  }

  return sparks;
}

// ── Delete ──

export function deleteSpark(id: string): void {
  const db = getDatabase();
  // CASCADE will remove spark_participations rows
  db.runSync(`DELETE FROM sparks WHERE id = ?`, id);
}

// ── Associate Sparks with Ember ──

export function associateSparksWithEmber(
  sparkIds: string[],
  emberId: string,
): void {
  const db = getDatabase();
  const now = new Date().toISOString();

  for (const sparkId of sparkIds) {
    // Application constraint: one participation per spark (for now).
    // INSERT OR IGNORE prevents duplicates if already participating.
    db.runSync(
      `INSERT OR IGNORE INTO spark_participations (spark_id, ember_id, established_at)
       VALUES (?, ?, ?)`,
      sparkId,
      emberId,
      now,
    );
  }
}

// ── Helpers ──

function rowToSpark(
  row: {
    id: string;
    title: string;
    content: string;
    input_type: string;
    audio_uri: string | null;
    created_at: string;
  },
  emberId?: string,
): Spark {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    inputType: row.input_type as Spark['inputType'],
    audioUri: row.audio_uri ?? undefined,
    status: emberId ? 'ember-associated' : 'lingering',
    emberId,
    createdAt: row.created_at,
  };
}
