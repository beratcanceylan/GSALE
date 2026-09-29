import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

import { Palette } from '@/constants/DesignSystem';

let splashHidden = false;

function hideSplashOnFirstLayout(): void {
  if (splashHidden) return;
  splashHidden = true;
  void SplashScreen.hideAsync().catch(() => {
    // Splash already hidden or unavailable in this runtime.
  });
}

/** App root: the slate ground, and the splash screen hidden once the first frame is laid out. */
export function AppBackground({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <View style={styles.root} onLayout={hideSplashOnFirstLayout}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Palette.background,
  },
});
