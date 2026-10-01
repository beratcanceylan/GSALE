import { afterEach, describe, expect, test } from 'bun:test';

import { catalogPlatforms, catalogStores, searchCatalog, setActiveCatalog, subscribeCatalog } from '@/services/catalog/state';
import type { CatalogDb } from '@/services/catalog/query';

const failingDb: CatalogDb = {
  getAllAsync: async () => { throw new Error('catalog file unavailable'); },
};

afterEach(() => { setActiveCatalog(null); });

describe('catalog state', () => {
  test('returns empty results when the catalog file fails during a search', async () => {
    setActiveCatalog({ db: failingDb, version: new Date().toISOString() });
    expect(await searchCatalog('Hades')).toEqual([]);
    expect(await catalogPlatforms('Hades')).toBeNull();
    expect(await catalogStores('Hades')).toBeNull();
  });
});

test('catalog activation notifies subscribers, and stopping removes the listener', () => {
  let notifications = 0;
  const stop = subscribeCatalog(() => { notifications += 1; });
  const catalog = { db: failingDb, version: new Date().toISOString() };
  setActiveCatalog(catalog);
  expect(notifications).toBe(1);
  setActiveCatalog(null);
  expect(notifications).toBe(1);
  stop();
  setActiveCatalog(catalog);
  expect(notifications).toBe(1);
});
