import React, { useMemo } from 'react';
import { Path, Skia } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import { COLORS } from '@/theme/colors';

interface EmberPathProps {
  cx: number;
  cy: number;
  nx: number;
  ny: number;
  orbitRadius: number;
  closeRadius: number;
  isSelected: boolean;
  hasSelection: boolean;
  revealVal: any; // SharedValue<number>
  selectVal: any; // SharedValue<number>
  transitionVal: any; // SharedValue<number>
}

export const EmberPath = ({
  cx,
  cy,
  nx,
  ny,
  orbitRadius,
  closeRadius,
  isSelected,
  hasSelection,
  revealVal,
  selectVal,
  transitionVal,
}: EmberPathProps) => {
  // Generate a jagged molten crack path once per node
  const jaggedPath = useMemo(() => {
    const path = Skia.Path.Make();
    const steps = 6;
    const points = [];

    const dx = nx - cx;
    const dy = ny - cy;
    const len = Math.sqrt(dx * dx + dy * dy);
    
    // Perpendicular vector normalized
    const px = -dy / len;
    const py = dx / len;

    points.push({ x: cx, y: cy });

    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      // Base straight line point
      let x = cx + dx * t;
      let y = cy + dy * t;

      // Add noise (larger in the middle of the path)
      const noiseMagnitude = Math.sin(t * Math.PI) * 12;
      const noise = (Math.random() - 0.5) * noiseMagnitude;

      points.push({
        x: x + px * noise,
        y: y + py * noise,
      });
    }

    points.push({ x: nx, y: ny });

    path.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      path.lineTo(points[i].x, points[i].y);
    }

    return path;
  }, [cx, cy, nx, ny]);

  // Derived path end: shrinks to satellite orbit if selected, or collapses back to center if unselected
  const pathEnd = useDerivedValue(() => {
    if (hasSelection) {
      if (isSelected) {
        const closeFraction = closeRadius / orbitRadius;
        // Interpolate the fraction from 1.0 down to closeFraction
        const currentFraction = 1.0 - (1.0 - closeFraction) * selectVal.value;
        return revealVal.value * currentFraction;
      } else {
        // Unselected paths collapse back to the center (1.0 -> 0.0)
        return revealVal.value * (1.0 - selectVal.value);
      }
    }
    return revealVal.value;
  });

  // Derived opacity based on selection state and transition zoom
  const opacity = useDerivedValue(() => {
    if (!hasSelection) {
      return 0.6;
    }
    if (isSelected) {
      // Selected path fades out as we zoom-enter the core
      return 1.0 - transitionVal.value;
    }
    // Unselected paths fade out immediately
    return 0.6 * (1.0 - selectVal.value);
  });

  // Derived stroke width
  const strokeWidth = useDerivedValue(() => {
    if (isSelected) {
      return 2.5 + selectVal.value * 2.5; // Grows thicker when selected
    }
    return 2.5;
  });

  // Derived path color: orange-red glow that intensifies if selected
  const color = useDerivedValue(() => {
    return isSelected && hasSelection
      ? COLORS.emberOrange
      : COLORS.emberRed;
  });

  return (
    <>
      {/* Background glow path */}
      <Path
        path={jaggedPath}
        color={COLORS.emberOrange}
        style="stroke"
        strokeWidth={12}
        strokeCap="round"
        start={0}
        end={pathEnd}
        opacity={useDerivedValue(() => opacity.value * 0.18)}
      />
      {/* Solid core molten line */}
      <Path
        path={jaggedPath}
        color={color}
        style="stroke"
        strokeWidth={strokeWidth}
        strokeCap="round"
        start={0}
        end={pathEnd}
        opacity={opacity}
      />
    </>
  );
};
