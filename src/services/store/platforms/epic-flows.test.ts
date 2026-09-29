import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

mock.module('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => undefined,
}));

const { resetCurrencyCacheForTests, setFxRatesForTests } = await import('@/services/store/currency');
const { fetchEpicDeals, fetchEpicDetails, fetchEpicEditionOffers, fetchEpicFreeGames, searchEpic } = await import(
  '@/services/store/platforms/epic'
);

const originalFetch = globalThis.fetch;

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;

function routeFetch(handler: Handler): string[] {
  const urls: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    urls.push(url);
    return handler(url, init);
  };
  return urls;
}

const HADES = {
  id: 'offer-hades',
  namespace: 'ns-hades',
  title: 'Hades',
  productSlug: 'hades',
  description: 'Defy the god of the dead.',
  developerDisplayName: 'Supergiant',
  tags: [{ name: 'Action' }, { name: 'Windows' }],
  keyImages: [
    { type: 'OfferImageWide', url: 'https://cdn1.epicgames.com/hades-wide.jpg' },
    { type: 'featuredMedia', url: 'https://cdn1.epicgames.com/hades-shot.jpg' },
  ],
  price: { price: { currencyCode: 'TRY', originalPrice: 20000, discountPrice: 10000 } },
};

function browseHtml(elements: unknown[]): string {
  const state = { queries: [{ state: {} }, { state: { data: { Catalog: { searchStore: { elements } } } } }] };
  return `<html><script>window.__REACT_QUERY_INITIAL_QUERIES__ = ${JSON.stringify(state)};window.server_rendered=true</script></html>`;
}

beforeEach(() => {
  setFxRatesForTests({ USD: 1, TRY: 40 });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  resetCurrencyCacheForTests();
});

