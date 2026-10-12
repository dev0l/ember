// ─────────────────────────────────────────────
// Inquiry Engine — Handoff content producibility
//
// requiredHandoffContentCanBeProduced (spec §7), deferred from Phase 1.
//
// Established ONLY from content the adopted configuration actually authors:
//   - the always-applicable parts every pack needs (setup, starter layout,
//     conventions, implementation sequence, base guidance, base checks);
//   - for every currently REQUIRED capability, a provision carrying at least
//     one guidance line and at least one verification check.
//
// A capability the configuration claims to satisfy (coverage) but for which
// it authors no content is NOT producible. Coverage and content are separate
// claims; generation needs both. Nothing here fills a gap with generic text.
// ─────────────────────────────────────────────

import type { Capability, Configuration, HandoffContentState } from './types.ts';

const BASE_PARTS: ReadonlyArray<[string, (c: Configuration) => string[]]> = [
  ['setup', (c) => c.setup],
  ['starter-layout', (c) => c.starterLayout],
  ['conventions', (c) => c.conventions],
  ['sequence', (c) => c.sequence],
  ['base-guidance', (c) => c.guidance],
  ['base-checks', (c) => c.checks],
];

const hasContent = (lines: string[] | undefined): boolean =>
  !!lines && lines.some((l) => l.trim().length > 0);

export function assessHandoffContent(
  configuration: Configuration,
  requiredCapabilities: readonly Capability[],
): HandoffContentState {
  const missing: string[] = [];
  for (const [part, read] of BASE_PARTS) {
    if (!hasContent(read(configuration))) missing.push(part);
  }
  for (const cap of requiredCapabilities) {
    const provision = configuration.provisions[cap];
    if (!provision || !hasContent(provision.guidance) || !hasContent(provision.checks)) {
      missing.push(`capability:${cap}`);
    }
  }
  return { assessed: true, producible: missing.length === 0, missing };
}

export const HANDOFF_NOT_ASSESSED: HandoffContentState = {
  assessed: false,
  producible: false,
  missing: [],
};
