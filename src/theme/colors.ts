// Ember Color Palette
// Derived from concept art: volcanic stone, molten pathways, warm ember glow

export const COLORS = {
  // Core ember colors
  emberOrange: '#FF6B2B',
  emberRed: '#CC3A1A',
  emberGold: '#FFB84D',
  coreWhiteHeat: '#FFF5E6',

  // Background & surface
  darkBase: '#1A1A1A',
  deepCharcoal: '#0D0D0D',
  surfaceDark: '#141414',
  surfaceElevated: '#1F1F1F',

  // Path & glow (semi-transparent for layering)
  pathGlow: 'rgba(255, 107, 43, 0.27)',
  pathGlowStrong: 'rgba(255, 107, 43, 0.5)',
  nodeGlow: 'rgba(255, 107, 43, 0.15)',
  coreGlow: 'rgba(255, 245, 230, 0.3)',

  // Text
  textPrimary: '#F5F0E8',
  textSecondary: '#A89880',
  textMuted: '#665E54',

  // Accent & status
  accentWarm: '#FF8C42',
  disabledNode: 'rgba(168, 152, 128, 0.3)',

  // Transparent
  transparent: 'transparent',
} as const;

export type EmberColor = keyof typeof COLORS;
