// ─────────────────────────────────────────────
// Inquiry Engine — Evidence Fingerprints
//
// Deterministic, dependency-free fingerprints of evidence states.
// Used to tell whether a decision (adoption, review) or a generated
// Design Pack still corresponds to the current evidence.
// Not a security hash; collisions are irrelevant at this scale.
// ─────────────────────────────────────────────

/** JSON with object keys sorted recursively, so equal values stringify equally. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

/** Two independent 32-bit FNV-1a passes → 16 hex chars. */
export function fingerprint(value: unknown): string {
  const text = stableStringify(value);
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x01000193) >>> 0;
    h2 = (h2 ^ (h2 >>> 13)) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}
