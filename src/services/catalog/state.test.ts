import { afterEach, describe, expect, test } from 'bun:test';

import { catalogPlatforms, searchCatalog, setActiveCatalog } from '@/services/catalog/state';
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
  });
});
