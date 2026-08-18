import React from 'react';
import { StyleSheet, Text, Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { COLORS } from '@/theme/colors';
import { SPACING, TYPOGRAPHY } from '@/theme';

interface EmberNodeProps {
  id: string;
  label: string;
  subtitle?: string;
  icon: string;
  cx: number;
  cy: number;
  nx: number;
  ny: number;
  closeX: number;
  closeY: number;
  isSelected: boolean;
  hasSelection: boolean;
  expandVal: any; // SharedValue<number>
  selectVal: any; // SharedValue<number>
  transitionVal: any; // SharedValue<number>
  pulseVal: any; // SharedValue<number>
  enabled: boolean;
  onPress: () => void;
}

export const EmberNode = ({
  id,
  label,
  subtitle,
  icon,
  cx,
  cy,
  nx,
  ny,
  closeX,
  closeY,
  isSelected,
  hasSelection,
  expandVal,
  selectVal,
  transitionVal,
  pulseVal,
  enabled,
  onPress,
}: EmberNodeProps) => {
  // Animate position, scale and opacity dynamically
  const animatedStyle = useAnimatedStyle(() => {
    // 1. Position interpolation: selected glides to satellite, unselected collapse to center
    let x = nx;
    let y = ny;

    if (hasSelection) {
      if (isSelected) {
        // Glides from orbit (nx, ny) to close satellite (closeX, closeY)
        x = nx + (closeX - nx) * selectVal.value;
        y = ny + (closeY - ny) * selectVal.value;
      } else {
        // Collapses from orbit (nx, ny) back into center (cx, cy)
        x = nx + (cx - nx) * selectVal.value;
        y = ny + (cy - ny) * selectVal.value;
      }
    }

    // 2. Scale interpolation
    let scale = expandVal.value;

    if (hasSelection) {
      if (isSelected) {
        // Selected node: subtle pulse, then fades/shrinks as the center zoom consumes it
        const pulse = 1.0 + pulseVal.value * 0.04;
        const transitionScale = 1.0 - transitionVal.value * 0.3; // shrink slightly
        scale = pulse * transitionScale;
      } else {
        // Unselected nodes: shrink to center
        scale = (1.0 - selectVal.value) * expandVal.value;
      }
    }

    // 3. Opacity interpolation
    let opacity = expandVal.value;
    if (hasSelection) {
      if (isSelected) {
        // Selected node fades out as center ember is entered (transition zoom)
        opacity = 1.0 - transitionVal.value;
      } else {
        // Unselected nodes fade out immediately
        opacity = 1.0 - selectVal.value;
      }
    }

    // Node wrapper is 80x80 (so offset by -40 to center exactly on coordinates)
    return {
      position: 'absolute',
      left: x - 40,
      top: y - 40,
      transform: [{ scale }],
      opacity,
    };
  });

  // Map icon names to emojis/unicodes for clean look without heavy dependencies
  const getIconEmoji = (iconName: string) => {
    switch (iconName) {
      case 'archive':
        return '📁';
      case 'clock':
        return '🕒';
      case 'download':
        return '📥';
      case 'flame':
        return '🔥';
      default:
        return '⚪';
    }
  };

  return (
    <Animated.View style={[styles.nodeContainer, animatedStyle]}>
      <Pressable
        onPress={enabled ? onPress : undefined}
        style={({ pressed }) => [
          styles.nodeCircle,
          pressed && styles.pressed,
          !enabled && styles.disabled,
          isSelected && styles.selectedCircle,
        ]}
      >
        <Text style={styles.icon}>{getIconEmoji(icon)}</Text>
      </Pressable>
      
      {/* Label (only visible if not in transition phase or if this is the selected node) */}
      <View style={styles.labelContainer}>
        <Text style={[styles.label, !enabled && styles.disabledText]}>
          {label}
        </Text>
        {subtitle && !hasSelection && (
          <Text style={styles.subtitle}>{subtitle}</Text>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  nodeContainer: {
    alignItems: 'center',
    width: 80,
    height: 80,
    zIndex: 10,
  },
  nodeCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(20, 20, 20, 0.95)',
    borderWidth: 1.5,
    borderColor: COLORS.emberOrange,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.emberOrange,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 4,
  },
  selectedCircle: {
    borderColor: COLORS.coreWhiteHeat,
    backgroundColor: 'rgba(255, 107, 43, 0.25)',
    borderWidth: 2,
    shadowColor: COLORS.coreWhiteHeat,
    shadowRadius: 8,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.95 }],
  },
  disabled: {
    borderColor: COLORS.disabledNode,
    opacity: 0.35,
  },
  icon: {
    fontSize: 22,
  },
  labelContainer: {
    position: 'absolute',
    top: 60,
    width: 140,
    alignItems: 'center',
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 8,
    color: COLORS.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  disabledText: {
    color: COLORS.textMuted,
  },
});
