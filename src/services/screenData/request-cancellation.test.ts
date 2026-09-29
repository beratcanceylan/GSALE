import { describe, expect, mock, test } from 'bun:test';

const searchSignals: AbortSignal[] = [];
const detailSignals: AbortSignal[] = [];

mock.module('@/services/gameData', () => ({
  fetchSearchResults: async (_query: string, options?: { signal?: AbortSignal }) => {
    if (options?.signal) searchSignals.push(options.signal);
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
  test('aborts the previous search when the query is reset', async () => {
    searchSignals.length = 0;
    const unsubscribe = searchStore.subscribeQuery('cancel-search', () => undefined);
    await flush();

    searchStore.reset();
    await flush();

    expect(searchSignals).toHaveLength(1);
    expect(searchSignals[0]?.aborted).toBe(true);
    expect(searchStore.getSnapshot().searching).toBe(false);
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
    expect(searchSignals[0]?.aborted).toBe(true);
    expect(searchStore.getSnapshot().searching).toBe(false);
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
    expect(detailSignals[0]?.aborted).toBe(true);
    expect(detailSignals[1]?.aborted).toBe(false);
    expect(gameDetailStore.getSnapshot(slug, 'Steam').loading).toBe(true);
    unsubscribe();
  });
});
