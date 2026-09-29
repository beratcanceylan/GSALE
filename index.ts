// Register "main" synchronously (required by AppRegistry / Expo Go).
import 'expo-router/entry';

import * as SplashScreen from 'expo-splash-screen';

import { loadCatalog } from '@/services/catalog/loader';
import { loadAppCountry } from '@/services/country';
import { loadAppLocale } from '@/services/locale';

void SplashScreen.preventAutoHideAsync().catch((error: unknown) => {
  console.warn('SplashScreen.preventAutoHideAsync failed', error);
});

void loadAppLocale().catch((error: unknown) => {
  console.warn('loadAppLocale failed', error);
});

void loadAppCountry().catch((error: unknown) => {
  console.warn('loadAppCountry failed', error);
});

void loadCatalog();
