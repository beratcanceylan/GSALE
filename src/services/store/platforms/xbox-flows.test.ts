import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

mock.module('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => undefined,
}));

const { resetCurrencyCacheForTests, setFxRatesForTests } = await import('@/services/store/currency');
const { fetchXboxDetails, fetchXboxEditionOffers, fetchXboxTopPaid, searchXbox } = await import(
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

describe('Xbox edition prices', () => {
  const priceOf = async (title: string) => (await fetchXboxEditionOffers(title))[0]?.price ?? null;

  test('converts a foreign-currency price and derives the discount', async () => {
    mockXbox(['A'], [product('A', 'Halo', [{ CurrencyCode: 'USD', ListPrice: 10, MSRP: 20 }])]);
    expect(await priceOf('Halo')).toMatchObject({
      price: '400,00 TL',
      original_price: '800,00 TL',
      discount: '-50%',
      store_url: 'https://www.xbox.com/tr-tr/games/store/A',
    });
  });

  test('treats a price without a currency as TRY', async () => {
    mockXbox(['A'], [product('A', 'Halo', [{ ListPrice: 300, MSRP: 300 }])]);
    expect(await priceOf('Halo')).toMatchObject({ price: '300,00 TL', original_price: null, discount: '' });
  });

  test('a zero list price is free', async () => {
    mockXbox(['F'], [product('F', 'Halo', [{ CurrencyCode: 'TRY', ListPrice: 0, MSRP: 0 }])]);
    expect(await priceOf('Halo')).toMatchObject({ price: 'Ücretsiz' });
  });

  test('skips unpriced and unrelated products', async () => {
    mockXbox(['A'], [product('A', 'Halo')]);
    expect(await fetchXboxEditionOffers('Halo')).toEqual([]);

    mockXbox(['A'], [product('A', 'Something Else', [{ ListPrice: 1 }])]);
    expect(await fetchXboxEditionOffers('Halo')).toEqual([]);
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

describe('fetchXboxTopPaid', () => {
  test('lists the top-paid channel with prices, in channel order', async () => {
    const bodies: string[] = [];
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      if (url.includes('emerald')) {
        bodies.push(String(init?.body ?? ''));
        return Response.json({ channels: { TopPaid: { products: [{ productId: 'B' }, { productId: 'A' }, {}] } } });
      }
      return Response.json({
        Products: [
          product('A', 'Alpha', [{ CurrencyCode: 'TRY', ListPrice: 100, MSRP: 100 }]),
          product('B', 'Beta', [{ CurrencyCode: 'TRY', ListPrice: 50, MSRP: 100 }]),
        ],
      });
    };
    const games = await fetchXboxTopPaid(10);
    expect(games.map((game) => [game.id, game.deals?.[0]?.price])).toEqual([
      ['xbox-B', '50,00 TL'],
      ['xbox-A', '100,00 TL'],
    ]);
    expect(JSON.parse(bodies[0] ?? '{}')).toMatchObject({ ChannelId: 'DynamicChannel.TopPaidGames' });
  });

  test('an empty channel makes no catalog request', async () => {
    const urls: string[] = [];
    globalThis.fetch = async (input) => {
      urls.push(String(input));
      return Response.json({});
    };
    expect(await fetchXboxTopPaid(10)).toEqual([]);
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
