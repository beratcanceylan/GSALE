import { getAppCountry, getCountryConfig, type CountryCode, type StoreCountry } from '@/services/country';
import { getAppLocale } from '@/services/locale';
import {
  STORE_RETRY,
  STORE_TIMEOUT,
  STORE_USER_AGENT,
} from '@/services/store/constants';

export const STORE_CONFIG = {
  timeout: STORE_TIMEOUT,
  retry: STORE_RETRY,
  userAgent: STORE_USER_AGENT,
} as const;

/** Store region selected in settings. */
export function getStoreCountry(): CountryCode {
  return getAppCountry();
}

export function getStoreCountryConfig(): StoreCountry {
  return getCountryConfig();
}

export function getSteamLang(): string {
  return getAppLocale() === 'tr' ? 'turkish' : 'english';
}

export function getEpicLocale(): string {
  return getAppLocale() === 'tr' ? 'tr-TR' : 'en-US';
}

/** Chihiro API locale segment (not BCP-47). */
export function getPsLocale(): string {
  return getAppLocale() === 'tr' ? 'tr' : 'en';
}
