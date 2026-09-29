import { afterEach, describe, expect, mock, test } from 'bun:test';

const stored = new Map<string, string>();
let failRead = false;

mock.module('expo-secure-store', () => ({
  getItemAsync: async (key: string) => {
    if (failRead) throw new Error('secure store unavailable');
    return stored.get(key) ?? null;
  },
  setItemAsync: async (key: string, value: string) => {
    stored.set(key, value);
  },
}));

const {
  SUPPORTED_COUNTRIES,
  countryStore,
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
    failRead = false;
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
    expect(await loadAppCountry('xx')).toBe('US');

    stored.set('gsale_country', 'ZZ');
    expect(await loadAppCountry('xx')).toBe('TR');
  });

  test('without a saved country, uses the device region when supported', async () => {
    expect(await loadAppCountry('de-DE')).toBe('DE');
    expect(await loadAppCountry('pt-BR')).toBe('BR');
    expect(await loadAppCountry('fr-BE')).toBe('TR');
  });

  test('notifies subscribers when the country changes', async () => {
    let notified = 0;
    const unsubscribe = countryStore.subscribe(() => { notified += 1; });
    await setAppCountry('JP');
    expect(countryStore.getSnapshot()).toBe('JP');
    await setAppCountry('JP');
    expect(notified).toBe(1);
    unsubscribe();
  });

  test('uses the default country when secure storage fails', async () => {
    await setAppCountry('DE');
    failRead = true;
    expect(await loadAppCountry('xx')).toBe('TR');
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
