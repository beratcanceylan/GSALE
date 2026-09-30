import { describe, expect, mock, test } from 'bun:test';

let stored: string | null = null;
const writes: [string, string][] = [];

mock.module('expo-secure-store', () => ({
  getItemAsync: async () => stored,
  setItemAsync: async (key: string, value: string) => { writes.push([key, value]); },
}));

const { matchLanguage, isRtl, usesSystemFont } = await import('@/i18n/languages');
const { formatMoney, formatPercent, plural, pluralCategory, t, translatorFor } = await import('@/i18n');
const { getLanguage, languageStore, loadLanguage, setLanguage } = await import('@/i18n/languageStore');

describe('matchLanguage', () => {
  test.each([
    ['tr-TR', 'tr'], ['en-GB', 'en'], ['es-MX', 'es-419'], ['es-ES', 'es'], ['pt-BR', 'pt-BR'], ['pt-PT', 'pt'],
    ['zh-TW', 'zh-Hant'], ['zh-CN', 'zh-Hans'], ['zh-Hant-HK', 'zh-Hant'], ['nb-NO', 'no'], ['ar-EG', 'ar'],
    ['de', 'de'], ['xx', null], ['', null],
  ])('%s → %s', (tag, code) => {
    expect(matchLanguage(tag)).toBe(code);
  });

  test('script and direction flags', () => {
    expect(isRtl('ar')).toBeTrue();
    expect(isRtl('tr')).toBeFalse();
    expect(usesSystemFont('ja')).toBeTrue();
    expect(usesSystemFont('ru')).toBeFalse();
  });
});

describe('language store', () => {
  test('loads the saved language, then falls back to the device language, then English', async () => {
    stored = 'de';
    expect(await loadLanguage('tr-TR')).toBe('de');
    stored = null;
    expect(await loadLanguage('pt-BR')).toBe('pt-BR');
    stored = 'klingon';
    expect(await loadLanguage('xx-YY')).toBe('en');
  });

  test('reads languages saved by the previous app version', async () => {
    stored = 'pt-br';
    expect(await loadLanguage('en-US')).toBe('pt-BR');
    stored = 'zh-tw';
    expect(await loadLanguage('en-US')).toBe('zh-Hant');
  });

  test('persists under gsale_locale and notifies subscribers', async () => {
    let notified = 0;
    const unsubscribe = languageStore.subscribe(() => { notified += 1; });
    await setLanguage('fr');
    expect(getLanguage()).toBe('fr');
    expect(languageStore.getSnapshot()).toBe('fr');
    expect(writes.at(-1)).toEqual(['gsale_locale', 'fr']);
    expect(notified).toBe(1);
    await setLanguage('fr');
    expect(notified).toBe(1);
    unsubscribe();
  });
});

describe('t', () => {
  test('reads the active catalog and interpolates parameters', async () => {
    await setLanguage('tr');
    expect(t('detail.notSoldHere')).toBe('Bu sürüm yok');
    expect(t('search.empty', { query: 'Hades' })).toContain('Hades');
    await setLanguage('en');
    expect(t('detail.notSoldHere')).toBe('Not sold in this edition');
  });

  test('plural picks the CLDR category and falls back to other', async () => {
    await setLanguage('en');
    expect(plural('search.resultCount', 1)).toBe('1 game');
    expect(plural('search.resultCount', 3)).toBe('3 games');
    await setLanguage('tr');
    expect(plural('search.resultCount', 3)).toBe('3 oyun');
  });
});

describe('formatting', () => {
  test('money follows the app language', () => {
    expect(formatMoney(1999.5, 'tr')).toBe(new Intl.NumberFormat('tr', { style: 'currency', currency: 'TRY' }).format(1999.5));
    expect(formatMoney(1999.5, 'en')).toBe(new Intl.NumberFormat('en', { style: 'currency', currency: 'TRY' }).format(1999.5));
  });

  test('percent shows a signed whole number', () => {
    expect(formatPercent(-40, 'en')).toBe(new Intl.NumberFormat('en', { style: 'percent', signDisplay: 'exceptZero', maximumFractionDigits: 0 }).format(-0.4));
  });
});

describe('translatorFor', () => {
  test('one stable function per language, so memoised screens recompute on a language change', () => {
    expect(translatorFor('en')).toBe(translatorFor('en'));
    expect(translatorFor('en')).not.toBe(translatorFor('tr'));
  });
});

describe('pluralCategory', () => {
  test('falls back to one/other when the runtime has no Intl.PluralRules', () => {
    expect(pluralCategory(1, 'ru', null)).toBe('one');
    expect(pluralCategory(5, 'ru', null)).toBe('other');
    expect(pluralCategory(5, 'ru')).toBe('many');
  });
});
