import { getFavorites, type FavoriteGame } from '@/services/favorites';

export type FavoritesSnapshot = Readonly<{
  data: FavoriteGame[];
  version: number;
}>;

const listeners = new Set<() => void>();
let snapshot: FavoritesSnapshot = { data: [], version: 0 };
let initialized = false;

function ensureLoaded(): void {
  if (initialized) return;
  initialized = true;
  snapshot = { data: getFavorites(), version: snapshot.version };
}

const notify = (): void => {
  for (const listener of listeners) {
    listener();
  }
};

export const favoritesStore = {
  getSnapshot: (): FavoritesSnapshot => snapshot,
  load: (): void => {
    ensureLoaded();
    snapshot = { data: getFavorites(), version: snapshot.version + 1 };
    notify();
  },
  subscribe: (listener: () => void): (() => void) => {
    listeners.add(listener);
    if (listeners.size === 1) {
      ensureLoaded();
      notify();
    }
    return () => {
      listeners.delete(listener);
    };
  },
};
