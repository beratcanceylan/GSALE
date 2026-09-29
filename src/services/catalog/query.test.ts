import { Database } from 'bun:sqlite';
import { describe, expect, test } from 'bun:test';

import { catalogPlatformsForTitle, searchCatalogHits, type CatalogDb } from '@/services/catalog/query';
import { CATALOG_SCHEMA_SQL, catalogSearchKey } from '@/services/catalog/schema';

type Row = readonly [store: string, id: string, title: string, image?: string];

function catalogDb(rows: readonly Row[]): CatalogDb {
  const db = new Database(':memory:');
  db.exec(CATALOG_SCHEMA_SQL);
  const insert = db.prepare('INSERT INTO games (store, id, title, search_key, image) VALUES (?, ?, ?, ?, ?)');
  for (const [store, id, title, image] of rows) {
    insert.run(store, id, title, catalogSearchKey(title), image ?? null);
  }
  return {
    getAllAsync: <T>(sql: string, params: (string | number)[]) =>
      Promise.resolve(db.query<T>(sql).all(...params)),
  };
}

const ROWS: readonly Row[] = [
  ['steam', '1145360', 'Hades'],
  ['steam', '1145350', 'Hades II'],
  ['xbox', '9P8DL6W0JBB8', 'Hades', 'https://store-images.s-microsoft.com/hades'],
  ['ps', 'UP0001-CUSA0001_00-HADES', 'Hades'],
  ['nintendo', '70010000033087', 'Hades'],
  ['epic', 'abc123', 'Hades II'],
  ['steam', '10', 'Counter-Strike'],
];

describe('searchCatalogHits', () => {
  test('returns Steam and Xbox hits with app routes, closest titles first', async () => {
    const hits = await searchCatalogHits(catalogDb(ROWS), 'hades', 'de-de');

    expect(hits.map((hit) => hit.id)).toEqual(['1145360', 'xbox-9P8DL6W0JBB8', '1145350']);
    expect(hits[0]).toMatchObject({
      platform: 'Steam',
      image_url: 'https://cdn.akamai.steamstatic.com/steam/apps/1145360/header.jpg',
      store_url: 'https://store.steampowered.com/app/1145360/',
    });
    expect(hits[1]).toMatchObject({
      platform: 'Xbox',
      store_url: 'https://www.xbox.com/de-de/games/store/9P8DL6W0JBB8',
    });
  });

  test('matches across punctuation and case, and ignores too-short or wildcard queries', async () => {
    const db = catalogDb(ROWS);
    expect((await searchCatalogHits(db, 'COUNTER strike', 'tr-tr')).map((hit) => hit.id)).toEqual(['10']);
    expect(await searchCatalogHits(db, 'h', 'tr-tr')).toEqual([]);
    expect(await searchCatalogHits(db, '%_%', 'tr-tr')).toEqual([]);
  });
});

describe('catalogPlatformsForTitle', () => {
  test('lists stores with any title containing the name, including platform-suffixed ones', async () => {
    const db = catalogDb([...ROWS, ['ps', 'EP0700-PPSA04609_00-ELDENRING', 'ELDEN RING PS4 & PS5'], ['steam', '1245620', 'ELDEN RING']]);
    const platforms = await catalogPlatformsForTitle(db, 'Elden Ring');
    expect([...(platforms ?? [])].sort()).toEqual(['PlayStation', 'Steam']);
  });

  test('errs toward querying: a sequel keeps its store in the set', async () => {
    const platforms = await catalogPlatformsForTitle(catalogDb(ROWS), 'Hades');
    expect([...(platforms ?? [])].sort()).toEqual(['Epic Games', 'Nintendo', 'PlayStation', 'Steam', 'Xbox']);
  });

  test('a store with no matching title is left out', async () => {
    const platforms = await catalogPlatformsForTitle(catalogDb(ROWS), 'Hades II');
    expect([...(platforms ?? [])].sort()).toEqual(['Epic Games', 'Steam']);
  });

  test('returns null for titles the catalog does not know', async () => {
    expect(await catalogPlatformsForTitle(catalogDb(ROWS), 'Brand New Game 2027')).toBeNull();
  });
});
