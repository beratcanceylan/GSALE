import { catalogPlatforms } from '@/services/catalog/state';
import { CATALOG_PLATFORMS } from '@/services/catalog/schema';
import { getStoreCountry } from '@/services/store/config';
import { extractEdition, getPriceLookupTitles } from '@/services/store/match';
import { throwIfAborted } from '@/services/store/fetch';
import { firstResult } from '@/services/store/sequence';
import { fetchEpicPrice } from '@/services/store/platforms/epic';
import { fetchGogPrice } from '@/services/store/platforms/gog';
import { fetchNintendoPrice } from '@/services/store/platforms/nintendo';
import { fetchPlayStationPrice } from '@/services/store/platforms/ps';
import { fetchSteamPrice } from '@/services/store/platforms/steam';
import { fetchXboxPrice } from '@/services/store/platforms/xbox';
import { isUnavailablePrice } from '@/services/store/price-parse';
import { platformPriceToGameDeal } from '@/services/store/deals';
import type {
  GameDeal,
  PlatformPriceResult,
  StoreRequestOptions,
} from '@/services/store/types';

const PRICE_CACHE_TTL_MS = 60_000;

type CachedPrice = Readonly<{
  value: PlatformPriceResult | null;
  expiresAt: number;
}>;

export type PriceFetchOptions = StoreRequestOptions & {
  edition?: string;
  knownDeals?: readonly GameDeal[];
};

type PriceFetcher = (
  lookupTitle: string,
  matchTitle: string,
  edition: string,
  options?: StoreRequestOptions,
) => Promise<PlatformPriceResult | null>;

type PriceProvider = Readonly<{
  platform: string;
  fetch: PriceFetcher;
}>;

const priceCache = new Map<string, CachedPrice>();
type InflightPrice = {
  promise: Promise<PlatformPriceResult | null>;
  signal?: AbortSignal;
};

const inflightPrices = new Map<string, InflightPrice>();

const PRICE_PROVIDERS: readonly PriceProvider[] = [
  {
    platform: 'Steam',
    fetch: (lookupTitle, matchTitle, edition, options) =>
      fetchSteamPrice(lookupTitle, edition, matchTitle, options),
  },
  {
    platform: 'Epic Games',
    fetch: (lookupTitle, matchTitle, _edition, options) =>
      fetchEpicPrice(lookupTitle, matchTitle, options),
  },
  {
    platform: 'GOG',
    fetch: (lookupTitle, matchTitle, _edition, options) =>
      fetchGogPrice(lookupTitle, matchTitle, options),
  },
  {
    platform: 'Xbox',
    fetch: (lookupTitle, matchTitle, _edition, options) =>
      fetchXboxPrice(lookupTitle, matchTitle, options),
  },
  {
    platform: 'PlayStation',
    fetch: (lookupTitle, matchTitle, _edition, options) =>
      fetchPlayStationPrice(lookupTitle, matchTitle, options),
  },
  {
    platform: 'Nintendo',
    fetch: (lookupTitle, matchTitle, _edition, options) =>
      fetchNintendoPrice(lookupTitle, matchTitle, options),
  },
];

function priceCacheKey(
  platform: string,
  lookupTitle: string,
  matchTitle: string,
  edition: string,
): string {
  return `${getStoreCountry()}|${platform}|${lookupTitle}|${matchTitle}|${edition}`;
}

async function fetchCachedPlatformPrice(
  platform: string,
  lookupTitle: string,
  matchTitle: string,
  edition: string,
  fetchPrice: PriceFetcher,
  options?: StoreRequestOptions,
): Promise<PlatformPriceResult | null> {
  const key = priceCacheKey(platform, lookupTitle, matchTitle, edition);
  const cached = priceCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const pending = inflightPrices.get(key);
  // A request from a newer search/detail generation must not join a pending
  // promise that is owned by the already-cancelled generation.
  if (pending && pending.signal === options?.signal) return pending.promise;

  const entry: InflightPrice = {
    promise: Promise.resolve(null),
    ...(options?.signal ? { signal: options.signal } : {}),
  };
  const request = fetchPrice(lookupTitle, matchTitle, edition, options).then((value) => {
    if (inflightPrices.get(key) === entry) {
      priceCache.set(key, { value, expiresAt: Date.now() + PRICE_CACHE_TTL_MS });
    }
    return value;
  });
  entry.promise = request;
  inflightPrices.set(key, entry);
  void request.then(
    () => {
      if (inflightPrices.get(key) === entry) inflightPrices.delete(key);
    },
    () => {
      if (inflightPrices.get(key) === entry) inflightPrices.delete(key);
    },
  );
  return request;
}

