// ─────────────────────────────────────────────
// Territory Plate System Types
//
// Represents the spatial hierarchy and mechanical plate stacks
// for Embers (upper territory) and Sparks (lower territory).
// ─────────────────────────────────────────────

export type TerritoryId = 'embers' | 'sparks';

export type StageMode = 'split' | 'embers' | 'sparks';

export interface TerritoryPlateItem {
  id: string;
  title: string;
  subtitle?: string;
  role?: string;
  depth: number;
}

export interface TerritoryStackState {
  activeTerritory: TerritoryId | null; // null represents 'split' resting state
  embersStack: TerritoryPlateItem[];
  sparksStack: TerritoryPlateItem[];
}
