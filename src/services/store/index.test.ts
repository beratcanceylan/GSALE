import { afterEach, describe, expect, mock, test } from 'bun:test';

import { getDetailPreview } from '@/services/store/detail-preview';

mock.module('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => undefined,
}));

const { getFreeGames, getGameDetail, searchGames } = await import('@/services/store/index');

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

  test('combines free games, deduplicates titles and remembers previews', async () => {
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.includes('freeGamesPromotions')) {
        return Response.json({ data: { Catalog: { searchStore: { elements: [
          {
            id: 'epic-1', namespace: 'ns', title: 'Shared Game',
            promotions: { promotionalOffers: [{ promotionalOffers: [{ discountSetting: { discountPercentage: 0 } }] }] },
          },
        ] } } } });
      }
      if (url.includes('featuredcategories')) {
        return Response.json({ free_to_play: { items: [
          { id: 101, name: 'shared game' },
          { id: 102, name: 'Steam Only' },
        ] } });
      }
      throw new Error(`Unexpected request: ${url}`);
    };

    const games = await getFreeGames();
    expect(games.map((game) => game.title)).toEqual(['Shared Game', 'Steam Only']);
    expect(getDetailPreview('102', 'Steam')?.title).toBe('Steam Only');
  });

  test('retains the available provider when the other free feed fails', async () => {
    globalThis.fetch = async (input) => String(input).includes('freeGamesPromotions')
      ? new Response('', { status: 404 })
      : Response.json({ free_to_play: { items: [{ id: 103, name: 'Available' }] } });
    expect((await getFreeGames()).map((game) => game.title)).toEqual(['Available']);
  });

  test('throws after cancellation even when provider requests settle', async () => {
    const controller = new AbortController();
    globalThis.fetch = async () => Response.json({});
    controller.abort();
    await expect(getFreeGames({ signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
  });

  test('reports a missing game detail', async () => {
    globalThis.fetch = async () => Response.json({ '987654321': { success: false } });
    await expect(getGameDetail('987654321', 'Steam')).rejects.toThrow('Oyun bulunamadı.');
  });

  test('uses the default detail adapter and reports a missing unprefixed game', async () => {
    globalThis.fetch = async () => Response.json({ 'gsale-unknown': { success: false } });
    await expect(getGameDetail('gsale-unknown')).rejects.toThrow('Oyun bulunamadı.');
  });
});
