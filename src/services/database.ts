// ─────────────────────────────────────────────
// Database — SQLite Schema & Initialization
//
// The relational representation of Ember's domain.
//
// 5 tables + 1 junction:
//   sparks, embers, spark_participations,
//   inquiries, inquiry_answers
//
// Design Packs remain as files on disk.
// Conditions are derived from answers + authored knowledge.
// Propositions are derived from conditions.
// Lifecycle status is derived from answer count + design_pack_version.
//
// "Do not let the existence of a familiar database pattern
//  settle a question runtime has not answered."
// ─────────────────────────────────────────────

import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

const DB_NAME = 'ember.db';
const SCHEMA_VERSION = 2;

let _db: SQLiteDatabase | null = null;

/**
 * Get the database instance, initializing if needed.
 * Synchronous — matches the existing storage pattern.
 */
export function getDatabase(): SQLiteDatabase {
  if (_db) return _db;

  _db = openDatabaseSync(DB_NAME);

  // Enable WAL mode for better concurrent read/write
  _db.execSync('PRAGMA journal_mode = WAL;');
  _db.execSync('PRAGMA foreign_keys = ON;');

  // Check current version
  const versionResult = _db.getFirstSync<{ user_version: number }>(
    'PRAGMA user_version;',
  );
  const currentVersion = versionResult?.user_version ?? 0;

  if (currentVersion < 1) {
    createSchema(_db);
  }

  if (currentVersion < 2) {
    migrateToV2(_db);
  }

  _db.execSync(`PRAGMA user_version = ${SCHEMA_VERSION};`);

  return _db;
}

/**
 * Create all tables. Idempotent via IF NOT EXISTS.
 */
function createSchema(db: SQLiteDatabase): void {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS sparks (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      input_type TEXT NOT NULL DEFAULT 'text',
      audio_uri TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS embers (
      id TEXT PRIMARY KEY NOT NULL,
      nature TEXT NOT NULL DEFAULT 'open',
      name TEXT,
      spark_text TEXT,
      carried_sentence TEXT,
      questions TEXT NOT NULL DEFAULT '[]',
      sources TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS spark_participations (
      spark_id TEXT NOT NULL REFERENCES sparks(id) ON DELETE CASCADE,
      ember_id TEXT NOT NULL,
      established_at TEXT NOT NULL,
      PRIMARY KEY (spark_id, ember_id)
    );

    CREATE TABLE IF NOT EXISTS inquiries (
      id TEXT PRIMARY KEY NOT NULL,
      ember_id TEXT REFERENCES embers(id),
      name TEXT NOT NULL,
      original_material TEXT NOT NULL DEFAULT '',
      open_questions TEXT NOT NULL DEFAULT '[]',
      design_pack_version INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inquiry_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inquiry_id TEXT NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
      question_id TEXT NOT NULL,
      dimension_id TEXT NOT NULL,
      raw_response TEXT NOT NULL,
      value TEXT NOT NULL,
      sequence INTEGER NOT NULL,
      answered_at TEXT NOT NULL,
      UNIQUE(inquiry_id, question_id)
    );

    CREATE INDEX IF NOT EXISTS idx_spark_participations_ember
      ON spark_participations(ember_id);

    CREATE INDEX IF NOT EXISTS idx_inquiries_ember
      ON inquiries(ember_id);

    CREATE INDEX IF NOT EXISTS idx_inquiry_answers_inquiry
      ON inquiry_answers(inquiry_id);
  `);
}

/**
 * Schema V2: FK integrity tightening.
 *
 * 1. spark_participations.ember_id → REFERENCES embers(id) ON DELETE CASCADE
 *    (was missing FK entirely — legacy from the removed isNew path)
 * 2. inquiries.ember_id → ON DELETE CASCADE
 *    (had FK but no CASCADE — deletion would throw violation)
 *
 * Also cleans orphaned spark_participations whose ember_id
 * doesn't reference a real ember (legacy data from isNew era).
 */
function migrateToV2(db: SQLiteDatabase): void {
  // Temporarily disable FK checks for the migration
  db.execSync('PRAGMA foreign_keys = OFF;');

  db.execSync(`BEGIN TRANSACTION;`);

  try {
    // ── 1. Fix spark_participations FK ──

    // Clean orphaned rows first (ember_id not in embers)
    db.execSync(`
      DELETE FROM spark_participations
      WHERE ember_id NOT IN (SELECT id FROM embers);
    `);

    db.execSync(`
      CREATE TABLE IF NOT EXISTS spark_participations_v2 (
        spark_id TEXT NOT NULL REFERENCES sparks(id) ON DELETE CASCADE,
        ember_id TEXT NOT NULL REFERENCES embers(id) ON DELETE CASCADE,
        established_at TEXT NOT NULL,
        PRIMARY KEY (spark_id, ember_id)
      );

      INSERT OR IGNORE INTO spark_participations_v2
        SELECT * FROM spark_participations;

      DROP TABLE IF EXISTS spark_participations;

      ALTER TABLE spark_participations_v2 RENAME TO spark_participations;

      CREATE INDEX IF NOT EXISTS idx_spark_participations_ember
        ON spark_participations(ember_id);
    `);

    // ── 2. Fix inquiries.ember_id CASCADE ──
    db.execSync(`
      CREATE TABLE IF NOT EXISTS inquiries_v2 (
        id TEXT PRIMARY KEY NOT NULL,
        ember_id TEXT REFERENCES embers(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        original_material TEXT NOT NULL DEFAULT '',
        open_questions TEXT NOT NULL DEFAULT '[]',
        design_pack_version INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      INSERT OR IGNORE INTO inquiries_v2
        SELECT * FROM inquiries;

      DROP TABLE IF EXISTS inquiries;

      ALTER TABLE inquiries_v2 RENAME TO inquiries;

      CREATE INDEX IF NOT EXISTS idx_inquiries_ember
        ON inquiries(ember_id);
    `);

    db.execSync(`COMMIT;`);
  } catch (error) {
    db.execSync(`ROLLBACK;`);
    throw error;
  }

  // Re-enable FK checks
  db.execSync('PRAGMA foreign_keys = ON;');

  if (__DEV__) {
    console.log('🔥 [Database] Schema V2 migration complete — FK integrity tightened');
  }
}

/**
 * Close the database (for testing or cleanup).
 */
export function closeDatabase(): void {
  if (_db) {
    _db.closeSync();
    _db = null;
  }
}
