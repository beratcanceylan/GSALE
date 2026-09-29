import { getEpicLocale, getStoreCountry, STORE_CONFIG } from '@/services/store/config';
import { liveGameWithDeal, platformPriceToGameDeal } from '@/services/store/deals';
import { acceptEditionCandidate, MAX_EDITION_CANDIDATES, type EditionOffer } from '@/services/store/edition-table';
import { baseTitle } from '@/services/store/editions';
import { fetchJson, fetchPostJson, fetchText, throwIfAborted, withRetry } from '@/services/store/fetch';
import { firstResult } from '@/services/store/sequence';
import { isStrictMatch } from '@/services/store/match';
import { parseEpicBrowseOffers, type EpicBrowseOffer } from '@/services/store/platforms/epic-browse';
import { epicPriceFromMinorUnits } from '@/services/store/platforms/epic-price';
import {
  epicMediaToGameMedia,
  epicDetailImage,
  epicImage,
  epicMetadataFromOffer,
  epicOfferToGameMedia,
  epicOfferToSearchHit,
  getEpicRouteSlug,
  pickBestEpicOffers,
  pickBestEpicOffer,
  pickBestEpicOfferForTitles,
  type EpicMediaResponse,
} from '@/services/store/platforms/epic-search';
import type {
  LiveGame,
  PlatformPriceResult,
  PlatformSearchHit,
  StoreRequestOptions,
} from '@/services/store/types';

type EpicSearchElement = EpicBrowseOffer;

interface EpicFreePromotion {
  title?: string;
  id?: string;
  namespace?: string;
  productSlug?: string;
  keyImages?: { type?: string; url?: string }[];
  promotions?: {
    promotionalOffers?: { promotionalOffers?: { discountSetting?: { discountPercentage?: number } }[] }[];
  };
}

interface EgdataSearchResponse {
  offers?: EpicSearchElement[];
  elements?: EpicSearchElement[];
}

const EGDATA_API_BASE = 'https://api.egdata.app';
const EPIC_STORE_BASE = 'https://store.epicgames.com';
const EPIC_BROWSE_HEADERS = {
  // Epic's storefront blocks generic browser UAs on the SSR browse route.
  'User-Agent': 'GSale/1.0',
};

function epicBrowseLocale(): string {
  return getEpicLocale().toLowerCase().startsWith('tr') ? 'tr' : 'en-US';
}

function epicBrowseUrl(query: string): string {
  return `${EPIC_STORE_BASE}/${epicBrowseLocale()}/browse?q=${encodeURIComponent(query)}`;
}

async function runEpicBrowseSearch(
  query: string,
  options?: StoreRequestOptions,
): Promise<EpicSearchElement[]> {
  try {
    const html = await withRetry(
      () => fetchText(
        epicBrowseUrl(query),
        { headers: EPIC_BROWSE_HEADERS, signal: options?.signal },
        STORE_CONFIG.timeout.long,
      ),
      0,
      options?.signal,
    );
    return parseEpicBrowseOffers(html);
  } catch (error) {
    if (options?.signal?.aborted) throw error;
    return [];
  }
}

function epicSearchQueryVariants(query: string): string[] {
  const variants = [query.trim()];
  if (/\bgta\b/i.test(query)) {
    variants.push(query.replace(/\bgta\b/gi, 'Grand Theft Auto').trim());
  }
  return [...new Set(variants.filter(Boolean))];
}

async function runEpicSearch(
  query: string,
  count: number,
  options?: StoreRequestOptions,
): Promise<EpicSearchElement[]> {
  const url = `${EGDATA_API_BASE}/search/v2/search?country=${getStoreCountry()}&locale=${getEpicLocale()}`;
  const variables = {
    title: query,
    limit: count,
    page: 1,
  };

  const response = await withRetry(
    () => fetchPostJson<EgdataSearchResponse>(url, variables, {}, STORE_CONFIG.timeout.short, options?.signal),
    0,
    options?.signal,
  );
  return response.offers ?? response.elements ?? [];
}

async function fetchEpicMedia(
  offerId: string,
  options?: StoreRequestOptions,
): Promise<EpicMediaResponse | null> {
  try {
    return await withRetry(
      () => fetchJson<EpicMediaResponse>(`${EGDATA_API_BASE}/offers/${offerId}/media`, { signal: options?.signal }),
      0,
      options?.signal,
    );
  } catch (error) {
    if (options?.signal?.aborted) throw error;
    return null;
  }
}

