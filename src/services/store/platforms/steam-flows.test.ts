import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

mock.module('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => undefined,
}));

const { resetCurrencyCacheForTests, setFxRatesForTests } = await import('@/services/store/currency');
const { fetchSteamDeals, fetchSteamDetails, fetchSteamEditionOffers, fetchSteamFreeGames, searchSteam } = await import(
  '@/services/store/platforms/steam'
);

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

const search = (...items: unknown[]) => ({ items });

beforeEach(() => {
  setFxRatesForTests({ USD: 1, TRY: 40 });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  resetCurrencyCacheForTests();
});

describe('searchSteam', () => {
  test('maps hits, dropping incomplete items and keeping at most 12', async () => {
    const items = Array.from({ length: 14 }, (_, index) => ({ id: index + 1, name: `Game ${index + 1}` }));
    routeFetch(() => search({ id: 0, name: 'No id' }, { id: 99, name: '' }, ...items));
    const hits = await searchSteam('Game');
    expect(hits).toHaveLength(12);
    expect(hits[0]).toMatchObject({
      id: '1',
      image_url: 'https://cdn.akamai.steamstatic.com/steam/apps/1/header.jpg',
      store_url: 'https://store.steampowered.com/app/1/',
    });
  });

  test('handles a response without items', async () => {
    routeFetch(() => ({}));
    expect(await searchSteam('Game')).toEqual([]);
  });
});

describe('Steam edition prices', () => {
  const priceOf = async (title: string) => (await fetchSteamEditionOffers(title))[0]?.price ?? null;

  test('uses the search price in TRY, including the discount', async () => {
    const urls = routeFetch((url) =>
      url.includes('storesearch')
        ? search({ id: 10, name: 'Hades', price: { currency: 'TRY', final: 5000, initial: 10000, discount_percent: 50 } })
        : {},
    );
    expect(await priceOf('Hades')).toMatchObject({
      price: '50,00 TL',
      original_price: '100,00 TL',
      discount: '-50%',
      store_url: 'https://store.steampowered.com/app/10/',
    });
    expect(urls.filter((url) => url.includes('storesearch'))).toHaveLength(1);
  });

  test('converts a foreign currency and derives a missing discount', async () => {
    routeFetch((url) => (url.includes('storesearch') ? search({ id: 11, name: 'Hades', price: { currency: 'USD', final: 500, initial: 1000 } }) : {}));
    expect(await priceOf('Hades')).toMatchObject({ price: '200,00 TL', original_price: '400,00 TL', discount: '-50%' });

    routeFetch((url) => (url.includes('storesearch') ? search({ id: 11, name: 'Hades', price: { currency: 'USD', final: 500 } }) : {}));
    expect(await priceOf('Hades')).toMatchObject({ price: '200,00 TL', original_price: null, discount: '' });
  });

  test('a zero search price is free', async () => {
    routeFetch((url) => (url.includes('storesearch') ? search({ id: 12, name: 'Hades', price: { currency: 'USD', final: 0 } }) : {}));
    expect(await priceOf('Hades')).toMatchObject({ price: 'Ücretsiz', original_price: null });
  });

  test('a base game without a search price is priced from its app details', async () => {
    const withDetails = (details: unknown) =>
      routeFetch((url) => (url.includes('/storesearch/') ? search({ id: 13, name: 'Hades' }) : details));

    withDetails({ 13: { success: true, data: { name: 'Hades', is_free: true } } });
    expect((await priceOf('Hades'))?.price).toBe('Ücretsiz');

    withDetails({ 13: { success: true, data: { name: 'Hades', price_overview: { currency: 'TRY', final: 2500, initial: 2500 } } } });
    expect((await priceOf('Hades'))?.price).toBe('25,00 TL');

    withDetails({ 13: { success: false } });
    expect(await priceOf('Hades')).toBeNull();
  });

  test('returns nothing when no title matches', async () => {
    routeFetch(() => search({ id: 14, name: 'Completely Different' }));
    expect(await fetchSteamEditionOffers('Hades')).toEqual([]);
  });
});

describe('fetchSteamDetails', () => {
  test('maps app details including media and price', async () => {
    routeFetch(() => ({
      730: {
        success: true,
        data: {
          name: 'Counter-Strike 2',
          header_image: 'https://cdn/730.jpg',
          short_description: 'Tactical shooter',
          release_date: { date: '27 Sep, 2023' },
          developers: ['Valve'],
          genres: [{ description: 'Action' }, { description: '' }],
          screenshots: [{ path_full: 'https://cdn/s1.jpg' }, {}],
          movies: [{ id: 1, hls_h264: 'https://cdn/m.m3u8', thumbnail: 'https://cdn/t.jpg' }, { id: 2, mp4: { max: 'https://cdn/m.mp4' } }, { id: 3 }],
          is_free: true,
        },
      },
    }));
    expect(await fetchSteamDetails('steam-730')).toMatchObject({
      id: '730',
      title: 'Counter-Strike 2',
      image_url: 'https://cdn/730.jpg',
      description: 'Tactical shooter',
      release_date: '27 Sep, 2023',
      developers: ['Valve'],
      genres: ['Action'],
      screenshots: ['https://cdn/s1.jpg'],
      videos: [
        { id: '1', url: 'https://cdn/m.m3u8', thumbnail: 'https://cdn/t.jpg' },
        { id: '2', url: 'https://cdn/m.mp4', thumbnail: '' },
      ],
      deals: [{ price: 'Ücretsiz' }],
    });
  });

  test('uses defaults for sparse data and returns null without a name', async () => {
    routeFetch(() => ({ 5: { success: true, data: { name: 'Sparse' } } }));
    expect(await fetchSteamDetails('5')).toMatchObject({
      image_url: 'https://cdn.akamai.steamstatic.com/steam/apps/5/header.jpg',
      developers: [],
      genres: [],
      screenshots: [],
      videos: [],
    });

    routeFetch(() => ({ 6: { success: true, data: {} } }));
    expect(await fetchSteamDetails('6')).toBeNull();
  });

  test('does not request non-numeric ids', async () => {
    const urls = routeFetch(() => ({}));
    expect(await fetchSteamDetails('not-a-number')).toBeNull();
    expect(urls).toHaveLength(0);
  });
});

