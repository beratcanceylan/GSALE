import { afterEach, describe, expect, mock, test } from 'bun:test';

mock.module('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => undefined,
}));

const { setAppCountry } = await import('@/services/country');
const { setLanguage } = await import('@/i18n/languageStore');
const { regionalLocale, storeLanguage } = await import('@/services/store/languages');

afterEach(async () => {
  await setAppCountry('TR');
  await setLanguage('tr');
});

describe('storeLanguage', () => {
  test.each([
    ['de', 'TR', 'ps', 'tr'],
    ['de', 'DE', 'ps', 'de'],
    ['fr', 'CA', 'xbox', 'fr-CA'],
    ['ja', 'US', 'xbox', 'en-US'],
    ['es-419', 'AR', 'steam', 'latam'],
    ['ko', 'TR', 'steam', 'koreana'],
    ['vi', 'TR', 'epic', 'en-US'],
    ['zh-Hant', 'TR', 'epic', 'zh-Hant'],
    ['es-419', 'US', 'epic', 'es-MX'],
    ['de', 'TR', 'gog', 'de-DE'],
    ['tr', 'TR', 'gog', 'en-US'],
    ['ar', 'TR', 'nintendo', 'en-US'],
  ] as const)('%s in %s on %s → %s', async (language, country, store, expected) => {
    await setLanguage(language);
    await setAppCountry(country);
    expect(storeLanguage(store)).toBe(expected);
  });
});

describe('regionalLocale', () => {
  test('uses the app language where the country store offers it, else the country default', async () => {
    await setAppCountry('CA');
    await setLanguage('fr');
    expect(regionalLocale()).toBe('fr-ca');
    await setLanguage('de');
    expect(regionalLocale()).toBe('en-ca');
    await setAppCountry('TR');
    await setLanguage('en');
    expect(regionalLocale()).toBe('en-tr');
  });
});
