import { describe, expect, mock, test } from 'bun:test';

let stored: string | null = null;
let failRead = false;
const writes: [string, string][] = [];

mock.module('expo-secure-store', () => ({
  getItemAsync: async () => {
    if (failRead) throw new Error('storage unavailable');
    return stored;
  },
  setItemAsync: async (key: string, value: string) => { writes.push([key, value]); },
}));

const { getAppLocale, loadAppLocale, setAppLocale } = await import('@/services/locale');

describe('app locale', () => {
  test('loads a saved locale and persists changes', async () => {
    stored = 'en';
    expect(await loadAppLocale()).toBe('en');
    expect(getAppLocale()).toBe('en');
    await setAppLocale('tr');
    expect(getAppLocale()).toBe('tr');
    expect(writes.at(-1)).toEqual(['gsale_locale', 'tr']);
  });

  test('keeps the current locale for an empty value and falls back after a read error', async () => {
    stored = '';
    expect(await loadAppLocale()).toBe('tr');
    failRead = true;
    expect(await loadAppLocale()).toBe('tr');
    failRead = false;
  });
});
