// ─────────────────────────────────────────────
// Territory Plate System Types
//
// Represents the spatial hierarchy and mechanical plate stacks
// for Embers (upper territory) and Sparks (lower territory).
// ─────────────────────────────────────────────

export type TerritoryId = 'embers' | 'sparks';

export type StageMode = 'split' | 'embers' | 'sparks';

export type EmbersFocus = 'collection' | 'ember';

export interface EmberPlateData {
  id: string;
  title: string;
  nature?: string;
  sparksCount?: number;
}

export interface TerritoryPlateItem {
  id: string;
  title: string;
  subtitle?: string;
  role?: string;
  depth: number;
}

export interface TerritoryStackState {
  activeTerritory: TerritoryId | null; // null represents 'split' resting state
  embersFocus: EmbersFocus;
  selectedEmber: EmberPlateData | null;
  lastEmbersFocus: EmbersFocus;
}

