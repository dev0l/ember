// Ember Typography
// Clean, warm, readable against dark backgrounds

export const TYPOGRAPHY = {
  fonts: {
    // Will be loaded via expo-font in _layout.tsx
    // For now, use system fonts with fallbacks
    heading: 'System',
    body: 'System',
    mono: 'monospace',
  },

  sizes: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 17,
    lg: 20,
    xl: 24,
    xxl: 32,
    title: 40,
  },

  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    light: '300' as const,
  },

  letterSpacing: {
    tight: -0.5,
    normal: 0,
    wide: 1.5,
    extraWide: 4,    // For "E M B E R" title
  },

  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.8,
  },
} as const;
