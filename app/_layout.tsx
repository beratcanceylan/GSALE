import { DarkTheme, ThemeProvider } from 'expo-router/react-navigation';
import { Stack } from 'expo-router';

import { AppBackground } from '@/components/AppBackground';

export default function RootLayout() {
  return (
    <ThemeProvider value={DarkTheme}>
      <AppBackground>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="game/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="notifications" />
        </Stack>
      </AppBackground>
    </ThemeProvider>
  );
}
