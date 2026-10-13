import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated from 'react-native-reanimated';
import { COLORS, TYPOGRAPHY } from '@/theme';

export interface PlateCoverProps {
  position: 'top' | 'bottom';
  title: string;
  etchTop?: string;
  etchSub?: string;
  role: string;
  onPress: () => void;
  height: number;
}

export function PlateCover({
  position,
  title,
  etchTop,
  etchSub,
  role,
  onPress,
  height,
}: PlateCoverProps) {
  const isTop = position === 'top';

  return (
    <Pressable
      style={({ pressed }) => [
        styles.cover,
        isTop ? styles.topCover : styles.bottomCover,
        { height },
        pressed && styles.coverPressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${title} territory`}
    >
      {/* Etch Text */}
      {isTop ? (
        <View style={styles.topEtchContainer}>
          <Text style={styles.etch}>{etchTop}</Text>
          <Text style={styles.etchSub}>{etchSub}</Text>
        </View>
      ) : null}

      {/* Cover Label (sits at the seam edge) */}
      <View style={[styles.labelRow, isTop ? styles.labelRowBottom : styles.labelRowTop]}>
        <View style={styles.titleGroup}>
          <Text style={styles.dot}>•</Text>
          <Text style={styles.title}>{title}</Text>
        </View>
        <Text style={styles.role}>{role}</Text>
      </View>

      {/* Etch Text (for bottom cover) */}
      {!isTop ? (
        <View style={styles.bottomEtchContainer}>
          <Text style={styles.etch}>{etchTop}</Text>
          <Text style={styles.etchSub}>{etchSub}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cover: {
    width: '100%',
    backgroundColor: '#161511',
    borderWidth: 1,
    borderColor: '#4E3A2A',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 18,
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 6,
  },
  topCover: {
    top: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#B86A35',
  },
  bottomCover: {
    bottom: 0,
    borderTopWidth: 1,
    borderTopColor: '#B86A35',
  },
  coverPressed: {
    backgroundColor: '#1E1C16',
  },
  topEtchContainer: {
    gap: 2,
    marginTop: 8,
  },
  bottomEtchContainer: {
    gap: 2,
    marginBottom: 8,
  },
  etch: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    color: '#8F7A65',
    textTransform: 'uppercase',
  },
  etchSub: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 9,
    letterSpacing: 1.4,
    color: '#6E5D4D',
    textTransform: 'uppercase',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
  },
  labelRowBottom: {
    marginBottom: 0,
  },
  labelRowTop: {
    marginTop: 0,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    fontSize: 18,
    color: COLORS.emberOrange,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#F5ECE0',
    letterSpacing: 0.8,
  },
  role: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 12,
    letterSpacing: 1.5,
    color: '#BAA28A',
    textTransform: 'uppercase',
  },
});
