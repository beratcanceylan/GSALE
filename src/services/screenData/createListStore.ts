export type ListStoreSnapshot<T> = Readonly<{
  data: T[] | null;
  refreshing: boolean;
}>;

export type ListStore<T> = Readonly<{
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => ListStoreSnapshot<T>;
  load: (isRefresh?: boolean) => void;
}>;

export function createListStore<T>(fetcher: () => Promise<T[]>): ListStore<T> {
  let snapshot: ListStoreSnapshot<T> = { data: null, refreshing: false };
  const listeners = new Set<() => void>();
  let pending: Promise<void> | null = null;

  const notify = (): void => {
    for (const listener of listeners) {
      listener();
    }
  };

  const fetchData = async (isRefresh: boolean): Promise<void> => {
    if (isRefresh) {
      snapshot = { ...snapshot, refreshing: true };
      notify();
    }
    try {
      const data = await fetcher();
      snapshot = { data, refreshing: false };
    } catch {
      snapshot = { data: [], refreshing: false };
    }
    notify();
  };

  const startLoad = (isRefresh: boolean): void => {
    if (pending) {
      // Coalesce refresh requests while the current load is still running.
      // A second refresh would otherwise start duplicate full-store work.
      return;
    }
    pending = fetchData(isRefresh).finally(() => {
      pending = null;
    });
  };

  return {
    getSnapshot: () => snapshot,
    load: (isRefresh = false) => {
      startLoad(isRefresh);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      if (snapshot.data === null && !pending) {
        startLoad(false);
      }
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
