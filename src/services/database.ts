// ─────────────────────────────────────────────
// Database — SQLite Schema & Initialization
//
// The relational representation of Ember's domain.
//
// 6 tables + 1 junction (schema v3):
//   sparks, embers, spark_participations (junction),
//   inquiries, inquiry_answers,
//   inquiry_decisions (append-only), design_packs
//   (+ _migration bookkeeping, created by services/migration.ts)
//
// Design Pack markdown remains as files on disk; design_packs records
// what each file is and where it came from (provenance).
// Conditions are derived from answers + authored knowledge.
// Propositions are derived from conditions.
// Lifecycle status is derived from answer count + design_pack_version.
//
// "Do not let the existence of a familiar database pattern
//  settle a question runtime has not answered."
// ─────────────────────────────────────────────

import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

const DB_NAME = 'ember.db';
const SCHEMA_VERSION = 3;

let _db: SQLiteDatabase | null = null;

/**
 * Get the database instance, initializing if needed.
 * Synchronous — matches the existing storage pattern.
 *
 * user_version is stamped after each completed step, never ahead of the
 * schema it describes. The v3 step is additionally checked structurally,
 * because it is additive and idempotent: runtime verification found an
 * install stamped 3 without the v3 tables (a development hot-reload ran a
 * build that had the new version number but not yet the v3 step).
 * The handle is cached only after initialization succeeds, so a failed
 * migration is retried rather than silently leaving an older schema in use.
 */
export function getDatabase(): SQLiteDatabase {
  if (_db) return _db;

  const db = openDatabaseSync(DB_NAME);

  try {
    // Enable WAL mode for better concurrent read/write
    db.execSync('PRAGMA journal_mode = WAL;');
    db.execSync('PRAGMA foreign_keys = ON;');

    // Check current version
    const versionResult = db.getFirstSync<{ user_version: number }>(
      'PRAGMA user_version;',
    );
    const currentVersion = versionResult?.user_version ?? 0;

    if (currentVersion < 1) {
      createSchema(db);
      setUserVersion(db, 1);
    }

    if (currentVersion < 2) {
      migrateToV2(db);
      setUserVersion(db, 2);
    }

    if (currentVersion < 3 || !hasV3Schema(db)) {
      migrateToV3(db);
      setUserVersion(db, 3);
    }
  } catch (error) {
    db.closeSync();
    throw error;
  }

  _db = db;
  return _db;
}

function setUserVersion(db: SQLiteDatabase, version: number): void {
  db.execSync(`PRAGMA user_version = ${version};`);
}

/** True when every structure schema v3 adds is present. */
function hasV3Schema(db: SQLiteDatabase): boolean {
  const tables = db
    .getAllSync<{ name: string }>(
      `SELECT name FROM sqlite_master
       WHERE type = 'table' AND name IN ('inquiry_decisions', 'design_packs')`,
    )
    .map(t => t.name);
  if (tables.length !== 2) return false;

  const answerColumns = db
    .getAllSync<{ name: string }>(`PRAGMA table_info(inquiry_answers);`)
    .map(c => c.name);
  return answerColumns.includes('specification') && answerColumns.includes('library_version');
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
 * Schema V3: Inquiry decisions + Design Pack records (provenance).
 *
 * Additive only — no existing table is rebuilt, no existing row is changed.
 *
 * 1. inquiry_answers gains two nullable columns:
 *    - specification:   verbatim text accompanying a choice that requires it
 *    - library_version: the authored Inquiry library the answer was committed
 *                       under. NULL means "not committed through the engine"
 *                       (legacy session or pre-v3). NULL does NOT assert the
 *                       answer is valid or invalid evidence — admitting legacy
 *                       answers is an open decision (D7).
 *
 * 2. inquiry_decisions — an append-only log of user decisions
 *    (consequence-chosen, configuration-adopted, review-confirmed).
 *    The evaluator treats the latest decision of each kind as authoritative,
 *    so history is never rewritten. No update/delete API exists.
 *
 * 3. design_packs — one row per Design Pack file, recording what it is and
 *    where it came from:
 *    - 'engine':  generated from a warranted Inquiry (Phase 3/4); carries the
 *                 library version, adopted configuration and fingerprints.
 *    - 'legacy':  generated by the proposition-based generator; no evidence
 *                 fingerprint exists for it.
 *    - 'unknown': a pre-v3 file discovered on disk; nothing about its
 *                 evidence or time of generation can be established.
 *    inquiries.design_pack_version remains as a compatibility counter for
 *    existing readers; design_packs is the record.
 */
function migrateToV3(db: SQLiteDatabase): void {
  db.withTransactionSync(() => {
    const answerColumns = db
      .getAllSync<{ name: string }>(`PRAGMA table_info(inquiry_answers);`)
      .map(c => c.name);

    if (!answerColumns.includes('specification')) {
      db.execSync(`ALTER TABLE inquiry_answers ADD COLUMN specification TEXT;`);
    }
    if (!answerColumns.includes('library_version')) {
      db.execSync(`ALTER TABLE inquiry_answers ADD COLUMN library_version TEXT;`);
    }

    db.execSync(`
      CREATE TABLE IF NOT EXISTS inquiry_decisions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        inquiry_id TEXT NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
        kind TEXT NOT NULL CHECK (kind IN (
          'consequence-chosen', 'configuration-adopted', 'review-confirmed'
        )),
        value TEXT NOT NULL,
        evidence_fingerprint TEXT,
        decided_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_inquiry_decisions_inquiry
        ON inquiry_decisions(inquiry_id);

      CREATE TABLE IF NOT EXISTS design_packs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        inquiry_id TEXT NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
        version INTEGER NOT NULL CHECK (version > 0),
        file_name TEXT NOT NULL,
        provenance TEXT NOT NULL CHECK (provenance IN ('engine', 'legacy', 'unknown')),
        generator TEXT,
        library_version TEXT,
        configuration_id TEXT,
        evidence_fingerprint TEXT,
        review_fingerprint TEXT,
        generated_at TEXT,
        recorded_at TEXT NOT NULL,
        UNIQUE (inquiry_id, version),
        CHECK (provenance <> 'engine' OR (
          library_version IS NOT NULL
          AND configuration_id IS NOT NULL
          AND evidence_fingerprint IS NOT NULL
          AND review_fingerprint IS NOT NULL
          AND generated_at IS NOT NULL
        )),
        CHECK (provenance <> 'legacy' OR (
          evidence_fingerprint IS NULL
          AND review_fingerprint IS NULL
          AND generated_at IS NOT NULL
        )),
        CHECK (provenance <> 'unknown' OR (
          evidence_fingerprint IS NULL
          AND review_fingerprint IS NULL
          AND configuration_id IS NULL
          AND generated_at IS NULL
        ))
      );

      CREATE INDEX IF NOT EXISTS idx_design_packs_inquiry
        ON design_packs(inquiry_id);
    `);
  });

  if (__DEV__) {
    console.log('🔥 [Database] Schema V3 migration complete — decisions + Design Pack records');
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
