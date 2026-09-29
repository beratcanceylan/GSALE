import { afterEach, describe, expect, mock, test } from 'bun:test';

mock.module('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => undefined,
}));

const { setAppCountry } = await import('@/services/country');
const { resetCurrencyCacheForTests, setFxRatesForTests } = await import('@/services/store/currency');
const { searchEpic } = await import('@/services/store/platforms/epic');
const { fetchGogPrice } = await import('@/services/store/platforms/gog');
const { fetchPlayStationPrice, searchPlayStation } = await import('@/services/store/platforms/ps');
const { searchSteam } = await import('@/services/store/platforms/steam');
const { searchXbox } = await import('@/services/store/platforms/xbox');
const { fetchPlatformDeal } = await import('@/services/store/prices');

const originalFetch = globalThis.fetch;

function recordFetch(body: unknown): string[] {
  const urls: string[] = [];
  globalThis.fetch = async (input) => {
    urls.push(String(input));
    return Response.json(body);
  };
  return urls;
}

afterEach(async () => {
  globalThis.fetch = originalFetch;
  resetCurrencyCacheForTests();
  await setAppCountry('TR');
});

describe('store requests follow the selected country', () => {
  test('Steam', async () => {
    const urls = recordFetch({ items: [] });
    await setAppCountry('DE');
    await searchSteam('Hades');
    expect(urls[0]).toContain('cc=DE');
  });

  test('Epic', async () => {
    const urls = recordFetch({ elements: [] });
    await setAppCountry('DE');
    await searchEpic('Hades');
    expect(urls.some((url) => url.includes('country=DE'))).toBeTrue();
    expect(urls.some((url) => url.includes('country=TR'))).toBeFalse();
  });

  test('GOG', async () => {
    const urls = recordFetch({ products: [] });
    await setAppCountry('DE');
    await fetchGogPrice('Witcher', 'Witcher');
    expect(urls[0]).toContain('countryCode=DE');
  });

  test('Xbox', async () => {
    const urls = recordFetch({ ResultSets: [] });
    await setAppCountry('DE');
    await searchXbox('Hades');
    expect(urls[0]).toContain('market=DE');
    expect(urls[0]).toContain('languages=de-DE');
  });

  test('PlayStation', async () => {
    const urls = recordFetch({ links: [] });
    await setAppCountry('DE');
    await searchPlayStation('Hades');
    expect(urls[0]).toContain('/tumbler/DE/de/');
  });

  test('PlayStation is skipped where there is no PlayStation Store', async () => {
    const urls = recordFetch({ links: [] });
    await setAppCountry('KZ');
    expect(await searchPlayStation('Hades')).toEqual([]);
    expect(await fetchPlayStationPrice('Hades')).toBeNull();
    expect(urls).toHaveLength(0);
  });

  test('PlayStation regional prices are converted to TL', async () => {
    setFxRatesForTests({ USD: 1, TRY: 40, EUR: 0.8 });
    globalThis.fetch = async () =>
      Response.json({
        links: [
          {
            id: 'EP0001-PPSA00001_00-GSALEPSREGION000',
            name: 'GSALE PS Region',
            top_category: 'downloadable_game',
            default_sku: { display_price: '€8,00' },
          },
        ],
      });
    await setAppCountry('DE');
    const result = await fetchPlayStationPrice('GSALE PS Region');
    expect(result?.price).toBe('400,00 TL');
    expect(result?.store_url ?? '').toContain('/de-de/');
  });

  test('the 60s price cache does not leak prices across countries', async () => {
    const urls = recordFetch({
      items: [{ id: 991004, name: 'GSALE Country Cache', price: { currency: 'TRY', final: 1000, initial: 1000 } }],
    });
    await fetchPlatformDeal('Steam', 'GSALE Country Cache');
    await setAppCountry('US');
    await fetchPlatformDeal('Steam', 'GSALE Country Cache');

    expect(urls.some((url) => url.includes('cc=TR'))).toBeTrue();
    expect(urls.some((url) => url.includes('cc=US'))).toBeTrue();
  });
});
