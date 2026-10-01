import { catalogPlatformsForTitle, catalogStoresForGame, searchCatalogHits, type CatalogDb } from '@/services/catalog/query';
import { getStoreCountryConfig } from '@/services/store/config';
import type { PlatformSearchHit } from '@/services/store/types';

/** Older catalogs may miss new releases, so they no longer rule out stores. */
const MAX_AVAILABILITY_AGE_MS = 30 * 24 * 60 * 60 * 1000;

type ActiveCatalog = Readonly<{ db: CatalogDb; version: string }>;

let active: ActiveCatalog | null = null;
const listeners = new Set<() => void>();

export function subscribeCatalog(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Called by the loader once a catalog file is open (or with null while it is replaced). */
export function setActiveCatalog(catalog: ActiveCatalog | null): void {
  active = catalog;
  if (catalog) for (const listener of listeners) listener();
}

/** Steam/Xbox catalog hits; empty while no catalog is available. */
export async function searchCatalog(query: string): Promise<PlatformSearchHit[]> {
  if (!active) return [];
  try {
    return await searchCatalogHits(active.db, query, getStoreCountryConfig().storeLocale);
  } catch {
    return [];
  }
}

/** Catalog-covered platforms that list the title; null means "unknown, query every store". */
export async function catalogPlatforms(title: string): Promise<ReadonlySet<string> | null> {
  if (!active) return null;
  const age = Date.now() - Date.parse(active.version);
  if (!Number.isFinite(age) || age > MAX_AVAILABILITY_AGE_MS) return null;
  try {
    return await catalogPlatformsForTitle(active.db, title);
  } catch {
    return null;
  }
}

/** Exact game identity for card logos; missing or older schemas fall back to live stores. */
export async function catalogStores(title: string): Promise<ReadonlySet<string> | null> {
  if (!active) return null;
  try {
    return await catalogStoresForGame(active.db, title);
  } catch {
    return null;
  }
}
