import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

mock.module('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => undefined,
}));

const { resetCurrencyCacheForTests, setFxRatesForTests } = await import('@/services/store/currency');
const { fetchNintendoDeals, fetchNintendoDetails, fetchNintendoEditionOffers, searchNintendo } = await import(
  '@/services/store/platforms/nintendo'
);
const { parseNintendoProduct } = await import('@/services/store/platforms/nintendo-parse');

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
});

describe('Nintendo store adapter', () => {
  test('search keeps products with an image', async () => {
    respond({ hits: [MARIO, { objectID: 'no-image', title: 'No image' }, MARIO] });
    expect((await searchNintendo('Mario')).map((hit) => hit.id)).toEqual(['nintendo-mario-wonder']);
  });

  test('details come from the Algolia object', async () => {
    const urls = respond(MARIO);
    expect(await fetchNintendoDetails('nintendo-mario-wonder')).toMatchObject({
      id: 'nintendo-mario-wonder',
      title: 'Super Mario Bros. Wonder',
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
