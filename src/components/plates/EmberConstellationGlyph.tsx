// ─────────────────────────────────────────────
// Ember Constellation Glyph
//
// Truthful visual signature of an Ember's relational structure
// and Inquiry maturity, honoring the 6-node geometric flame
// constellation of the Ember logo concept and promo lineage.
//
// Encodes real persisted state:
//   - Center Core: the Ember itself (breathing warm halo)
//   - Satellite Electron Nodes: participating Sparks bound to this Ember
//   - Relational Filaments:
//       · 'seed': faint radial threads to participating Sparks
//       · 'exploring': active radial threads + inner exploration ring
//       · 'developing': angular perimeter facets linking nodes
//       · 'warranted' / 'pack': crystallized geometric flame lattice
// ─────────────────────────────────────────────

import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Canvas,
  Circle,
  Line,
  RadialGradient,
  vec,
} from '@shopify/react-native-skia';
import {
  useSharedValue,
  useDerivedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { COLORS } from '@/theme';

export type ConstellationStage =
  | 'seed'
  | 'exploring'
  | 'developing'
  | 'warranted'
  | 'pack';

export interface EmberConstellationGlyphProps {
  sparkCount: number;
  stage: ConstellationStage;
  size?: number;
  animated?: boolean;
}

/**
 * Normalized 6-vertex flame/crown constellation coordinates (in [-1, 1] space),
 * echoing logo_concept_variant.jpg:
 *   0: Crown Apex (top center)
 *   1: Upper Right Wing
 *   2: Upper Left Wing
 *   3: Lower Right Hearth
 *   4: Lower Left Hearth
 *   5: Base Anchor (bottom center)
 */
const LATTICE_VERTICES: readonly { x: number; y: number }[] = [
  { x: 0, y: -0.78 },
  { x: 0.68, y: -0.34 },
  { x: -0.68, y: -0.34 },
  { x: 0.54, y: 0.44 },
  { x: -0.54, y: 0.44 },
  { x: 0, y: 0.78 },
];

/** Perimeter edges forming the geometric flame crown */
const PERIMETER_EDGES: readonly [number, number][] = [
  [0, 1],
  [0, 2],
  [1, 3],
  [2, 4],
  [3, 5],
  [4, 5],
];

/** Inner facet chords that lock in when Warranted / Design Pack is reached */
const CRYSTALLIZED_CHORDS: readonly [number, number][] = [
  [1, 2],
  [3, 4],
  [0, 3],
  [0, 4],
];

export function EmberConstellationGlyph({
  sparkCount,
  stage,
  size = 44,
  animated = true,
}: EmberConstellationGlyphProps) {
  const pulse = useSharedValue(0.35);

  useEffect(() => {
    if (!animated) {
      pulse.value = 0.5;
      return;
    }
    pulse.value = withRepeat(
      withTiming(1, {
        duration: 2800,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );
  }, [animated, pulse]);

  const cx = size / 2;
  const cy = size / 2;
  const scale = size * 0.42;

  const isCrystallized = stage === 'warranted' || stage === 'pack';
  const isDevelopingOrBeyond =
    stage === 'developing' || stage === 'warranted' || stage === 'pack';
  const isExploringOrBeyond = stage !== 'seed';

  const primaryColor =
    stage === 'pack' || stage === 'warranted'
      ? COLORS.emberGold
      : stage === 'developing'
      ? '#FF9E44'
      : COLORS.emberOrange;

  const points = useMemo(() => {
    return LATTICE_VERTICES.map((v) => ({
      x: cx + v.x * scale,
      y: cy + v.y * scale,
    }));
  }, [cx, cy, scale]);

  const activeNodeCount = Math.min(Math.max(sparkCount, 0), LATTICE_VERTICES.length);

  const haloRadius = useDerivedValue(() => {
    const base = size * (isCrystallized ? 0.44 : 0.36);
    return base + pulse.value * (size * 0.08);
  });

  const haloOpacity = useDerivedValue(() => {
    const base = isCrystallized ? 0.28 : isExploringOrBeyond ? 0.2 : 0.14;
    return base + pulse.value * 0.12;
  });

  const coreRadius = useDerivedValue(() => {
    const base = Math.max(2.6, size * 0.085);
    return base + pulse.value * (size * 0.018);
  });

  return (
    <View style={[styles.frame, { width: size, height: size }]}>
      <Canvas style={{ width: size, height: size }}>
        {/* 1. Breathing Core Halo */}
        <Circle cx={cx} cy={cy} r={haloRadius} opacity={haloOpacity}>
          <RadialGradient
            c={vec(cx, cy)}
            r={size * 0.48}
            colors={[primaryColor, 'transparent']}
          />
        </Circle>

        {/* 2. Radial Filaments (Core -> Participating Spark Nodes) */}
        {points.map((pt, idx) => {
          const isIgnited = idx < activeNodeCount;
          if (!isIgnited && !isCrystallized) return null;
          const opacity = isIgnited
            ? isExploringOrBeyond
              ? 0.62
              : 0.36
            : 0.18;
          return (
            <Line
              key={`rad-${idx}`}
              p1={vec(cx, cy)}
              p2={vec(pt.x, pt.y)}
              color={isIgnited ? primaryColor : '#8F7A65'}
              strokeWidth={isIgnited ? 1.15 : 0.75}
              opacity={opacity}
            />
          );
        })}

        {/* 3. Perimeter Constellation Segments (Developing / Warranted / Pack) */}
        {isDevelopingOrBeyond &&
          PERIMETER_EDGES.map(([a, b], idx) => {
            const bothIgnited = a < activeNodeCount && b < activeNodeCount;
            const oneIgnited = a < activeNodeCount || b < activeNodeCount;
            if (!bothIgnited && !oneIgnited && !isCrystallized) return null;
            const edgeOpacity = isCrystallized
              ? bothIgnited
                ? 0.78
                : 0.38
              : bothIgnited
              ? 0.55
              : 0.22;
            return (
              <Line
                key={`perim-${idx}`}
                p1={vec(points[a].x, points[a].y)}
                p2={vec(points[b].x, points[b].y)}
                color={isCrystallized ? COLORS.emberGold : primaryColor}
                strokeWidth={bothIgnited || isCrystallized ? 1.1 : 0.8}
                opacity={edgeOpacity}
              />
            );
          })}

        {/* 4. Crystallized Inner Chords (Warranted / Design Pack Flame Lattice) */}
        {isCrystallized &&
          CRYSTALLIZED_CHORDS.map(([a, b], idx) => (
            <Line
              key={`chord-${idx}`}
              p1={vec(points[a].x, points[a].y)}
              p2={vec(points[b].x, points[b].y)}
              color={COLORS.emberGold}
              strokeWidth={0.85}
              opacity={0.34}
            />
          ))}

        {/* 5. Satellite Electron Nodes (Participating Sparks vs. Latent Calibration Vertices) */}
        {points.map((pt, idx) => {
          const isIgnited = idx < activeNodeCount;
          const nodeR = isIgnited
            ? Math.max(2.1, size * 0.056)
            : Math.max(1.2, size * 0.028);
          return (
            <React.Fragment key={`node-${idx}`}>
              {isIgnited && (
                <Circle
                  cx={pt.x}
                  cy={pt.y}
                  r={nodeR * 2.2}
                  color={primaryColor}
                  opacity={0.26}
                />
              )}
              <Circle
                cx={pt.x}
                cy={pt.y}
                r={nodeR}
                color={
                  isIgnited
                    ? isCrystallized
                      ? COLORS.coreWhiteHeat
                      : COLORS.emberGold
                    : isCrystallized
                    ? 'rgba(255, 184, 77, 0.45)'
                    : 'rgba(186, 162, 138, 0.22)'
                }
              />
            </React.Fragment>
          );
        })}

        {/* 6. Hot Center Core */}
        <Circle
          cx={cx}
          cy={cy}
          r={coreRadius}
          color={isCrystallized ? COLORS.coreWhiteHeat : primaryColor}
        />
        <Circle
          cx={cx}
          cy={cy}
          r={Math.max(1.4, size * 0.04)}
          color={COLORS.coreWhiteHeat}
        />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
