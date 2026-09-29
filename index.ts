// Register "main" synchronously (required by AppRegistry / Expo Go).
import 'expo-router/entry';

import * as SplashScreen from 'expo-splash-screen';

import { loadCatalog } from '@/services/catalog/loader';
import { loadAppCountry } from '@/services/country';
import { watchRegionChanges } from '@/services/screenData';
import { loadLanguage } from '@/i18n/languageStore';
import { applyLayoutDirection } from '@/i18n/rtl';

export function reportBootstrapFailure(label: string, task: Promise<unknown>): void {
  void task.catch((error: unknown) => {
    console.warn(`${label} failed`, error);
  });
}

reportBootstrapFailure('SplashScreen.preventAutoHideAsync', SplashScreen.preventAutoHideAsync());
reportBootstrapFailure('loadLanguage', loadLanguage().then(applyLayoutDirection));
reportBootstrapFailure('loadAppCountry', loadAppCountry());

watchRegionChanges();
void loadCatalog();
