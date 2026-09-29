import * as SecureStore from 'expo-secure-store';

import { deviceLocaleTag } from '@/i18n/languageStore';

const COUNTRY_KEY = 'gsale_country';

type CountryDefinition = Readonly<{
  code: string;
  /** Default `language-country` path segment used by PlayStation and Xbox store pages. */
  storeLocale: string;
  /** Other languages those regional stores offer; the app language is used when listed. */
  otherStoreLanguages: readonly string[];
  /** Currency of the PlayStation Store prices; null where there is no storefront. */
  playStationCurrency: string | null;
}>;

export const SUPPORTED_COUNTRIES = [
  { code: 'TR', storeLocale: 'tr-tr', otherStoreLanguages: ['en'], playStationCurrency: 'TRY' },
  { code: 'US', storeLocale: 'en-us', otherStoreLanguages: ['es'], playStationCurrency: 'USD' },
  { code: 'GB', storeLocale: 'en-gb', otherStoreLanguages: [], playStationCurrency: 'GBP' },
  { code: 'DE', storeLocale: 'de-de', otherStoreLanguages: ['en'], playStationCurrency: 'EUR' },
  { code: 'FR', storeLocale: 'fr-fr', otherStoreLanguages: ['en'], playStationCurrency: 'EUR' },
  { code: 'NL', storeLocale: 'nl-nl', otherStoreLanguages: ['en'], playStationCurrency: 'EUR' },
  { code: 'PL', storeLocale: 'pl-pl', otherStoreLanguages: ['en'], playStationCurrency: 'PLN' },
  { code: 'UA', storeLocale: 'uk-ua', otherStoreLanguages: ['en'], playStationCurrency: 'UAH' },
  { code: 'KZ', storeLocale: 'ru-kz', otherStoreLanguages: ['en'], playStationCurrency: null },
  { code: 'AR', storeLocale: 'es-ar', otherStoreLanguages: ['en'], playStationCurrency: 'USD' },
  { code: 'BR', storeLocale: 'pt-br', otherStoreLanguages: ['en'], playStationCurrency: 'BRL' },
  { code: 'CA', storeLocale: 'en-ca', otherStoreLanguages: ['fr'], playStationCurrency: 'CAD' },
  { code: 'AU', storeLocale: 'en-au', otherStoreLanguages: [], playStationCurrency: 'AUD' },
  { code: 'JP', storeLocale: 'ja-jp', otherStoreLanguages: ['en'], playStationCurrency: 'JPY' },
  { code: 'IN', storeLocale: 'en-in', otherStoreLanguages: [], playStationCurrency: 'INR' },
] as const satisfies readonly CountryDefinition[];

export type CountryCode = (typeof SUPPORTED_COUNTRIES)[number]['code'];
export type StoreCountry = (typeof SUPPORTED_COUNTRIES)[number];

const DEFAULT_COUNTRY: StoreCountry = SUPPORTED_COUNTRIES[0];

let memoryCountry: StoreCountry = DEFAULT_COUNTRY;
const listeners = new Set<() => void>();

function applyCountry(next: StoreCountry): void {
  if (next === memoryCountry) return;
  memoryCountry = next;
  for (const listener of listeners) listener();
}

export const countryStore = {
  getSnapshot: (): CountryCode => memoryCountry.code,
  subscribe: (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

/** Region subtag of a BCP-47 tag ("pt-BR" → "BR"). */
function regionOf(tag: string): string | undefined {
  return tag.split(/[-_]/).slice(1).find((part) => /^[A-Za-z]{2}$/.test(part));
}

function findCountry(code: string | null | undefined): StoreCountry | undefined {
  const upper = code?.trim().toUpperCase();
  return SUPPORTED_COUNTRIES.find((country) => country.code === upper);
}

export function getAppCountry(): CountryCode {
  return memoryCountry.code;
}

export function getCountryConfig(): StoreCountry {
  return memoryCountry;
}

/** Saved country, else the device region when supported, else Türkiye. */
export async function loadAppCountry(deviceTag: string = deviceLocaleTag()): Promise<CountryCode> {
  let saved: string | null = null;
  try {
    saved = await SecureStore.getItemAsync(COUNTRY_KEY);
  } catch {
    saved = null;
  }
  applyCountry(findCountry(saved) ?? findCountry(regionOf(deviceTag)) ?? DEFAULT_COUNTRY);
  return memoryCountry.code;
}

export async function setAppCountry(code: CountryCode): Promise<void> {
  applyCountry(findCountry(code) ?? DEFAULT_COUNTRY);
  await SecureStore.setItemAsync(COUNTRY_KEY, memoryCountry.code);
}
