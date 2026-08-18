import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { COLORS, SPACING } from '@/theme';

interface RecentItem {
  id: string;
  title: string;
  type: string;
  date: string;
}

const MOCK_RECENTS: RecentItem[] = [
  { id: '1', title: 'Hearth Orchestration Protocol', type: 'Framework', date: '2 hours ago' },
  { id: '2', title: 'Scout Reconnaissance Findings', type: 'Document', date: '5 hours ago' },
  { id: '3', title: 'Ember Spec Draft v0.3', type: 'Specification', date: 'Yesterday' },
  { id: '4', title: 'Concept Art Moodboard', type: 'Design', date: '3 days ago' },
  { id: '5', title: 'Zustand State Spec', type: 'Technical Notes', date: '4 days ago' },
];

export default function RecentScreen() {
  return (
    <View style={styles.container}>
      <FlatList
        data={MOCK_RECENTS}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <Pressable style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardType}>{item.type}</Text>
              <Text style={styles.cardDate}>{item.date}</Text>
            </View>
            <Text style={styles.cardTitle}>{item.title}</Text>
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
  cardType: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.emberOrange,
    textTransform: 'uppercase',
    letterSpacing: 1.0,
  },
  cardDate: {
    fontSize: 9,
    color: COLORS.textMuted,
  },
  cardTitle: {
    fontSize: 14,
    color: COLORS.textPrimary,
    fontWeight: '500',
    marginTop: 4,
  },
});
