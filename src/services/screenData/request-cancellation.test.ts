import { describe, expect, mock, test } from 'bun:test';

const searchSignals: AbortSignal[] = [];
const detailSignals: AbortSignal[] = [];
let searchOutcome: 'pending' | 'success' | 'failure' = 'pending';
let detailOutcome: 'pending' | 'success' | 'failure' = 'pending';

mock.module('@/services/gameData', () => ({
  fetchSearchResults: async (_query: string, options?: { signal?: AbortSignal }) => {
    if (options?.signal) searchSignals.push(options.signal);
    if (searchOutcome === 'success') return [{ id: 'found' }];
    if (searchOutcome === 'failure') throw new Error('search unavailable');
    await new Promise<void>((_, reject) => {
      const signal = options?.signal;
      if (!signal) return;
      if (signal.aborted) {
        reject(new DOMException('The operation was aborted.', 'AbortError'));
        return;
      }
      signal.addEventListener(
        'abort',
        () => reject(new DOMException('The operation was aborted.', 'AbortError')),
        { once: true },
      );
    });
    return [];
  },
  fetchGameDetail: async (
    _slug: string,
    _platformHint?: string,
    options?: { signal?: AbortSignal },
  ) => {
    if (options?.signal) detailSignals.push(options.signal);
    if (detailOutcome === 'success') return { id: 'detail-found' };
    if (detailOutcome === 'failure') throw new Error('detail unavailable');
    await new Promise<void>((_, reject) => {
      const signal = options?.signal;
      if (!signal) return;
      if (signal.aborted) {
        reject(new DOMException('The operation was aborted.', 'AbortError'));
        return;
      }
      signal.addEventListener(
        'abort',
        () => reject(new DOMException('The operation was aborted.', 'AbortError')),
        { once: true },
      );
    });
    return null;
  },
}));

const { searchStore } = await import('@/services/screenData/searchStore');
const { gameDetailStore } = await import('@/services/screenData/gameDetailStore');

async function flush(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

describe('screen request cancellation', () => {
  test('publishes successful detail loads and reports fetch errors', async () => {
    detailOutcome = 'success';
    const successSlug = `detail-success-${Date.now()}`;
    let notifications = 0;
    const unsubscribe = gameDetailStore.subscribe(successSlug, 'Steam', () => { notifications += 1; });
    await flush();
    expect(gameDetailStore.getSnapshot(successSlug, 'Steam').game).toEqual({ id: 'detail-found' });
    expect(gameDetailStore.getSnapshot(successSlug, 'Steam').loading).toBeFalse();
    expect(notifications).toBe(2);
    unsubscribe();

    detailOutcome = 'failure';
    const failedSlug = `detail-failure-${Date.now()}`;
    const unsubscribeFailure = gameDetailStore.subscribe(failedSlug, undefined, () => undefined);
    await flush();
    expect(gameDetailStore.getSnapshot(failedSlug).error).toBe('Oyun bilgileri yüklenemedi.');
    unsubscribeFailure();
    detailOutcome = 'pending';
  });
  test('searches, reloads, updates query and clears short terms', async () => {
    searchStore.reset();
    searchOutcome = 'success';
    let notifications = 0;
    const unsubscribe = searchStore.subscribeQuery('  found  ', () => { notifications += 1; });
    await flush();
    expect(searchStore.getSnapshot().games).toEqual([{ id: 'found' }]);
    expect(searchStore.getSnapshot().searchQuery).toBe('found');
    expect(searchStore.getSnapshot().searching).toBeFalse();
    searchStore.setQuery('edited');
    expect(searchStore.getSnapshot().searchQuery).toBe('edited');
    searchStore.reload();
    await flush();
    expect(searchSignals.length).toBeGreaterThan(1);
    expect(notifications).toBeGreaterThan(2);
    searchStore.search('x');
    expect(searchStore.getSnapshot().hasSearched).toBeFalse();
    expect(searchStore.getSnapshot().searchQuery).toBe('x');
    unsubscribe();
    searchOutcome = 'pending';
  });

  test('records a failed search as an empty result', async () => {
    searchStore.reset();
    searchOutcome = 'failure';
    const unsubscribe = searchStore.subscribeQuery('broken', () => undefined);
    await flush();
    expect(searchStore.getSnapshot().games).toEqual([]);
    expect(searchStore.getSnapshot().hasSearched).toBeTrue();
    expect(searchStore.getSnapshot().searching).toBeFalse();
    unsubscribe();
    searchOutcome = 'pending';
  });
  test('aborts the previous search when the query is reset', async () => {
    searchSignals.length = 0;
    const unsubscribe = searchStore.subscribeQuery('cancel-search', () => undefined);
    await flush();

    searchStore.reset();
    await flush();

    expect(searchSignals).toHaveLength(1);
    expect(searchSignals[0]?.aborted).toBeTrue();
    expect(searchStore.getSnapshot().searching).toBeFalse();
    unsubscribe();
  });

  test('aborts the previous search when the route query is cleared', async () => {
    searchStore.reset();
    searchSignals.length = 0;
    const unsubscribe = searchStore.subscribeQuery('cancel-route', () => undefined);
    await flush();

    const clearUnsubscribe = searchStore.subscribeQuery('', () => undefined);
    await flush();

    expect(searchSignals).toHaveLength(1);
    expect(searchSignals[0]?.aborted).toBeTrue();
    expect(searchStore.getSnapshot().searching).toBeFalse();
    clearUnsubscribe();
    unsubscribe();
  });

  test('aborts an obsolete detail request before reload starts', async () => {
    detailSignals.length = 0;
    const slug = `cancel-detail-${Date.now()}`;
    const unsubscribe = gameDetailStore.subscribe(slug, 'Steam', () => undefined);
    await flush();

    gameDetailStore.reload(slug, 'Steam');
    await flush();

    expect(detailSignals).toHaveLength(2);
    expect(detailSignals[0]?.aborted).toBeTrue();
    expect(detailSignals[1]?.aborted).toBeFalse();
    expect(gameDetailStore.getSnapshot(slug, 'Steam').loading).toBeTrue();
    unsubscribe();
  });
});
