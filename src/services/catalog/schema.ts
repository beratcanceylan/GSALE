import { canonicalMergeTitleKey } from '@/services/store/match';

/** Catalog store keys and the platform names the store adapters use. */
export const CATALOG_STORES = {
  steam: 'Steam',
  ps: 'PlayStation',
  xbox: 'Xbox',
  nintendo: 'Nintendo',
  epic: 'Epic Games',
} as const;

export type CatalogStore = keyof typeof CATALOG_STORES;

/** Platforms the catalog covers; anything else (GOG) is always queried live. */
export const CATALOG_PLATFORMS: ReadonlySet<string> = new Set(Object.values(CATALOG_STORES));

export const CATALOG_DB_NAME = 'catalog.db';
export const CATALOG_MANIFEST_NAME = 'catalog-manifest.json';

/** No index: searches are substring scans, and the file is downloaded uncompressed. */
export const CATALOG_SCHEMA_SQL = `
CREATE TABLE games (
  store TEXT NOT NULL,
  id TEXT NOT NULL,
  title TEXT NOT NULL,
  search_key TEXT NOT NULL,
  image TEXT
);
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`;

export interface CatalogManifest {
  /** Date the source catalog was scraped (ISO string); changes trigger a new download. */
  version: string;
  file: string;
  bytes: number;
  rows: number;
}

/** Lower-case ASCII words only, so substring search behaves the same everywhere. */
export function catalogSearchKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[™®©]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Same key the search merge uses, so "which stores sell this title" matches merged results. */
export function catalogMergeKey(title: string): string {
  return canonicalMergeTitleKey(title);
}

export function isCatalogManifest(value: unknown): value is CatalogManifest {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record['version'] === 'string' &&
    typeof record['file'] === 'string' &&
    typeof record['bytes'] === 'number' &&
    typeof record['rows'] === 'number'
  );
}
