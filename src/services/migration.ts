// ─────────────────────────────────────────────
// Data Migration — JSON/Markdown → SQLite
//
// Reads existing file-based persisted data and imports
// it into the SQLite database. Non-destructive:
// old files remain on disk after migration.
//
// Runs once on first launch after the database is introduced.
// ─────────────────────────────────────────────

import { Paths, File, Directory } from 'expo-file-system';
import type { Spark } from '@/core/spark-types';
import type { EmberProject } from '@/core/ember-project-types';
import { parseEmberMarkdown } from './ember-markdown';
import { getDatabase } from './database';
import { backfillDesignPackRecords } from './ember-project-storage';

const SPARKS_DIR = new Directory(Paths.document, 'sparks');
const EMBERS_DIR = new Directory(Paths.document, 'embers');
const PROJECTS_DIR = new Directory(Paths.document, 'ember-projects');

const V1_FILE_TO_SQLITE = 'v1_file_to_sqlite';
const V3_DESIGN_PACK_BACKFILL = 'v3_design_pack_backfill';

function isMigrationDone(key: string): boolean {
  const db = getDatabase();
  return !!db.getFirstSync<{ key: string }>(
    `SELECT key FROM _migration WHERE key = ?`,
    key,
  );
}

function markMigrationDone(key: string): void {
  getDatabase().runSync(
    `INSERT OR IGNORE INTO _migration (key, completed_at) VALUES (?, ?)`,
    key,
    new Date().toISOString(),
  );
}

/**
 * Run pending data migrations, each independently keyed in `_migration`.
 * Idempotent: completed steps are skipped.
 *
 * Order matters: the v3 backfill needs Inquiries to exist, so it runs after
 * the v1 file → SQLite import (on a fresh install with legacy files, both
 * run in this same call).
 */
export function migrateIfNeeded(): void {
  const db = getDatabase();

  db.execSync(`
    CREATE TABLE IF NOT EXISTS _migration (
      key TEXT PRIMARY KEY NOT NULL,
      completed_at TEXT NOT NULL
    );
  `);

  if (!isMigrationDone(V1_FILE_TO_SQLITE)) {
    migrateFilesToSqlite();
  }

  if (!isMigrationDone(V3_DESIGN_PACK_BACKFILL)) {
    const inserted = backfillDesignPackRecords();
    markMigrationDone(V3_DESIGN_PACK_BACKFILL);
    if (__DEV__) {
      console.log(
        `🔥 [Migration] Design Pack backfill: ${inserted} existing file(s) recorded as provenance 'unknown'`,
      );
    }
  }
}

/**
 * v1: Migrate existing file-based data to SQLite.
 */
function migrateFilesToSqlite(): void {
  const db = getDatabase();

  if (__DEV__) {
    console.log('🔥 [Migration] Starting file → SQLite migration...');
  }

  let sparkCount = 0;
  let emberCount = 0;
  let projectCount = 0;

  // ── Import order matters ──
  // getDatabase() has already applied schema v1 and v2, so
  // spark_participations.ember_id and inquiries.ember_id reference embers(id)
  // with FK enforcement ON. Embers must therefore be imported BEFORE Sparks
  // (whose participations reference Embers) and BEFORE Inquiries.
  // Previously Sparks ran first, so participation inserts for not-yet-imported
  // Embers failed and were silently swallowed by the per-file catch.

  // ── Migrate Embers ──
  if (EMBERS_DIR.exists) {
    try {
      const entries = EMBERS_DIR.list();
      for (const entry of entries) {
        if (entry instanceof File && entry.name.endsWith('.md')) {
          try {
            const markdown = entry.textSync();
            const seed = parseEmberMarkdown(markdown);

            db.runSync(
              `INSERT OR IGNORE INTO embers
               (id, nature, name, spark_text, carried_sentence, questions, sources, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              seed.id,
              seed.nature,
              seed.name ?? null,
              seed.spark ?? null,
              seed.carriedSentence ?? null,
              JSON.stringify(seed.questions),
              JSON.stringify(seed.sources),
              seed.createdAt,
              seed.updatedAt,
            );

            emberCount++;
          } catch {
            // Skip invalid files
          }
        }
      }
    } catch {
      // Directory read error
    }
  }

  // ── Migrate Sparks (after Embers — participations reference embers) ──
  if (SPARKS_DIR.exists) {
    try {
      const entries = SPARKS_DIR.list();
      for (const entry of entries) {
        if (entry instanceof File && entry.name.endsWith('.json')) {
          try {
            const spark = JSON.parse(entry.textSync()) as Spark;
            db.runSync(
              `INSERT OR IGNORE INTO sparks (id, title, content, input_type, audio_uri, created_at)
               VALUES (?, ?, ?, ?, ?, ?)`,
              spark.id,
              spark.title,
              spark.content,
              spark.inputType,
              spark.audioUri ?? null,
              spark.createdAt,
            );

            // If the spark was associated with an ember, create a participation row
            if (spark.status === 'ember-associated' && spark.emberId) {
              db.runSync(
                `INSERT OR IGNORE INTO spark_participations (spark_id, ember_id, established_at)
                 VALUES (?, ?, ?)`,
                spark.id,
                spark.emberId,
                spark.createdAt, // Best available timestamp
              );
            }

            sparkCount++;
          } catch {
            // Skip invalid files
          }
        }
      }
    } catch {
      // Directory read error
    }
  }

  // ── Migrate Projects ──
  if (PROJECTS_DIR.exists) {
    try {
      const entries = PROJECTS_DIR.list();
      for (const entry of entries) {
        if (entry instanceof File && entry.name.endsWith('.json')) {
          try {
            const project = JSON.parse(entry.textSync()) as EmberProject;

            db.runSync(
              `INSERT OR IGNORE INTO inquiries
               (id, ember_id, name, original_material, open_questions, design_pack_version, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              project.id,
              project.seedId ?? null,
              project.name,
              project.originalMaterial,
              JSON.stringify(project.openQuestions),
              project.designPackVersion,
              project.createdAt,
              project.updatedAt,
            );

            // Migrate answers
            for (let i = 0; i < project.answers.length; i++) {
              const a = project.answers[i];
              db.runSync(
                `INSERT OR IGNORE INTO inquiry_answers
                 (inquiry_id, question_id, dimension_id, raw_response, value, sequence, answered_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                project.id,
                a.questionId,
                a.dimensionId,
                a.rawResponse,
                a.value,
                i,
                a.answeredAt,
              );
            }

            projectCount++;
          } catch {
            // Skip invalid files
          }
        }
      }
    } catch {
      // Directory read error
    }
  }

  // Mark migration complete
  markMigrationDone(V1_FILE_TO_SQLITE);

  if (__DEV__) {
    console.log(
      `🔥 [Migration] Complete: ${sparkCount} sparks, ${emberCount} embers, ${projectCount} projects`,
    );
  }
}
