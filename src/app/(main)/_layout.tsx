import { Stack } from 'expo-router';
import { COLORS } from '@/theme';

export default function MainLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: COLORS.deepCharcoal,
        },
        headerTintColor: COLORS.emberOrange,
        headerTitleStyle: {
          fontWeight: '700',
          color: COLORS.textPrimary,
          fontSize: 14,
        },
        headerShadowVisible: false,
        contentStyle: {
          backgroundColor: COLORS.deepCharcoal,
        },
        animation: 'fade', // Smooth fading transition
      }}
    >
      <Stack.Screen name="collections/index" options={{ title: 'COLLECTIONS' }} />
      <Stack.Screen name="recent" options={{ title: 'RECENT' }} />
      <Stack.Screen name="import" options={{ title: 'IMPORT' }} />
      <Stack.Screen name="create/index" options={{ title: 'CREATE EMBER', headerShown: false }} />
      <Stack.Screen name="ember/[id]" options={{ title: 'EMBER', headerShown: false }} />
      <Stack.Screen name="ember/edit/[id]" options={{ title: 'EDIT EMBER', headerShown: false }} />
      {/* ── Spark-to-Design-Pack Pipeline ── */}
      <Stack.Screen name="sparks/index" options={{ title: 'SPARKS', headerShown: false }} />
      <Stack.Screen name="ember-session/[id]" options={{ title: 'EMBER SESSION', headerShown: false }} />
      <Stack.Screen name="design-pack/[id]" options={{ title: 'DESIGN PACK', headerShown: false }} />
    </Stack>
  );
}
