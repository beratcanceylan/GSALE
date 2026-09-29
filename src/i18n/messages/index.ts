import type { LanguageCode } from '@/i18n/languages';
import { en, type Messages } from '@/i18n/messages/en';
import { tr } from '@/i18n/messages/tr';

/** Languages without a catalog yet read English. */
export const CATALOGS: Readonly<Record<LanguageCode, Messages>> = {
  tr,
  en,
  de: en,
  fr: en,
  es: en,
  'es-419': en,
  pt: en,
  'pt-BR': en,
  it: en,
  nl: en,
  pl: en,
  ru: en,
  uk: en,
  cs: en,
  hu: en,
  ro: en,
  bg: en,
  el: en,
  da: en,
  sv: en,
  no: en,
  fi: en,
  vi: en,
  id: en,
  ja: en,
  ko: en,
  'zh-Hans': en,
  'zh-Hant': en,
  th: en,
  ar: en,
};
