import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

mock.module('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => undefined,
}));

const { resetCurrencyCacheForTests, setFxRatesForTests } = await import('@/services/store/currency');
const { fetchGogDeals, fetchGogDetails, fetchGogEditionOffers, searchGog } = await import(
  '@/services/store/platforms/gog'
);
const { gogPriceFromProduct } = await import('@/services/store/platforms/gog-price');

const originalFetch = globalThis.fetch;

function routeFetch(handler: (url: string) => unknown): string[] {
  const urls: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    urls.push(url);
    const body = handler(url);
    return body instanceof Response ? body : Response.json(body);
  };
  return urls;
}

const WITCHER = {
  id: 1207664643,
  title: 'The Witcher 3',
  slug: 'the_witcher_3',
  coverHorizontal: 'https://images.gog-statics.com/w3.jpg',
  price: {
    discount: '-50%',
    finalMoney: { amount: '10.00', currency: 'USD' },
    baseMoney: { amount: '20.00', currency: 'USD' },
  },
};

beforeEach(() => {
  setFxRatesForTests({ USD: 1, TRY: 40 });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  resetCurrencyCacheForTests();
});

describe('searchGog and GOG edition prices', () => {
  test('maps catalog products to hits with store links', async () => {
    routeFetch(() => ({ products: [WITCHER, { ...WITCHER, id: 2, storeLink: 'https://www.gog.com/en/game/x' }] }));
    const hits = await searchGog('Witcher');
    expect(hits.map((hit) => hit.store_url)).toEqual([
      'https://www.gog.com/game/the_witcher_3',
      'https://www.gog.com/en/game/x',
    ]);
  });

  test('prices each match in TL, or returns nothing without one', async () => {
    routeFetch(() => ({ products: [WITCHER] }));
    expect((await fetchGogEditionOffers('The Witcher 3'))[0]?.price).toMatchObject({
      price: '400,00 TL',
      original_price: '800,00 TL',
      discount: '-50%',
      store_url: 'https://www.gog.com/game/the_witcher_3',
    });

    routeFetch(() => ({}));
    expect(await fetchGogEditionOffers('The Witcher 3')).toEqual([]);
  });
});

describe('fetchGogDetails', () => {
  const expanded = {
    id: WITCHER.id,
    title: 'The Witcher 3',
    slug: 'the_witcher_3',
    images: { logo: '//images.gog.com/logo.png' },
  };

  test('combines the expanded product with the priced catalog entry', async () => {
    const urls = routeFetch((url) => (url.includes('api.gog.com') ? expanded : { products: [WITCHER] }));
    const game = await fetchGogDetails(`gog-${WITCHER.id}`);
    expect(game).toMatchObject({
      id: `gog-${WITCHER.id}`,
      title: 'The Witcher 3',
      price: '400,00 TL',
      original_price: '800,00 TL',
      store_links: { GOG: 'https://www.gog.com/game/the_witcher_3' },
      deals: [{ platform: 'GOG', price: '400,00 TL' }],
    });
    expect(urls.filter((url) => url.includes('catalog.gog.com'))).toHaveLength(1);
  });

  test('falls back to the expanded product when the catalog has no entry', async () => {
    routeFetch((url) => {
      if (url.includes('api.gog.com')) return { id: 'abc', slug: 'some-game', images: { background: 'https://img/bg.jpg' } };
      if (url.includes('query=some+game')) return new Response('', { status: 500 });
      return { products: [] };
    });
    const game = await fetchGogDetails('gog-77');
    expect(game).toMatchObject({
      id: 'gog-0',
      title: 'some game',
      image_url: 'https://img/bg.jpg',
      price: 'Bilinmiyor',
      store_links: { GOG: 'https://www.gog.com/game/some-game' },
    });
    expect(game?.deals).toBeUndefined();
  });

  test('names a product without a title or slug after its id and has no image without images', async () => {
    routeFetch((url) => (url.includes('api.gog.com') ? {} : { products: [] }));
    expect(await fetchGogDetails('88')).toMatchObject({ title: 'GOG 88', image_url: '', id: 'gog-88' });
  });

  test('returns null for non-numeric ids and unavailable products', async () => {
    const urls = routeFetch(() => new Response('', { status: 404 }));
    expect(await fetchGogDetails('gog-abc')).toBeNull();
    expect(urls).toHaveLength(0);
    expect(await fetchGogDetails('gog-1')).toBeNull();
  });

  test('aborted requests reject', async () => {
    const controller = new AbortController();
    routeFetch(() => {
      controller.abort();
      throw controller.signal.reason;
    });
    await expect(fetchGogDetails('gog-1', { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });

    const catalogAbort = new AbortController();
    routeFetch((url) => {
      if (url.includes('api.gog.com')) return expanded;
      catalogAbort.abort();
      throw catalogAbort.signal.reason;
    });
    await expect(fetchGogDetails('gog-1', { signal: catalogAbort.signal })).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('fetchGogDeals', () => {
  test('keeps discounted products only', async () => {
    const fullPrice = { ...WITCHER, id: 5, price: { discount: null, finalMoney: { amount: '5.00', currency: 'USD' } } };
    routeFetch(() => ({ products: [WITCHER, fullPrice] }));
    expect((await fetchGogDeals(10)).map((game) => game.id)).toEqual([`gog-${WITCHER.id}`]);

    routeFetch(() => ({}));
    expect(await fetchGogDeals(10)).toEqual([]);
  });
});

describe('gogPriceFromProduct', () => {
  test('handles missing and text-only prices', async () => {
    expect(await gogPriceFromProduct({ id: 1, title: 'x', slug: 'x' })).toEqual({
      price: 'Bilinmiyor',
      original_price: null,
      discount: '',
    });
    expect(
      await gogPriceFromProduct({ id: 1, title: 'x', slug: 'x', price: { final: ' 9,99 TL ', base: ' ', discount: '-20' } }),
    ).toEqual({ price: '9,99 TL', original_price: null, discount: '-20%' });
    expect(await gogPriceFromProduct({ id: 1, title: 'x', slug: 'x', price: { final: '  ' } })).toMatchObject({
      price: 'Bilinmiyor',
    });
  });
});

describe('fetchGogEditionOffers', () => {
  test('returns one offer per edition and drops DLC and sequels', async () => {
    routeFetch(() => ({
      products: [
        { ...WITCHER, id: 1, title: 'The Witcher 3: Wild Hunt', slug: 'w3' },
        { ...WITCHER, id: 2, title: 'The Witcher 3: Wild Hunt - Game of the Year Edition', slug: 'w3_goty' },
        { ...WITCHER, id: 3, title: 'The Witcher 3: Wild Hunt - Hearts of Stone Expansion', slug: 'w3_hos' },
        { ...WITCHER, id: 4, title: 'The Witcher 2: Assassins of Kings', slug: 'w2' },
      ],
    }));
    const offers = await fetchGogEditionOffers('The Witcher 3: Wild Hunt');
    expect(offers.map((offer) => [offer.edition, offer.id])).toEqual([
      ['base', 'gog-1'],
      ['goty', 'gog-2'],
    ]);
  });

  test('searches once with the base title', async () => {
    const urls = routeFetch(() => ({ products: [] }));
    await fetchGogEditionOffers('The Witcher 3: Wild Hunt - Game of the Year Edition');
    expect(urls).toHaveLength(1);
    expect(new URL(urls[0] ?? '').searchParams.get('query')).toBe('The Witcher 3: Wild Hunt');
  });
});
