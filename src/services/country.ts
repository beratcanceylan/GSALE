import * as SecureStore from 'expo-secure-store';

const COUNTRY_KEY = 'gsale_country';

type CountryDefinition = Readonly<{
  code: string;
  name: string;
  /** `language-country` path segment used by PlayStation and Xbox store pages. */
  storeLocale: string;
  /** Currency of the PlayStation Store prices; null where there is no storefront. */
  playStationCurrency: string | null;
}>;

export const SUPPORTED_COUNTRIES = [
  { code: 'TR', name: 'Türkiye', storeLocale: 'tr-tr', playStationCurrency: 'TRY' },
  { code: 'US', name: 'Amerika Birleşik Devletleri', storeLocale: 'en-us', playStationCurrency: 'USD' },
  { code: 'GB', name: 'Birleşik Krallık', storeLocale: 'en-gb', playStationCurrency: 'GBP' },
  { code: 'DE', name: 'Almanya', storeLocale: 'de-de', playStationCurrency: 'EUR' },
  { code: 'FR', name: 'Fransa', storeLocale: 'fr-fr', playStationCurrency: 'EUR' },
  { code: 'NL', name: 'Hollanda', storeLocale: 'nl-nl', playStationCurrency: 'EUR' },
  { code: 'PL', name: 'Polonya', storeLocale: 'pl-pl', playStationCurrency: 'PLN' },
  { code: 'UA', name: 'Ukrayna', storeLocale: 'uk-ua', playStationCurrency: 'UAH' },
  { code: 'KZ', name: 'Kazakistan', storeLocale: 'ru-kz', playStationCurrency: null },
  { code: 'AR', name: 'Arjantin', storeLocale: 'es-ar', playStationCurrency: 'USD' },
  { code: 'BR', name: 'Brezilya', storeLocale: 'pt-br', playStationCurrency: 'BRL' },
  { code: 'CA', name: 'Kanada', storeLocale: 'en-ca', playStationCurrency: 'CAD' },
  { code: 'AU', name: 'Avustralya', storeLocale: 'en-au', playStationCurrency: 'AUD' },
  { code: 'JP', name: 'Japonya', storeLocale: 'ja-jp', playStationCurrency: 'JPY' },
  { code: 'IN', name: 'Hindistan', storeLocale: 'en-in', playStationCurrency: 'INR' },
] as const satisfies readonly CountryDefinition[];

export type CountryCode = (typeof SUPPORTED_COUNTRIES)[number]['code'];
export type StoreCountry = (typeof SUPPORTED_COUNTRIES)[number];

const DEFAULT_COUNTRY: StoreCountry = SUPPORTED_COUNTRIES[0];

let memoryCountry: StoreCountry = DEFAULT_COUNTRY;

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

export async function loadAppCountry(): Promise<CountryCode> {
  try {
    memoryCountry = findCountry(await SecureStore.getItemAsync(COUNTRY_KEY)) ?? DEFAULT_COUNTRY;
  } catch {
    memoryCountry = DEFAULT_COUNTRY;
  }
  return memoryCountry.code;
}

export async function setAppCountry(code: CountryCode): Promise<void> {
  memoryCountry = findCountry(code) ?? DEFAULT_COUNTRY;
  await SecureStore.setItemAsync(COUNTRY_KEY, memoryCountry.code);
}
