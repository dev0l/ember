import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { COLORS, TYPOGRAPHY } from '@/theme';

export interface PlateCoverProps {
  position: 'top' | 'bottom';
  title: string;
  etchTop?: string;
  etchSub?: string;
  role: string;
  onPress: () => void;
  onQuickCapture?: () => void;
  height: number;
}

export function PlateCover({
  position,
  title,
  etchTop,
  etchSub,
  role,
  onPress,
  onQuickCapture,
  height,
}: PlateCoverProps) {
  const isTop = position === 'top';

  return (
    <View
      style={[
        styles.cover,
        isTop ? styles.topCover : styles.bottomCover,
        { height },
      ]}
    >
      {/* Full-Plate Tap Target */}
      <Pressable
        style={({ pressed }) => [
          StyleSheet.absoluteFill,
          pressed && styles.coverPressed,
        ]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Open ${title} territory`}
      >
        {/* Etch Text (for top cover, stays near top edge) */}
        {isTop && (etchTop || etchSub) ? (
          <View style={styles.topEtchContainer}>
            {etchTop ? <Text style={styles.etch}>{etchTop}</Text> : null}
            {etchSub ? <Text style={styles.etchSub}>{etchSub}</Text> : null}
          </View>
        ) : null}

        {/* Cover Label (sits precisely in the 48px seam edge) */}
        <View style={[styles.labelRow, isTop ? styles.labelRowBottom : styles.labelRowTop]}>
          <View style={styles.titleGroup}>
            <Text style={styles.dot}>•</Text>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
          </View>
          <Text style={styles.role}>{role}</Text>
        </View>

        {/* Etch Text (for bottom cover, stays near bottom edge) */}
        {!isTop && (etchTop || etchSub) ? (
          <View style={styles.bottomEtchContainer}>
            {etchTop ? <Text style={styles.etch}>{etchTop}</Text> : null}
            {etchSub ? <Text style={styles.etchSub}>{etchSub}</Text> : null}
          </View>
        ) : null}
      </Pressable>

      {/* Sibling Engraved Quick Capture Recess (on lower Sparks plate face, below the 48px rail lip) */}
      {!isTop && onQuickCapture ? (
        <View style={styles.quickCaptureContainer} pointerEvents="box-none">
          <Pressable
            onPress={onQuickCapture}
            style={({ pressed }) => [
              styles.quickCaptureRecess,
              pressed && styles.quickCaptureRecessPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Quick capture a spark"
          >
            <View style={styles.quickCaptureLeft}>
              <Text style={styles.quickCaptureGlyph}>⌁</Text>
              <Text style={styles.quickCapturePrompt}>Catch a spark...</Text>
            </View>
            <View style={styles.quickCaptureModalities}>
              <View style={styles.modalityChipActive}>
                <Text style={styles.modalityChipActiveText}>Aa</Text>
              </View>
              <View style={styles.modalityChipMuted}>
                <Text style={styles.modalityChipMutedText}>🎙</Text>
              </View>
              <View style={styles.modalityChipMuted}>
                <Text style={styles.modalityChipMutedText}>📷</Text>
              </View>
            </View>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    width: '100%',
    backgroundColor: '#161511',
    borderWidth: 1,
    borderColor: '#4E3A2A',
    position: 'relative',
    zIndex: 6,
    overflow: 'hidden',
  },
  topCover: {
    borderBottomWidth: 1,
    borderBottomColor: '#B86A35',
  },
  bottomCover: {
    borderTopWidth: 1,
    borderTopColor: '#B86A35',
  },
  coverPressed: {
    backgroundColor: '#1E1C16',
  },
  topEtchContainer: {
    paddingHorizontal: 20,
    paddingTop: 18,
    gap: 3,
  },
  bottomEtchContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 18,
    gap: 3,
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
    position: 'absolute',
    left: 0,
    right: 0,
    height: 48,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  labelRowBottom: {
    bottom: 0,
  },
  labelRowTop: {
    top: 0,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  dot: {
    fontSize: 16,
    color: COLORS.emberOrange,
    includeFontPadding: false,
  },
  title: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '600',
    color: '#F5ECE0',
    letterSpacing: 0.6,
    maxWidth: '70%',
    includeFontPadding: false,
  },
  role: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    color: '#BAA28A',
    textTransform: 'uppercase',
    includeFontPadding: false,
  },
  quickCaptureContainer: {
    position: 'absolute',
    top: 64,
    left: 20,
    right: 20,
    zIndex: 2,
  },
  quickCaptureRecess: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#11100C',
    borderWidth: 1,
    borderColor: '#4A3626',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  quickCaptureRecessPressed: {
    borderColor: COLORS.emberOrange,
    backgroundColor: '#191711',
  },
  quickCaptureLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickCaptureGlyph: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.emberOrange,
  },
  quickCapturePrompt: {
    fontSize: 13,
    color: '#C4B19B',
    letterSpacing: 0.4,
  },
  quickCaptureModalities: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modalityChipActive: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.4)',
    backgroundColor: 'rgba(255, 107, 43, 0.1)',
  },
  modalityChipActiveText: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.emberOrange,
    letterSpacing: 0.5,
  },
  modalityChipMuted: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#2E2319',
    backgroundColor: '#16140F',
    opacity: 0.65,
  },
  modalityChipMutedText: {
    fontSize: 9,
  },
});