async function runEpicSearchVariants(
  query: string,
  count: number,
  options?: StoreRequestOptions,
): Promise<{ elements: EpicSearchElement[]; matchedQuery: string }> {
  const matched = await firstResult(epicSearchQueryVariants(query), async (variant) => {
    const elements = await runEpicSearch(variant, count, options);
    return pickBestEpicOffer(elements, variant) ? { elements, matchedQuery: variant } : null;
  });
  if (matched) return matched;
  const localizedElements = await runEpicBrowseSearch(query, options);
  return { elements: localizedElements, matchedQuery: query };
}

export async function searchEpic(
  query: string,
  options?: StoreRequestOptions,
): Promise<PlatformSearchHit[]> {
  const { elements } = await runEpicSearchVariants(query, 12, options);

  const hits: PlatformSearchHit[] = [];
  for (const el of pickBestEpicOffers(elements, query)) {
    const hit = epicOfferToSearchHit(el);
    if (hit) hits.push(hit);
  }
  return hits;
}

export async function fetchEpicPrice(
  lookupTitle: string,
  matchTitle: string = lookupTitle,
  options?: StoreRequestOptions,
): Promise<PlatformPriceResult | null> {
  const { elements, matchedQuery } = await runEpicSearchVariants(lookupTitle, 12, options);
  const el = pickBestEpicOfferForTitles(elements, [matchTitle, matchedQuery, lookupTitle]);
  if (!el) return null;

  const priceInfo = el.price?.price;
  if (!priceInfo) return null;

  const priced = await epicPriceFromMinorUnits(priceInfo, options?.signal);
  const hit = epicOfferToSearchHit(el);

  const result: PlatformPriceResult = {
    platform: 'Epic Games',
    price: priced.price,
    original_price: priced.original_price,
    discount: priced.discount,
    tier: 'pc',
  };
  if (hit?.store_url) result.store_url = hit.store_url;
  return result;
}

/** Every edition of `title`'s game on Epic, from one search with the base title. */
export async function fetchEpicEditionOffers(
  title: string,
  options?: StoreRequestOptions,
): Promise<EditionOffer[]> {
  const { elements } = await runEpicSearchVariants(baseTitle(title), 12, options);
  throwIfAborted(options?.signal);
  const accepted = elements
    .flatMap((element) => {
      const edition = element.title ? acceptEditionCandidate(element.title, title) : null;
      const priceInfo = element.price?.price;
      return edition && priceInfo ? [{ element, edition, priceInfo }] : [];
    })
    .slice(0, MAX_EDITION_CANDIDATES);

  const offers = await Promise.all(accepted.map(async ({ element, edition, priceInfo }): Promise<EditionOffer> => {
    const priced = await epicPriceFromMinorUnits(priceInfo, options?.signal);
    const hit = epicOfferToSearchHit(element);
    const price: PlatformPriceResult = {
      platform: 'Epic Games',
      price: priced.price,
      original_price: priced.original_price,
      discount: priced.discount,
      tier: 'pc',
      ...(hit?.store_url ? { store_url: hit.store_url } : {}),
    };
    return { platform: 'Epic Games', edition, title: element.title ?? '', id: hit?.slug ?? hit?.id ?? element.id ?? '', price };
  }));
  throwIfAborted(options?.signal);
  return offers;
}

/** Offer media, keeping the offer's own screenshots when the media endpoint has none. */
function mergeEpicMedia(offer: EpicSearchElement, media: Awaited<ReturnType<typeof fetchEpicMedia>>) {
  const offerMedia = epicOfferToGameMedia(offer);
  const fetchedMedia = epicMediaToGameMedia(media);
  const keepOfferScreenshots = !fetchedMedia.screenshots?.length && Boolean(offerMedia.screenshots?.length);
  return {
    ...offerMedia,
    ...fetchedMedia,
    ...(keepOfferScreenshots ? { screenshots: offerMedia.screenshots } : {}),
  };
}

async function epicOfferDeal(offer: EpicSearchElement, storeUrl: string | undefined, signal?: AbortSignal) {
  const priceInfo = offer.price?.price;
  if (!priceInfo) return null;
  const priced = await epicPriceFromMinorUnits(priceInfo, signal);
  return platformPriceToGameDeal({
    platform: 'Epic Games',
    price: priced.price,
    original_price: priced.original_price,
    discount: priced.discount,
    ...(storeUrl ? { store_url: storeUrl } : {}),
    tier: 'pc',
  });
}

