import { describe, expect, test } from 'bun:test';

import { LANGUAGES } from '@/i18n/languages';
import { CATALOGS } from '@/i18n/messages';
import { en, type MessageKey, type Messages } from '@/i18n/messages/en';

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
const KEYS = Object.keys(en) as MessageKey[];

describe('message catalogs', () => {
  test.each(LANGUAGES.map((language) => [language.code] as const))('%s has every key, translated, with the same placeholders', (code) => {
    const catalog: Messages = CATALOGS[code];
    if (code !== 'en') expect(catalog === en).toBeFalse();
    for (const key of KEYS) {
      const text = catalog[key];
      expect(typeof text).toBe('string');
      expect(text.trim().length).toBeGreaterThan(0);
      expect(placeholders(text)).toEqual(placeholders(en[key]));
    }
  });

  test.each(LANGUAGES.map((language) => [language.code] as const))('%s covers the plural forms its language uses', (code) => {
    const catalog: Messages = CATALOGS[code];
    const categories = new Intl.PluralRules(code).resolvedOptions().pluralCategories;
    for (const category of categories) {
      const key = `search.resultCount.${category}` as keyof Messages;
      const text = catalog[key] ?? catalog['search.resultCount.other'];
      expect(placeholders(text ?? '')).toEqual(['count']);
    }
    for (const extra of ['zero', 'two', 'few', 'many'] as const) {
      if (!categories.includes(extra)) expect(catalog[`search.resultCount.${extra}`]).toBeUndefined();
    }
  });

  test('brand names stay untranslated', () => {
    for (const { code } of LANGUAGES) {
      expect(CATALOGS[code]['price.gamePass']).toBe('Game Pass');
    }
  });
});
