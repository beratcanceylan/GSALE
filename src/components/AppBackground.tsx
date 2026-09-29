import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
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

export function AppBackground({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <View style={styles.root} onLayout={hideSplashOnFirstLayout}>
      <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 1 1" pointerEvents="none">
        <Defs>
          <LinearGradient id="appBg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={Palette.backgroundElevated} />
            <Stop offset="0.35" stopColor={Palette.background} />
            <Stop offset="1" stopColor={Palette.background} />
          </LinearGradient>
        </Defs>
        <Rect width="1" height="1" fill="url(#appBg)" transform={[{ translateX: 0 }, { translateY: 0 }]} />
      </Svg>
      <View style={styles.glow} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  glow: {
    position: 'absolute',
    top: -120,
    right: -80,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: Palette.accentMuted,
    opacity: 0.35,
  },
});
