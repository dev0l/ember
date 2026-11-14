// ─────────────────────────────────────────────
// PrivacyPolicyModal — In-App Sovereign Privacy Policy Sheet
//
// Displays Ember's complete Local-First Privacy Policy offline
// inside a mechanical-plate modal sheet, with direct links to
// the public web policy (https://www.dev0l.com/ember/privacy/)
// and developer contact email (marcus.mobark@gmail.com).
// ─────────────────────────────────────────────

import React, { useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Linking,
} from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING } from '@/theme';
import {
  PRIVACY_POLICY_URL,
  PRIVACY_POLICY_CONTACT_EMAIL,
  PRIVACY_POLICY_EFFECTIVE_DATE,
  PRIVACY_POLICY_APP_VERSION,
  PRIVACY_POLICY_PACKAGE_ID,
  PRIVACY_POLICY_HIGHLIGHTS,
  PRIVACY_POLICY_SECTIONS,
} from '@/core/privacy-policy';

export interface PrivacyPolicyModalProps {
  visible: boolean;
  onClose: () => void;
}

export function PrivacyPolicyModal({ visible, onClose }: PrivacyPolicyModalProps) {
  const handleOpenWebPolicy = useCallback(async () => {
    try {
      await Linking.openURL(PRIVACY_POLICY_URL);
    } catch {
      // Fallback no-op if no browser handler is available on device
    }
  }, []);

  const handleContactEmail = useCallback(async () => {
    try {
      await Linking.openURL(
        `mailto:${PRIVACY_POLICY_CONTACT_EMAIL}?subject=Ember%20Privacy%20Inquiry`,
      );
    } catch {
      // Fallback no-op if no mail client is configured
    }
  }, []);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.sheet}>
          {/* ── Top Plate Header ── */}
          <View style={styles.header}>
            <View style={styles.headerTextCol}>
              <Text style={styles.badge}>
                ✦ LOCAL-FIRST & SOVEREIGN BY DESIGN
              </Text>
              <Text style={styles.title}>Ember Privacy Policy</Text>
              <Text style={styles.meta}>
                {PRIVACY_POLICY_PACKAGE_ID} · v{PRIVACY_POLICY_APP_VERSION} · Effective{' '}
                {PRIVACY_POLICY_EFFECTIVE_DATE}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={styles.closeIconBtn}
              accessibilityRole="button"
              accessibilityLabel="Close Privacy Policy"
            >
              <Text style={styles.closeIconText}>✕</Text>
            </Pressable>
          </View>

          {/* ── Scrollable Policy Body ── */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
          >
            {/* Summary Highlights Box */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryCardHeader}>
                AT A GLANCE — ZERO DATA COLLECTION
              </Text>
              {PRIVACY_POLICY_HIGHLIGHTS.map((item) => (
                <View key={item.label} style={styles.highlightRow}>
                  <Text style={styles.highlightBullet}>◆</Text>
                  <View style={styles.highlightTextCol}>
                    <Text style={styles.highlightLabel}>{item.label}</Text>
                    <Text style={styles.highlightDetail}>{item.detail}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Full Policy Sections */}
            {PRIVACY_POLICY_SECTIONS.map((section) => (
              <View key={section.id} style={styles.sectionBlock}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionNumber}>{section.number}</Text>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                </View>

                {section.paragraphs.map((p, idx) => {
                  const isEmailLine = p === PRIVACY_POLICY_CONTACT_EMAIL;
                  if (isEmailLine) {
                    return (
                      <Pressable
                        key={`${section.id}-p-${idx}`}
                        onPress={handleContactEmail}
                        style={styles.emailPill}
                      >
                        <Text style={styles.emailPillText}>
                          ✉ {PRIVACY_POLICY_CONTACT_EMAIL}
                        </Text>
                      </Pressable>
                    );
                  }
                  return (
                    <Text key={`${section.id}-p-${idx}`} style={styles.paragraph}>
                      {p}
                    </Text>
                  );
                })}

                {section.bullets && section.bullets.length > 0 && (
                  <View style={styles.bulletList}>
                    {section.bullets.map((b, bIdx) => (
                      <View key={`${section.id}-b-${bIdx}`} style={styles.bulletRow}>
                        <Text style={styles.bulletDot}>•</Text>
                        <Text style={styles.bulletText}>{b}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}

            {/* Canonical Web URL Note */}
            <View style={styles.canonicalBox}>
              <Text style={styles.canonicalLabel}>CANONICAL WEB URL</Text>
              <Text style={styles.canonicalUrl} selectable>
                {PRIVACY_POLICY_URL}
              </Text>
            </View>
          </ScrollView>

          {/* ── Bottom Action Bar ── */}
          <View style={styles.footer}>
            <Pressable
              onPress={handleOpenWebPolicy}
              style={styles.webLinkBtn}
              accessibilityRole="link"
              accessibilityLabel="View Online Privacy Policy"
            >
              <Text style={styles.webLinkBtnText}>View Online Policy ↗</Text>
            </Pressable>

            <Pressable
              onPress={onClose}
              style={styles.doneBtn}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Text style={styles.doneBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xl,
  },
  sheet: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '88%',
    backgroundColor: '#141310',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#5A4330',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm + 2,
    backgroundColor: '#1B1814',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 107, 43, 0.18)',
    gap: SPACING.sm,
  },
  headerTextCol: {
    flex: 1,
    gap: 3,
  },
  badge: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.emberOrange,
    letterSpacing: 1.2,
  },
  title: {
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: '700',
    color: '#F5ECE0',
    letterSpacing: 0.3,
  },
  meta: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 9,
    color: COLORS.textMuted,
    letterSpacing: 0.4,
  },
  closeIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(168, 132, 94, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIconText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  scrollArea: {
    flexGrow: 0,
  },
  scrollContent: {
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  summaryCard: {
    backgroundColor: 'rgba(255, 107, 43, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255, 158, 68, 0.28)',
    borderRadius: 12,
    padding: SPACING.md,
    gap: 10,
  },
  summaryCardHeader: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.emberGold,
    letterSpacing: 1.2,
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  highlightBullet: {
    fontSize: 10,
    color: COLORS.emberOrange,
    marginTop: 2,
  },
  highlightTextCol: {
    flex: 1,
    gap: 2,
  },
  highlightLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F5ECE0',
  },
  highlightDetail: {
    fontSize: 11,
    color: '#C9BBAE',
    lineHeight: 16,
  },
  sectionBlock: {
    gap: 6,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  sectionNumber: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.emberOrange,
    letterSpacing: 0.8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F5ECE0',
    flex: 1,
  },
  paragraph: {
    fontSize: 11.5,
    color: '#C8B9AB',
    lineHeight: 17,
  },
  bulletList: {
    gap: 5,
    marginTop: 2,
    paddingLeft: 4,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
  },
  bulletDot: {
    fontSize: 12,
    color: COLORS.emberGold,
    lineHeight: 17,
  },
  bulletText: {
    flex: 1,
    fontSize: 11,
    color: '#BEB0A2',
    lineHeight: 16,
  },
  emailPill: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 107, 43, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 158, 68, 0.35)',
  },
  emailPillText: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.emberGold,
  },
  canonicalBox: {
    marginTop: 4,
    padding: SPACING.sm + 2,
    borderRadius: 10,
    backgroundColor: '#0E0D0B',
    borderWidth: 1,
    borderColor: 'rgba(168, 132, 94, 0.22)',
    gap: 3,
  },
  canonicalLabel: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 8.5,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 1.1,
  },
  canonicalUrl: {
    fontFamily: TYPOGRAPHY.fonts.mono,
    fontSize: 10.5,
    color: COLORS.emberOrange,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 2,
    backgroundColor: '#1B1814',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 107, 43, 0.16)',
    gap: SPACING.sm,
  },
  webLinkBtn: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 107, 43, 0.14)',
    borderWidth: 1,
    borderColor: COLORS.emberOrange,
    alignItems: 'center',
  },
  webLinkBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.emberOrange,
    letterSpacing: 0.3,
  },
  doneBtn: {
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: '#24201A',
    borderWidth: 1,
    borderColor: '#5A4330',
    alignItems: 'center',
  },
  doneBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F5ECE0',
  },
});
