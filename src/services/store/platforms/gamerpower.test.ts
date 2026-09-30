import { afterEach, describe, expect, mock, test } from 'bun:test';

mock.module('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => undefined,
}));

const { fetchGamerPowerGiveaways } = await import('@/services/store/platforms/gamerpower');

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

const giveaway = (id: number, title: string, platforms: string, extra: Record<string, unknown> = {}) => ({
  id,
  title,
  platforms,
  type: 'Game',
  status: 'Active',
  image: `https://www.gamerpower.com/offers/1b/${id}.jpg`,
  open_giveaway_url: `https://www.gamerpower.com/open/${id}`,
  ...extra,
});

describe('fetchGamerPowerGiveaways', () => {
  test('maps game giveaways to free games with their store and an external link', async () => {
    const urls: string[] = [];
    globalThis.fetch = async (input) => {
      urls.push(String(input));
      return Response.json([
        giveaway(1, 'Best Plumber (IndieGala) Giveaway', 'PC, DRM-Free'),
        giveaway(2, 'Hades (Steam) Giveaway', 'PC, Steam'),
        giveaway(3, 'Tiny Game Giveaway', 'PC, Itch.io'),
        giveaway(4, 'Phone Game Giveaway', 'Android, iOS'),
        giveaway(5, 'Unsafe Giveaway', 'PC, Steam', { open_giveaway_url: 'http://example.com/x' }),
      ]);
    };
    const games = await fetchGamerPowerGiveaways();
    expect(urls[0]).toBe('https://www.gamerpower.com/api/giveaways?type=game&sort-by=popularity');
    expect(games.map((game) => [game.title, game.platform, game.external_url])).toEqual([
      ['Best Plumber', 'IndieGala', 'https://www.gamerpower.com/open/1'],
      ['Hades', 'Steam', 'https://www.gamerpower.com/open/2'],
      ['Tiny Game', 'itch.io', 'https://www.gamerpower.com/open/3'],
    ]);
    expect(games[0]).toMatchObject({ id: 'gamerpower-1', price: 'Ücretsiz', image_url: 'https://www.gamerpower.com/offers/1b/1.jpg' });
  });

  test('an unexpected response is an empty list', async () => {
    globalThis.fetch = async () => Response.json({ status: 0 });
    expect(await fetchGamerPowerGiveaways()).toEqual([]);
  });
});
