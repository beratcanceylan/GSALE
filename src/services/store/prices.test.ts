import { afterEach, describe, expect, mock, test } from 'bun:test';

mock.module('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => undefined,
}));

const { resetCurrencyCacheForTests } = await import('@/services/store/currency');
const { fetchEditionTable } = await import('@/services/store/prices');

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  resetCurrencyCacheForTests();
});

describe('fetchEditionTable', () => {
  test('one store failing keeps the other stores in the table', async () => {
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.includes('storesearch')) {
        return Response.json({
          items: [{ id: 7001, name: 'GSALE Outage Game', price: { currency: 'TRY', final: 5000, initial: 5000 } }],
        });
      }
      if (url.includes('appdetails')) return Response.json({});
      return new Response('down', { status: 503 });
    };
    const table = await fetchEditionTable('GSALE Outage Game');
    expect(table.map((option) => option.key)).toEqual(['base']);
    expect(table[0]?.deals.map((deal) => deal.platform)).toEqual(['Steam']);
  });

  test('a second lookup within 60 seconds reuses the cached offers', async () => {
    let requests = 0;
    globalThis.fetch = async () => {
      requests += 1;
      return Response.json({});
    };
    await fetchEditionTable('GSALE Cached Game');
    const afterFirst = requests;
    await fetchEditionTable('GSALE Cached Game Deluxe Edition');
    expect(afterFirst).toBeGreaterThan(0);
    expect(requests).toBe(afterFirst);
  });

  test('a cancelled request rejects with an abort error', async () => {
    const controller = new AbortController();
    globalThis.fetch = async (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    const pending = fetchEditionTable('GSALE Abort Game', { signal: controller.signal });
    controller.abort();
    expect(pending).rejects.toThrow();
  });
});
