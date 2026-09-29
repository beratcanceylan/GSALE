import { mock } from 'bun:test';

type Listener = () => void;

function createStore<T>(initial: T) {
  let snapshot = initial;
  const listeners = new Set<Listener>();
  const loads: boolean[] = [];
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: Listener) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    load: (refresh = false) => { loads.push(refresh); },
    setSnapshot: (next: T) => {
      snapshot = next;
      for (const listener of listeners) listener();
    },
    loads,
  };
}

export const homeStoreMock = createStore<{ data: unknown[] | null; refreshing: boolean }>({ data: null, refreshing: false });
export const freeGamesStoreMock = createStore<{ data: unknown[] | null; refreshing: boolean }>({ data: null, refreshing: false });
export const favoritesStoreMock = createStore<{ data: unknown[]; version: number }>({ data: [], version: 0 });

export const searchStoreMock = {
  ...createStore<{ games: unknown[]; searchQuery: string; searching: boolean; hasSearched: boolean; version: number }>({
    games: [], searchQuery: '', searching: false, hasSearched: false, version: 0,
  }),
  queries: [] as string[],
  subscribeQuery(query: string, listener: Listener) {
    this.queries.push(query);
    return this.subscribe(listener);
  },
};

let detailSnapshot = { game: null as unknown | null, loading: true, error: null as string | null, version: 0 };
const detailListeners = new Set<Listener>();

export const gameDetailStoreMock = {
  reloads: [] as [string, string | undefined][],
  getSnapshot(_slug: string, _hint?: string) { return detailSnapshot; },
  subscribe(_slug: string, _hint: string | undefined, listener: Listener) {
    detailListeners.add(listener);
    return () => { detailListeners.delete(listener); };
  },
  reload(slug: string, hint?: string) { this.reloads.push([slug, hint]); },
  setSnapshot(next: { game: unknown | null; loading: boolean; error: string | null; version: number }) {
    detailSnapshot = next;
    for (const listener of detailListeners) listener();
  },
};

mock.module('@/services/screenData', () => ({
  homeStore: homeStoreMock,
  freeGamesStore: freeGamesStoreMock,
  favoritesStore: favoritesStoreMock,
  searchStore: searchStoreMock,
  gameDetailStore: gameDetailStoreMock,
}));
