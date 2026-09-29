import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

mock.module('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => undefined,
}));

const { resetCurrencyCacheForTests, setFxRatesForTests } = await import('@/services/store/currency');
const { fetchXboxDeals, fetchXboxDetails, fetchXboxEditionOffers, fetchXboxPrice, searchXbox } = await import(
  '@/services/store/platforms/xbox'
);

const originalFetch = globalThis.fetch;

type Price = { CurrencyCode?: string; ListPrice?: number; MSRP?: number };

function product(id: string, title: string, prices: Price[] = [], extra: Record<string, unknown> = {}) {
  return {
    ProductId: id,
    LocalizedProperties: [{ ProductTitle: title, Images: [{ ImagePurpose: 'Poster', Uri: '//store-images.s-microsoft.com/p' }] }],
    DisplaySkuAvailabilities: [{ Availabilities: prices.map((price) => ({ OrderManagementData: { Price: price } })) }],
    ...extra,
  };
}

/** Autosuggest returns `ids`; the display catalog returns `products`. */
function mockXbox(ids: string[], products: unknown[]): string[] {
  const urls: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    urls.push(url);
    if (url.includes('autosuggest')) {
      return Response.json({ Results: [{ Products: ids.map((id) => ({ ProductId: id })) }] });
    }
    return Response.json({ Products: products });
  };
  return urls;
}

beforeEach(() => {
  setFxRatesForTests({ USD: 1, TRY: 40 });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  resetCurrencyCacheForTests();
});

describe('searchXbox', () => {
  test('keeps the autosuggest order and drops products without an id or title', async () => {
    mockXbox(['B', 'A'], [product('A', 'Alpha'), product('B', 'Beta'), product('C', 'Unrequested'), { ProductId: 'D' }, { LocalizedProperties: [{ ProductTitle: 'No id' }] }]);
    const hits = await searchXbox('game');
    expect(hits.map((hit) => hit.id)).toEqual(['xbox-B', 'xbox-A', 'xbox-C']);
    expect(hits[0]?.image_url).toBe('https://store-images.s-microsoft.com/p');
  });

  test('makes no catalog request when autosuggest has no candidates', async () => {
    const urls = mockXbox([], []);
    expect(await searchXbox('nothing')).toEqual([]);
    expect(urls.some((url) => url.includes('/products?'))).toBeFalse();
  });
});

describe('fetchXboxPrice', () => {
  test('converts a foreign-currency price and derives the discount', async () => {
    mockXbox(['A'], [product('A', 'Halo', [{ CurrencyCode: 'USD', ListPrice: 10, MSRP: 20 }])]);
    expect(await fetchXboxPrice('Halo')).toMatchObject({
      price: '400,00 TL',
      original_price: '800,00 TL',
      discount: '-50%',
      store_url: 'https://www.xbox.com/tr-tr/games/store/A',
    });
  });

  test('treats a price without a currency as TRY', async () => {
    mockXbox(['A'], [product('A', 'Halo', [{ ListPrice: 300, MSRP: 300 }])]);
    expect(await fetchXboxPrice('Halo')).toMatchObject({ price: '300,00 TL', original_price: null, discount: '' });
  });

  test('prefers a paid match over a loose free one, and an exact free one over paid', async () => {
    mockXbox(['F', 'P'], [
      product('F', 'Halo Infinite Multiplayer Free', [{ CurrencyCode: 'TRY', ListPrice: 0, MSRP: 0 }]),
      product('P', 'Halo', [{ CurrencyCode: 'TRY', ListPrice: 500, MSRP: 500 }]),
    ]);
    expect((await fetchXboxPrice('Halo'))?.price).toBe('500,00 TL');

    mockXbox(['F', 'P'], [
      product('F', 'Halo', [{ CurrencyCode: 'TRY', ListPrice: 0, MSRP: 0 }]),
      product('P', 'Halo Deluxe', [{ CurrencyCode: 'TRY', ListPrice: 500, MSRP: 500 }]),
    ]);
    expect((await fetchXboxPrice('Halo'))?.price).toBe('Ücretsiz');
  });

  test('falls back to a loose free match, and returns null when nothing is priced or matched', async () => {
    mockXbox(['F'], [product('F', 'Halo Trial', [{ CurrencyCode: 'TRY', ListPrice: 0, MSRP: 0 }])]);
    expect((await fetchXboxPrice('Halo'))?.price).toBe('Ücretsiz');

    mockXbox(['A'], [product('A', 'Halo')]);
    expect(await fetchXboxPrice('Halo')).toBeNull();

    mockXbox(['A'], [product('A', 'Something Else', [{ ListPrice: 1 }])]);
    expect(await fetchXboxPrice('Halo')).toBeNull();
  });
});

