import type { LanguageCode } from '@/i18n/languages';
import { getLanguage } from '@/i18n/languageStore';
import { getStoreCountryConfig } from '@/services/store/config';

export type StoreId = 'steam' | 'epic' | 'gog' | 'ps' | 'xbox' | 'nintendo';

/** Steam's `l=` names; Steam covers every app language. */
const STEAM_LANGUAGES: Readonly<Record<LanguageCode, string>> = {
  tr: 'turkish', en: 'english', de: 'german', fr: 'french', es: 'spanish', 'es-419': 'latam',
  pt: 'portuguese', 'pt-BR': 'brazilian', it: 'italian', nl: 'dutch', pl: 'polish', ru: 'russian',
  uk: 'ukrainian', cs: 'czech', hu: 'hungarian', ro: 'romanian', bg: 'bulgarian', el: 'greek',
  da: 'danish', sv: 'swedish', no: 'norwegian', fi: 'finnish', vi: 'vietnamese', id: 'indonesian',
  ja: 'japanese', ko: 'koreana', 'zh-Hans': 'schinese', 'zh-Hant': 'tchinese', th: 'thai', ar: 'arabic',
};

/** Epic store locales; languages Epic does not offer read English. */
const EPIC_LOCALES: Partial<Readonly<Record<LanguageCode, string>>> = {
  ar: 'ar', de: 'de', en: 'en-US', es: 'es-ES', 'es-419': 'es-MX', fr: 'fr', it: 'it', ja: 'ja', ko: 'ko',
  pl: 'pl', pt: 'pt-BR', 'pt-BR': 'pt-BR', ru: 'ru', th: 'th', tr: 'tr', 'zh-Hans': 'zh-CN', 'zh-Hant': 'zh-Hant',
};

/** GOG catalog locales. */
const GOG_LOCALES: Partial<Readonly<Record<LanguageCode, string>>> = {
  en: 'en-US', de: 'de-DE', fr: 'fr-FR', pl: 'pl-PL', ru: 'ru-RU', 'zh-Hans': 'zh-Hans',
};

function primaryTag(language: LanguageCode): string {
  return language.split('-')[0] ?? language;
}

/**
 * `language-country` for the regional PlayStation and Xbox stores: the app language when
 * that country's store offers it, otherwise the country's own store language ("de" in Türkiye → "tr-tr").
 */
export function regionalLocale(): string {
  const { code, storeLocale, otherStoreLanguages } = getStoreCountryConfig();
  const language = primaryTag(getLanguage());
  const [defaultLanguage] = storeLocale.split('-');
  const offered: readonly string[] = otherStoreLanguages;
  const chosen = offered.includes(language) ? language : defaultLanguage;
  return `${chosen}-${code.toLowerCase()}`;
}

/** The language parameter a store expects for the app language and store country. */
export function storeLanguage(store: StoreId): string {
  const language = getLanguage();
  switch (store) {
    case 'steam':
      return STEAM_LANGUAGES[language];
    case 'epic':
      return EPIC_LOCALES[language] ?? 'en-US';
    case 'gog':
      return GOG_LOCALES[language] ?? 'en-US';
    case 'ps':
      return regionalLocale().split('-')[0] ?? 'en';
    case 'xbox': {
      const [lang, country] = regionalLocale().split('-');
      return `${lang}-${(country ?? '').toUpperCase()}`;
    }
    case 'nintendo':
      return 'en-US';
  }
}
