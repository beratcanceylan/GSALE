import { fetchSearchResults, type Game } from '@/services/gameData';

export type SearchSnapshot = Readonly<{
  games: Game[];
  searchQuery: string;
  searching: boolean;
  hasSearched: boolean;
  version: number;
}>;

const initialSnapshot: SearchSnapshot = {
  games: [],
  searchQuery: '',
  searching: false,
  hasSearched: false,
  version: 0,
};

const listeners = new Set<() => void>();
let snapshot = initialSnapshot;
let activeQuery = '';
let loadGeneration = 0;
let activeController: AbortController | null = null;

const notify = (): void => {
  for (const listener of listeners) {
    listener();
  }
};

async function runSearch(query: string): Promise<void> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    loadGeneration += 1;
    activeController?.abort();
    activeController = null;
    snapshot = { ...initialSnapshot, searchQuery: trimmed, version: snapshot.version + 1 };
    activeQuery = trimmed;
    notify();
    return;
  }

  const generation = ++loadGeneration;
  activeController?.abort();
  const controller = new AbortController();
  activeController = controller;
  activeQuery = trimmed;
  snapshot = {
    ...snapshot,
    searchQuery: trimmed,
    searching: true,
    hasSearched: true,
    version: snapshot.version + 1,
  };
  notify();

  try {
    const games = await fetchSearchResults(trimmed, { signal: controller.signal });
    if (generation === loadGeneration) {
      snapshot = {
        games,
        searchQuery: trimmed,
        searching: false,
        hasSearched: true,
        version: snapshot.version + 1,
      };
      notify();
    }
  } catch {
    if (generation === loadGeneration) {
      snapshot = {
        games: [],
        searchQuery: trimmed,
        searching: false,
        hasSearched: true,
        version: snapshot.version + 1,
      };
      notify();
    }
  } finally {
    if (activeController === controller) activeController = null;
  }
}

export const searchStore = {
  getSnapshot: (): SearchSnapshot => snapshot,
  reload: (): void => {
    void runSearch(activeQuery);
  },
  search: (query: string): void => {
    void runSearch(query);
  },
  setQuery: (query: string): void => {
    snapshot = { ...snapshot, searchQuery: query, version: snapshot.version + 1 };
    notify();
  },
  reset: (): void => {
    loadGeneration += 1;
    activeController?.abort();
    activeController = null;
    activeQuery = '';
    snapshot = { ...initialSnapshot, version: snapshot.version + 1 };
    notify();
  },
  subscribeQuery: (query: string, listener: () => void): (() => void) => {
    listeners.add(listener);
    const trimmed = query.trim();
    if (trimmed.length >= 2 && (trimmed !== activeQuery || !snapshot.hasSearched)) {
      void runSearch(query);
    } else if (trimmed.length < 2 && trimmed !== activeQuery) {
      loadGeneration += 1;
      activeController?.abort();
      activeController = null;
      activeQuery = trimmed;
      snapshot = { ...initialSnapshot, searchQuery: trimmed, version: snapshot.version + 1 };
      notify();
    }
    return () => {
      listeners.delete(listener);
    };
  },
};