async function fetchFirstAvailablePrice(
  provider: PriceProvider,
  lookupTitles: string[],
  matchTitle: string,
  edition: string,
  options?: StoreRequestOptions,
): Promise<PlatformPriceResult | null> {
  return firstResult(lookupTitles, async (lookupTitle) => {
    const result = await fetchCachedPlatformPrice(
      provider.platform,
      lookupTitle,
      matchTitle,
      edition,
      provider.fetch,
      options,
    );
    return result && !isUnavailablePrice(result.price) ? result : null;
  });
}

function normalizeFetchOptions(optionsOrEdition?: PriceFetchOptions | string): PriceFetchOptions {
  return typeof optionsOrEdition === 'string' ? { edition: optionsOrEdition } : optionsOrEdition ?? {};
}

function knownDealForPlatform(
  deals: readonly GameDeal[] | undefined,
  platform: string,
): GameDeal | undefined {
  return deals?.find((deal) => deal.platform === platform && !isUnavailablePrice(deal.price));
}

async function fetchPlatformResult(
  provider: PriceProvider,
  title: string,
  edition: string,
  options?: StoreRequestOptions,
): Promise<PlatformPriceResult | null> {
  const lookupTitles = getPriceLookupTitles(title);
  return fetchFirstAvailablePrice(
    provider,
    provider.platform === 'Steam' && lookupTitles.length === 0 ? [title] : lookupTitles,
    title,
    edition,
    options,
  );
}

/** False only when the catalog knows the title and this catalog-covered store has nothing like it. */
function isListedOn(platform: string, available: ReadonlySet<string> | null): boolean {
  return !available || !CATALOG_PLATFORMS.has(platform) || available.has(platform);
}

/** Fetch one provider through the shared TTL/inflight deduplication layer. */
export async function fetchPlatformDeal(
  platform: string,
  title: string,
  options?: Pick<PriceFetchOptions, 'edition' | 'signal'>,
): Promise<GameDeal | null> {
  const provider = PRICE_PROVIDERS.find((candidate) => candidate.platform === platform);
  if (!provider) return null;
  if (!isListedOn(platform, await catalogPlatforms(title))) return null;
  const edition = options?.edition ?? extractEdition(title);
  const result = await fetchPlatformResult(provider, title, edition, options);
  return result ? platformPriceToGameDeal(result) : null;
}

export async function fetchAllPrices(
  title: string,
  optionsOrEdition?: PriceFetchOptions | string,
): Promise<GameDeal[]> {
  const options = normalizeFetchOptions(optionsOrEdition);
  const resolvedEdition = options.edition ?? extractEdition(title);
  const available = await catalogPlatforms(title);

  // Keep one store outage from hiding prices returned by the other providers.
  // This mirrors the previous all-settled behaviour while still allowing a
  // caller cancellation to be observed by the individual requests.
  const results = await Promise.allSettled(
    PRICE_PROVIDERS.map(async (provider) => {
      const known = knownDealForPlatform(options.knownDeals, provider.platform);
      if (known) return known;
      if (!isListedOn(provider.platform, available)) return null;

      const result = await fetchPlatformResult(provider, title, resolvedEdition, options);
      return result ? platformPriceToGameDeal(result) : null;
    }),
  );

  throwIfAborted(options.signal);

  return results.flatMap((result) =>
    result.status === 'fulfilled' && result.value ? [result.value] : [],
  );
}
