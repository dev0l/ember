import React from 'react';
import { useWindowDimensions } from 'react-native';
import { Rect, RadialGradient, vec } from '@shopify/react-native-skia';
import { COLORS } from '@/theme/colors';

export const EmberBackground = () => {
  const { width, height } = useWindowDimensions();
  const cx = width / 2;
  const cy = height / 2;

  return (
    <Rect x={0} y={0} width={width} height={height}>
      <RadialGradient
        c={vec(cx, cy)}
        r={Math.max(width, height) * 0.6}
        colors={['#1c0c08', '#0d0d0d']}
      />
    </Rect>
  );
};
