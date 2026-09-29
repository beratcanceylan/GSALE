import { afterEach, describe, expect, mock, test } from 'bun:test';

mock.module('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => undefined,
}));

const { fetchGogPrice } = await import('@/services/store/platforms/gog');
const { fetchNintendoPrice } = await import('@/services/store/platforms/nintendo');
const { fetchPlayStationPrice } = await import('@/services/store/platforms/ps');
const { fetchSteamPrice } = await import('@/services/store/platforms/steam');
const { fetchXboxPrice } = await import('@/services/store/platforms/xbox');
const { fetchAllPrices } = await import('@/services/store/prices');

const originalFetch = globalThis.fetch;

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('store adapter request reuse', () => {
  let urls: string[];

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('uses the Steam search price without a second appdetails request', async () => {
    urls = [];
    globalThis.fetch = async (input) => {
      const url = String(input);
      urls.push(url);
      return jsonResponse({
        items: [
          {
            id: 991001,
            name: 'GSALE Direct Steam Price',
            price: {
              currency: 'TRY',
              final: 1499,
              initial: 1999,
            },
          },
        ],
      });
    };

    const result = await fetchSteamPrice('GSALE Direct Steam Price', 'base');

    expect(result?.price).toBe('14,99 TL');
    expect(result?.original_price).toBe('19,99 TL');
    expect(result?.discount).toBe('-25%');
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain('/api/storesearch/');
  });

  test('falls back to Steam appdetails when search has no price', async () => {
    urls = [];
    globalThis.fetch = async (input) => {
      const url = String(input);
      urls.push(url);
      if (url.includes('/api/storesearch/')) {
        return jsonResponse({ items: [{ id: 991002, name: 'GSALE Steam Fallback' }] });
      }
      return jsonResponse({
        '991002': {
          success: true,
          data: { name: 'GSALE Steam Fallback', is_free: true },
        },
      });
    };

    const result = await fetchSteamPrice('GSALE Steam Fallback', 'base');

    expect(result?.price).toBe('Ücretsiz');
    expect(urls).toHaveLength(2);
    expect(urls[1]).toContain('/api/appdetails?');
  });

  test('uses one GOG catalog response for title matching and pricing', async () => {
    urls = [];
    globalThis.fetch = async (input) => {
      const url = String(input);
      urls.push(url);
      return jsonResponse({
        products: [
          {
            id: 991003,
            title: 'GSALE GOG Price',
            slug: 'gsale_gog_price',
            price: {
              finalMoney: { amount: '12.50', currency: 'TRY' },
              baseMoney: { amount: '25.00', currency: 'TRY' },
              discount: '50',
            },
          },
        ],
      });
    };

    const result = await fetchGogPrice('GSALE GOG Price');

    expect(result?.price).toBe('12,50 TL');
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain('catalog.gog.com/v1/catalog');
  });

  test('uses the Xbox search catalog prices without per-candidate refetches', async () => {
    urls = [];
    globalThis.fetch = async (input) => {
      const url = String(input);
      urls.push(url);
      if (url.includes('displaycatalog.mp.microsoft.com/v7.0/productFamilies/autosuggest')) {
        return jsonResponse({
          Results: [{
            ProductFamilyName: 'Games',
            Products: [{ ProductId: '9GSALE001', Type: 'Game', Title: 'GSALE Xbox Price' }],
          }],
        });
      }
      if (url.includes('xbox.com/tr-tr/search')) {
        return new Response(
          '<script>{"SEARCH_GAMES_SEARCHQUERY=GSALE":{"data":{"products":[{"productId":"9GSALE001"}]}}}</script>',
          { status: 200 },
        );
      }
      return jsonResponse({
        Products: [
          {
            ProductId: '9GSALE001',
            LocalizedProperties: [{ ProductTitle: 'GSALE Xbox Price' }],
            DisplaySkuAvailabilities: [
              {
                Availabilities: [
                  { OrderManagementData: { Price: { ListPrice: 29.99, MSRP: 59.99, CurrencyCode: 'TRY' } } },
                ],
              },
            ],
          },
        ],
      });
    };

    const result = await fetchXboxPrice('GSALE Xbox Price');

    expect(result?.price).toBe('29,99 TL');
    expect(urls).toHaveLength(2);
    expect(urls[0]).toContain('displaycatalog.mp.microsoft.com/v7.0/productFamilies/autosuggest');
    expect(urls[1]).toContain('displaycatalog.mp.microsoft.com/v7.0/products');
  });

  test('keeps the Xbox HTML search as a fallback when autosuggest is unavailable', async () => {
    urls = [];
    globalThis.fetch = async (input) => {
      const url = String(input);
      urls.push(url);
      if (url.includes('displaycatalog.mp.microsoft.com/v7.0/productFamilies/autosuggest')) {
        return new Response('{}', { status: 400 });
      }
      if (url.includes('xbox.com/tr-tr/search')) {
        return new Response(
          '<script>{"SEARCH_GAMES_SEARCHQUERY=GSALE":{"data":{"products":[{"productId":"9GSALE002"}]}}}</script>',
          { status: 200 },
        );
      }
      return jsonResponse({
        Products: [{
          ProductId: '9GSALE002',
          LocalizedProperties: [{ ProductTitle: 'GSALE Xbox HTML Fallback' }],
          DisplaySkuAvailabilities: [{
            Availabilities: [{
              OrderManagementData: { Price: { ListPrice: 39.99, MSRP: 39.99, CurrencyCode: 'TRY' } },
            }],
          }],
        }],
      });
    };

    const result = await fetchXboxPrice('GSALE Xbox HTML Fallback');

    expect(result?.price).toBe('39,99 TL');
    expect(urls).toHaveLength(3);
    expect(urls[1]).toContain('xbox.com/tr-tr/search');
    expect(urls[2]).toContain('displaycatalog.mp.microsoft.com/v7.0/products');
  });

  test('uses the live PlayStation Chihiro response for a price', async () => {
    urls = [];
    globalThis.fetch = async (input) => {
      urls.push(String(input));
      return jsonResponse({
        links: [
          {
            id: 'UP0000-PPSA00000_00-GSALEPS00000000',
            name: 'GSALE PS Price',
            top_category: 'downloadable_game',
            default_sku: { display_price: '499,00 TL', price: 49900 },
            images: [{ type: 10, url: 'https://image.api.playstation.com/gsale-ps.jpg' }],
          },
        ],
      });
    };

    const result = await fetchPlayStationPrice('GSALE PS Price');

    expect(result?.price).toBe('499,00 TL');
    expect(result?.store_url).toContain('/product/UP0000-PPSA00000_00-GSALEPS00000000');
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain('/chihiro/00_09_000/tumbler/');
  });

  test('falls back to the legacy PlayStation page when Chihiro is malformed', async () => {
    urls = [];
    globalThis.fetch = async (input) => {
      const url = String(input);
      urls.push(url);
      if (url.includes('/chihiro/00_09_000/')) return jsonResponse({ unexpected: true });
      return new Response(
        `<li><a data-telemetry-meta="{&quot;id&quot;:&quot;UP0000-PPSA00000_00-GSALEPS00000001&quot;,&quot;name&quot;:&quot;GSALE PS Legacy&quot;,&quot;price&quot;:&quot;499,00 TL&quot;}" href="/tr-tr/product/UP0000-PPSA00000_00-GSALEPS00000001"><img src="https://image.api.playstation.com/gsale-legacy.jpg" /></a></li>`,
        { status: 200, headers: { 'Content-Type': 'text/html' } },
      );
    };

    const result = await fetchPlayStationPrice('GSALE PS Legacy');

    expect(result).toMatchObject({
      platform: 'PlayStation',
      price: '499,00 TL',
      store_url: 'https://store.playstation.com/tr-tr/product/UP0000-PPSA00000_00-GSALEPS00000001',
    });
    expect(urls).toHaveLength(2);
    expect(urls[0]).toContain('/chihiro/00_09_000/tumbler/');
    expect(urls[1]).toContain('store.playstation.com/tr-tr/search/');
  });

  test('uses one Nintendo Algolia search response for a price', async () => {
    urls = [];
    globalThis.fetch = async (input) => {
      urls.push(String(input));
      return jsonResponse({
        hits: [
          {
            objectID: '7100000001',
            nsuid: '70010000000001',
            title: 'GSALE Nintendo Price',
            url: '/us/store/products/gsale-nintendo-price/',
            productImageSquare: 'https://assets.nintendo.com/image/upload/gsale.jpg',
            platform: 'Nintendo Switch',
            price: { finalPrice: 599, regPrice: 799, percentOff: 25 },
            eshopDetails: { currency: 'TRY', regularPrice: 799, discountPrice: 599 },
            productType: ['Games'],
          },
        ],
      });
    };

    const result = await fetchNintendoPrice('GSALE Nintendo Price');

    expect(result).toMatchObject({
      platform: 'Nintendo',
      price: '599,00 TL',
      original_price: '799,00 TL',
      discount: '-25%',
    });
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain('algolia.net/1/indexes/store_game_en_us/query');
  });

  test('reuses authoritative source deals and keeps canonical provider order', async () => {
    urls = [];
    globalThis.fetch = async (input) => {
      urls.push(String(input));
      throw new Error('No provider request should be needed');
    };

    const deals = await fetchAllPrices('GSALE Known Deals', {
      knownDeals: [
        { platform: 'Xbox', price: '40,00 TL', discount: '', tier: 'console' },
        { platform: 'Steam', price: '10,00 TL', discount: '', tier: 'pc' },
        { platform: 'PlayStation', price: '30,00 TL', discount: '', tier: 'console' },
        { platform: 'Nintendo', price: '25,00 TL', discount: '', tier: 'console' },
        { platform: 'GOG', price: '20,00 TL', discount: '', tier: 'pc' },
        { platform: 'Epic Games', price: '15,00 TL', discount: '', tier: 'pc' },
      ],
    });

    expect(deals.map((deal) => deal.platform)).toEqual([
      'Steam',
      'Epic Games',
      'GOG',
      'Xbox',
      'PlayStation',
      'Nintendo',
    ]);
    expect(urls).toHaveLength(0);
  });
});
