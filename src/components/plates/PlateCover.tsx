import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  SharedValue,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { COLORS, TYPOGRAPHY } from '@/theme';
import { PlateFieldCanvas, type PlateEmberFieldItem } from './PlateFieldCanvas';

export interface PlateCoverProps {
  position: 'top' | 'bottom';
  title: string;
  etchTop?: string;
  etchSub?: string;
  role: string;
  onPress: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onQuickCapture?: () => void;
  height: number;
  isSplit?: boolean;
  openProgress?: SharedValue<number>;
  travel?: number;
  emberSummaries?: PlateEmberFieldItem[];
  lingeringCount?: number;
  onDragPreviewTerritory?: (territory: 'embers' | 'sparks') => void;
}

const SWIPE_THRESHOLD = 22;
const VELOCITY_THRESHOLD = 260;
const SNAP_EASING = Easing.bezier(0.32, 0.04, 0.18, 1);

export function PlateCover({
  position,
  title,
  etchTop,
  etchSub,
  role,
  onPress,
  onSwipeUp,
  onSwipeDown,
  onQuickCapture,
  height,
  isSplit = true,
  openProgress,
  travel = 240,
  emberSummaries = [],
  lingeringCount = 0,
  onDragPreviewTerritory,
}: PlateCoverProps) {
  const isTop = position === 'top';
  const startOpenVal = useSharedValue(0);

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

  const notifyPreview = useCallback(() => {
    onDragPreviewTerritory?.(isTop ? 'embers' : 'sparks');
  }, [onDragPreviewTerritory, isTop]);

  const panGesture = Gesture.Pan()
    .activeOffsetY([-10, 10])
    .failOffsetX([-28, 28])
    .onStart(() => {
      startOpenVal.value = openProgress ? openProgress.value : isSplit ? 0 : 1;
      if (isSplit && onDragPreviewTerritory) {
        scheduleOnRN(notifyPreview);
      }
    })
    .onUpdate((e) => {
      if (!openProgress) return;
      const effectiveTravel = Math.max(120, travel);
      const delta = Math.abs(e.translationY) / effectiveTravel;
      if (startOpenVal.value < 0.5) {
        // Scrubbing plates apart from Split (0 -> 1)
        openProgress.value = Math.min(1, Math.max(0, delta));
      } else {
        // Scrubbing plates back toward Split (1 -> 0.15)
        openProgress.value = Math.max(0.15, Math.min(1, 1 - delta));
      }
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
      } else if (openProgress) {
        openProgress.value = withTiming(startOpenVal.value, {
          duration: 260,
          easing: SNAP_EASING,
        });
      }
    });

  // Smoothly fade the interior field etchings as the plate collapses into a 48px rail
  const fieldAnimatedStyle = useAnimatedStyle(() => {
    const progress = openProgress ? openProgress.value : isSplit ? 0 : 1;
    const opacity = Math.max(0, 1 - progress * 1.45);
    return {
      opacity,
    };
  });

  // Preview summary inscription on the Upper Embers Plate in Split mode
  const primaryEmber = emberSummaries[0] ?? null;

  return (
    <View
      style={[
        styles.cover,
        isTop ? styles.topCover : styles.bottomCover,
        { height },
      ]}
    >
      {/* Living Technical Grid, Constellation Cores (Upper) & Electron Motes (Lower) */}
      <Animated.View
        style={[StyleSheet.absoluteFill, fieldAnimatedStyle]}
        pointerEvents="none"
      >
        <PlateFieldCanvas
          position={position}
          height={height}
          emberSummaries={emberSummaries}
          lingeringCount={lingeringCount}
        />
      </Animated.View>

      {/* Full-Plate Tap & Continuous Vertical Pan Target */}
      <GestureDetector gesture={panGesture}>
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
            <Animated.View style={[styles.topEtchContainer, fieldAnimatedStyle]}>
              <View style={styles.etchHeaderRow}>
                <View style={styles.etchTextCol}>
                  {etchTop ? <Text style={styles.etch}>{etchTop}</Text> : null}
                  {etchSub ? <Text style={styles.etchSub}>{etchSub}</Text> : null}
                </View>
                {emberSummaries.length > 0 && (
                  <View style={styles.constellationReadoutPill}>
                    <Text style={styles.constellationReadoutDot}>✦</Text>
                    <Text style={styles.constellationReadoutText}>
                      {emberSummaries.length} ACTIVE
                    </Text>
                  </View>
                )}
              </View>
              {primaryEmber && (
                <Text style={styles.primaryEmberWhisper} numberOfLines={1}>
                  {primaryEmber.title} · {primaryEmber.sparkCount} spark
                  {primaryEmber.sparkCount === 1 ? '' : 's'}
                </Text>
              )}
            </Animated.View>
          ) : null}

          {/* Cover Label (sits precisely in the 48px seam edge) */}
          <View style={[styles.labelRow, isTop ? styles.labelRowBottom : styles.labelRowTop]}>
            <View style={styles.titleGroup}>
              <Text style={styles.dot}>•</Text>
              <Text style={styles.title} numberOfLines={1}>{title}</Text>
            </View>
            <Text style={styles.role} numberOfLines={1} ellipsizeMode="tail">
              {role}
            </Text>
          </View>

          {/* Etch Text (for bottom cover, stays near bottom edge) */}
          {!isTop && (etchTop || etchSub) ? (
            <Animated.View style={[styles.bottomEtchContainer, fieldAnimatedStyle]}>
              {etchTop ? <Text style={styles.etch}>{etchTop}</Text> : null}
              {etchSub ? <Text style={styles.etchSub}>{etchSub}</Text> : null}
            </Animated.View>
          ) : null}
        </Pressable>
      </GestureDetector>

      {/* Sibling Engraved Quick Capture Recess (on lower Sparks plate face, below the 48px rail lip) */}
      {!isTop && onQuickCapture ? (
        <Animated.View
          style={[styles.quickCaptureContainer, fieldAnimatedStyle]}
          pointerEvents={isSplit ? 'box-none' : 'none'}
        >
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
        </Animated.View>
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
    backgroundColor: 'rgba(255, 107, 43, 0.03)',
  },
  topEtchContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 5,
  },
  etchHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  etchTextCol: {
    gap: 3,
    flex: 1,
  },
  constellationReadoutPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 77, 0.28)',
    backgroundColor: 'rgba(255, 107, 43, 0.08)',
  },
  constellationReadoutDot: {
    fontSize: 9,
    color: COLORS.emberGold,
  },
  constellationReadoutText: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#E5CFAF',
  },
  primaryEmberWhisper: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 9,
    letterSpacing: 0.8,
    color: '#B59B80',
    marginTop: 2,
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
    flexShrink: 0,
    marginRight: 12,
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
    includeFontPadding: false,
  },
  role: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    color: '#BAA28A',
    textTransform: 'uppercase',
    includeFontPadding: false,
    flexShrink: 1,
    maxWidth: '62%',
    textAlign: 'right',
  },
  quickCaptureContainer: {
    position: 'absolute',
    top: 56,
    left: 20,
    right: 20,
    zIndex: 2,
  },
  quickCaptureRecess: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(17, 16, 12, 0.92)',
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
