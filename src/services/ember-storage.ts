// ─────────────────────────────────────────────
// Ember File Storage
//
// Persistence layer using expo-file-system (new class-based API).
// Each Ember is a Markdown file stored in the app's
// document directory under `embers/`.
//
// "The initial persisted representation can be a Markdown file."
// ─────────────────────────────────────────────

import { Paths, File, Directory } from 'expo-file-system';
import type { EmberSeed } from '@/core/ember-types';
import { serializeEmberMarkdown, parseEmberMarkdown } from './ember-markdown';

/** Root directory for persisted Embers */
const EMBERS_DIR = new Directory(Paths.document, 'embers');

/**
 * Ensures the embers directory exists.
 * Called lazily before any file operation.
 */
function ensureDir(): void {
  if (!EMBERS_DIR.exists) {
    EMBERS_DIR.create();
  }
}

/**
 * Saves an EmberSeed as a Markdown file.
 * Returns the file URI.
 */
export function saveEmber(seed: EmberSeed): string {
  ensureDir();

  // Update the timestamp
  const updated: EmberSeed = {
    ...seed,
    updatedAt: new Date().toISOString(),
  };

  const markdown = serializeEmberMarkdown(updated);
  const file = new File(EMBERS_DIR, `${seed.id}.md`);

  file.write(markdown);

  if (__DEV__) {
    console.log(`🔥 [Ember] Saved: ${file.uri}`);
  }

  return file.uri;
}

/**
 * Loads a single Ember by ID.
 * Returns null if not found.
 */
export function loadEmber(id: string): EmberSeed | null {
  const file = new File(EMBERS_DIR, `${id}.md`);

  try {
    if (!file.exists) return null;

    const markdown = file.textSync();
    return parseEmberMarkdown(markdown);
  } catch (error) {
    if (__DEV__) {
      console.warn(`🔥 [Ember] Failed to load ${id}:`, error);
    }
    return null;
  }
}

/**
 * Loads the raw Markdown content for an Ember.
 * Used by the Ember view to display the document directly.
 */
export function loadEmberMarkdown(id: string): string | null {
  const file = new File(EMBERS_DIR, `${id}.md`);

  try {
    if (!file.exists) return null;
    return file.textSync();
  } catch (error) {
    if (__DEV__) {
      console.warn(`🔥 [Ember] Failed to load markdown ${id}:`, error);
    }
    return null;
  }
}

/**
 * Lists all persisted Embers.
 * Returns seeds sorted by updatedAt (most recent first).
 */
export function listEmbers(): EmberSeed[] {
  ensureDir();

  try {
    const entries = EMBERS_DIR.list();
    const seeds: EmberSeed[] = [];

    for (const entry of entries) {
      if (entry instanceof File && entry.name.endsWith('.md')) {
        try {
          const markdown = entry.textSync();
          seeds.push(parseEmberMarkdown(markdown));
        } catch {
          // Skip files that can't be parsed
        }
      }
    }

    // Sort by updatedAt descending
    seeds.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );

    return seeds;
  } catch (error) {
    if (__DEV__) {
      console.warn('🔥 [Ember] Failed to list embers:', error);
    }
    return [];
  }
}

/**
 * Deletes an Ember by ID.
 */
export function deleteEmber(id: string): void {
  const file = new File(EMBERS_DIR, `${id}.md`);

  try {
    if (file.exists) {
      file.delete();
    }
    if (__DEV__) {
      console.log(`🔥 [Ember] Deleted: ${file.uri}`);
    }
  } catch (error) {
    if (__DEV__) {
      console.warn(`🔥 [Ember] Failed to delete ${id}:`, error);
    }
  }
}
