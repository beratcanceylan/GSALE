export type ListStoreSnapshot<T> = Readonly<{
  data: T[] | null;
  refreshing: boolean;
}>;

export type ListStore<T> = Readonly<{
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => ListStoreSnapshot<T>;
  load: (isRefresh?: boolean) => void;
  /** Drops a pending load (its result would be stale) and reloads if anything was loaded or requested. */
  invalidate: () => void;
}>;

export function createListStore<T>(fetcher: (signal: AbortSignal) => Promise<T[]>): ListStore<T> {
  let snapshot: ListStoreSnapshot<T> = { data: null, refreshing: false };
  const listeners = new Set<() => void>();
  let pending: Promise<void> | null = null;
  let controller: AbortController | null = null;
  let generation = 0;

  const notify = (): void => {
    for (const listener of listeners) {
      listener();
    }
  };

  const fetchData = async (isRefresh: boolean, loadGeneration: number, signal: AbortSignal): Promise<void> => {
    if (isRefresh) {
      snapshot = { ...snapshot, refreshing: true };
      notify();
    }
    let next: ListStoreSnapshot<T>;
    try {
      next = { data: await fetcher(signal), refreshing: false };
    } catch {
      next = { data: [], refreshing: false };
    }
    if (loadGeneration !== generation) return;
    snapshot = next;
    notify();
  };

  const startLoad = (isRefresh: boolean): void => {
    if (pending) {
      // Coalesce refresh requests while the current load is still running.
      // A second refresh would otherwise start duplicate full-store work.
      return;
    }
    const loadGeneration = generation;
    controller = new AbortController();
    const request = fetchData(isRefresh, loadGeneration, controller.signal).finally(() => {
      if (pending === request) pending = null;
    });
    pending = request;
  };

  return {
    getSnapshot: () => snapshot,
    load: (isRefresh = false) => {
      startLoad(isRefresh);
    },
    invalidate: () => {
      const wasActive = pending !== null || snapshot.data !== null;
      generation += 1;
      controller?.abort();
      pending = null;
      if (wasActive) startLoad(snapshot.data !== null);
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
