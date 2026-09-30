import { afterEach, describe, expect, mock, test } from 'bun:test';

mock.module('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => undefined,
}));

const { setAppCountry } = await import('@/services/country');
const { markSubscriptions, resetSubscriptionCacheForTests } = await import('@/services/store/subscriptions');

const originalFetch = globalThis.fetch;

afterEach(async () => {
  globalThis.fetch = originalFetch;
  resetSubscriptionCacheForTests();
  await setAppCountry('TR');
});

const price = (platform: string) => ({ platform, price: '100,00 TL', discount: '' });
const offer = (platform: string, id: string, title: string) => ({ platform, edition: 'base' as const, id, title, price: price(platform) });

function routeCatalogs(requests: string[], psPages: string[][] = [['Hades', 'Marvel’s Spider-Man 2']]): void {
  globalThis.fetch = async (input) => {
    const url = String(input);
    requests.push(url);
    if (url.includes('catalog.gamepass.com')) {
      return Response.json([{ siglId: 'x', title: 'All' }, { id: 'GAMEPASS1' }]);
    }
    if (url.includes('web.np.playstation.com')) {
      const variables = JSON.parse(new URL(url).searchParams.get('variables') ?? '{}') as { pageArgs?: { offset?: number } };
      const page = Math.floor((variables.pageArgs?.offset ?? 0) / 200);
      const names = psPages[page] ?? [];
      const total = psPages.reduce((sum, list) => sum + list.length, 0);
      return Response.json({ data: { categoryGridRetrieve: { pageInfo: { totalCount: total, isLast: page >= psPages.length - 1 }, products: names.map((name) => ({ name })) } } });
    }
    return new Response('', { status: 404 });
  };
}

describe('markSubscriptions', () => {
  test('marks Xbox products in Game Pass and PlayStation games in the PS Plus catalog', async () => {
    const requests: string[] = [];
    routeCatalogs(requests);
    const marked = await markSubscriptions([
      offer('Xbox', 'xbox-GAMEPASS1', 'Starfield'),
      offer('Xbox', 'xbox-OTHER', 'Halo'),
      offer('PlayStation', 'ps-EP1', 'Hades'),
      offer('PlayStation', 'ps-EP2', 'Marvel\'s Spider-Man 2 Deluxe Edition'),
      offer('Steam', '1', 'Hades'),
    ]);
    expect(marked.map((entry) => entry.price.subscription_note ?? null)).toEqual(['Game Pass', null, 'PS Plus', 'PS Plus', null]);
    expect(requests.filter((url) => url.includes('catalog.gamepass.com'))).toHaveLength(2);
    expect(requests.some((url) => url.includes('market=TR'))).toBeTrue();
  });

  test('reads the catalogs once per country', async () => {
    const requests: string[] = [];
    routeCatalogs(requests);
    await markSubscriptions([offer('Xbox', 'xbox-A', 'A')]);
    const afterFirst = requests.length;
    await markSubscriptions([offer('PlayStation', 'ps-B', 'B')]);
    expect(requests).toHaveLength(afterFirst);
    await setAppCountry('DE');
    await markSubscriptions([offer('Xbox', 'xbox-A', 'A')]);
    expect(requests.length).toBeGreaterThan(afterFirst);
  });

  test('pages through the whole PS Plus catalog', async () => {
    const requests: string[] = [];
    routeCatalogs(requests, [Array.from({ length: 200 }, (_, index) => `Filler ${index}`), ['Last Page Game']]);
    const [marked] = await markSubscriptions([offer('PlayStation', 'ps-L', 'Last Page Game')]);
    expect(marked?.price.subscription_note).toBe('PS Plus');
  });

  test('a catalog that fails to load leaves the offers unmarked', async () => {
    globalThis.fetch = async () => new Response('', { status: 503 });
    const [marked] = await markSubscriptions([offer('Xbox', 'xbox-GAMEPASS1', 'Starfield')]);
    expect(marked?.price.subscription_note).toBeUndefined();
  });
});