describe('fetchXboxDetails', () => {
  test('maps the product with its price and store link', async () => {
    mockXbox([], [product('9NBLGGH4R315', 'Halo', [{ CurrencyCode: 'TRY', ListPrice: 100, MSRP: 200 }])]);
    expect(await fetchXboxDetails('xbox-9NBLGGH4R315')).toMatchObject({
      id: 'xbox-9NBLGGH4R315',
      title: 'Halo',
      store_links: { Xbox: 'https://www.xbox.com/tr-tr/games/store/9NBLGGH4R315' },
      deals: [{ price: '100,00 TL', original_price: '200,00 TL', discount: '-50%' }],
    });
  });

  test('uses the slug id when the product has none and omits deals without a price', async () => {
    mockXbox([], [{ LocalizedProperties: [{ ProductTitle: 'Nameless' }] }]);
    const game = await fetchXboxDetails('xbox-ABC');
    expect(game?.id).toBe('xbox-ABC');
    expect(game?.deals).toBeUndefined();
  });

  test('returns null for invalid ids, missing products and untitled products', async () => {
    const urls = mockXbox([], []);
    expect(await fetchXboxDetails('xbox-not valid!')).toBeNull();
    expect(urls).toHaveLength(0);
    expect(await fetchXboxDetails('xbox-MISSING')).toBeNull();

    mockXbox([], [{ ProductId: 'X', LocalizedProperties: [{ ProductTitle: '  ' }] }]);
    expect(await fetchXboxDetails('xbox-X')).toBeNull();
  });
});

describe('fetchXboxDeals', () => {
  test('keeps discounted, paid products from the deals channel', async () => {
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.includes('emerald')) {
        return Response.json({ channels: { GameDeals: { products: [{ productId: 'D' }, { productId: 'F' }, { productId: 'N' }, {}] } } });
      }
      return Response.json({
        Products: [
          product('D', 'Discounted', [{ CurrencyCode: 'TRY', ListPrice: 50, MSRP: 100 }]),
          product('F', 'Free', [{ CurrencyCode: 'TRY', ListPrice: 0, MSRP: 0 }]),
          product('N', 'Full price', [{ CurrencyCode: 'TRY', ListPrice: 100, MSRP: 100 }]),
        ],
      });
    };
    expect((await fetchXboxDeals(10)).map((game) => game.id)).toEqual(['xbox-D']);
  });

  test('an empty channel yields no deals and no catalog request', async () => {
    const urls: string[] = [];
    globalThis.fetch = async (input) => {
      urls.push(String(input));
      return Response.json({});
    };
    expect(await fetchXboxDeals(10)).toEqual([]);
    expect(urls).toHaveLength(1);
  });
});

describe('Xbox search fallbacks', () => {
  test('a blank query falls straight back to the HTML search', async () => {
    const urls: string[] = [];
    globalThis.fetch = async (input) => {
      const url = String(input);
      urls.push(url);
      if (url.includes('/search?q=')) return new Response('"productId":"H1" "productId":"H1"');
      return Response.json({ Products: [product('H1', 'From HTML')] });
    };
    expect((await searchXbox('   ')).map((hit) => hit.id)).toEqual(['xbox-H1']);
    expect(urls.some((url) => url.includes('autosuggest'))).toBeFalse();
  });

  test('long queries retry with their first four words, then use the HTML search on errors', async () => {
    const urls: string[] = [];
    globalThis.fetch = async (input) => {
      const url = String(input);
      urls.push(url);
      if (url.includes('autosuggest')) return new Response('', { status: 404 });
      if (url.includes('/search?q=')) return new Response('SEARCH_GAMES_SEARCHQUERY= "productId":"H2"');
      return Response.json({ Products: [product('H2', 'One Two Three Four Five')] });
    };
    expect((await searchXbox('One Two Three Four Five')).map((hit) => hit.id)).toEqual(['xbox-H2']);
    const suggestions = urls.filter((url) => url.includes('autosuggest'));
    expect(suggestions).toHaveLength(2);
    expect(suggestions[1]?.endsWith('query=One+Two+Three+Four')).toBeTrue();
  });

  test('an aborted autosuggest request rejects', async () => {
    const controller = new AbortController();
    globalThis.fetch = async () => {
      controller.abort();
      throw controller.signal.reason;
    };
    await expect(searchXbox('Halo', { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('fetchXboxEditionOffers', () => {
  const usd = (list: number): Price[] => [{ CurrencyCode: 'USD', ListPrice: list, MSRP: list }];

  test('returns one offer per edition and keeps the console listing over the PC one', async () => {
    mockXbox(
      ['A', 'B', 'C', 'D'],
      [
        product('A', 'Forza Horizon 5', usd(60)),
        product('B', 'Forza Horizon 5 Premium Edition', usd(100)),
        product('C', 'Forza Horizon 5 Premium Edition (PC)', usd(90)),
        product('D', 'Forza Horizon 5 Car Pass', usd(30)),
      ],
    );
    const offers = await fetchXboxEditionOffers('Forza Horizon 5');
    expect(offers.map((offer) => [offer.edition, offer.id])).toEqual([
      ['base', 'xbox-A'],
      ['premium', 'xbox-B'],
    ]);
  });

  test('searches once with the base title', async () => {
    const urls = mockXbox([], []);
    await fetchXboxEditionOffers('Forza Horizon 5 Premium Edition');
    const searches = urls.filter((url) => url.includes('autosuggest'));
    expect(searches).toHaveLength(1);
    expect(new URL(searches[0] ?? '').searchParams.get('query')).toBe('Forza Horizon 5');
  });
});
