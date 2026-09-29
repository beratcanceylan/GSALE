import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

mock.module('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => undefined,
}));

const { resetCurrencyCacheForTests, setFxRatesForTests } = await import('@/services/store/currency');
const { fetchNintendoDeals, fetchNintendoDetails, fetchNintendoEditionOffers, fetchNintendoPrice, searchNintendo } = await import(
  '@/services/store/platforms/nintendo'
);
const { parseNintendoProduct, pickBestNintendoProduct } = await import('@/services/store/platforms/nintendo-parse');

const originalFetch = globalThis.fetch;

function respond(body: unknown): string[] {
  const urls: string[] = [];
  globalThis.fetch = async (input) => {
    urls.push(String(input));
    return Response.json(body);
  };
  return urls;
}

const MARIO = {
  objectID: 'mario-wonder',
  nsuid: '70010000068688',
  title: 'Super Mario Bros. Wonder',
  url: '/us/store/products/super-mario-bros-wonder-switch/',
  productImage: 'store/software/switch/70010000068688/cover',
  description: 'Wonder!',
  releaseDate: '2023-10-20',
  corePlatforms: [{ label: 'Nintendo Switch' }, '', 5],
  softwareDeveloper: ['Nintendo'],
  softwarePublisher: 'Nintendo',
  gameGenreLabels: ['Platformer', { label: 'Action' }],
  price: { finalPrice: '49.99', regPrice: 69.99, salePrice: 49.99 },
  eshopDetails: { currency: 'USD' },
};

beforeEach(() => {
  setFxRatesForTests({ USD: 1, TRY: 40 });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  resetCurrencyCacheForTests();
});

describe('parseNintendoProduct', () => {
  test('normalizes URLs, images, prices, platforms and labels', () => {
    expect(parseNintendoProduct(MARIO)).toMatchObject({
      id: 'mario-wonder',
      nsuid: '70010000068688',
      store_url: 'https://www.nintendo.com/us/store/products/super-mario-bros-wonder-switch/',
      image_url: 'https://assets.nintendo.com/image/upload/q_auto/f_auto/store/software/switch/70010000068688/cover',
      price: 49.99,
      original_price: 69.99,
      currency: 'USD',
      discount: '-29%',
      platform: 'Nintendo Switch',
      developers: ['Nintendo'],
      genres: ['Platformer', 'Action'],
      is_add_on: false,
    });
  });

  test('keeps absolute URLs, relative links without a slash, and marks add-ons', () => {
    expect(
      parseNintendoProduct({
        sku: 'sku-1',
        name: 'DLC Pack',
        productLink: 'us/store/dlc',
        image: 'https://cdn/x.png',
        dlcType: 'Individual',
        price: { percentOff: 20.4, regPrice: 10, finalPrice: 8 },
        currency: 'EUR',
      }),
    ).toMatchObject({
      id: 'sku-1',
      store_url: 'https://www.nintendo.com/us/store/dlc',
      image_url: 'https://cdn/x.png',
      discount: '-20%',
      currency: 'EUR',
      is_add_on: true,
    });
    expect(parseNintendoProduct({ nsuid: '1', title: 'Game', url: 'https://www.nintendo.com/x', productType: ['DLC'] })).toMatchObject({
      store_url: 'https://www.nintendo.com/x',
      price: null,
      image_url: '',
      is_add_on: true,
    });
  });

  test('rejects values without an id or title', () => {
    expect(parseNintendoProduct(null)).toBeNull();
    expect(parseNintendoProduct({ title: 'No id' })).toBeNull();
    expect(parseNintendoProduct({ objectID: 'x' })).toBeNull();
  });

  test('matches titles that only add optional edition words, either way round', () => {
    const products = ['Mario Deluxe Edition', 'Mario Party', 'Zelda'].map((title, index) =>
      parseNintendoProduct({ objectID: String(index), title, price: { finalPrice: 10 } }),
    ).filter((product) => product !== null);
    expect(pickBestNintendoProduct(products, 'Mario')?.title).toBe('Mario Deluxe Edition');
    expect(pickBestNintendoProduct(products, 'Zelda Switch Edition')?.title).toBe('Zelda');
    expect(pickBestNintendoProduct(products, 'Metroid')).toBeNull();
    const party = products.filter((product) => product.title === 'Mario Party');
    expect(pickBestNintendoProduct(party, 'Mario')).toBeNull();
  });

  test('picks nothing from add-ons only', () => {
    const addOn = parseNintendoProduct({ objectID: 'a', title: 'Mario', dlcType: 'bundle' });
    expect(pickBestNintendoProduct(addOn ? [addOn] : [], 'Mario')).toBeNull();
  });
});

