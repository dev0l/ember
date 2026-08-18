import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';

import { COLORS } from '@/theme';

/**
 * Root Layout
 *
 * Wraps the entire app in:
 * 1. GestureHandlerRootView — required for RNGH 3.0
 * 2. Stack navigator — Expo Router navigation
 * 3. StatusBar — light content for dark theme
 *
 * Ember is always dark. There is no light mode.
 * The warmth comes from the embers, not the background.
 */
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.deepCharcoal },
          animation: 'fade',
        }}
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.deepCharcoal,
  },
});
