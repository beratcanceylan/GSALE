import { fetchGameDetail, type Game } from '@/services/gameData';
import type { EditionKey } from '@/services/api';

export type GameDetailFetchSnapshot = Readonly<{
  game: Game | null;
  /** Edition whose prices are shown; starts on the opened product's edition. */
  selectedEdition: EditionKey | null;
  loading: boolean;
  /** Error code; screens translate it. */
  error: 'load-failed' | null;
  version: number;
}>;

type DetailEntry = {
  snapshot: GameDetailFetchSnapshot;
  listeners: Set<() => void>;
  pending: Promise<void> | null;
  controller: AbortController | null;
  generation: number;
};

const entries = new Map<string, DetailEntry>();

function detailKey(slug: string, platformHint?: string): string {
  return `${slug}|${platformHint ?? ''}`;
}

function createEntry(): DetailEntry {
  return {
    snapshot: { game: null, selectedEdition: null, loading: true, error: null, version: 0 },
    listeners: new Set(),
    pending: null,
    controller: null,
    generation: 0,
  };
}

function notifyEntry(entry: DetailEntry): void {
  for (const listener of entry.listeners) {
    listener();
  }
}

type DetailResult = Pick<GameDetailFetchSnapshot, 'game' | 'error'>;

async function fetchDetailResult(
  slug: string,
  platformHint: string | undefined,
  signal: AbortSignal,
): Promise<DetailResult> {
  try {
    return { game: await fetchGameDetail(slug, platformHint, { signal }), error: null };
  } catch {
    return { game: null, error: 'load-failed' };
  }
}

function initialEdition(game: Game | null): EditionKey | null {
  if (!game) return null;
  const keys = game.editions?.map((option) => option.key) ?? [];
  if (game.edition && keys.includes(game.edition)) return game.edition;
  return keys[0] ?? game.edition ?? null;
}

/** A newer load (retry or new platform hint) supersedes this one; drop stale results. */
function commitIfCurrent(entry: DetailEntry, generation: number, result: DetailResult): void {
  if (generation !== entry.generation) return;
  entry.snapshot = {
    ...result,
    selectedEdition: initialEdition(result.game),
    loading: false,
    version: entry.snapshot.version + 1,
  };
  notifyEntry(entry);
}

function loadEntry(
  entry: DetailEntry,
  slug: string,
  platformHint: string | undefined,
): void {
  const generation = entry.generation + 1;
  entry.generation = generation;
  const controller = new AbortController();
  entry.controller = controller;

  entry.pending = (async () => {
    entry.snapshot = {
      game: entry.snapshot.game,
      selectedEdition: entry.snapshot.selectedEdition,
      loading: true,
      error: null,
      version: entry.snapshot.version + 1,
    };
    notifyEntry(entry);

    const result = await fetchDetailResult(slug, platformHint, controller.signal);
    commitIfCurrent(entry, generation, result);
  })().finally(() => {
    if (generation === entry.generation) {
      entry.pending = null;
      entry.controller = null;
    }
  });
}

function getEntry(key: string): DetailEntry {
  let entry = entries.get(key);
  if (!entry) {
    entry = createEntry();
    entries.set(key, entry);
  }
  return entry;
}

export const gameDetailStore = {
  getSnapshot: (slug: string, platformHint?: string): GameDetailFetchSnapshot => {
    return getEntry(detailKey(slug, platformHint)).snapshot;
  },
  reload: (slug: string, platformHint?: string): void => {
    const entry = getEntry(detailKey(slug, platformHint));
    entry.generation += 1;
    entry.controller?.abort();
    entry.controller = null;
    entry.pending = null;
    loadEntry(entry, slug, platformHint);
  },
  /** Shows another edition's prices; every edition is already loaded, so no request is made. */
  selectEdition: (slug: string, platformHint: string | undefined, key: EditionKey): void => {
    const entry = getEntry(detailKey(slug, platformHint));
    const { snapshot } = entry;
    const known = snapshot.game?.editions?.some((option) => option.key === key) ?? false;
    if (!known || snapshot.selectedEdition === key) return;
    entry.snapshot = { ...snapshot, selectedEdition: key, version: snapshot.version + 1 };
    notifyEntry(entry);
  },
  subscribe: (
    slug: string,
    platformHint: string | undefined,
    listener: () => void,
  ): (() => void) => {
    const key = detailKey(slug, platformHint);
    const entry = getEntry(key);
    entry.listeners.add(listener);
    if (!entry.pending && (entry.snapshot.game === null || entry.snapshot.error !== null)) {
      loadEntry(entry, slug, platformHint);
    }
    return () => {
      entry.listeners.delete(listener);
    };
  },
};
