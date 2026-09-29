// Register "main" synchronously (required by AppRegistry / Expo Go).
import 'expo-router/entry';

import * as SplashScreen from 'expo-splash-screen';

import { loadCatalog } from '@/services/catalog/loader';
import { loadAppCountry } from '@/services/country';
import { loadAppLocale } from '@/services/locale';

export function reportBootstrapFailure(label: string, task: Promise<unknown>): void {
  void task.catch((error: unknown) => {
    console.warn(`${label} failed`, error);
  });
}

reportBootstrapFailure('SplashScreen.preventAutoHideAsync', SplashScreen.preventAutoHideAsync());
reportBootstrapFailure('loadAppLocale', loadAppLocale());
reportBootstrapFailure('loadAppCountry', loadAppCountry());

void loadCatalog();