describe('searchEpic', () => {
  test('returns hits from the egdata search', async () => {
    const urls = routeFetch(() => Response.json({ offers: [HADES] }));
    const hits = await searchEpic('Hades');
    expect(hits.map((hit) => hit.id)).toEqual(['epic-ns-hades_offer-hades']);
    expect(urls[0]).toContain('/search/v2/search?country=TR');
  });

  test('retries "GTA" as "Grand Theft Auto"', async () => {
    const gta = { ...HADES, id: 'gta', namespace: 'rockstar', title: 'Grand Theft Auto V' };
    const bodies: string[] = [];
    routeFetch((_url, init) => {
      const body = String(init?.body ?? '');
      bodies.push(body);
      return Response.json({ elements: body.includes('Grand Theft Auto') ? [gta] : [] });
    });
    const hits = await searchEpic('GTA V');
    expect(hits.map((hit) => hit.title)).toEqual(['Grand Theft Auto V']);
    expect(bodies).toHaveLength(2);
  });

  test('falls back to the localized browse page when egdata has no match', async () => {
    const browseOffer = { id: 'b1', namespace: 'nsb', title: 'Hades', productSlug: 'hades' };
    const urls = routeFetch((url) =>
      url.includes('/browse?q=') ? new Response(browseHtml([browseOffer, 'junk'])) : Response.json({}),
    );
    const hits = await searchEpic('Hades');
    expect(hits.map((hit) => hit.id)).toEqual(['epic-nsb_b1']);
    expect(urls.some((url) => url.includes('store.epicgames.com/tr/browse?q=Hades'))).toBeTrue();
  });

  test('a failing browse page yields no hits, but an aborted one rejects', async () => {
    routeFetch((url) => (url.includes('/browse') ? new Response('', { status: 500 }) : Response.json({})));
    expect(await searchEpic('Nothing')).toEqual([]);

    const controller = new AbortController();
    routeFetch((url) => {
      if (url.includes('/browse')) {
        controller.abort();
        throw controller.signal.reason;
      }
      return Response.json({});
    });
    await expect(searchEpic('Nothing', { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('Epic edition prices', () => {
  test('prices the offer in TL with its store link', async () => {
    routeFetch(() => Response.json({ offers: [HADES] }));
    expect((await fetchEpicEditionOffers('Hades'))[0]?.price).toEqual({
      platform: 'Epic Games',
      price: '100,00 TL',
      original_price: '200,00 TL',
      discount: '-50%',
      tier: 'pc',
      store_url: 'https://store.epicgames.com/p/hades',
    });
  });

  test('skips offers without a price and returns nothing without a match', async () => {
    routeFetch(() => Response.json({ offers: [] }));
    expect(await fetchEpicEditionOffers('Nothing')).toEqual([]);

    const { price: _price, ...unpriced } = HADES;
    routeFetch(() => Response.json({ offers: [{ ...unpriced, productSlug: null, urlSlug: null }] }));
    expect(await fetchEpicEditionOffers('Hades')).toEqual([]);
  });

  test('falls back to the store home when the offer has no product path', async () => {
    routeFetch(() => Response.json({ offers: [{ ...HADES, productSlug: null }] }));
    expect((await fetchEpicEditionOffers('Hades'))[0]?.price.store_url).toBe('https://store.epicgames.com/');
  });
});

describe('fetchEpicDetails', () => {
  test('builds details from the offer, its media and its price', async () => {
    routeFetch((url) => {
      if (url.endsWith('/media')) {
        return Response.json({
          images: [{ src: 'https://cdn1.epicgames.com/media-1.jpg' }],
          videos: [{ outputs: [{ key: 'high', url: 'https://v/high.mp4' }, { key: 'thumbnail', url: 'https://v/t.jpg' }] }],
        });
      }
      return Response.json(HADES);
    });
    const game = await fetchEpicDetails('epic-ns-hades_offer-hades');
    expect(game).toMatchObject({
      id: 'ns-hades_offer-hades',
      title: 'Hades',
      image_url: 'https://cdn1.epicgames.com/media-1.jpg',
      description: 'Defy the god of the dead.',
      screenshots: ['https://cdn1.epicgames.com/media-1.jpg'],
      store_links: { 'Epic Games': 'https://store.epicgames.com/p/hades' },
      deals: [{ platform: 'Epic Games', price: '100,00 TL' }],
    });
    expect(game?.videos?.[0]).toMatchObject({ url: 'https://v/high.mp4', thumbnail: 'https://v/t.jpg' });
  });

  test('keeps the offer screenshots when media fails, and skips deals without a price', async () => {
    const { price: _price, ...unpriced } = HADES;
    routeFetch((url) => (url.endsWith('/media') ? new Response('', { status: 500 }) : Response.json(unpriced)));
    const game = await fetchEpicDetails('hades');
    expect(game?.screenshots).toEqual([
      'https://cdn1.epicgames.com/hades-wide.jpg',
      'https://cdn1.epicgames.com/hades-shot.jpg',
    ]);
    expect(game?.deals).toBeUndefined();
    expect(game?.image_url).toBe('https://cdn1.epicgames.com/hades-wide.jpg');
  });

  test('falls back to searching when the offer has no title', async () => {
    routeFetch((url) => {
      if (url.includes('/search/v2/')) return Response.json({ offers: [HADES] });
      return Response.json({});
    });
    const bySlug = await fetchEpicDetails('ns-hades_offer-hades');
    expect(bySlug).toMatchObject({ id: 'ns-hades_offer-hades', title: 'Hades', description: '' });

    const byTitle = await fetchEpicDetails('unknown-slug', 'Hades');
    expect(byTitle?.title).toBe('Hades');

    expect(await fetchEpicDetails('unknown_slug', 'Something Else')).toBeNull();
  });

  test('an aborted media request rejects', async () => {
    const controller = new AbortController();
    routeFetch((url) => {
      if (url.endsWith('/media')) {
        controller.abort();
        throw controller.signal.reason;
      }
      return Response.json(HADES);
    });
    await expect(fetchEpicDetails('hades', undefined, { signal: controller.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
  });
});

describe('fetchEpicDeals', () => {
  test('keeps only discounted, linkable offers up to the limit', async () => {
    const fullPrice = { ...HADES, id: 'full', price: { price: { currencyCode: 'TRY', originalPrice: 100, discountPrice: 100 } } };
    const { price: _price, ...unpriced } = { ...HADES, id: 'unpriced' };
    routeFetch(() => Response.json([HADES, fullPrice, unpriced, { title: '' }, { ...HADES, id: 'second' }]));
    const games = await fetchEpicDeals(1);
    expect(games.map((game) => game.id)).toEqual(['ns-hades_offer-hades']);
  });

  test('treats a non-array response as no deals', async () => {
    routeFetch(() => Response.json({ unexpected: true }));
    expect(await fetchEpicDeals(5)).toEqual([]);
  });
});

describe('fetchEpicFreeGames', () => {
  test('returns currently free promotions', async () => {
    const promotion = (percentage: number) => ({
      promotionalOffers: [{ promotionalOffers: [{ discountSetting: { discountPercentage: percentage } }] }],
    });
    routeFetch(() =>
      Response.json({
        data: {
          Catalog: {
            searchStore: {
              elements: [
                { title: 'Free Game', id: 'f1', namespace: 'nsf', keyImages: [{ type: 'Thumbnail', url: 'https://i/t.jpg' }], promotions: promotion(0) },
                { title: 'Half Price', id: 'h1', namespace: 'nsh', promotions: promotion(50) },
                { title: '', id: 'x', namespace: 'nsx', promotions: promotion(0) },
                { title: 'No Slug', promotions: promotion(0) },
                { title: 'No Promotions' },
              ],
            },
          },
        },
      }),
    );
    expect(await fetchEpicFreeGames()).toEqual([
      {
        id: 'nsf_f1',
        slug: 'nsf_f1',
        title: 'Free Game',
        image_url: 'https://i/t.jpg',
        platform: 'Epic Games',
        source_platform: 'Epic Games',
        price: 'Ücretsiz',
        discount: '',
        rating: null,
      },
    ]);
  });

  test('handles an empty payload', async () => {
    routeFetch(() => Response.json({}));
    expect(await fetchEpicFreeGames()).toEqual([]);
  });
});

describe('fetchEpicEditionOffers', () => {
  const offer = (id: string, title: string, amount: number) => ({
    ...HADES,
    id,
    title,
    productSlug: id,
    price: { price: { currencyCode: 'TRY', originalPrice: amount, discountPrice: amount } },
  });

  test('returns one offer per edition and drops DLC and sequels', async () => {
    routeFetch(() =>
      Response.json({
        offers: [
          offer('hades', 'Hades', 10000),
          offer('hades-deluxe', 'Hades Deluxe Edition', 15000),
          offer('hades-ost', 'Hades Original Soundtrack', 3000),
          offer('hades-2', 'Hades II', 20000),
        ],
      }),
    );
    const offers = await fetchEpicEditionOffers('Hades Deluxe Edition');
    expect(offers.map((entry) => [entry.edition, entry.price.store_url])).toEqual([
      ['base', 'https://store.epicgames.com/p/hades'],
      ['deluxe', 'https://store.epicgames.com/p/hades-deluxe'],
    ]);
  });

  test('searches once with the base title', async () => {
    const bodies: string[] = [];
    routeFetch((_url, init) => {
      bodies.push(String(init?.body ?? ''));
      return Response.json({ offers: [offer('hades', 'Hades', 10000)] });
    });
    await fetchEpicEditionOffers('Hades Deluxe Edition');
    expect(bodies).toHaveLength(1);
    expect(JSON.parse(bodies[0] ?? '{}')).toMatchObject({ title: 'Hades' });
  });
});
