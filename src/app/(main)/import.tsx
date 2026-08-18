import { View, Text, StyleSheet, Pressable } from 'react-native';
import { COLORS, SPACING } from '@/theme';

export default function ImportScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Import Archive</Text>
        <Text style={styles.cardDesc}>
          Load your exported data packages (like ChatGPT exports ZIP or markdown archives) to parse them into structured Embers.
        </Text>
        <Pressable style={styles.button}>
          <Text style={styles.buttonText}>Choose Archive File</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.deepCharcoal,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
  },
  card: {
    backgroundColor: 'rgba(25, 25, 25, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 43, 0.15)',
    borderRadius: 12,
    padding: SPACING.lg,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
    letterSpacing: 0.5,
  },
  cardDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: SPACING.lg,
  },
  button: {
    backgroundColor: COLORS.emberOrange,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    borderRadius: 8,
    shadowColor: COLORS.emberOrange,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  buttonText: {
    fontSize: 12,
    color: COLORS.textPrimary,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
