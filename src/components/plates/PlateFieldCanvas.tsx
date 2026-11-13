// ─────────────────────────────────────────────
// Plate Field Canvas — Etched Coordinate Grid, Constellation
// Cores (Upper Plate), and Electron Motes (Lower Plate)
//
// Bridges the Mechanical Plate architecture with the organic
// visual language of Creative Space (etched technical grid,
// glowing cores, angular circuit paths) and the Ember promo /
// constellation logo concept.
//
// Every visual element is grounded in real SQLite state:
//   - Upper Plate ('top'): active Embers and their participating
//     Spark constellations + Inquiry maturity
//   - Lower Plate ('bottom'): unbound lingering Spark electron
//     motes breathing below the Quick Capture recess
// ─────────────────────────────────────────────

import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import {
  Canvas,
  Circle,
  Line,
  RadialGradient,
  LinearGradient,
  Rect,
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
import type { ConstellationStage } from './EmberConstellationGlyph';

export interface PlateEmberFieldItem {
  id: string;
  title: string;
  sparkCount: number;
  stage: ConstellationStage;
}

export interface PlateFieldCanvasProps {
  position: 'top' | 'bottom';
  height: number;
  emberSummaries?: PlateEmberFieldItem[];
  lingeringCount?: number;
}

/** Deterministic normalized positions for satellite Ember clusters in the upper field */
const UPPER_CLUSTER_OFFSETS: readonly { rx: number; ry: number }[] = [
  { rx: 0.5, ry: 0.52 },
  { rx: 0.23, ry: 0.44 },
  { rx: 0.77, ry: 0.44 },
  { rx: 0.31, ry: 0.68 },
  { rx: 0.69, ry: 0.68 },
];

/** 6-node flame/crown offsets around an Ember core */
const CORE_SATELLITE_OFFSETS: readonly { dx: number; dy: number; kneeX: number; kneeY: number }[] = [
  { dx: 0, dy: -38, kneeX: 0, kneeY: -20 },
  { dx: 42, dy: -20, kneeX: 22, kneeY: -20 },
  { dx: -42, dy: -20, kneeX: -22, kneeY: -20 },
  { dx: 34, dy: 24, kneeX: 20, kneeY: 24 },
  { dx: -34, dy: 24, kneeX: -20, kneeY: 24 },
  { dx: 0, dy: 38, kneeX: 0, kneeY: 20 },
];

/** Deterministic normalized positions for unbound lingering Spark electron motes in the lower field */
const LOWER_MOTE_POSITIONS: readonly { rx: number; ry: number; phase: number }[] = [
  { rx: 0.5, ry: 0.58, phase: 0.0 },
  { rx: 0.32, ry: 0.52, phase: 0.35 },
  { rx: 0.68, ry: 0.54, phase: 0.7 },
  { rx: 0.22, ry: 0.66, phase: 0.15 },
  { rx: 0.78, ry: 0.65, phase: 0.55 },
  { rx: 0.44, ry: 0.71, phase: 0.85 },
  { rx: 0.58, ry: 0.69, phase: 0.25 },
  { rx: 0.16, ry: 0.53, phase: 0.6 },
  { rx: 0.84, ry: 0.52, phase: 0.9 },
  { rx: 0.36, ry: 0.62, phase: 0.45 },
];

export function PlateFieldCanvas({
  position,
  height,
  emberSummaries = [],
  lingeringCount = 0,
}: PlateFieldCanvasProps) {
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.max(260, windowWidth - 22);
  const isTop = position === 'top';

  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, {
        duration: 3200,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );
  }, [pulse]);

  // Etched technical grid lines and calibration crosshairs (Creative Space lineage)
  const gridGeometry = useMemo(() => {
    const step = 56;
    const vLines: number[] = [];
    const hLines: number[] = [];
    const crosshairs: { x: number; y: number }[] = [];

    const startX = (width % step) / 2;
    for (let x = startX; x < width; x += step) {
      vLines.push(x);
    }
    const startY = 28;
    for (let y = startY; y < height - 20; y += step) {
      hLines.push(y);
    }

    for (let i = 0; i < vLines.length; i++) {
      for (let j = 0; j < hLines.length; j++) {
        if ((i + j) % 2 === 0) {
          crosshairs.push({ x: vLines[i], y: hLines[j] });
        }
      }
    }

    return { vLines, hLines, crosshairs };
  }, [width, height]);

  const primaryEmber = emberSummaries[0] ?? null;
  const secondaryEmbers = emberSummaries.slice(1, 5);

  const centerX = width * 0.5;
  const centerY = isTop ? height * 0.52 : height * 0.62;

  const coreHaloRadius = useDerivedValue(() => {
    const base = primaryEmber ? 64 : 42;
    return base + pulse.value * 14;
  });

  const coreHaloOpacity = useDerivedValue(() => {
    const base = primaryEmber ? 0.24 : 0.11;
    return base + pulse.value * 0.1;
  });

  const coreInnerRadius = useDerivedValue(() => {
    const base = primaryEmber ? 8.5 : 5;
    return base + pulse.value * 1.8;
  });

  const moteHaloRadius = useDerivedValue(() => {
    return 18 + pulse.value * 7;
  });

  const moteHaloOpacity = useDerivedValue(() => {
    return 0.18 + pulse.value * 0.14;
  });

  if (height < 96) {
    return null;
  }

  const activeMotes = LOWER_MOTE_POSITIONS.slice(
    0,
    Math.min(Math.max(lingeringCount, 0), LOWER_MOTE_POSITIONS.length),
  );

  const primaryIgnitedNodes = primaryEmber
    ? Math.min(Math.max(primaryEmber.sparkCount, 0), CORE_SATELLITE_OFFSETS.length)
    : 0;
  const isPrimaryCrystallized =
    primaryEmber?.stage === 'warranted' || primaryEmber?.stage === 'pack';
  const isPrimaryDeveloping =
    primaryEmber?.stage === 'developing' || isPrimaryCrystallized;
  const primaryColor = isPrimaryCrystallized
    ? COLORS.emberGold
    : primaryEmber?.stage === 'developing'
    ? '#FF9E44'
    : COLORS.emberOrange;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Canvas style={{ width, height }}>
        {/* ── 1. Horizon Seam Ambient Glow ── */}
        <Rect x={0} y={isTop ? height - 54 : 0} width={width} height={54}>
          <LinearGradient
            start={vec(0, isTop ? height : 0)}
            end={vec(0, isTop ? height - 54 : 54)}
            colors={['rgba(255, 107, 43, 0.14)', 'transparent']}
          />
        </Rect>

        {/* ── 2. Etched Technical Coordinate Grid ── */}
        {gridGeometry.vLines.map((x, idx) => (
          <Line
            key={`vg-${idx}`}
            p1={vec(x, 0)}
            p2={vec(x, height)}
            color="rgba(255, 149, 64, 0.035)"
            strokeWidth={1}
          />
        ))}
        {gridGeometry.hLines.map((y, idx) => (
          <Line
            key={`hg-${idx}`}
            p1={vec(0, y)}
            p2={vec(width, y)}
            color="rgba(255, 149, 64, 0.035)"
            strokeWidth={1}
          />
        ))}
        {gridGeometry.crosshairs.map((pt, idx) => (
          <React.Fragment key={`ch-${idx}`}>
            <Line
              p1={vec(pt.x - 3.5, pt.y)}
              p2={vec(pt.x + 3.5, pt.y)}
              color="rgba(255, 184, 77, 0.13)"
              strokeWidth={1}
            />
            <Line
              p1={vec(pt.x, pt.y - 3.5)}
              p2={vec(pt.x, pt.y + 3.5)}
              color="rgba(255, 184, 77, 0.13)"
              strokeWidth={1}
            />
          </React.Fragment>
        ))}

        {/* ── 3A. UPPER PLATE: Ember Constellation Core & Angular Circuit Filaments ── */}
        {isTop && (
          <>
            {/* Secondary Ember Constellation Clusters */}
            {secondaryEmbers.map((emb, idx) => {
              const offset = UPPER_CLUSTER_OFFSETS[idx + 1] ?? UPPER_CLUSTER_OFFSETS[0];
              const ex = width * offset.rx;
              const ey = height * offset.ry;
              const secColor =
                emb.stage === 'warranted' || emb.stage === 'pack'
                  ? COLORS.emberGold
                  : COLORS.emberOrange;
              const subNodes = Math.min(Math.max(emb.sparkCount, 1), 4);
              return (
                <React.Fragment key={emb.id}>
                  {/* Resonance filament to primary hearth core */}
                  <Line
                    p1={vec(centerX, centerY)}
                    p2={vec(ex, ey)}
                    color="rgba(255, 107, 43, 0.16)"
                    strokeWidth={1}
                  />
                  <Circle cx={ex} cy={ey} r={26} opacity={0.18}>
                    <RadialGradient
                      c={vec(ex, ey)}
                      r={26}
                      colors={[secColor, 'transparent']}
                    />
                  </Circle>
                  {Array.from({ length: subNodes }).map((_, sIdx) => {
                    const angle = (sIdx * Math.PI) / 2 + Math.PI / 4;
                    const sx = ex + Math.cos(angle) * 16;
                    const sy = ey + Math.sin(angle) * 16;
                    return (
                      <React.Fragment key={`${emb.id}-s-${sIdx}`}>
                        <Line
                          p1={vec(ex, ey)}
                          p2={vec(sx, sy)}
                          color={secColor}
                          strokeWidth={0.9}
                          opacity={0.42}
                        />
                        <Circle
                          cx={sx}
                          cy={sy}
                          r={2.2}
                          color={COLORS.emberGold}
                          opacity={0.85}
                        />
                      </React.Fragment>
                    );
                  })}
                  <Circle cx={ex} cy={ey} r={4.2} color={secColor} />
                  <Circle cx={ex} cy={ey} r={2} color={COLORS.coreWhiteHeat} />
                </React.Fragment>
              );
            })}

            {/* Primary Hearth / Ember Core Halo */}
            <Circle
              cx={centerX}
              cy={centerY}
              r={coreHaloRadius}
              opacity={coreHaloOpacity}
            >
              <RadialGradient
                c={vec(centerX, centerY)}
                r={76}
                colors={[primaryColor, 'transparent']}
              />
            </Circle>

            {/* Angular Circuit / Constellation Pathways around Primary Core */}
            {CORE_SATELLITE_OFFSETS.map((sat, idx) => {
              const isIgnited = idx < primaryIgnitedNodes;
              const sx = centerX + sat.dx;
              const sy = centerY + sat.dy;
              const kx = centerX + sat.kneeX;
              const ky = centerY + sat.kneeY;
              const lineOpacity = isIgnited
                ? 0.62
                : primaryEmber
                ? 0.18
                : 0.11;
              return (
                <React.Fragment key={`sat-${idx}`}>
                  {/* 2-segment angular pathway (Creative Space circuit lineage) */}
                  <Line
                    p1={vec(centerX, centerY)}
                    p2={vec(kx, ky)}
                    color={isIgnited ? primaryColor : '#8F7A65'}
                    strokeWidth={isIgnited ? 1.3 : 0.8}
                    opacity={lineOpacity}
                  />
                  <Line
                    p1={vec(kx, ky)}
                    p2={vec(sx, sy)}
                    color={isIgnited ? primaryColor : '#8F7A65'}
                    strokeWidth={isIgnited ? 1.3 : 0.8}
                    opacity={lineOpacity}
                  />
                  {isIgnited && (
                    <Circle
                      cx={sx}
                      cy={sy}
                      r={8}
                      color={primaryColor}
                      opacity={0.22}
                    />
                  )}
                  <Circle
                    cx={sx}
                    cy={sy}
                    r={isIgnited ? 3.2 : 1.6}
                    color={
                      isIgnited
                        ? COLORS.coreWhiteHeat
                        : 'rgba(186, 162, 138, 0.28)'
                    }
                  />
                </React.Fragment>
              );
            })}

            {/* Outer Constellation Crown Facets when Developing / Warranted / Pack */}
            {isPrimaryDeveloping && (
              <>
                <Line
                  p1={vec(centerX + CORE_SATELLITE_OFFSETS[0].dx, centerY + CORE_SATELLITE_OFFSETS[0].dy)}
                  p2={vec(centerX + CORE_SATELLITE_OFFSETS[1].dx, centerY + CORE_SATELLITE_OFFSETS[1].dy)}
                  color={COLORS.emberGold}
                  strokeWidth={1}
                  opacity={0.45}
                />
                <Line
                  p1={vec(centerX + CORE_SATELLITE_OFFSETS[0].dx, centerY + CORE_SATELLITE_OFFSETS[0].dy)}
                  p2={vec(centerX + CORE_SATELLITE_OFFSETS[2].dx, centerY + CORE_SATELLITE_OFFSETS[2].dy)}
                  color={COLORS.emberGold}
                  strokeWidth={1}
                  opacity={0.45}
                />
                <Line
                  p1={vec(centerX + CORE_SATELLITE_OFFSETS[1].dx, centerY + CORE_SATELLITE_OFFSETS[1].dy)}
                  p2={vec(centerX + CORE_SATELLITE_OFFSETS[3].dx, centerY + CORE_SATELLITE_OFFSETS[3].dy)}
                  color={COLORS.emberGold}
                  strokeWidth={1}
                  opacity={0.38}
                />
                <Line
                  p1={vec(centerX + CORE_SATELLITE_OFFSETS[2].dx, centerY + CORE_SATELLITE_OFFSETS[2].dy)}
                  p2={vec(centerX + CORE_SATELLITE_OFFSETS[4].dx, centerY + CORE_SATELLITE_OFFSETS[4].dy)}
                  color={COLORS.emberGold}
                  strokeWidth={1}
                  opacity={0.38}
                />
                {isPrimaryCrystallized && (
                  <>
                    <Line
                      p1={vec(centerX + CORE_SATELLITE_OFFSETS[3].dx, centerY + CORE_SATELLITE_OFFSETS[3].dy)}
                      p2={vec(centerX + CORE_SATELLITE_OFFSETS[5].dx, centerY + CORE_SATELLITE_OFFSETS[5].dy)}
                      color={COLORS.emberGold}
                      strokeWidth={1}
                      opacity={0.48}
                    />
                    <Line
                      p1={vec(centerX + CORE_SATELLITE_OFFSETS[4].dx, centerY + CORE_SATELLITE_OFFSETS[4].dy)}
                      p2={vec(centerX + CORE_SATELLITE_OFFSETS[5].dx, centerY + CORE_SATELLITE_OFFSETS[5].dy)}
                      color={COLORS.emberGold}
                      strokeWidth={1}
                      opacity={0.48}
                    />
                  </>
                )}
              </>
            )}

            {/* Center Hearth Core */}
            <Circle
              cx={centerX}
              cy={centerY}
              r={coreInnerRadius}
              color={primaryEmber ? primaryColor : 'rgba(255, 107, 43, 0.5)'}
            />
            <Circle
              cx={centerX}
              cy={centerY}
              r={primaryEmber ? 3.5 : 2}
              color={COLORS.coreWhiteHeat}
              opacity={primaryEmber ? 0.95 : 0.6}
            />
          </>
        )}

        {/* ── 3B. LOWER PLATE: Unbound Lingering Spark Electron Motes ── */}
        {!isTop && (
          <>
            {activeMotes.map((mote, idx) => {
              const mx = width * mote.rx;
              const my = Math.max(122, Math.min(height - 54, height * mote.ry));
              return (
                <React.Fragment key={`mote-${idx}`}>
                  {/* Subtle upward potential filament toward the horizon seam */}
                  <Line
                    p1={vec(mx, my)}
                    p2={vec(mx, Math.max(112, my - 26))}
                    color="rgba(255, 184, 77, 0.22)"
                    strokeWidth={1}
                  />
                  {/* Breathing Electron Halo */}
                  <Circle
                    cx={mx}
                    cy={my}
                    r={moteHaloRadius}
                    opacity={moteHaloOpacity}
                  >
                    <RadialGradient
                      c={vec(mx, my)}
                      r={24}
                      colors={[COLORS.emberGold, COLORS.emberOrange, 'transparent']}
                    />
                  </Circle>
                  {/* Hot Electron Core */}
                  <Circle cx={mx} cy={my} r={3.6} color={COLORS.emberGold} />
                  <Circle cx={mx} cy={my} r={1.8} color={COLORS.coreWhiteHeat} />
                </React.Fragment>
              );
            })}
          </>
        )}
      </Canvas>
    </View>
  );
}
