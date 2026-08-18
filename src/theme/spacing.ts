// Ember Spacing & Layout Constants

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

export const LAYOUT = {
  // Screen padding
  screenPaddingHorizontal: SPACING.lg,
  screenPaddingVertical: SPACING.xl,

  // Ember hub dimensions (relative to screen)
  hubSizeRatio: 0.85,           // Hub canvas takes 85% of screen width
  coreSizeRatio: 0.12,          // Core ember radius as ratio of hub size
  nodeOrbitRatio: 0.38,         // Node orbit radius as ratio of hub size
  nodeHitRadiusDp: 40,          // Touch target radius for nodes

  // Border radius
  radiusSm: 8,
  radiusMd: 12,
  radiusLg: 16,
  radiusXl: 24,
  radiusFull: 9999,
} as const;
