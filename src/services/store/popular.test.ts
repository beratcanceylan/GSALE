import { Database } from 'bun:sqlite';
import { afterEach, describe, expect, mock, test } from 'bun:test';

mock.module('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => undefined,
}));

const { CATALOG_SCHEMA_SQL, catalogSearchKey } = await import('@/services/catalog/schema');
const { gameKey } = await import('@/services/store/editions');
const { setActiveCatalog } = await import('@/services/catalog/state');
const { getPopularGames } = await import('@/services/store/popular');

const originalFetch = globalThis.fetch;
const tryItem = (id: number, name: string) => ({ id, name, currency: 'TRY', final_price: 1000, original_price: 1000, discount_percent: 0 });
const epicOffer = (id: string, title: string) => ({ id, namespace: 'ns', title, urlSlug: id, keyImages: [{ type: 'OfferImageWide', url: `https://cdn1.epicgames.com/${id}.jpg` }] });
const xboxProduct = (id: string, title: string) => ({
  ProductId: id,
  LocalizedProperties: [{ ProductTitle: title, Images: [{ ImagePurpose: 'Poster', Uri: '//store-images.s-microsoft.com/p' }] }],
  DisplaySkuAvailabilities: [{ Availabilities: [{ OrderManagementData: { Price: { CurrencyCode: 'TRY', ListPrice: 10, MSRP: 10 } } }] }],
});

type Routes = { steam?: unknown[]; epic?: unknown[]; xbox?: unknown[]; failEpic?: boolean };

function routeStores(routes: Routes): void {
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes('featuredcategories')) return Response.json({ top_sellers: { items: routes.steam ?? [] } });
    if (url.includes('/offers/top-sellers')) {
      return routes.failEpic ? new Response('', { status: 503 }) : Response.json({ elements: routes.epic ?? [] });
    }
    if (url.includes('emerald')) {
      const ids = (routes.xbox ?? []).map((product) => ({ productId: (product as { ProductId: string }).ProductId }));
      return Response.json({ channels: { TopPaid: { products: ids } } });
    }
    if (url.includes('displaycatalog')) return Response.json({ Products: routes.xbox ?? [] });
    return new Response('', { status: 404 });
  };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  setActiveCatalog(null);
});

describe('getPopularGames', () => {
  test('mixes the stores in turn, drops add-ons and lists a shared game once with every store', async () => {
    routeStores({
      steam: [tryItem(1, 'GSALE Pop Alpha'), tryItem(2, 'GSALE Pop Shared'), tryItem(3, 'Seçkin Durumu Yükseltmesi'), tryItem(4, 'GSALE Pop Alpha Soundtrack')],
      epic: [epicOffer('e1', 'GSALE Pop Beta'), epicOffer('e2', 'GSALE Pop Shared™')],
      xbox: [xboxProduct('X1', 'GSALE Pop Gamma')],
    });
    const games = await getPopularGames();
    expect(games.map((game) => game.title)).toEqual(['GSALE Pop Alpha', 'GSALE Pop Beta', 'GSALE Pop Gamma', 'GSALE Pop Shared']);
    expect(games[3]?.platforms).toEqual(expect.arrayContaining(['Steam', 'Epic Games']));
  });

  test('one store failing keeps the others', async () => {
    routeStores({ steam: [tryItem(5, 'GSALE Pop Solo')], failEpic: true });
    expect((await getPopularGames()).map((game) => game.title)).toEqual(['GSALE Pop Solo']);
  });

  test('the catalog adds the other stores that sell a game', async () => {
    const db = new Database(':memory:');
    db.exec(CATALOG_SCHEMA_SQL);
    const insert = db.prepare('INSERT INTO games (store, id, title, search_key, game_key, image) VALUES (?, ?, ?, ?, ?, ?)');
    for (const store of ['steam', 'ps', 'xbox']) insert.run(store, '9', 'GSALE Pop Catalog', catalogSearchKey('GSALE Pop Catalog'), gameKey('GSALE Pop Catalog'), null);
    setActiveCatalog({
      db: { getAllAsync: <T>(sql: string, params: (string | number)[]) => Promise.resolve(db.query<T>(sql).all(...params)) },
      version: new Date().toISOString(),
    });
    routeStores({ steam: [tryItem(9, 'GSALE Pop Catalog')] });
    const [game] = await getPopularGames();
    expect(game?.platforms).toEqual(expect.arrayContaining(['Steam', 'PlayStation', 'Xbox']));
  });

  test('a sequel in the catalog never adds its stores to the original game', async () => {
    const db = new Database(':memory:');
    db.exec(CATALOG_SCHEMA_SQL);
    const insert = db.prepare('INSERT INTO games (store, id, title, search_key, game_key) VALUES (?, ?, ?, ?, ?)');
    insert.run('ps', '2', 'GSALE Pop Exact II', catalogSearchKey('GSALE Pop Exact II'), gameKey('GSALE Pop Exact II'));
    setActiveCatalog({
      db: { getAllAsync: <T>(sql: string, params: (string | number)[]) => Promise.resolve(db.query<T>(sql).all(...params)) },
      version: new Date().toISOString(),
    });
    routeStores({ steam: [tryItem(20, 'GSALE Pop Exact')] });
    expect((await getPopularGames())[0]?.platforms).toEqual(['Steam']);
  });

  test('keeps the 30-game limit', async () => {
    routeStores({ steam: Array.from({ length: 40 }, (_, index) => tryItem(100 + index, `GSALE Pop Many ${index}`)) });
    expect(await getPopularGames()).toHaveLength(30);
  });
});
