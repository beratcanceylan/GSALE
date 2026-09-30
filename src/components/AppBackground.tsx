import { useSyncExternalStore, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

import { Palette } from '@/constants/DesignSystem';
import { startupStore } from '@/services/startup';

let splashHidden = false;

function hideSplashOnFirstLayout(): void {
  if (splashHidden) return;
  splashHidden = true;
  void SplashScreen.hideAsync().catch(() => {
    // Splash already hidden or unavailable in this runtime.
  });
}

/**
 * App root: the slate ground. Screens mount once the saved language and country are
 * loaded (the splash stays up until then), so nothing loads in the wrong language.
 */
export function AppBackground({ children }: Readonly<{ children: ReactNode }>) {
  const ready = useSyncExternalStore(startupStore.subscribe, startupStore.getSnapshot);
  return (
    <View style={styles.root}>
      {ready ? (
        <View style={styles.root} onLayout={hideSplashOnFirstLayout}>
          {children}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Palette.background,
  },
});
