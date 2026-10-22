// ─────────────────────────────────────────────
// Quick Capture Modal — Reusable Spark Capture Surface
//
// "Capture says: 'Carry this.'
//  Ember says something more like: 'Attend to this.'"
//
// Invokable from:
//   - The closed mechanical plates (SPLIT mode)
//   - The TerritoryStage header bar (outside active Inquiry)
//   - Contextually inside Create Ember or Ember View (without
//     unmounting or disrupting unfinished Ember state)
//
// Prioritizes functional text capture while visibly presenting
// Voice and Image capture as honest future capabilities on the
// Spark horizon.
// ─────────────────────────────────────────────

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING } from '@/theme';
import { createTextSpark, type Spark } from '@/core/spark-types';
import { saveSpark } from '@/services/spark-storage';

export interface QuickCaptureModalProps {
  visible: boolean;
  /**
   * 'standalone': shows post-capture discovery ("Let it Linger" vs. "Carry Forward as an Ember")
   * 'attach': immediately attaches the captured Spark to the current Ember creation/view context
   */
  contextMode?: 'standalone' | 'attach';
  /** Optional label when in 'attach' mode (e.g., "New Ember" or Ember title) */
  targetEmberLabel?: string;
  onClose: () => void;
  /** Called whenever a Spark is persisted */
  onCaptured?: (spark: Spark) => void;
  /** In standalone mode, user chooses to immediately create & open an Ember from the caught Spark */
  onCarryIntoNewEmber?: (spark: Spark) => void;
  /** In standalone mode, user chooses to view the Spark inside the Sparks plate */
  onOpenSparksTerritory?: (spark: Spark) => void;
}

type ModalityPreview = 'text' | 'voice' | 'image';

