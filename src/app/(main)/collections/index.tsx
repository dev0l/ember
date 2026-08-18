import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { COLORS, SPACING } from '@/theme';

interface CollectionItem {
  id: string;
  title: string;
  desc: string;
  count: number;
}

const MOCK_COLLECTIONS: CollectionItem[] = [
  { id: '1', title: 'Core Research', desc: 'Notes on cognitive frameworks and agentic architectures.', count: 12 },
  { id: '2', title: 'Hearth Framework Specs', desc: 'Orchestration specifications and routing tables.', count: 4 },
  { id: '3', title: 'Creative Log', desc: 'Concept sketches and draft designs for Ember.', count: 8 },
];

export default function CollectionsScreen() {
  return (
    <View style={styles.container}>
      <FlatList
        data={MOCK_COLLECTIONS}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <Pressable style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardCount}>{item.count} embers</Text>
            </View>
            <Text style={styles.cardDesc}>{item.desc}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.deepCharcoal,
  },
  listContent: {
    padding: SPACING.md,
    gap: SPACING.md,
  },
  card: {
    backgroundColor: 'rgba(25, 25, 25, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.12)',
    borderRadius: 8,
    padding: SPACING.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: 0.5,
  },
  cardCount: {
    fontSize: 10,
    color: COLORS.emberOrange,
    fontWeight: '600',
  },
  cardDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },
});
