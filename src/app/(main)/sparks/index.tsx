// ─────────────────────────────────────────────
// Sparks Screen
//
// Capture thoughts. Let them linger. Select them.
// Spark an Ember.
//
// "Capture says: 'Carry this.'
//  Ember says something more like: 'Attend to this.'"
// ─────────────────────────────────────────────

import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';

import { createTextSpark } from '@/core/spark-types';
import type { Spark } from '@/core/spark-types';
import type { EmberSeed } from '@/core/ember-types';
import { createEmberSeed } from '@/core/ember-types';
import { saveSpark, listSparks, associateSparksWithEmber, deleteSpark } from '@/services/spark-storage';
import { saveEmber, loadEmber, listEmbers } from '@/services/ember-storage';
import { loadProject } from '@/services/ember-project-storage';
import { COLORS, TYPOGRAPHY, SPACING } from '@/theme';

export default function SparksScreen() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [sparks, setSparks] = useState<Spark[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sparkFilter, setSparkFilter] = useState<'all' | 'lingering' | 'participating'>('all');
  const [detailSpark, setDetailSpark] = useState<Spark | null>(null);
  const [showEmberPicker, setShowEmberPicker] = useState(false);

  // Reload sparks on focus or filter change
  useFocusEffect(
    useCallback(() => {
      const status = sparkFilter === 'all' ? undefined :
                     sparkFilter === 'lingering' ? 'lingering' as const : 'ember-associated' as const;
      setSparks(listSparks(status));
      setSelectedIds(new Set());
    }, [sparkFilter]),
  );

  // Resolve ember names for participating sparks
  const emberNames = useMemo(() => {
    const map: Record<string, string> = {};
    const uniqueIds = new Set(
      sparks
        .filter(s => s.status === 'ember-associated' && s.emberId)
        .map(s => s.emberId!),
    );
    for (const eid of uniqueIds) {
      const seed = loadEmber(eid);
      if (seed) {
        map[eid] = seed.name || 'Untitled Ember';
        continue;
      }
      const proj = loadProject(eid);
      if (proj) {
        map[eid] = proj.name || 'Untitled Enquiry';
      }
    }
    return map;
  }, [sparks]);

  // ── Capture ──
  const handleCapture = useCallback(() => {
    if (!content.trim()) return;

    const spark = createTextSpark(title.trim(), content.trim());
    saveSpark(spark);
    setTitle('');
    setContent('');
    const status = sparkFilter === 'all' ? undefined :
                   sparkFilter === 'lingering' ? 'lingering' as const : 'ember-associated' as const;
    setSparks(listSparks(status));
  }, [title, content, sparkFilter]);

  // ── Selection (constrained to lingering sparks only) ──
  const toggleSelect = useCallback((spark: Spark) => {
    if (spark.status !== 'lingering') {
      // Participating sparks open detail view instead
      setDetailSpark(spark);
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(spark.id)) {
        next.delete(spark.id);
      } else {
        next.add(spark.id);
      }
      return next;
    });
  }, []);

  // ── Spark a New Ember ──
  // Both paths now converge on EmberSeed as the Ember identity.
  // The user encounters the Ember before Inquiry begins.
  const handleSparkEmber = useCallback(() => {
    const selected = sparks.filter((s) => selectedIds.has(s.id));
    if (selected.length === 0) return;

    const combinedContent = selected
      .map((s) => s.content)
      .join('\n\n');

    // Create an EmberSeed — the Ember identity
    const seed = createEmberSeed('open', {
      name: selected.length === 1 ? selected[0].title : undefined,
      spark: combinedContent,
    });

    // Persist the Ember
    saveEmber(seed);

    // Associate the Sparks with this Ember
    associateSparksWithEmber(
      selected.map((s) => s.id),
      seed.id,
    );

    // Navigate to the Ember View — encounter the Ember before Inquiry
    router.replace(`/(main)/ember/${seed.id}` as any);
  }, [sparks, selectedIds]);

  // ── Participate in Existing Ember ──
  const handleSelectEmber = useCallback((emberId: string) => {
    const selected = sparks.filter((s) => selectedIds.has(s.id));
    if (selected.length === 0) return;

    associateSparksWithEmber(
      selected.map((s) => s.id),
      emberId,
    );
    setShowEmberPicker(false);
    router.replace(`/(main)/ember/${emberId}` as any);
  }, [sparks, selectedIds]);

  // ── Delete lingering sparks ──
  const handleDeleteSparks = useCallback(() => {
    const selected = sparks.filter((s) => selectedIds.has(s.id));
    if (selected.length === 0) return;

    Alert.alert(
      'Delete Sparks',
      `Delete ${selected.length} lingering spark${selected.length > 1 ? 's' : ''}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            for (const s of selected) {
              deleteSpark(s.id);
            }
            const status = sparkFilter === 'all' ? undefined :
                           sparkFilter === 'lingering' ? 'lingering' as const : 'ember-associated' as const;
            setSparks(listSparks(status));
            setSelectedIds(new Set());
          },
        },
      ],
    );
  }, [sparks, selectedIds, sparkFilter]);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Pressable onPress={handleBack} hitSlop={12}>
            <Text style={styles.backArrow}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Sparks</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* ── Capture Section ── */}
        <View style={styles.captureSection}>
          <TextInput
            style={styles.contentInput}
            value={content}
            onChangeText={setContent}
            placeholder="What are you carrying?..."
            placeholderTextColor={COLORS.textMuted}
            multiline
            textAlignVertical="top"
          />
          <TextInput
            style={styles.titleInput}
            value={title}
            onChangeText={setTitle}
            placeholder="Name this spark (optional)"
            placeholderTextColor={COLORS.textMuted}
            returnKeyType="done"
          />
          <Pressable
            onPress={handleCapture}
            style={[
              styles.captureButton,
              !content.trim() && styles.buttonDisabled,
            ]}
            disabled={!content.trim()}
          >
            <Text style={styles.captureButtonText}>Capture Spark</Text>
          </Pressable>
        </View>

        {/* ── Filter Tabs ── */}
        <View style={styles.filterRow}>
          {(['all', 'lingering', 'participating'] as const).map((filter) => (
            <Pressable
              key={filter}
              onPress={() => setSparkFilter(filter)}
              style={[
                styles.filterTab,
                sparkFilter === filter && styles.filterTabActive,
              ]}
            >
              <Text
                style={[
                  styles.filterTabText,
                  sparkFilter === filter && styles.filterTabTextActive,
                ]}
              >
                {filter === 'all' ? 'All' : filter === 'lingering' ? 'Lingering' : 'Participating'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ── Spark List ── */}
        <View style={styles.listSection}>
          <Text style={styles.listLabel}>
            {sparkFilter === 'all' ? 'All' : sparkFilter === 'lingering' ? 'Lingering' : 'Participating'} · {sparks.length} spark
            {sparks.length !== 1 ? 's' : ''}
          </Text>

          <FlatList
            data={sparks}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                {sparkFilter === 'lingering'
                  ? 'No lingering sparks. All sparks have found an Ember.'
                  : sparkFilter === 'participating'
                  ? 'No participating sparks yet. Spark a new Ember to relate sparks.'
                  : 'No sparks yet. Carry something.'}
              </Text>
            }
            renderItem={({ item }) => {
              const isSelected = selectedIds.has(item.id);
              const isParticipating = item.status === 'ember-associated';
              return (
                <Pressable
                  onPress={() => toggleSelect(item)}
                  style={[
                    styles.sparkCard,
                    isSelected && styles.sparkCardSelected,
                    isParticipating && styles.sparkCardParticipating,
                  ]}
                >
                  <Text style={styles.sparkTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.sparkContent} numberOfLines={2}>
                    {item.content}
                  </Text>
                  {isParticipating && item.emberId && emberNames[item.emberId] && (
                    <Text style={styles.sparkEmberName}>
                      → {emberNames[item.emberId]}
                    </Text>
                  )}
                  <Text style={styles.sparkDate}>
                    {formatRelative(item.createdAt)}
                  </Text>
                </Pressable>
              );
            }}
          />
        </View>

        {/* ── Actions (visible when lingering sparks selected) ── */}
        {selectedIds.size > 0 && (
          <View style={styles.footer}>
            <Pressable
              onPress={handleSparkEmber}
              style={styles.emberButton}
            >
              <Text style={styles.emberButtonText}>
                Spark New Ember ({selectedIds.size} selected)
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setShowEmberPicker(true)}
              style={styles.participateButton}
            >
              <Text style={styles.participateButtonText}>
                Participate in Ember
              </Text>
            </Pressable>
            <Pressable
              onPress={handleDeleteSparks}
              style={styles.deleteButton}
            >
              <Text style={styles.deleteButtonText}>
                Delete
              </Text>
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* ── Spark Detail Modal (read-only) ── */}
      <Modal visible={!!detailSpark} transparent animationType="fade" onRequestClose={() => setDetailSpark(null)}>
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setDetailSpark(null)}
        >
          <Pressable style={styles.modalContent} onPress={() => {}}>
            {detailSpark && (
              <>
                <Text style={styles.modalTitle}>{detailSpark.title}</Text>
                <Text style={styles.modalBody}>{detailSpark.content}</Text>
                <Text style={styles.modalMeta}>
                  Captured {formatRelative(detailSpark.createdAt)}
                </Text>
                {detailSpark.emberId && emberNames[detailSpark.emberId] && (
                  <Text style={styles.modalRelation}>
                    Participating in: {emberNames[detailSpark.emberId]}
                  </Text>
                )}
                <Pressable
                  onPress={() => setDetailSpark(null)}
                  style={styles.modalClose}
                >
                  <Text style={styles.modalCloseText}>Close</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Ember Picker Modal ── */}
      <Modal visible={showEmberPicker} transparent animationType="slide" onRequestClose={() => setShowEmberPicker(false)}>
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowEmberPicker(false)}
        >
          <Pressable style={styles.pickerContent} onPress={() => {}}>
            <Text style={styles.pickerTitle}>Choose an Ember</Text>
            <Text style={styles.pickerSubtitle}>
              {selectedIds.size} spark{selectedIds.size > 1 ? 's' : ''} will participate
            </Text>
            <FlatList
              data={listEmbers()}
              keyExtractor={(item) => item.id}
              style={styles.pickerList}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No Embers yet. Create one first.</Text>
              }
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => handleSelectEmber(item.id)}
                  style={styles.pickerItem}
                >
                  <Text style={styles.pickerItemName}>
                    {item.name || 'Untitled Ember'}
                  </Text>
                  <Text style={styles.pickerItemNature}>
                    {item.nature.toUpperCase()}
                  </Text>
                </Pressable>
              )}
            />
            <Pressable
              onPress={() => setShowEmberPicker(false)}
              style={styles.modalClose}
            >
              <Text style={styles.modalCloseText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function formatRelative(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.deepCharcoal,
  },
  flex: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  backArrow: {
    fontSize: 22,
    color: COLORS.emberOrange,
    paddingHorizontal: SPACING.xs,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
  },
  headerSpacer: { width: 36 },

  // Capture
  captureSection: {
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 107, 43, 0.08)',
    gap: SPACING.sm,
  },
  titleInput: {
    backgroundColor: COLORS.surfaceDark,
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textPrimary,
  },
  contentInput: {
    backgroundColor: COLORS.surfaceDark,
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textPrimary,
    minHeight: 80,
  },
  captureButton: {
    backgroundColor: 'rgba(255, 107, 43, 0.15)',
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    alignItems: 'center',
  },
  captureButtonText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: '600',
    color: COLORS.emberOrange,
  },
  buttonDisabled: { opacity: 0.4 },

  // Filter tabs
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.xs,
  },
  filterTab: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.12)',
  },
  filterTabActive: {
    borderColor: COLORS.emberOrange,
    backgroundColor: 'rgba(255, 107, 43, 0.1)',
  },
  filterTabText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textMuted,
    letterSpacing: 0.5,
  },
  filterTabTextActive: {
    color: COLORS.emberOrange,
  },

  // List
  listSection: {
    flex: 1,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
  },
  listLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: SPACING.sm,
  },
  listContent: {
    paddingBottom: SPACING.xl * 4,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.xl,
    fontStyle: 'italic',
  },

  // Spark card
  sparkCard: {
    backgroundColor: COLORS.surfaceDark,
    padding: SPACING.md,
    borderRadius: 10,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.08)',
    gap: 4,
  },
  sparkCardSelected: {
    borderColor: COLORS.emberOrange,
    backgroundColor: 'rgba(255, 107, 43, 0.08)',
  },
  sparkCardParticipating: {
    opacity: 0.7,
  },
  sparkTitle: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  sparkContent: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },
  sparkDate: {
    fontSize: 9,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  sparkEmberName: {
    fontSize: 9,
    color: COLORS.emberOrange,
    opacity: 0.7,
    letterSpacing: 0.5,
    marginTop: 2,
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
    backgroundColor: COLORS.deepCharcoal,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 107, 43, 0.12)',
    gap: SPACING.sm,
  },
  emberButton: {
    backgroundColor: COLORS.emberOrange,
    paddingVertical: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  emberButtonText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: '700',
    color: COLORS.deepCharcoal,
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
  },
  participateButton: {
    backgroundColor: 'rgba(255, 107, 43, 0.1)',
    paddingVertical: SPACING.sm,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.25)',
  },
  participateButtonText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: '600',
    color: COLORS.emberOrange,
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
  },
  deleteButton: {
    paddingVertical: SPACING.xs,
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 10,
    color: COLORS.textMuted,
    opacity: 0.6,
    letterSpacing: 0.5,
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalContent: {
    backgroundColor: COLORS.deepCharcoal,
    borderRadius: 16,
    padding: SPACING.lg,
    width: '100%',
    maxWidth: 340,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.15)',
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  modalBody: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  modalMeta: {
    fontSize: 9,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },
  modalRelation: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.emberOrange,
    opacity: 0.8,
    fontWeight: '600',
  },
  modalClose: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    marginTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 107, 43, 0.08)',
  },
  modalCloseText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textMuted,
  },

  // Ember Picker Modal
  pickerContent: {
    backgroundColor: COLORS.deepCharcoal,
    borderRadius: 16,
    padding: SPACING.lg,
    width: '100%',
    maxWidth: 340,
    maxHeight: '70%',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.15)',
  },
  pickerTitle: {
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  pickerSubtitle: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.textMuted,
    marginBottom: SPACING.md,
  },
  pickerList: {
    maxHeight: 300,
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 107, 43, 0.06)',
  },
  pickerItemName: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textPrimary,
    fontWeight: '500',
    flex: 1,
  },
  pickerItemNature: {
    fontSize: 8,
    color: COLORS.emberOrange,
    letterSpacing: 1,
    opacity: 0.6,
  },
});
