import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { COLORS, TYPOGRAPHY } from '@/theme';

export interface PlateRailProps {
  title: string;
  subtitle?: string;
  role?: string;
  isActive?: boolean;
  onPress: () => void;
  position?: 'top' | 'bottom' | 'middle';
}

export const RAIL_HEIGHT = 48;

export function PlateRail({
  title,
  subtitle,
  role,
  isActive = false,
  onPress,
  position = 'top',
}: PlateRailProps) {
  const positionStyle =
    position === 'top'
      ? styles.topRail
      : position === 'bottom'
      ? styles.bottomRail
      : styles.middleRail;

  return (
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
        <Text style={[styles.title, isActive && styles.activeTitle]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
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
  },
  rightContainer: {
    alignItems: 'flex-end',
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
