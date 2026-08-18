import React from 'react';
import { Circle, RadialGradient, vec } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import { COLORS } from '@/theme/colors';

interface EmberCoreProps {
  cx: number;
  cy: number;
  state: string;
  pulseVal: any; // SharedValue<number>
  revealVal: any; // SharedValue<number>
  selectVal: any; // SharedValue<number>
  transitionVal: any; // SharedValue<number>
}

export const EmberCore = ({
  cx,
  cy,
  state,
  pulseVal,
  revealVal,
  selectVal,
  transitionVal,
}: EmberCoreProps) => {
  const baseRadius = 36;

  // Breathing pulse + hold growth + tightening on selection * transition scale
  const radius = useDerivedValue(() => {
    const pulseOffset = pulseVal.value * 5.0; // More pronounced breathing (5px)
    const holdScale = revealVal.value * 8.0;
    const selectScale = selectVal.value * -3.0; // Tightens slightly when a node is collected
    
    // Zoom in up to 18x during transition
    const transitionScale = 1.0 + transitionVal.value * 18.0;

    return (baseRadius + pulseOffset + holdScale + selectScale) * transitionScale;
  });

  // Outer glow breaths and expands outward
  const glowRadius = useDerivedValue(() => {
    const pulseOffset = pulseVal.value * 24.0; // Glowing halo breaths by 24px
    const holdScale = revealVal.value * 16.0;
    const transitionScale = 1.0 + transitionVal.value * 12.0;

    return (baseRadius * 2.2 + pulseOffset + holdScale) * transitionScale;
  });

  // Glow opacity breaths as well
  const glowOpacity = useDerivedValue(() => {
    const baseGlow = 0.12;
    const pulseGlow = pulseVal.value * 0.16; // Glow intensity breathes (12% to 28%)
    const transitionFade = 1.0 - transitionVal.value; // Fades out at the end of zoom

    return (baseGlow + pulseGlow) * transitionFade;
  });

  const coreOpacity = useDerivedValue(() => {
    // Core fades out smoothly as it expands to fill the screen
    return 1.0 - transitionVal.value;
  });

  return (
    <>
      {/* Outer Glow Halo (Breathing Light) */}
      <Circle cx={cx} cy={cy} r={glowRadius} opacity={glowOpacity}>
        <RadialGradient
          c={vec(cx, cy)}
          r={glowRadius}
          colors={[COLORS.emberOrange, 'transparent']}
        />
      </Circle>

      {/* Inner Hot Core */}
      <Circle cx={cx} cy={cy} r={radius} opacity={coreOpacity}>
        <RadialGradient
          c={vec(cx, cy)}
          r={radius}
          colors={[COLORS.coreWhiteHeat, COLORS.emberOrange, COLORS.emberRed]}
        />
      </Circle>
    </>
  );
};
