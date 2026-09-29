import { afterEach, describe, expect, mock, test } from 'bun:test';
import { getDetailPreview, rememberDetailPreviews } from '@/services/store/detail-preview';

mock.module('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => undefined,
}));

const { fetchGameDetailLive } = await import('@/services/store/detail');
const { getGameDetail } = await import('@/services/store');
const originalFetch = globalThis.fetch;

describe('detail navigation fallback', () => {
  afterEach(() => { globalThis.fetch = originalFetch; });

  test('evicts the oldest preview after the navigation cache fills', () => {
    const games = Array.from({ length: 121 }, (_, index) => ({
      id: `preview-${index}`, title: `Preview ${index}`,
      platform: 'Steam', image_url: '', rating: null,
    }));
    rememberDetailPreviews(games);
    expect(getDetailPreview('preview-0')).toBeNull();
    expect(getDetailPreview('preview-120')?.title).toBe('Preview 120');
  });

  for (const mode of ['HTTP failure', 'missing product']) {
    test(`fetches live prices from the search preview after ${mode}`, async () => {
      const id = mode === 'HTTP failure' ? '3768760' : '9910876';
      const title = mode === 'HTTP failure' ? '007 First Light' : 'GSALE Detail Fallback';
      rememberDetailPreviews([{
        id, title, platform: 'Steam', image_url: 'https://example.com/game.jpg', rating: null,
        deals: [{ platform: 'Steam', price: '1,00 TL', discount: '' }],
      }]);
      globalThis.fetch = async (input) => {
        const url = String(input);
        if (url.includes('/api/appdetails')) {
          return mode === 'HTTP failure'
            ? new Response('', { status: 403 })
            : Response.json({ [id]: { success: false } });
        }
        if (url.includes('/api/storesearch')) {
          return Response.json({ items: [{
            id: Number(id), name: title,
            price: { currency: 'TRY', final: 150000, initial: 150000 },
          }] });
        }
        return new Response('', { status: 404 });
      };

      const game = await fetchGameDetailLive(id, 'Steam');

      expect(game?.game.title).toBe(title);
      expect(game?.editions[0]?.deals[0]?.price).toBe('1.500,00 TL');
      expect(getDetailPreview(id, 'Steam')?.deals).toBeUndefined();
      expect(getDetailPreview(id, 'Xbox')).toBeNull();
    });
  }

  test('preserves errors when no matching preview is available', async () => {
    globalThis.fetch = async () => new Response('', { status: 403 });
    await expect(fetchGameDetailLive('9910877', 'Steam')).rejects.toMatchObject({ status: 403 });
  });

  test('does not use a preview to hide caller cancellation', async () => {
    rememberDetailPreviews([{
      id: '9910878', title: 'Cancelled detail', platform: 'Steam', image_url: '', rating: null,
    }]);
    const controller = new AbortController();
    controller.abort();
    await expect(fetchGameDetailLive('9910878', 'Steam', { signal: controller.signal }))
      .rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('detail editions', () => {
  const tryPrice = (final: number) => ({ currency: 'TRY', final, initial: final, discount_percent: 0 });

  afterEach(() => { globalThis.fetch = originalFetch; });

  function routeStores(routes: { appdetails: Record<string, unknown>; steamSearch: unknown[]; epicOffers?: unknown[] }): string[] {
    const urls: string[] = [];
    globalThis.fetch = async (input) => {
      const url = String(input);
      urls.push(url);
      if (url.includes('/api/appdetails')) {
        const id = new URL(url).searchParams.get('appids') ?? '';
        return Response.json({ [id]: routes.appdetails[id] ?? { success: false } });
      }
      if (url.includes('/api/storesearch')) return Response.json({ items: routes.steamSearch });
      if (url.includes('egdata') && routes.epicOffers) return Response.json({ offers: routes.epicOffers });
      return new Response('', { status: 404 });
    };
    return urls;
  }

  test('a Deluxe route opens Deluxe and never shows the base price for it', async () => {
    routeStores({
      appdetails: {
        '71001': { success: true, data: { name: 'GSALE Route Game Deluxe Edition', price_overview: tryPrice(80000) } },
        '71000': { success: true, data: { name: 'GSALE Route Game', price_overview: tryPrice(50000) } },
      },
      steamSearch: [
        { id: 71000, name: 'GSALE Route Game', price: tryPrice(50000) },
        { id: 71001, name: 'GSALE Route Game Deluxe Edition', price: tryPrice(80000) },
      ],
      epicOffers: [{
        id: 'route-base', namespace: 'ns', title: 'GSALE Route Game', productSlug: 'route-game',
        price: { price: { currencyCode: 'TRY', originalPrice: 45000, discountPrice: 45000 } },
      }],
    });
    const detail = await getGameDetail('71001', 'Steam');
    expect(detail.game.edition).toBe('deluxe');
    expect(detail.editions.find((option) => option.key === 'deluxe')?.deals.map((deal) => deal.platform)).toEqual(['Steam']);
    expect(detail.editions.find((option) => option.key === 'base')?.deals.map((deal) => deal.platform)).toEqual([
      'Epic Games',
      'Steam',
    ]);
  });

  test('a route whose edition no search lists still offers that edition from the source store', async () => {
    routeStores({
      appdetails: {
        '72001': { success: true, data: { name: 'GSALE Lonely Game Gold Edition', price_overview: tryPrice(99000) } },
      },
      steamSearch: [],
    });
    const detail = await getGameDetail('72001', 'Steam');
    expect(detail.game.edition).toBe('gold');
    expect(detail.editions.map((option) => option.key)).toEqual(['gold']);
    expect(detail.editions[0]?.deals[0]?.price).toBe('990,00 TL');
  });

  test('the detail makes one search per store and no metadata lookups', async () => {
    const urls = routeStores({
      appdetails: { '73001': { success: true, data: { name: 'GSALE Quiet Game', price_overview: tryPrice(1000) } } },
      steamSearch: [],
    });
    await getGameDetail('73001', 'Steam');
    expect(urls.filter((url) => url.includes('/api/storesearch'))).toHaveLength(1);
    expect(urls.filter((url) => url.includes('catalog.gog.com'))).toHaveLength(1);
  });
});
