import * as SecureStore from 'expo-secure-store';

const LOCALE_KEY = 'gsale_locale';
const DEFAULT_LOCALE = 'tr';

let memoryLocale = DEFAULT_LOCALE;

export function getAppLocale(): string {
  return memoryLocale;
}

export async function loadAppLocale(): Promise<string> {
  try {
    const stored = await SecureStore.getItemAsync(LOCALE_KEY);
    if (stored && stored.length > 0) {
      memoryLocale = stored;
    }
  } catch {
    memoryLocale = DEFAULT_LOCALE;
  }
  return memoryLocale;
}

export async function setAppLocale(code: string): Promise<void> {
  memoryLocale = code;
  await SecureStore.setItemAsync(LOCALE_KEY, code);
}
