import { DarkTheme, ThemeProvider, type Theme } from 'expo-router/react-navigation';
import { Stack } from 'expo-router';

import { AppBackground } from '@/components/AppBackground';
import { Palette } from '@/constants/DesignSystem';

const theme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: Palette.background,
    card: Palette.background,
    border: Palette.line,
    text: Palette.text,
    primary: Palette.text,
  },
};

export default function RootLayout() {
  return (
    <ThemeProvider value={theme}>
      <AppBackground>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Palette.background } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="game/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="notifications" />
        </Stack>
      </AppBackground>
    </ThemeProvider>
  );
}