export function QuickCaptureModal({
  visible,
  contextMode = 'standalone',
  targetEmberLabel,
  onClose,
  onCaptured,
  onCarryIntoNewEmber,
  onOpenSparksTerritory,
}: QuickCaptureModalProps) {
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [modality, setModality] = useState<ModalityPreview>('text');
  const [caughtSpark, setCaughtSpark] = useState<Spark | null>(null);
  const contentInputRef = useRef<TextInput>(null);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleInputFocus = useCallback(() => {
    if (focusTimerRef.current) {
      clearTimeout(focusTimerRef.current);
    }
    focusTimerRef.current = setTimeout(() => {
      contentInputRef.current?.focus();
    }, 80);
  }, []);

  // Reset internal state whenever modal opens
  useEffect(() => {
    if (visible) {
      setContent('');
      setTitle('');
      setModality('text');
      setCaughtSpark(null);
    } else if (focusTimerRef.current) {
      clearTimeout(focusTimerRef.current);
      focusTimerRef.current = null;
    }
    return () => {
      if (focusTimerRef.current) {
        clearTimeout(focusTimerRef.current);
        focusTimerRef.current = null;
      }
    };
  }, [visible]);

  const handleCatch = useCallback(() => {
    if (!content.trim()) return;

    const spark = createTextSpark(title.trim(), content.trim());
    saveSpark(spark);
    onCaptured?.(spark);

    if (contextMode === 'attach') {
      // Immediately return to the calling Ember creation / Ember view surface
      onClose();
      return;
    }

    // In standalone mode, reveal the post-capture discovery moment
    setCaughtSpark(spark);
  }, [content, title, contextMode, onCaptured, onClose]);

  const handleCatchAnother = useCallback(() => {
    setContent('');
    setTitle('');
    setModality('text');
    setCaughtSpark(null);
    scheduleInputFocus();
  }, [scheduleInputFocus]);

  const handleCarryForward = useCallback(() => {
    if (!caughtSpark) return;
    const sparkToCarry = caughtSpark;
    onClose();
    onCarryIntoNewEmber?.(sparkToCarry);
  }, [caughtSpark, onClose, onCarryIntoNewEmber]);

  const handleViewInSparks = useCallback(() => {
    if (!caughtSpark) return;
    const sparkToView = caughtSpark;
    onClose();
    onOpenSparksTerritory?.(sparkToView);
  }, [caughtSpark, onClose, onOpenSparksTerritory]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onShow={scheduleInputFocus}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        enabled={Platform.OS === 'ios'}
        style={styles.overlay}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.sheet}>
          {/* ── Top Engraved Header ── */}
          <View style={styles.sheetHeader}>
            <View style={styles.headerTitleGroup}>
              <Text style={styles.sparkGlyph}>⌁</Text>
              <Text style={styles.sheetTitle}>
                {caughtSpark ? 'SPARK CAUGHT' : 'QUICK CAPTURE'}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          {contextMode === 'attach' && !caughtSpark && (
            <View style={styles.contextBanner}>
              <Text style={styles.contextBannerText}>
                WILL PARTICIPATE IN · {(targetEmberLabel || 'THIS EMBER').toUpperCase()}
              </Text>
            </View>
          )}

          {!caughtSpark ? (
            <>
              {/* ── Engraved Modality Bar (Text active; Voice & Image future horizon) ── */}
              <View style={styles.modalityBar}>
                <Pressable
                  onPress={() => setModality('text')}
                  style={[
                    styles.modalityPill,
                    modality === 'text' && styles.modalityPillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.modalityGlyph,
                      modality === 'text' && styles.modalityGlyphActive,
                    ]}
                  >
                    Aa
                  </Text>
                  <Text
                    style={[
                      styles.modalityLabel,
                      modality === 'text' && styles.modalityLabelActive,
                    ]}
                  >
                    TEXT ◆
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setModality(modality === 'voice' ? 'text' : 'voice')}
                  style={[
                    styles.modalityPill,
                    styles.modalityPillFuture,
                    modality === 'voice' && styles.modalityPillFutureSelected,
                  ]}
                >
                  <Text style={styles.modalityGlyphFuture}>🎙</Text>
                  <Text style={styles.modalityLabelFuture}>VOICE</Text>
                  <Text style={styles.soonBadge}>SOON</Text>
                </Pressable>

                <Pressable
                  onPress={() => setModality(modality === 'image' ? 'text' : 'image')}
                  style={[
                    styles.modalityPill,
                    styles.modalityPillFuture,
                    modality === 'image' && styles.modalityPillFutureSelected,
                  ]}
                >
                  <Text style={styles.modalityGlyphFuture}>📷</Text>
                  <Text style={styles.modalityLabelFuture}>IMAGE</Text>
                  <Text style={styles.soonBadge}>SOON</Text>
                </Pressable>
              </View>

              {/* ── Honest Future Capability Whisper when Voice or Image is inspected ── */}
              {modality !== 'text' && (
                <View style={styles.horizonNotice}>
                  <Text style={styles.horizonNoticeTitle}>
                    {modality === 'voice'
                      ? 'Spoken Spark Capture · Horizon Capability'
                      : 'Visual Spark Capture · Horizon Capability'}
                  </Text>
                  <Text style={styles.horizonNoticeBody}>
                    {modality === 'voice'
                      ? 'A Spark may take the form of text, voice, or image. Audio recording is reserved for an upcoming cycle — text capture is active below.'
                      : 'A Spark may take the form of text, voice, or image. Camera & image capture is reserved for an upcoming cycle — text capture is active below.'}
                  </Text>
                </View>
              )}

              {/* ── Primary Thought Input ── */}
              <TextInput
                ref={contentInputRef}
                style={styles.contentInput}
                value={content}
                onChangeText={setContent}
                placeholder="Catch a thought, observation, or fragment worth carrying..."
                placeholderTextColor={COLORS.textMuted}
                multiline
                textAlignVertical="top"
              />

              {/* ── Optional Spark Name ── */}
              <TextInput
                style={styles.titleInput}
                value={title}
                onChangeText={setTitle}
                placeholder="Give this spark a short name (optional)"
                placeholderTextColor={COLORS.textMuted}
                returnKeyType="done"
              />

              {/* ── Primary Capture Action ── */}
              <View style={styles.actionRow}>
                <Pressable onPress={onClose} style={styles.cancelButton}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>

                <Pressable
                  onPress={handleCatch}
                  disabled={!content.trim()}
                  style={[
                    styles.catchButton,
                    !content.trim() && styles.catchButtonDisabled,
                  ]}
                >
                  <Text style={styles.catchButtonText}>
                    {contextMode === 'attach'
                      ? 'Catch & Bring into Ember'
                      : 'Catch Spark'}
                  </Text>
                </Pressable>
              </View>
            </>
          ) : (
            /* ── Post-Capture Discovery Moment (Standalone Mode) ── */
            <View style={styles.caughtContainer}>
              <View style={styles.caughtCard}>
                <View style={styles.caughtCardHeader}>
                  <Text style={styles.caughtStatusBadge}>• LINGERING SPARK</Text>
                  <Text style={styles.caughtInputBadge}>TEXT</Text>
                </View>
                <Text style={styles.caughtTitle} numberOfLines={1}>
                  {caughtSpark.title}
                </Text>
                <Text style={styles.caughtContent} numberOfLines={3}>
                  {caughtSpark.content}
                </Text>
              </View>

              <Text style={styles.discoveryPrompt}>
                This Spark is now held in Sparks. You can let it linger until you need it, or carry it forward into an Ember right now.
              </Text>

              <View style={styles.postActions}>
                <Pressable onPress={ onClose } style={styles.lingerButton}>
                  <Text style={styles.lingerButtonTitle}>Let it Linger</Text>
                  <Text style={styles.lingerButtonSub}>
                    Keep resting in Sparks · return where you were
                  </Text>
                </Pressable>

                {onCarryIntoNewEmber && (
                  <Pressable onPress={handleCarryForward} style={styles.carryEmberButton}>
                    <Text style={styles.carryEmberTitle}>
                      Carry Forward as an Ember →
                    </Text>
                    <Text style={styles.carryEmberSub}>
                      Begin an Ember with this Spark participating
                    </Text>
                  </Pressable>
                )}

                <View style={styles.secondaryPostRow}>
                  {onOpenSparksTerritory && (
                    <Pressable onPress={handleViewInSparks} hitSlop={8}>
                      <Text style={styles.secondaryLinkText}>Open Sparks Territory ↓</Text>
                    </Pressable>
                  )}
                  <Pressable onPress={handleCatchAnother} hitSlop={8}>
                    <Text style={styles.secondaryLinkText}>+ Catch Another</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(10, 9, 7, 0.78)',
  },
  sheet: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#171511',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#6B482E',
    padding: SPACING.lg,
    gap: SPACING.md,
    zIndex: 10,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sparkGlyph: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.emberOrange,
  },
  sheetTitle: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: '#F5ECE0',
  },
  closeBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  closeBtnText: {
    fontSize: 14,
    color: '#8F7A65',
  },
  contextBanner: {
    backgroundColor: 'rgba(255, 107, 43, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.22)',
    borderRadius: 6,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
  },
  contextBannerText: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: COLORS.emberOrange,
  },

  // Engraved Modality Cluster
  modalityBar: {
    flexDirection: 'row',
    gap: 8,
  },
  modalityPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#12110E',
    borderWidth: 1,
    borderColor: '#3A2B1E',
  },
  modalityPillActive: {
    borderColor: COLORS.emberOrange,
    backgroundColor: 'rgba(255, 107, 43, 0.1)',
  },
  modalityPillFuture: {
    opacity: 0.75,
  },
  modalityPillFutureSelected: {
    borderColor: '#8F7A65',
    backgroundColor: '#1E1B16',
    opacity: 1,
  },
  modalityGlyph: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: '#8F7A65',
  },
  modalityGlyphActive: {
    color: COLORS.emberOrange,
  },
  modalityLabel: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#8F7A65',
  },
  modalityLabelActive: {
    color: '#F5ECE0',
  },
  modalityGlyphFuture: {
    fontSize: 11,
  },
  modalityLabelFuture: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 9,
    letterSpacing: 0.8,
    color: '#8F7A65',
  },
  soonBadge: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 7,
    letterSpacing: 0.6,
    color: '#6E5D4D',
    borderWidth: 1,
    borderColor: '#3A2B1E',
    borderRadius: 3,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  horizonNotice: {
    backgroundColor: '#12110E',
    borderLeftWidth: 2,
    borderLeftColor: '#8F7A65',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs + 2,
    borderRadius: 6,
    gap: 2,
  },
  horizonNoticeTitle: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    color: '#BAA28A',
    letterSpacing: 0.8,
  },
  horizonNoticeBody: {
    fontSize: 11,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },

  // Inputs
  contentInput: {
    backgroundColor: '#12110E',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.2)',
    borderRadius: 10,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textPrimary,
    minHeight: 96,
    maxHeight: 160,
  },
  titleInput: {
    backgroundColor: '#12110E',
    borderWidth: 1,
    borderColor: '#3A2B1E',
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.textPrimary,
  },

  // Action row
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
    marginTop: 2,
  },
  cancelButton: {
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.md,
  },
  cancelButtonText: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.textMuted,
    letterSpacing: 0.5,
  },
  catchButton: {
    backgroundColor: COLORS.emberOrange,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.lg,
    borderRadius: 20,
    alignItems: 'center',
  },
  catchButtonDisabled: {
    opacity: 0.35,
  },
  catchButtonText: {
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: '700',
    color: COLORS.deepCharcoal,
    letterSpacing: 0.8,
  },

  // Post-capture discovery state
  caughtContainer: {
    gap: SPACING.md,
  },
  caughtCard: {
    backgroundColor: '#12110E',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.28)',
    borderRadius: 10,
    padding: SPACING.md,
    gap: 4,
  },
  caughtCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  caughtStatusBadge: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.emberOrange,
    letterSpacing: 1,
  },
  caughtInputBadge: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 8,
    color: '#8F7A65',
    letterSpacing: 1,
  },
  caughtTitle: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: '600',
    color: '#F5ECE0',
  },
  caughtContent: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.textSecondary,
    lineHeight: 17,
  },
  discoveryPrompt: {
    fontSize: 11,
    color: '#BAA28A',
    lineHeight: 16,
    fontStyle: 'italic',
  },
  postActions: {
    gap: SPACING.sm,
  },
  lingerButton: {
    backgroundColor: '#1E1B16',
    borderWidth: 1,
    borderColor: '#5A4330',
    borderRadius: 10,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.md,
    gap: 2,
  },
  lingerButtonTitle: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: '600',
    color: '#F5ECE0',
  },
  lingerButtonSub: {
    fontSize: 10,
    color: '#8F7A65',
  },
  carryEmberButton: {
    backgroundColor: 'rgba(255, 107, 43, 0.14)',
    borderWidth: 1,
    borderColor: COLORS.emberOrange,
    borderRadius: 10,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.md,
    gap: 2,
  },
  carryEmberTitle: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: '700',
    color: COLORS.emberOrange,
  },
  carryEmberSub: {
    fontSize: 10,
    color: '#BAA28A',
  },
  secondaryPostRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  secondaryLinkText: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 10,
    color: COLORS.emberOrange,
    letterSpacing: 0.6,
  },
});
