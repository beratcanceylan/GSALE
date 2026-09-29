import { catalogPlatforms } from '@/services/catalog/state';
import { CATALOG_PLATFORMS } from '@/services/catalog/schema';
import { getStoreCountry } from '@/services/store/config';
import { buildEditionTable, type EditionOffer, type EditionOffersFetcher, type EditionOption } from '@/services/store/edition-table';
import { baseTitle } from '@/services/store/editions';
import { throwIfAborted } from '@/services/store/fetch';
import { fetchEpicEditionOffers } from '@/services/store/platforms/epic';
import { fetchGogEditionOffers } from '@/services/store/platforms/gog';
import { fetchNintendoEditionOffers } from '@/services/store/platforms/nintendo';
import { fetchPlayStationEditionOffers } from '@/services/store/platforms/ps';
import { fetchSteamEditionOffers } from '@/services/store/platforms/steam';
import { fetchXboxEditionOffers } from '@/services/store/platforms/xbox';
import type { StoreRequestOptions } from '@/services/store/types';

const PRICE_CACHE_TTL_MS = 60_000;

type CachedOffers = Readonly<{
  value: EditionOffer[];
  expiresAt: number;
}>;

type InflightOffers = {
  promise: Promise<EditionOffer[]>;
  signal?: AbortSignal;
};

export const EDITION_PROVIDERS = [
  { platform: 'Steam', fetch: fetchSteamEditionOffers },
  { platform: 'Epic Games', fetch: fetchEpicEditionOffers },
  { platform: 'GOG', fetch: fetchGogEditionOffers },
  { platform: 'Xbox', fetch: fetchXboxEditionOffers },
  { platform: 'PlayStation', fetch: fetchPlayStationEditionOffers },
  { platform: 'Nintendo', fetch: fetchNintendoEditionOffers },
] as const satisfies readonly { platform: string; fetch: EditionOffersFetcher }[];

const offerCache = new Map<string, CachedOffers>();
const inflightOffers = new Map<string, InflightOffers>();

/** Every edition shares one entry: the adapters search by base title. */
function offersCacheKey(platform: string, title: string): string {
  return `${getStoreCountry()}|${platform}|${baseTitle(title).toLowerCase()}`;
}

async function fetchCachedOffers(
  platform: string,
  title: string,
  fetchOffers: EditionOffersFetcher,
  options?: StoreRequestOptions,
): Promise<EditionOffer[]> {
  const key = offersCacheKey(platform, title);
  const cached = offerCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const pending = inflightOffers.get(key);
  // A request from a newer search/detail generation must not join a pending
  // promise that is owned by the already-cancelled generation.
  if (pending && pending.signal === options?.signal) return pending.promise;

  const entry: InflightOffers = {
    promise: Promise.resolve([]),
    ...(options?.signal ? { signal: options.signal } : {}),
  };
  const request = fetchOffers(title, options).then((value) => {
    if (inflightOffers.get(key) === entry) {
      offerCache.set(key, { value, expiresAt: Date.now() + PRICE_CACHE_TTL_MS });
    }
    return value;
  });
  entry.promise = request;
  inflightOffers.set(key, entry);
  const release = () => {
    if (inflightOffers.get(key) === entry) inflightOffers.delete(key);
  };
  request.then(release, release);
  return request;
}

/** False only when the catalog knows the title and this catalog-covered store has nothing like it. */
function isListedOn(platform: string, available: ReadonlySet<string> | null): boolean {
  return !available || !CATALOG_PLATFORMS.has(platform) || available.has(platform);
}

/** Every store's offers for every edition of `title`'s game; one store failing never hides the others. */
export async function fetchEditionOffers(title: string, options?: StoreRequestOptions): Promise<EditionOffer[]> {
  const available = await catalogPlatforms(title);
  const results = await Promise.allSettled(
    EDITION_PROVIDERS.map((provider) =>
      isListedOn(provider.platform, available)
        ? fetchCachedOffers(provider.platform, title, provider.fetch, options)
        : Promise.resolve([]),
    ),
  );
  throwIfAborted(options?.signal);
  return results.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
}

export async function fetchEditionTable(title: string, options?: StoreRequestOptions): Promise<EditionOption[]> {
  return buildEditionTable(await fetchEditionOffers(title, options));
}