describe('fetchSteamFreeGames and fetchSteamDeals', () => {
  test('lists free-to-play games', async () => {
    routeFetch(() => ({
      free_to_play: {
        items: [
          { id: 440, name: 'Team Fortress 2', header_image: 'https://steamcdn-a.akamaihd.net/steam/apps/440/header.jpg' },
          { id: 570, name: 'Dota 2' },
        ],
      },
    }));
    const games = await fetchSteamFreeGames();
    expect(games.map((game) => game.image_url)).toEqual([
      'https://cdn.akamai.steamstatic.com/steam/apps/440/header.jpg',
      'https://cdn.akamai.steamstatic.com/steam/apps/570/header.jpg',
    ]);
    expect(games[0]).toMatchObject({ price: 'Ücretsiz', platform: 'Steam' });
  });

  test('handles missing free-to-play data', async () => {
    routeFetch(() => ({}));
    expect(await fetchSteamFreeGames()).toEqual([]);
  });

  test('skips specials without a usable price or duplicates', async () => {
    routeFetch(() => ({
      specials: {
        items: [
          { id: 1, name: 'Priced', discount_percent: 50, currency: 'TRY', original_price: 2000, final_price: 1000 },
          { id: 1, name: 'Priced', discount_percent: 50, currency: 'TRY', original_price: 2000, final_price: 1000 },
          { id: 2, name: 'No price', discount_percent: 50 },
          { id: 3, name: 'Negative', discount_percent: 50, final_price: -1 },
          { id: 4, name: 'Defaults', discount_percent: 25, final_price: 750 },
        ],
      },
    }));
    const games = await fetchSteamDeals(10);
    expect(games.map((game) => game.id)).toEqual(['1', '4']);
    expect(games[1]?.deals?.[0]).toMatchObject({ price: '300,00 TL' });
  });
});

describe('fetchSteamEditionOffers', () => {
  const tryPrice = (final: number) => ({ currency: 'TRY', final, initial: final, discount_percent: 0 });

  test('returns one offer per edition and drops DLC and sequels', async () => {
    routeFetch((url) =>
      url.includes('storesearch')
        ? search(
            { id: 1, name: 'Hades', price: tryPrice(5000) },
            { id: 2, name: 'Hades Deluxe Edition', price: tryPrice(8000) },
            { id: 3, name: 'Hades Season Pass', price: tryPrice(2000) },
            { id: 4, name: 'Hades II', price: tryPrice(9000) },
          )
        : { 1: { success: true, data: { name: 'Hades' } } },
    );
    const offers = await fetchSteamEditionOffers('Hades Deluxe Edition');
    expect(offers.map((offer) => [offer.edition, offer.id])).toEqual([
      ['base', '1'],
      ['deluxe', '2'],
    ]);
  });

  test('searches once with the base title', async () => {
    const urls = routeFetch((url) => (url.includes('storesearch') ? search() : {}));
    await fetchSteamEditionOffers('Hades Deluxe Edition');
    const searches = urls.filter((url) => url.includes('storesearch'));
    expect(searches).toHaveLength(1);
    expect(searches[0]).toContain('term=Hades&');
  });

  test('adds the base app packages as editions with their own store link', async () => {
    routeFetch((url) =>
      url.includes('storesearch')
        ? search({ id: 10, name: 'ELDEN RING', price: tryPrice(100000) })
        : {
            10: {
              success: true,
              data: {
                name: 'ELDEN RING',
                price_overview: tryPrice(100000),
                package_groups: [{
                  subs: [
                    { packageid: 100, option_text: 'Buy ELDEN RING - ₺1.000,00', price_in_cents_with_discount: 100000 },
                    { packageid: 101, option_text: 'ELDEN RING Deluxe Edition - ₺1.500,00', price_in_cents_with_discount: 120000, percent_savings: 20 },
                  ],
                }],
              },
            },
          },
    );
    const offers = await fetchSteamEditionOffers('ELDEN RING');
    const deluxe = offers.find((offer) => offer.edition === 'deluxe');
    expect(deluxe?.price).toMatchObject({
      price: '1.200,00 TL',
      original_price: '1.500,00 TL',
      discount: '-20%',
      store_url: 'https://store.steampowered.com/sub/101/',
    });
    expect(offers.filter((offer) => offer.edition === 'base')).toHaveLength(2);
  });
});
