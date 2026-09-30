import { describe, expect, mock, test } from 'bun:test';

import { nativeState, resetNativeState } from '../../test-support/native-mocks';

const stored = new Map<string, string>();
mock.module('expo-secure-store', () => ({
  getItemAsync: (key: string) => Promise.resolve(stored.get(key) ?? null),
  setItemAsync: (key: string, value: string) => {
    stored.set(key, value);
    return Promise.resolve();
  },
}));

const SecureStore = await import('expo-secure-store');
const { loadAppLanguage } = await import('@/i18n/bootstrap');
const { setLanguage } = await import('@/i18n/languageStore');

describe('loadAppLanguage', () => {
  test('asks for a restart when the saved language needs the other layout direction', async () => {
    resetNativeState();
    await SecureStore.setItemAsync('gsale_locale', 'ar');
    await loadAppLanguage();
    expect(nativeState.rtl.forced).toBeTrue();
    expect(nativeState.alerts).toHaveLength(1);
    await SecureStore.setItemAsync('gsale_locale', 'tr');
    await setLanguage('tr');
  });

  test('says nothing when the direction already matches', async () => {
    resetNativeState();
    await SecureStore.setItemAsync('gsale_locale', 'de');
    await loadAppLanguage();
    expect(nativeState.alerts).toHaveLength(0);
    await SecureStore.setItemAsync('gsale_locale', 'tr');
    await setLanguage('tr');
  });
});
