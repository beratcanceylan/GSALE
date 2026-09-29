import { afterEach, describe, expect, mock, test } from 'bun:test';

const stored = new Map<string, string>();

mock.module('expo-secure-store', () => ({
  getItemAsync: async (key: string) => stored.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    stored.set(key, value);
  },
}));

const {
  SUPPORTED_COUNTRIES,
  getAppCountry,
  getCountryConfig,
  loadAppCountry,
  setAppCountry,
} = await import('@/services/country');

describe('store country setting', () => {
  afterEach(async () => {
    // Other test files share this module; leave the default behind.
    await setAppCountry('TR');
    stored.clear();
  });

  test('defaults to TR', () => {
    expect(getAppCountry()).toBe('TR');
    expect(getCountryConfig().storeLocale).toBe('tr-tr');
  });

  test('persists the selected country', async () => {
    await setAppCountry('DE');
    expect(getAppCountry()).toBe('DE');
    expect(getCountryConfig().storeLocale).toBe('de-de');
    expect(stored.get('gsale_country')).toBe('DE');
  });

  test('loads a stored country and ignores unsupported values', async () => {
    stored.set('gsale_country', 'us');
    expect(await loadAppCountry()).toBe('US');

    stored.set('gsale_country', 'ZZ');
    expect(await loadAppCountry()).toBe('TR');
  });

  test('country codes and store locales are well formed and unique', () => {
    const codes = SUPPORTED_COUNTRIES.map((country) => country.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const country of SUPPORTED_COUNTRIES) {
      expect(country.code).toMatch(/^[A-Z]{2}$/);
      expect(country.storeLocale).toMatch(new RegExp(`^[a-z]{2}-${country.code.toLowerCase()}$`));
      if (country.playStationCurrency !== null) expect(country.playStationCurrency).toMatch(/^[A-Z]{3}$/);
    }
  });
});
