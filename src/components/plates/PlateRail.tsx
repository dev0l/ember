import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  SharedValue,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { COLORS, TYPOGRAPHY } from '@/theme';

export interface PlateRailProps {
  title: string;
  subtitle?: string;
  role?: string;
  isActive?: boolean;
  onPress: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  position?: 'top' | 'bottom' | 'middle';
  railProgress?: SharedValue<number>;
  travelDistance?: number;
}

export const RAIL_HEIGHT = 48;
const SWIPE_THRESHOLD = 22;
const VELOCITY_THRESHOLD = 240;
const SNAP_EASING = Easing.bezier(0.32, 0.04, 0.18, 1);

export function PlateRail({
  title,
  subtitle,
  role,
  isActive = false,
  onPress,
  onSwipeUp,
  onSwipeDown,
  position = 'top',
  railProgress,
  travelDistance = 260,
}: PlateRailProps) {
  const startVal = useSharedValue(0);

  const triggerUp = useCallback(() => {
    if (onSwipeUp) {
      onSwipeUp();
    } else {
      onPress();
    }
  }, [onSwipeUp, onPress]);

  const triggerDown = useCallback(() => {
    if (onSwipeDown) {
      onSwipeDown();
    } else {
      onPress();
    }
  }, [onSwipeDown, onPress]);

  const panGesture = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .failOffsetX([-28, 28])
    .onStart(() => {
      startVal.value = railProgress ? railProgress.value : 0;
    })
    .onUpdate((e) => {
      if (!railProgress) return;
      const effectiveTravel = Math.max(120, travelDistance);
      // Dragging up (translationY < 0) increases railProgress toward 1
      const next = startVal.value - e.translationY / effectiveTravel;
      railProgress.value = Math.min(1, Math.max(0, next));
    })
    .onEnd((e) => {
      const crossedDistance = Math.abs(e.translationY) >= SWIPE_THRESHOLD;
      const crossedVelocity = Math.abs(e.velocityY) >= VELOCITY_THRESHOLD;

      if (crossedDistance || crossedVelocity) {
        if (e.translationY < 0) {
          scheduleOnRN(triggerUp);
        } else {
          scheduleOnRN(triggerDown);
        }
      } else if (railProgress) {
        railProgress.value = withTiming(startVal.value, {
          duration: 240,
          easing: SNAP_EASING,
        });
      }
    });

  const positionStyle =
    position === 'top'
      ? styles.topRail
      : position === 'bottom'
      ? styles.bottomRail
      : styles.middleRail;

  return (
    <GestureDetector gesture={panGesture}>
      <Pressable
        style={({ pressed }) => [
          styles.rail,
          positionStyle,
          isActive && styles.activeRail,
          pressed && styles.pressedRail,
        ]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${title} plate. ${role || ''}`}
      >
        <View style={styles.leftContainer}>
          <Text style={[styles.dot, isActive && styles.activeDot]}>•</Text>
          <Text
            style={[styles.title, isActive && styles.activeTitle]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1} ellipsizeMode="tail">
              {subtitle}
            </Text>
          ) : null}
        </View>

        {role ? (
          <View style={styles.rightContainer}>
            <Text style={[styles.role, isActive && styles.activeRole]}>{role}</Text>
          </View>
        ) : null}
      </Pressable>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  rail: {
    height: RAIL_HEIGHT,
    paddingHorizontal: 20,
    backgroundColor: '#1E1B16',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
    borderWidth: 1,
    borderColor: '#4A3727',
  },
  topRail: {
    borderTopWidth: 0,
    borderBottomWidth: 1,
  },
  bottomRail: {
    borderBottomWidth: 0,
    borderTopWidth: 1,
  },
  middleRail: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderTopColor: '#5A4330',
    borderBottomColor: '#3A2B1E',
  },

  activeRail: {
    borderColor: '#8C5632',
    backgroundColor: '#25211B',
  },
  pressedRail: {
    backgroundColor: '#2E2820',
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  dot: {
    fontSize: 16,
    color: '#8C7861',
  },
  activeDot: {
    color: COLORS.emberOrange,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
    letterSpacing: 0.5,
    includeFontPadding: false,
    flexShrink: 1,
  },
  activeTitle: {
    color: '#FFF2E0',
  },
  subtitle: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    marginLeft: 4,
    maxWidth: '50%',
    includeFontPadding: false,
    flexShrink: 0,
  },
  rightContainer: {
    alignItems: 'flex-end',
    flexShrink: 0,
    marginLeft: 12,
  },
  role: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    color: '#A8947E',
    textTransform: 'uppercase',
    includeFontPadding: false,
  },
  activeRole: {
    color: COLORS.emberOrange,
    fontWeight: '700',
  },
});
