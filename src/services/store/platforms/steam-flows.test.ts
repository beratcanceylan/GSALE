import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

mock.module('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => undefined,
}));

const { resetCurrencyCacheForTests, setFxRatesForTests } = await import('@/services/store/currency');
const { fetchSteamDeals, fetchSteamDetails, fetchSteamFreeGames, fetchSteamPrice, searchSteam } = await import(
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

describe('fetchSteamPrice', () => {
  test('uses the search price in TRY, including the discount', async () => {
    const urls = routeFetch(() =>
      search({ id: 10, name: 'Hades', price: { currency: 'TRY', final: 5000, initial: 10000, discount_percent: 50 } }),
    );
    expect(await fetchSteamPrice('Hades', 'base')).toMatchObject({
      price: '50,00 TL',
      original_price: '100,00 TL',
      discount: '-50%',
      store_url: 'https://store.steampowered.com/app/10/',
    });
    expect(urls).toHaveLength(1);
  });

  test('converts a foreign currency and derives a missing discount', async () => {
    routeFetch(() => search({ id: 11, name: 'Hades', price: { currency: 'USD', final: 500, initial: 1000 } }));
    expect(await fetchSteamPrice('Hades', 'base')).toMatchObject({
      price: '200,00 TL',
      original_price: '400,00 TL',
      discount: '-50%',
    });

    routeFetch(() => search({ id: 11, name: 'Hades', price: { currency: 'USD', final: 500 } }));
    expect(await fetchSteamPrice('Hades', 'base')).toMatchObject({ price: '200,00 TL', original_price: null, discount: '' });
  });

  test('a zero search price is free', async () => {
    routeFetch(() => search({ id: 12, name: 'Hades', price: { currency: 'USD', final: 0 } }));
    expect(await fetchSteamPrice('Hades', 'base')).toMatchObject({ price: 'Ücretsiz', original_price: null });
  });

  test('falls back to app details: free, priced, unknown or missing', async () => {
    const withDetails = (details: unknown) =>
      routeFetch((url) => (url.includes('/storesearch/') ? search({ id: 13, name: 'Hades', price: { final: 'x' } }) : details));

    withDetails({ 13: { success: true, data: { name: 'Hades', is_free: true } } });
    expect((await fetchSteamPrice('Hades', 'base'))?.price).toBe('Ücretsiz');

    withDetails({ 13: { success: true, data: { name: 'Hades', price_overview: { currency: 'TRY', final: 2500, initial: 2500 } } } });
    expect((await fetchSteamPrice('Hades', 'base'))?.price).toBe('25,00 TL');

    withDetails({ 13: { success: true, data: { name: 'Hades' } } });
    expect((await fetchSteamPrice('Hades', 'base'))?.price).toBe('Bilinmiyor');

    withDetails({ 13: { success: false } });
    expect(await fetchSteamPrice('Hades', 'base')).toBeNull();
  });

  test('returns null when nothing matches', async () => {
    routeFetch(() => search({ id: 14, name: 'Completely Different' }));
    expect(await fetchSteamPrice('Hades', 'base')).toBeNull();
  });

  test('prefers the requested edition, then prime upgrades', async () => {
    const items = [
      { id: 20, name: 'Hades', price: { currency: 'TRY', final: 1000, initial: 1000 } },
      { id: 21, name: 'Hades Deluxe Edition', price: { currency: 'TRY', final: 2000, initial: 2000 } },
      { id: 22, name: 'Hades Prime Status Upgrade', price: { currency: 'TRY', final: 3000, initial: 3000 } },
    ];
    routeFetch(() => search(...items));
    expect((await fetchSteamPrice('Hades Deluxe Edition', 'deluxe'))?.store_url).toContain('/app/21/');
    expect((await fetchSteamPrice('Hades Prime', 'base', 'Hades Prime'))?.store_url).toContain('/app/22/');

    routeFetch(() => search(items[0], items[2]));
    expect((await fetchSteamPrice('Hades', 'base', 'Hades prime status upgrade'))?.store_url).toContain('/app/22/');

    // An edition match is replaced by the upgrade when the search itself is an upgrade.
    routeFetch(() => search(...items));
    expect((await fetchSteamPrice('Hades Deluxe Edition', 'deluxe', 'Hades Deluxe Prime'))?.store_url).toContain(
      '/app/22/',
    );
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
