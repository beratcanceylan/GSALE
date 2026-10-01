import { Database } from 'bun:sqlite';
import { afterEach, describe, expect, mock, test } from 'bun:test';

mock.module('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => undefined,
}));

const { CATALOG_SCHEMA_SQL, catalogSearchKey } = await import('@/services/catalog/schema');
const { gameKey } = await import('@/services/store/editions');
const { setActiveCatalog } = await import('@/services/catalog/state');
const { fetchEditionTable } = await import('@/services/store/prices');
const { searchLiveGames } = await import('@/services/store/search');

const originalFetch = globalThis.fetch;
const DAY_MS = 24 * 60 * 60 * 1000;

function activateCatalog(rows: readonly (readonly [string, string, string])[], ageDays = 1): void {
  const db = new Database(':memory:');
  db.exec(CATALOG_SCHEMA_SQL);
  const insert = db.prepare('INSERT INTO games (store, id, title, search_key, game_key, image) VALUES (?, ?, ?, ?, ?, ?)');
  for (const [store, id, title] of rows) insert.run(store, id, title, catalogSearchKey(title), gameKey(title), null);
  setActiveCatalog({
    db: { getAllAsync: <T>(sql: string, params: (string | number)[]) => Promise.resolve(db.query<T>(sql).all(...params)) },
    version: new Date(Date.now() - ageDays * DAY_MS).toISOString(),
  });
}

function recordEmptyStores(): string[] {
  const urls: string[] = [];
  globalThis.fetch = async (input) => {
    urls.push(String(input));
    return Response.json({});
  };
  return urls;
}

const hitsStore = (urls: string[], fragment: string): boolean => urls.some((url) => url.includes(fragment));

afterEach(() => {
  globalThis.fetch = originalFetch;
  setActiveCatalog(null);
});

describe('catalog platform detection', () => {
  test('stores whose catalog has no such title are not queried; GOG always is', async () => {
    activateCatalog([['steam', '42', 'GSALE Catalog Only Steam']]);
    const urls = recordEmptyStores();

    await fetchEditionTable('GSALE Catalog Only Steam');

    expect(hitsStore(urls, 'store.steampowered.com')).toBeTrue();
    expect(hitsStore(urls, 'catalog.gog.com')).toBeTrue();
    expect(hitsStore(urls, 'playstation.com')).toBeFalse();
    expect(hitsStore(urls, 'displaycatalog')).toBeFalse();
    expect(hitsStore(urls, 'egdata')).toBeFalse();
    expect(hitsStore(urls, 'algolia.net')).toBeFalse();
  });

  test('titles unknown to the catalog query every store', async () => {
    activateCatalog([['steam', '42', 'Something Else Entirely']]);
    const urls = recordEmptyStores();

    await fetchEditionTable('GSALE Unknown Brand New Game');

    expect(hitsStore(urls, 'playstation.com')).toBeTrue();
    expect(hitsStore(urls, 'algolia.net')).toBeTrue();
  });

  test('a catalog older than 30 days does not rule out stores', async () => {
    activateCatalog([['steam', '42', 'GSALE Stale Catalog Game']], 45);
    const urls = recordEmptyStores();

    await fetchEditionTable('GSALE Stale Catalog Game');

    expect(hitsStore(urls, 'playstation.com')).toBeTrue();
  });
});

describe('catalog search', () => {
  test('search cards include catalog console stores without borrowing a sequel', async () => {
    activateCatalog([
      ['steam', '4250', 'GSALE Exact Search'],
      ['ps', 'p', 'GSALE Exact Search Deluxe Edition PS4 & PS5'],
      ['nintendo', 'n', 'GSALE Exact Search II'],
    ]);
    recordEmptyStores();
    const [game] = await searchLiveGames('GSALE Exact Search');
    expect(game?.platforms).toEqual(['Steam', 'PlayStation']);
  });

  test('catalog Steam hits appear even when live search returns nothing', async () => {
    activateCatalog([['steam', '4242', 'GSALE Catalog Search Hit']]);
    recordEmptyStores();

    const games = await searchLiveGames('GSALE Catalog Search');

    expect(games.map((game) => game.id)).toContain('4242');
  });
});
