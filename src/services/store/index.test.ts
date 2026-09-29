import { afterEach, describe, expect, mock, test } from 'bun:test';

import { getDetailPreview } from '@/services/store/detail-preview';

mock.module('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => undefined,
}));

const { searchGames } = await import('@/services/store/index');

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('store search API', () => {
  test('returns search previews without looking up cross-platform prices', async () => {
    const urls: string[] = [];
    globalThis.fetch = async (input) => {
      const url = String(input);
      urls.push(url);
      if (url.includes('/api/storesearch/')) {
        return Response.json({ items: [{ id: 9910999, name: 'Ready or Not' }] });
      }
      return Response.json({});
    };

    const games = await searchGames('Ready or Not');

    expect(games.map((game) => game.id)).toEqual(['9910999']);
    expect(getDetailPreview('9910999', 'Steam')?.title).toBe('Ready or Not');
    // Price lookups (Steam app details) are left to the detail screen.
    expect(urls.some((url) => url.includes('/api/appdetails'))).toBeFalse();
  });
});
