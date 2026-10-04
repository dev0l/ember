// ─────────────────────────────────────────────
// Ember View
//
// "The user may see the Markdown directly during this prototype."
//
// Loads a persisted Ember by ID and renders its Markdown content.
// For the prototype, this shows the raw Markdown with warm styling.
// Later, this becomes the living surface where questions,
// annotations, and deeper exploration happen.
// ─────────────────────────────────────────────

import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';

import { COLORS, TYPOGRAPHY, SPACING } from '@/theme';
import type { EmberSeed } from '@/core';
import type { Spark } from '@/core/spark-types';
import type { EmberProject } from '@/core/ember-project-types';
import { emberSeedToProject } from '@/core';
import { loadEmber, loadEmberMarkdown, deleteEmber } from '@/services/ember-storage';
import { listSparks, saveSpark } from '@/services/spark-storage';
import {
  loadLatestDesignPack,
  loadProjectByEmberId,
  saveProject,
  saveDesignPack,
} from '@/services/ember-project-storage';
import {
  getFoundationalQuestions,
  getAvailableExploratoryQuestions,
} from '@/knowledge/questions';
import { generateDesignPack } from '@/engine/design-pack-generator';

export default function EmberViewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [seed, setSeed] = useState<EmberSeed | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [participatingSparks, setParticipatingSparks] = useState<Spark[]>([]);
  const [project, setProject] = useState<EmberProject | null>(null);
  const [designPack, setDesignPack] = useState<{ version: number } | null>(null);
  const [loading, setLoading] = useState(true);

  // Derived progression state
  const foundationalCount = useMemo(() => getFoundationalQuestions().length, []);

  const progression = useMemo(() => {
    if (!project) return { developed: false, exploring: false, explored: false, generated: false, canExplore: false, canGenerate: false };
    const developed = project.answers.length >= foundationalCount;
    const hasExploratoryAnswers = project.answers.length > foundationalCount;
    const generated = project.designPackVersion > 0;
    const availableExploratory = developed
      ? getAvailableExploratoryQuestions(
          project.askedQuestionIds,
          project.conditions.map(c => c.id),
        )
      : [];
    const moreToExplore = availableExploratory.length > 0;
    // exploring: has begun exploratory but more questions remain
    const exploring = hasExploratoryAnswers && moreToExplore;
    // explored: has answered at least one exploratory AND no more remain
    const explored = hasExploratoryAnswers && !moreToExplore;
    // canExplore: developed, has available exploratory questions, hasn't finished
    const canExplore = developed && !generated && moreToExplore;
    // canGenerate: developed is sufficient. Explore is voluntary enrichment,
    // not a gate. Generation becomes available once Develop establishes
    // the foundational conditions. Do not promote "all exploratory questions
    // exhausted" into domain truth for when generation is warranted.
    const canGenerate = developed && !generated;
    return { developed, exploring, explored, generated, canExplore, canGenerate };
  }, [project, foundationalCount]);

  // Reload every time this screen comes into focus (e.g. after editing or returning from session)
  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      setLoading(true);
      const loadedSeed = loadEmber(id);
      const loadedMarkdown = loadEmberMarkdown(id);
      setSeed(loadedSeed);
      setMarkdown(loadedMarkdown);

      // Find Sparks that participate in this Ember
      const associated = listSparks('ember-associated')
        .filter(s => s.emberId === id);
      setParticipatingSparks(associated);

      // Discover associated EmberProject via indexed lookup
      const associatedProject = loadProjectByEmberId(id) ?? null;
      setProject(associatedProject);

      // Load latest Design Pack if generated
      if (associatedProject && associatedProject.designPackVersion > 0) {
        const pack = loadLatestDesignPack(associatedProject.id);
        setDesignPack(pack ? { version: pack.version } : null);
      } else {
        setDesignPack(null);
      }

      setLoading(false);
    }, [id]),
  );

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }, []);

  const handleEdit = useCallback(() => {
    if (id) {
      router.push(`/(main)/ember/edit/${id}` as any);
    }
  }, [id]);

  // ── Develop further: cross from initiation into enquiry ──
  const handleDevelop = useCallback(() => {
    if (!seed) return;

    // The crossing: EmberSeed → EmberProject
    const newProject = emberSeedToProject(seed);
    saveProject(newProject);

    // Navigate to the Ember Session with the new project
    router.push({
      pathname: '/(main)/ember-session/[id]',
      params: { id: newProject.id },
    } as any);
  }, [seed]);

  // ── Explore further: enter exploratory phase of existing inquiry ──
  const handleExplore = useCallback(() => {
    if (!project) return;
    router.push({
      pathname: '/(main)/ember-session/[id]',
      params: { id: project.id, startPhase: 'exploratory' },
    } as any);
  }, [project]);

  // ── Generate Design Pack from the Ember surface ──
  const handleGenerateFromEmber = useCallback(() => {
    if (!project) return;
    try {
      const packMarkdown = generateDesignPack(project);
      const version = project.designPackVersion + 1;
      saveDesignPack(project.id, version, packMarkdown);
      const updated: EmberProject = {
        ...project,
        status: 'generated',
        designPackVersion: version,
        updatedAt: new Date().toISOString(),
      };
      saveProject(updated);
      setProject(updated);
      setDesignPack({ version });
      router.push({
        pathname: '/(main)/design-pack/[id]',
        params: { id: project.id },
      } as any);
    } catch (error) {
      Alert.alert('Generation failed', 'Something went wrong generating the Design Pack.');
      if (__DEV__) console.error('🔥 [Ember] Design Pack generation error:', error);
    }
  }, [project]);

  // ── Remove Ember ──
  // Guardian amendment: only undeveloped Embers can be removed cleanly.
  // Developed Embers encounter the relational boundary.
  const handleRemove = useCallback(() => {
    if (!seed || !id) return;

    if (project) {
      // This Ember has an associated Inquiry — removal is relationally non-trivial
      Alert.alert(
        'Removal boundary',
        'This Ember has been developed into an Inquiry. Removing an Ember with existing Inquiry lineage requires answering questions about what happens to conditions, propositions, and any generated artifacts.\n\nThis boundary has become relationally non-trivial. Removal for developed Embers is deferred to the database cycle.',
        [{ text: 'OK' }],
      );
      return;
    }

    Alert.alert(
      'Remove Ember',
      `Remove this Ember?${participatingSparks.length > 0 ? ` ${participatingSparks.length} participating Spark${participatingSparks.length > 1 ? 's' : ''} will return to Lingering.` : ''}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            // Release participating Sparks to lingering
            for (const spark of participatingSparks) {
              saveSpark({ ...spark, status: 'lingering', emberId: undefined });
            }
            // Delete the EmberSeed
            deleteEmber(id);
            // Navigate away
            router.replace('/');
          },
        },
      ],
    );
  }, [seed, id, project, participatingSparks]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={COLORS.emberOrange} size="large" />
          <Text style={styles.loadingText}>Loading Ember...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!seed || !markdown) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Ember not found</Text>
          <Pressable onPress={handleBack} style={styles.backButtonCenter}>
            <Text style={styles.backButtonText}>Return to Hub</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Display title from seed
  const title = seed.name || `Untitled ${seed.nature.charAt(0).toUpperCase() + seed.nature.slice(1)}`;

  // Remove frontmatter from display markdown
  const displayMarkdown = markdown.replace(/^---\n[\s\S]*?\n---\n*/, '');

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Header Bar ── */}
      <View style={styles.headerBar}>
        <Pressable onPress={handleBack} hitSlop={12}>
          <Text style={styles.backArrow}>←</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <Pressable onPress={handleEdit} hitSlop={12}>
          <Text style={styles.editButton}>Edit</Text>
        </Pressable>
      </View>

      {/* ── Divider ── */}
      <View style={styles.divider} />

      {/* ── Markdown Content ── */}
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Render markdown as styled text blocks */}
        {renderMarkdownBlocks(displayMarkdown)}

        {/* ── Participating Sparks ── */}
        {participatingSparks.length > 0 && (
          <View style={styles.sparksSection}>
            <Text style={styles.sparksSectionTitle}>
              PARTICIPATING SPARKS · {participatingSparks.length}
            </Text>
            {participatingSparks.map((spark) => (
              <View key={spark.id} style={styles.sparkItem}>
                <Text style={styles.sparkItemTitle} numberOfLines={1}>
                  {spark.title}
                </Text>
                <Text style={styles.sparkItemContent} numberOfLines={2}>
                  {spark.content}
                </Text>
                <Text style={styles.sparkItemDate}>
                  {formatDate(spark.createdAt)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Inquiry Progression ── */}
        <View style={styles.developSection}>
          <View style={styles.developDivider} />

          {/* Develop */}
          {!project ? (
            <Pressable onPress={handleDevelop} style={styles.developButton}>
              <Text style={styles.developButtonText}>
                Develop
              </Text>
              <Text style={styles.developButtonHint}>
                Carry this into structured enquiry
              </Text>
            </Pressable>
          ) : !progression.developed ? (
            <Pressable
              onPress={() => router.push({
                pathname: '/(main)/ember-session/[id]',
                params: { id: project.id },
              } as any)}
              style={styles.developButton}
            >
              <Text style={styles.developButtonText}>
                Developing
              </Text>
              <Text style={styles.developButtonHint}>
                {project.answers.length} of {foundationalCount} answered
              </Text>
            </Pressable>
          ) : (
            <View style={styles.completedMovement}>
              <Text style={styles.completedText}>✓ Developed</Text>
              <Text style={styles.completedHint}>
                {project.conditions.length} condition{project.conditions.length !== 1 ? 's' : ''} established
              </Text>
            </View>
          )}

          {/* Explore */}
          {progression.canExplore && (
            <Pressable onPress={handleExplore} style={styles.developButton}>
              <Text style={styles.developButtonText}>
                Explore
              </Text>
              <Text style={styles.developButtonHint}>
                Voluntary questions from what has been established
              </Text>
            </Pressable>
          )}
          {progression.exploring && (
            <Pressable onPress={handleExplore} style={styles.developButton}>
              <Text style={styles.developButtonText}>
                Exploring
              </Text>
              <Text style={styles.developButtonHint}>
                {project!.answers.length - foundationalCount} answered · more available
              </Text>
            </Pressable>
          )}
          {progression.explored && (
            <View style={styles.completedMovement}>
              <Text style={styles.completedText}>✓ Explored</Text>
              <Text style={styles.completedHint}>
                {project!.answers.length - foundationalCount} additional answer{project!.answers.length - foundationalCount !== 1 ? 's' : ''}
              </Text>
            </View>
          )}

          {/* Generate Design Pack */}
          {progression.canGenerate && !progression.generated && (
            <Pressable onPress={handleGenerateFromEmber} style={[styles.developButton, styles.generateButton]}>
              <Text style={styles.generateButtonText}>
                Generate Design Pack
              </Text>
              <Text style={styles.developButtonHint}>
                From what has been established
              </Text>
            </Pressable>
          )}

          {/* View Design Pack (consequence visible from Ember) */}
          {progression.generated && designPack && (
            <Pressable
              onPress={() => router.push({
                pathname: '/(main)/design-pack/[id]',
                params: { id: project!.id },
              } as any)}
              style={styles.developButton}
            >
              <Text style={styles.completedText}>
                ✓ Design Pack v{designPack.version}
              </Text>
              <Text style={styles.developButtonHint}>
                Tap to view
              </Text>
            </Pressable>
          )}
        </View>

        {/* ── Meta Footer ── */}
        <View style={styles.metaFooter}>
          <Text style={styles.metaText}>
            Created {formatDate(seed.createdAt)}
          </Text>
          <Text style={styles.metaText}>
            ID: {seed.id}
          </Text>
        </View>

        {/* ── Remove Ember ── */}
        <Pressable onPress={handleRemove} style={styles.removeButton}>
          <Text style={styles.removeButtonText}>
            Remove Ember
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Simple Markdown Renderer ────────────────
// A lightweight block renderer for the prototype.
// Not a full Markdown parser — just enough to make
// the persisted document readable and warm.

function renderMarkdownBlocks(markdown: string) {
  const lines = markdown.split('\n');
  const blocks: React.JSX.Element[] = [];
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // H1
    if (line.startsWith('# ')) {
      blocks.push(
        <Text key={key++} style={mdStyles.h1}>
          {line.replace(/^# /, '')}
        </Text>,
      );
      continue;
    }

    // H2
    if (line.startsWith('## ')) {
      blocks.push(
        <Text key={key++} style={mdStyles.h2}>
          {line.replace(/^## /, '')}
        </Text>,
      );
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      blocks.push(
        <View key={key++} style={mdStyles.blockquoteContainer}>
          <View style={mdStyles.blockquoteBorder} />
          <Text style={mdStyles.blockquote}>
            {renderInline(line.replace(/^> /, ''))}
          </Text>
        </View>,
      );
      continue;
    }

    // List item
    if (line.startsWith('- ')) {
      blocks.push(
        <View key={key++} style={mdStyles.listItem}>
          <Text style={mdStyles.listBullet}>•</Text>
          <Text style={mdStyles.listText}>
            {renderInline(line.replace(/^- /, ''))}
          </Text>
        </View>,
      );
      continue;
    }

    // Empty line — spacer
    if (line.trim() === '') {
      blocks.push(<View key={key++} style={mdStyles.spacer} />);
      continue;
    }

    // Regular paragraph
    blocks.push(
      <Text key={key++} style={mdStyles.paragraph}>
        {renderInline(line)}
      </Text>,
    );
  }

  return blocks;
}

/**
 * Renders inline formatting (bold, italic, links).
 * Very simple pattern matching for the prototype.
 */
function renderInline(text: string): string {
  // Strip markdown inline formatting for now — the text itself
  // is the content we care about in the prototype.
  // Remove bold markers
  let cleaned = text.replace(/\*\*(.+?)\*\*/g, '$1');
  // Remove italic markers
  cleaned = cleaned.replace(/\*(.+?)\*/g, '$1');
  // Simplify markdown links to display text
  cleaned = cleaned.replace(/\[(.+?)\]\(.+?\)/g, '$1');
  return cleaned;
}

function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

// ── Styles ──────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.deepCharcoal,
  },
  flex: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.md,
  },
  loadingText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textMuted,
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
  },
  errorText: {
    fontSize: TYPOGRAPHY.sizes.md,
    color: COLORS.textSecondary,
  },
  backButtonCenter: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.emberOrange,
    marginTop: SPACING.md,
  },
  backButtonText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.emberOrange,
  },

  // Header bar
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  backArrow: {
    fontSize: 20,
    color: COLORS.emberOrange,
    paddingHorizontal: SPACING.sm,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: '500',
    color: COLORS.textPrimary,
    letterSpacing: TYPOGRAPHY.letterSpacing.normal,
  },
  editButton: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: '700',
    color: COLORS.emberOrange,
    paddingHorizontal: SPACING.xs,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 107, 43, 0.12)',
    marginHorizontal: SPACING.lg,
  },

  // Content
  contentContainer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xl * 3,
  },

  // Meta footer
  metaFooter: {
    marginTop: SPACING.xl * 2,
    paddingTop: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 107, 43, 0.08)',
    gap: SPACING.xs,
  },
  metaText: {
    fontSize: 9,
    color: COLORS.textMuted,
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
    fontFamily: 'monospace',
  },

  // Participating Sparks
  sparksSection: {
    marginTop: SPACING.xl,
    gap: SPACING.sm,
  },
  sparksSectionTitle: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 1.5,
  },
  sparkItem: {
    backgroundColor: COLORS.surfaceDark,
    borderRadius: 8,
    padding: SPACING.md,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(255, 180, 100, 0.3)',
    gap: 3,
  },
  sparkItemTitle: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  sparkItemContent: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },
  sparkItemDate: {
    fontSize: 9,
    color: COLORS.textMuted,
  },

  // Develop further (bridge)
  developSection: {
    marginTop: SPACING.xl * 2,
    alignItems: 'center',
    gap: SPACING.md,
  },
  developDivider: {
    width: 40,
    height: 1,
    backgroundColor: COLORS.emberOrange,
    opacity: 0.2,
  },
  developButton: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.25)',
    backgroundColor: 'rgba(255, 107, 43, 0.06)',
    gap: SPACING.xs,
  },
  developButtonText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: '600',
    color: COLORS.emberOrange,
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
  },
  developButtonHint: {
    fontSize: 9,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    letterSpacing: 0.5,
  },

  // Completed movement indicators
  completedMovement: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    gap: 2,
  },
  completedText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: '600',
    color: COLORS.emberOrange,
    opacity: 0.8,
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
  },
  completedHint: {
    fontSize: 9,
    color: COLORS.textMuted,
    letterSpacing: 0.5,
  },

  // Generate button (slightly different emphasis)
  generateButton: {
    borderColor: 'rgba(255, 107, 43, 0.4)',
    backgroundColor: 'rgba(255, 107, 43, 0.1)',
  },
  generateButtonText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: '700',
    color: COLORS.emberOrange,
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
  },

  // Remove
  removeButton: {
    alignItems: 'center',
    marginTop: SPACING.xl * 2,
    marginBottom: SPACING.xl,
    paddingVertical: SPACING.sm,
  },
  removeButtonText: {
    fontSize: 10,
    color: COLORS.textMuted,
    letterSpacing: 1,
    opacity: 0.5,
  },
});

// ── Markdown Styles ─────────────────────────

const mdStyles = StyleSheet.create({
  h1: {
    fontSize: 22,
    fontWeight: '300',
    color: COLORS.emberOrange,
    letterSpacing: TYPOGRAPHY.letterSpacing.extraWide,
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
  },
  h2: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textSecondary,
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
    textTransform: 'uppercase',
    marginBottom: SPACING.xs,
    marginTop: SPACING.lg,
  },
  paragraph: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textPrimary,
    lineHeight: 20,
    letterSpacing: TYPOGRAPHY.letterSpacing.normal,
  },
  blockquoteContainer: {
    flexDirection: 'row',
    marginVertical: SPACING.xs,
  },
  blockquoteBorder: {
    width: 2,
    backgroundColor: COLORS.emberOrange,
    borderRadius: 1,
    marginRight: SPACING.sm,
    opacity: 0.4,
  },
  blockquote: {
    flex: 1,
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 2,
    paddingLeft: SPACING.xs,
  },
  listBullet: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.emberOrange,
    marginRight: SPACING.sm,
    lineHeight: 20,
  },
  listText: {
    flex: 1,
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  spacer: {
    height: SPACING.xs,
  },
});
