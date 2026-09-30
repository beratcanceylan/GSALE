// Register "main" synchronously (required by AppRegistry / Expo Go).
import 'expo-router/entry';

import * as SplashScreen from 'expo-splash-screen';

import { loadCatalog } from '@/services/catalog/loader';
import { loadAppCountry } from '@/services/country';
import { watchRegionChanges } from '@/services/screenData';
import { markStartupReady } from '@/services/startup';
import { loadLanguage } from '@/i18n/languageStore';
import { applyLayoutDirection } from '@/i18n/rtl';

export function reportBootstrapFailure(label: string, task: Promise<unknown>): void {
  void task.catch((error: unknown) => {
    console.warn(`${label} failed`, error);
  });
}

reportBootstrapFailure('SplashScreen.preventAutoHideAsync', SplashScreen.preventAutoHideAsync());
const languageLoad = loadLanguage().then(applyLayoutDirection);
const countryLoad = loadAppCountry();
reportBootstrapFailure('loadLanguage', languageLoad);
reportBootstrapFailure('loadAppCountry', countryLoad);
// Screens mount after both settle (failures fall back to defaults), so they load once, in the right language.
void Promise.allSettled([languageLoad, countryLoad]).then(markStartupReady);

watchRegionChanges();
void loadCatalog();
