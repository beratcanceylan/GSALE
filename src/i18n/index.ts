import { useSyncExternalStore } from 'react';

import type { LanguageCode } from '@/i18n/languages';
import { getLanguage, languageStore } from '@/i18n/languageStore';
import { CATALOGS } from '@/i18n/messages';
import { en, type MessageKey, type Messages, type PluralExtraKey } from '@/i18n/messages/en';

export type { MessageKey } from '@/i18n/messages/en';

type Params = Readonly<Record<string, string | number>>;

function interpolate(text: string, params?: Params): string {
  if (!params) return text;
  return text.replaceAll(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

function lookup(key: MessageKey | PluralExtraKey, language: LanguageCode): string | undefined {
  const catalog: Messages = CATALOGS[language];
  return catalog[key] ?? (key in en ? en[key as MessageKey] : undefined);
}

/** Message for `key` in the app language, falling back to English. */
export function t(key: MessageKey, params?: Params): string {
  return interpolate(lookup(key, getLanguage()) ?? key, params);
}

type PluralBase = 'search.resultCount';

/** `${base}.${category}` for the CLDR plural category of `count`, falling back to `.other`. */
export function plural(base: PluralBase, count: number): string {
  const language = getLanguage();
  const category = new Intl.PluralRules(language).select(count);
  const key = `${base}.${category}` as MessageKey | PluralExtraKey;
  const text = lookup(key, language) ?? lookup(`${base}.other`, language) ?? base;
  return interpolate(text, { count });
}

/** Re-renders the caller when the app language changes and returns `t`. */
export function useT(): typeof t {
  useSyncExternalStore(languageStore.subscribe, languageStore.getSnapshot);
  return t;
}

/** Turkish lira amount formatted for the app language. */
export function formatMoney(amountTry: number, language: LanguageCode = getLanguage()): string {
  return new Intl.NumberFormat(language, { style: 'currency', currency: 'TRY' }).format(amountTry);
}

/** Whole-number signed percent ("-40%"), formatted for the app language. */
export function formatPercent(percent: number, language: LanguageCode = getLanguage()): string {
  return new Intl.NumberFormat(language, { style: 'percent', signDisplay: 'exceptZero', maximumFractionDigits: 0 }).format(percent / 100);
}
