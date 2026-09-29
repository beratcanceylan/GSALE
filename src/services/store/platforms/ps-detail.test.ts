import { afterEach, describe, expect, mock, test } from 'bun:test';

mock.module('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => undefined,
}));

const { fetchPlayStationDetails } = await import('@/services/store/platforms/ps');
const { fetchGameDetailLive } = await import('@/services/store/detail');
const originalFetch = globalThis.fetch;
const productId = 'EP3969-PPSA11386_00-007FIRSTLIGHT000';

function catalogResponse(): Response {
  return Response.json({
    id: productId,
    name: '007 First Light',
    title_name: '007 First Light',
    images: [{ type: 10, url: 'https://image.api.playstation.com/007.png' }],
    long_desc: 'An espionage adventure.',
  });
}

describe('PlayStation detail price fallback', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  for (const fallback of ['empty page', 'HTTP error']) {
    test(`retains catalog metadata without inventing a price after ${fallback}`, async () => {
      const urls: string[] = [];
      globalThis.fetch = async (input) => {
        const url = String(input);
        urls.push(url);
        if (url.includes('/container/')) return catalogResponse();
        return fallback === 'empty page'
          ? new Response('<html><body></body></html>')
          : new Response('', { status: 404 });
      };

      const game = await fetchPlayStationDetails(`ps-${productId}`);

      expect(game?.title).toBe('007 First Light');
      expect(game?.description).toBe('An espionage adventure.');
      expect(game?.deals).toBeUndefined();
      expect(game?.price).toBe('Bilinmiyor');
      expect(urls).toHaveLength(2);
    });
  }

  test('loads 007 First Light from its product page after an empty catalog response', async () => {
    globalThis.fetch = async (input) => {
      if (String(input).includes('/container/')) return new Response(null, { status: 204 });
      return new Response(`<script type="application/ld+json">${JSON.stringify({
        '@type': 'Product',
        name: '007 First Light',
        image: 'https://image.api.playstation.com/007.png',
        offers: { '@type': 'Offer', price: '2399.20', priceCurrency: 'TRY' },
      })}</script>`);
    };

    const game = await fetchPlayStationDetails(`ps-${productId}`);

    expect(game?.title).toBe('007 First Light');
    expect(game?.deals?.[0]?.price).toBe('2.399,20 TL');
    expect(game?.deals?.[0]?.store_url).toBe(`https://store.playstation.com/tr-tr/product/${productId}`);
  });

  test('propagates cancellation during the page fallback even with catalog metadata', async () => {
    const controller = new AbortController();
    globalThis.fetch = async (input) => {
      if (String(input).includes('/container/')) return catalogResponse();
      controller.abort();
      throw controller.signal.reason;
    };

    await expect(fetchPlayStationDetails(`ps-${productId}`, { signal: controller.signal }))
      .rejects.toMatchObject({ name: 'AbortError' });
  });

  test('still returns other store prices when the PlayStation page is unavailable', async () => {
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.includes('/container/')) return catalogResponse();
      if (url.includes('/api/storesearch/')) {
        return Response.json({ items: [{
          id: 3768760,
          name: '007 First Light',
          price: { currency: 'TRY', final: 150000, initial: 150000 },
        }] });
      }
      return new Response('', { status: 404 });
    };

    const game = await fetchGameDetailLive(`ps-${productId}`, 'PlayStation');

    expect(game?.title).toBe('007 First Light');
    expect(game?.deals).toHaveLength(1);
    expect(game?.deals?.[0]?.platform).toBe('Steam');
    expect(game?.deals?.[0]?.price).toBe('1.500,00 TL');
  });
});
