import { catalogSearchKey, type CatalogStore } from '@/services/catalog/schema';
import { gameKey } from '@/services/store/editions';

/** Ephellon/game-store-catalog directory for each catalog store. */
export const SOURCE_DIRECTORIES: Readonly<Record<CatalogStore, string>> = {
  steam: 'steam',
  ps: 'psn',
  xbox: 'xbox',
  nintendo: 'nintendo',
  epic: 'epic',
};

export interface CatalogRow {
  store: CatalogStore;
  id: string;
  title: string;
  search_key: string;
  game_key: string;
  image: string | null;
}

interface SourceRecord {
  name?: unknown;
  type?: unknown;
  price?: unknown;
  uuid?: unknown;
  image?: unknown;
}

/** Maps one source record to a catalog row; delisted, non-game and non-Latin-only titles are dropped. */
export function sourceRecordToRow(store: CatalogStore, value: unknown): CatalogRow | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as SourceRecord;
  const title = typeof record.name === 'string' ? record.name.trim() : '';
  const id =
    typeof record.uuid === 'string' || typeof record.uuid === 'number' ? String(record.uuid).trim() : '';
  if (!title || !id) return null;
  if (record.type !== undefined && record.type !== null && record.type !== 'game') return null;
  if (record.price === 'Unavailable') return null;

  const searchKey = catalogSearchKey(title);
  if (!searchKey) return null;

  return {
    store,
    id,
    title,
    search_key: searchKey,
    game_key: gameKey(title),
    // Steam images are derived from the app id; only Xbox search hits need a stored image.
    image: store === 'xbox' && typeof record.image === 'string' ? record.image : null,
  };
}