describe('Nintendo store adapter', () => {
  test('search keeps products with an image', async () => {
    respond({ hits: [MARIO, { objectID: 'no-image', title: 'No image' }, MARIO] });
    expect((await searchNintendo('Mario')).map((hit) => hit.id)).toEqual(['nintendo-mario-wonder']);
  });

  test('prices the best match in TL, free games as free, and null without a match', async () => {
    respond({ hits: [MARIO] });
    expect(await fetchNintendoPrice('Super Mario Bros. Wonder')).toMatchObject({
      price: '1.999,60 TL',
      original_price: '2.799,60 TL',
      discount: '-29%',
      store_url: 'https://www.nintendo.com/us/store/products/super-mario-bros-wonder-switch/',
    });

    respond({ hits: [{ ...MARIO, price: { finalPrice: 0 } }] });
    expect((await fetchNintendoPrice('Super Mario Bros. Wonder'))?.price).toBe('Ücretsiz');

    respond({ hits: [{ ...MARIO, url: '', price: {} }] });
    expect(await fetchNintendoPrice('Super Mario Bros. Wonder')).toBeNull();

    respond({ hits: [] });
    expect(await fetchNintendoPrice('Super Mario Bros. Wonder')).toBeNull();
  });

  test('details come from the Algolia object', async () => {
    const urls = respond(MARIO);
    expect(await fetchNintendoDetails('nintendo-mario-wonder')).toMatchObject({
      id: 'nintendo-mario-wonder',
      title: 'Super Mario Bros. Wonder',
      description: 'Wonder!',
      release_date: '2023-10-20',
      developers: ['Nintendo'],
      genres: ['Platformer', 'Action'],
      platforms: ['Nintendo Switch'],
      deals: [{ price: '1.999,60 TL' }],
    });
    expect(urls[0]).toContain('/store_game_en_us/mario-wonder');
  });

  test('details fall back to a store URL and platform, and need a title', async () => {
    respond({ objectID: 'bare', title: 'Bare' });
    expect(await fetchNintendoDetails('bare')).toMatchObject({
      store_links: { Nintendo: 'https://www.nintendo.com/us/store/products/bare/' },
      platforms: ['Nintendo Switch'],
    });

    respond({});
    expect(await fetchNintendoDetails('nothing')).toBeNull();
  });

  test('deals skip add-ons and full-price games', async () => {
    respond({
      hits: [
        MARIO,
        { ...MARIO, objectID: 'dlc', dlcType: 'Individual' },
        { ...MARIO, objectID: 'full', price: { finalPrice: 20 } },
      ],
    });
    expect((await fetchNintendoDeals(10)).map((game) => game.id)).toEqual(['nintendo-mario-wonder']);
  });
});

describe('fetchNintendoEditionOffers', () => {
  test('returns one offer per edition and drops add-ons', async () => {
    respond({
      hits: [
        MARIO,
        { ...MARIO, objectID: 'mario-deluxe', title: 'Super Mario Bros. Wonder Deluxe Edition' },
        { ...MARIO, objectID: 'mario-extra', title: 'Super Mario Bros. Wonder Extra Levels', dlcType: 'Individual' },
      ],
    });
    const offers = await fetchNintendoEditionOffers('Super Mario Bros. Wonder');
    expect(offers.map((offer) => [offer.edition, offer.id])).toEqual([
      ['base', 'nintendo-mario-wonder'],
      ['deluxe', 'nintendo-mario-deluxe'],
    ]);
  });
});