async function fetchEpicOfferDetails(
  offerId: string,
  fallbackSlug: string,
  options?: StoreRequestOptions,
): Promise<LiveGame | null> {
  const offer = await withRetry(
    () =>
      fetchJson<EpicSearchElement>(
        `${EGDATA_API_BASE}/offers/${encodeURIComponent(offerId)}?country=${getStoreCountry()}`,
        { signal: options?.signal },
      ),
    0,
    options?.signal,
  );
  if (!offer.title) return null;

  const storeUrl = epicOfferToSearchHit(offer)?.store_url;
  const [media, deal] = await Promise.all([
    fetchEpicMedia(offerId, options),
    epicOfferDeal(offer, storeUrl, options?.signal),
  ]);
  const routeSlug = getEpicRouteSlug(offer) || fallbackSlug;
  return {
    id: routeSlug,
    slug: routeSlug,
    title: offer.title,
    image_url: epicDetailImage(offer, media),
    platform: 'Epic Games',
    source_platform: 'Epic Games',
    ...epicMetadataFromOffer(offer),
    ...mergeEpicMedia(offer, media),
    rating: null,
    store_links: { 'Epic Games': storeUrl || '' },
    ...(deal ? { deals: [deal] } : {}),
  };
}

async function fetchEpicSearchDetails(
  cleanSlug: string,
  titleHint: string | undefined,
  options?: StoreRequestOptions,
): Promise<LiveGame | null> {
  const hits = await searchEpic(titleHint || cleanSlug.replaceAll('_', ' '), options);
  const match =
    hits.find((h) => h.slug === cleanSlug || h.id === `epic-${cleanSlug}`) ||
    hits.find((h) => titleHint && isStrictMatch(h.title, titleHint));
  if (!match) return null;

  return {
    id: match.id.replace(/^epic-/, '') || match.id,
    slug: match.slug ?? match.id,
    title: match.title,
    image_url: match.image_url,
    platform: 'Epic Games',
    source_platform: 'Epic Games',
    description: '',
    rating: null,
    store_links: { 'Epic Games': match.store_url || '' },
  };
}

/** Details by egdata offer id (route slugs are "<namespace>_<offerId>"), else by searching the title. */
export async function fetchEpicDetails(
  slug: string,
  titleHint?: string,
  options?: StoreRequestOptions,
): Promise<LiveGame | null> {
  const cleanSlug = slug.replace(/^epic-/, '');
  const offerId = cleanSlug.includes('_') ? cleanSlug.split('_').at(-1) : cleanSlug;
  const fromOffer = offerId ? await fetchEpicOfferDetails(offerId, cleanSlug, options) : null;
  return fromOffer ?? fetchEpicSearchDetails(cleanSlug, titleHint, options);
}

/** Discounted offers egdata features for the selected country. */
export async function fetchEpicDeals(
  limit: number,
  options?: StoreRequestOptions,
): Promise<LiveGame[]> {
  const url = `${EGDATA_API_BASE}/offers/featured-discounts?country=${getStoreCountry()}`;
  const offers = await withRetry(
    () => fetchJson<EpicSearchElement[]>(url, { signal: options?.signal }, STORE_CONFIG.timeout.long),
    0,
    options?.signal,
  );
  const games = await Promise.all(
    (Array.isArray(offers) ? offers : []).map(async (offer) => {
      const hit = epicOfferToSearchHit(offer);
      const priceInfo = offer.price?.price;
      if (!hit || !priceInfo) return null;
      const priced = await epicPriceFromMinorUnits(priceInfo, options?.signal);
      if (!priced.discount) return null;
      return liveGameWithDeal(hit, {
        platform: 'Epic Games',
        price: priced.price,
        original_price: priced.original_price,
        discount: priced.discount,
        tier: 'pc',
        ...(hit.store_url ? { store_url: hit.store_url } : {}),
      });
    }),
  );
  return games.flatMap((game) => (game ? [game] : [])).slice(0, limit);
}

export async function fetchEpicFreeGames(options?: StoreRequestOptions): Promise<LiveGame[]> {
  const url = `https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=${getEpicLocale()}&country=${getStoreCountry()}&allowCountries=${getStoreCountry()}`;
  const data = await withRetry(
    () =>
      fetchJson<{ data?: { Catalog?: { searchStore?: { elements?: EpicFreePromotion[] } } } }>(url, {
        signal: options?.signal,
      }),
    0,
    options?.signal,
  );

  const elements = data.data?.Catalog?.searchStore?.elements ?? [];
  const freeGames: LiveGame[] = [];

  for (const el of elements) {
    const offers = el.promotions?.promotionalOffers?.[0]?.promotionalOffers ?? [];
    const isFree = offers.some((o) => o.discountSetting?.discountPercentage === 0);
    if (!isFree || !el.title) continue;

    const slug = getEpicRouteSlug(el);
    if (!slug) continue;

    freeGames.push({
      id: slug,
      slug,
      title: el.title,
      image_url: epicImage(el),
      platform: 'Epic Games',
      source_platform: 'Epic Games',
      price: 'Ücretsiz',
      discount: '',
      rating: null,
    });
  }

  return freeGames;
}
