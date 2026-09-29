import * as SecureStore from 'expo-secure-store';

import { isLanguageCode, matchLanguage, type LanguageCode } from '@/i18n/languages';

const LANGUAGE_KEY = 'gsale_locale';
const FALLBACK_LANGUAGE: LanguageCode = 'en';
/** Before loadLanguage runs: the app's original language, matching the default country (Türkiye). */
const INITIAL_LANGUAGE: LanguageCode = 'tr';

let current: LanguageCode = INITIAL_LANGUAGE;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

/** The device's BCP-47 locale, as Hermes and JSC report it. */
export function deviceLocaleTag(): string {
  return Intl.DateTimeFormat().resolvedOptions().locale;
}

export const languageStore = {
  getSnapshot: (): LanguageCode => current,
  subscribe: (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function getLanguage(): LanguageCode {
  return current;
}

/** Saved language, else the device language, else English. */
export async function loadLanguage(deviceTag: string = deviceLocaleTag()): Promise<LanguageCode> {
  let saved: string | null = null;
  try {
    saved = await SecureStore.getItemAsync(LANGUAGE_KEY);
  } catch {
    saved = null;
  }
  const next = (isLanguageCode(saved) ? saved : matchLanguage(saved)) ?? matchLanguage(deviceTag) ?? FALLBACK_LANGUAGE;
  if (next !== current) {
    current = next;
    notify();
  }
  return current;
}

export async function setLanguage(code: LanguageCode): Promise<void> {
  if (code === current) return;
  current = code;
  notify();
  await SecureStore.setItemAsync(LANGUAGE_KEY, code);
}
