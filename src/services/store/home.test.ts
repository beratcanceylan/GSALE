import { afterEach, describe, expect, mock, test } from 'bun:test';

mock.module('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => undefined,
}));

const { setAppCountry } = await import('@/services/country');
const { resetCurrencyCacheForTests, setFxRatesForTests } = await import('@/services/store/currency');
const { getHomeSections } = await import('@/services/store/home');

const originalFetch = globalThis.fetch;

type Route = (url: string) => unknown;

function storeResponses(overrides: Partial<Record<string, Route>> = {}): Record<string, Route> {
  return {
    steam: () => ({
      specials: {
        items: [
          { id: 101, name: 'Steam Deal', discount_percent: 50, currency: 'TRY', original_price: 20000, final_price: 10000 },
          { id: 102, name: 'Steam Full Price', discount_percent: 0, currency: 'TRY', original_price: 20000, final_price: 20000 },
        ],
      },
    }),
    epic: () => [
      {
        id: 'offer1',
        namespace: 'ns1',
        title: 'Epic Deal',
        productSlug: 'epic-deal',
        keyImages: [],
        price: { price: { currencyCode: 'TRY', originalPrice: 40000, discountPrice: 10000, discount: 30000 } },
      },
    ],
    gog: () => ({
      products: [
        {
          id: 7,
          title: 'GOG Deal',
          slug: 'gog_deal',
          price: {
            discount: '-60%',
            finalMoney: { amount: '4.00', currency: 'USD' },
            baseMoney: { amount: '10.00', currency: 'USD' },
          },
        },
      ],
    }),
    xboxBrowse: () => ({ channels: { GameDeals: { products: [{ productId: '9XBOXDEAL001' }] } } }),
    xboxCatalog: () => ({
      Products: [
        {
          ProductId: '9XBOXDEAL001',
          LocalizedProperties: [{ ProductTitle: 'Xbox Deal' }],
          DisplaySkuAvailabilities: [
            { Availabilities: [{ OrderManagementData: { Price: { CurrencyCode: 'TRY', ListPrice: 300, MSRP: 600 } } }] },
          ],
        },
      ],
    }),
    playstation: () => ({
      data: {
        categoryGridRetrieve: {
          products: [
            {
              id: 'EP0001-PPSA00001_00-GSALEPSDEAL00000',
              name: 'PS Deal',
              media: [{ role: 'MASTER', type: 'IMAGE', url: 'https://image.api.playstation.com/ps-deal.png' }],
              price: { basePrice: '1.000,00 TL', discountedPrice: '250,00 TL', discountText: '-%75' },
            },
          ],
        },
      },
    }),
    nintendo: () => ({
      hits: [
        {
          objectID: 'nsw-deal',
          nsuid: '70010000000001',
          title: 'Nintendo Deal',
          url: '/us/store/products/nintendo-deal-switch/',
          price: { finalPrice: 5, regPrice: 10, percentOff: 50 },
        },
      ],
    }),
    ...overrides,
  } as Record<string, Route>;
}

function routeKey(url: string): string {
  if (url.includes('featuredcategories')) return 'steam';
  if (url.includes('featured-discounts')) return 'epic';
  if (url.includes('catalog.gog.com')) return 'gog';
  if (url.includes('emerald.xboxservices.com')) return 'xboxBrowse';
  if (url.includes('displaycatalog')) return 'xboxCatalog';
  if (url.includes('web.np.playstation.com')) return 'playstation';
  if (url.includes('algolia.net')) return 'nintendo';
  return 'unknown';
}

function mockStores(routes: Record<string, Route>): string[] {
  const urls: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    urls.push(url);
    const route = routes[routeKey(url)];
    if (!route) return new Response('', { status: 404 });
    const body = route(url);
    return body instanceof Response ? body : Response.json(body);
  };
  return urls;
}

afterEach(async () => {
  globalThis.fetch = originalFetch;
  resetCurrencyCacheForTests();
  await setAppCountry('TR');
});

describe('home deal strips', () => {
  test('returns one discounted strip per store in a fixed order', async () => {
    setFxRatesForTests({ USD: 1, TRY: 40 });
    mockStores(storeResponses());

    const sections = await getHomeSections();

    expect(sections.map((section) => section.platform)).toEqual([
      'Steam',
      'PlayStation',
      'Xbox',
      'Epic Games',
      'GOG',
      'Nintendo',
    ]);
    const ids = sections.map((section) => section.games.map((game) => game.id));
    expect(ids).toEqual([
      ['101'],
      ['ps-EP0001-PPSA00001_00-GSALEPSDEAL00000'],
      ['xbox-9XBOXDEAL001'],
      ['ns1_offer1'],
      ['gog-7'],
      ['nintendo-nsw-deal'],
    ]);
  });

  test('every game carries a TL price, a discount and an official store link', async () => {
    setFxRatesForTests({ USD: 1, TRY: 40 });
    mockStores(storeResponses());

    for (const section of await getHomeSections()) {
      for (const game of section.games) {
        const deal = game.deals?.[0];
        expect(deal?.price ?? '').toMatch(/ TL$/);
        expect(deal?.discount ?? '').toMatch(/^-\d+%$/);
        expect(deal?.store_url ?? '').toMatch(/^https:\/\//);
      }
    }
  });

  test('a failing store only drops its own strip', async () => {
    mockStores(storeResponses({ xboxBrowse: () => new Response('', { status: 503 }) }));

    const platforms = (await getHomeSections()).map((section) => section.platform);

    expect(platforms).not.toContain('Xbox');
    expect(platforms).toContain('Steam');
    expect(platforms).toContain('PlayStation');
  });

  test('PlayStation is skipped where there is no PlayStation Store', async () => {
    const urls = mockStores(storeResponses());
    await setAppCountry('KZ');

    const platforms = (await getHomeSections()).map((section) => section.platform);

    expect(platforms).not.toContain('PlayStation');
    expect(urls.some((url) => url.includes('playstation.com'))).toBeFalse();
  });

  test('regional PlayStation deal prices are converted to TL', async () => {
    setFxRatesForTests({ USD: 1, TRY: 40, EUR: 0.8 });
    mockStores(
      storeResponses({
        playstation: () => ({
          data: {
            categoryGridRetrieve: {
              products: [
                {
                  id: 'EP0001-PPSA00001_00-GSALEPSDEAL00000',
                  name: 'PS Deal',
                  price: { basePrice: '€20,00', discountedPrice: '€8,00', discountText: '–60 %' },
                },
              ],
            },
          },
        }),
      }),
    );
    await setAppCountry('DE');

    const ps = (await getHomeSections()).find((section) => section.platform === 'PlayStation');
    const deal = ps?.games[0]?.deals?.[0];

    expect(deal?.price).toBe('400,00 TL');
    expect(deal?.original_price).toBe('1.000,00 TL');
    expect(deal?.discount).toBe('-60%');
    expect(deal?.store_url ?? '').toContain('/de-de/');
  });
});
