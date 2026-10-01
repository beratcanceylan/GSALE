import {
  CATALOG_STORES,
  catalogMergeKey,
  catalogSearchKey,
  type CatalogStore,
} from '@/services/catalog/schema';
import { gameKey } from '@/services/store/editions';
import type { PlatformSearchHit } from '@/services/store/types';

/** The part of expo-sqlite's database the catalog needs (bun:sqlite in tests). */
export interface CatalogDb {
  getAllAsync<T>(sql: string, params: (string | number)[]): Promise<T[]>;
}

const MIN_QUERY_LENGTH = 2;
const DEFAULT_SEARCH_LIMIT = 20;

interface HitRow {
  store: CatalogStore;
  id: string;
  title: string;
  image: string | null;
}

/**
 * Catalog ids only match the app's routes for Steam (app id) and Xbox (big id);
 * PlayStation/Nintendo ids are US-store ids and Epic ids are offer ids.
 */
function rowToHit(row: HitRow, storeLocale: string): PlatformSearchHit | null {
  if (row.store === 'steam') {
    return {
      id: row.id,
      slug: row.id,
      title: row.title,
      image_url: `https://cdn.akamai.steamstatic.com/steam/apps/${row.id}/header.jpg`,
      platform: CATALOG_STORES.steam,
      store_url: `https://store.steampowered.com/app/${row.id}/`,
    };
  }
  if (row.store === 'xbox') {
    return {
      id: `xbox-${row.id}`,
      slug: `xbox-${row.id}`,
      title: row.title,
      image_url: row.image ?? '',
      platform: CATALOG_STORES.xbox,
      store_url: `https://www.xbox.com/${storeLocale}/games/store/${row.id}`,
    };
  }
  return null;
}

/** Steam and Xbox titles containing the query, shortest (closest) titles first. */
export async function searchCatalogHits(
  db: CatalogDb,
  query: string,
  storeLocale: string,
  limit = DEFAULT_SEARCH_LIMIT,
): Promise<PlatformSearchHit[]> {
  const key = catalogSearchKey(query);
  if (key.length < MIN_QUERY_LENGTH) return [];
  // The key only contains [a-z0-9 ], so it cannot carry LIKE wildcards.
  const rows = await db.getAllAsync<HitRow>(
    `SELECT store, id, title, image FROM games
     WHERE store IN ('steam', 'xbox') AND search_key LIKE ?
     ORDER BY length(search_key), title
     LIMIT ?`,
    [`%${key}%`, limit],
  );
  return rows.flatMap((row) => {
    const hit = rowToHit(row, storeLocale);
    return hit ? [hit] : [];
  });
}

/**
 * Stores that list any title containing this game's name, or null when no store does.
 *
 * Store names differ ("ELDEN RING PS4 & PS5", "Hollow Knight – Nintendo Switch 2
 * Edition"), so a store only counts as missing the game when none of its titles
 * contains the name. Sequels therefore count too: that costs an extra request,
 * whereas a false "missing" would hide a real price.
 */
export async function catalogPlatformsForTitle(
  db: CatalogDb,
  title: string,
): Promise<ReadonlySet<string> | null> {
  const key = catalogSearchKey(catalogMergeKey(title));
  if (key.length < MIN_QUERY_LENGTH) return null;
  const rows = await db.getAllAsync<{ store: CatalogStore }>(
    'SELECT DISTINCT store FROM games WHERE search_key LIKE ?',
    [`%${key}%`],
  );
  if (rows.length === 0) return null;
  return new Set(rows.map((row) => CATALOG_STORES[row.store]));
}

/**
 * Stores that sell exactly this game (any edition or platform version), or null when the
 * catalog does not know it. Used to show every store on a card without a network request.
 */
export async function catalogStoresForGame(db: CatalogDb, title: string): Promise<ReadonlySet<string> | null> {
  const key = gameKey(title);
  if (key.length < MIN_QUERY_LENGTH) return null;
  const rows = await db.getAllAsync<{ store: CatalogStore }>('SELECT DISTINCT store FROM games WHERE game_key = ?', [key]);
  if (rows.length === 0) return null;
  return new Set(rows.map((row) => CATALOG_STORES[row.store]));
}
