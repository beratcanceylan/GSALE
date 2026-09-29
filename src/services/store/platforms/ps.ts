import { STORE_CONFIG, getPsLocale, getStoreCountry, getStoreCountryConfig } from '@/services/store/config';
import { formatPriceAsTry } from '@/services/store/currency';
import { liveGameWithDeal, platformPriceToGameDeal } from '@/services/store/deals';
import { fetchJson, fetchText, withRetry } from '@/services/store/fetch';
import { firstResult } from '@/services/store/sequence';
import {
  isExplicitlyFreePrice,
  isUnavailablePrice,
  parseLocalizedAmount,
} from '@/services/store/price-parse';
import {
  getPlayStationStoreUrl,
  getPsSearchQueryCandidates,
  pickBestAvailablePlayStationProduct,
  parsePlayStationChihiroResponse,
  parsePlayStationProductHtml,
  parsePlayStationSearchHtml,
  type ParsedPlayStationProduct,
} from '@/services/store/platforms/ps-parse';

import type {
  LiveGame,
  PlatformPriceResult,
  PlatformSearchHit,
  StoreRequestOptions,
} from '@/services/store/types';

export { getPsSearchQueryCandidates } from '@/services/store/platforms/ps-parse';

function getPsPathLocale(): string {
  return getStoreCountryConfig().storeLocale;
}

/** Chihiro language segment; Türkiye keeps the app-language choice. */
function getPsLanguage(): string {
  const { code, storeLocale } = getStoreCountryConfig();
  return code === 'TR' ? getPsLocale() : storeLocale.slice(0, 2);
}

/** Null where the selected country has no PlayStation Store. */
function getPsCurrency(): string | null {
  return getStoreCountryConfig().playStationCurrency;
}

async function psPriceToTry(price: string, currency: string, signal?: AbortSignal): Promise<string> {
  if (isUnavailablePrice(price) || isExplicitlyFreePrice(price)) return price;
  const amount = parseLocalizedAmount(price);
  return amount === null ? 'Bilinmiyor' : formatPriceAsTry(amount, currency, signal);
}

/** PlayStation parsers format regional prices as-is; show them in TL like other stores. */
async function localizePsProduct(
  product: ParsedPlayStationProduct,
  signal?: AbortSignal,
): Promise<ParsedPlayStationProduct> {
  const currency = getPsCurrency();
  if (!currency || currency === 'TRY') return product;
  return {
    ...product,
    price: await psPriceToTry(product.price, currency, signal),
    original_price: product.original_price
      ? await psPriceToTry(product.original_price, currency, signal)
      : product.original_price,
  };
}

const PS_CHIHIRO_BASE = 'https://store.playstation.com/store/api/chihiro/00_09_000';
const PS_STORE_BASE = 'https://store.playstation.com';

function psHeaders(): HeadersInit {
  return {
    Accept: 'application/json',
    Referer: 'https://store.playstation.com/',
  };
}

function psSearchUrl(term: string): string {
  return `${PS_CHIHIRO_BASE}/tumbler/${getStoreCountry()}/${getPsLanguage()}/999/${encodeURIComponent(term)}?suggested_size=50&mode=game`;
}

function psProductUrl(productId: string): string {
  return `${PS_CHIHIRO_BASE}/container/${getStoreCountry()}/${getPsLanguage()}/999/${encodeURIComponent(productId)}`;
}

function psLegacySearchUrl(query: string): string {
  return `${PS_STORE_BASE}/${getPsPathLocale()}/search/${encodeURIComponent(query)}`;
}

function psLegacyProductUrl(productId: string): string {
  return getPlayStationStoreUrl(productId, getPsPathLocale());
}

async function fetchPsJson(url: string, options?: StoreRequestOptions): Promise<unknown> {
  return withRetry(
    () => fetchJson<unknown>(url, { headers: psHeaders(), signal: options?.signal }, STORE_CONFIG.timeout.long),
    0,
    options?.signal,
  );
}

function productToHit(product: ParsedPlayStationProduct): PlatformSearchHit {
  return {
    id: `ps-${product.id}`,
    slug: `ps-${product.id}`,
    title: product.title,
    image_url: product.image_url,
    platform: 'PlayStation',
    store_url: product.store_url,
  };
}

function psHtmlHeaders(): HeadersInit {
  return {
    Accept: 'text/html,application/xhtml+xml',
    Referer: 'https://store.playstation.com/',
  };
}

async function fetchPsHtml(url: string, options?: StoreRequestOptions): Promise<string> {
  return withRetry(
    () => fetchText(url, { headers: psHtmlHeaders(), signal: options?.signal }, STORE_CONFIG.timeout.long),
    0,
    options?.signal,
  );
}

function hasLinksArray(payload: unknown): boolean {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    Array.isArray((payload as { links?: unknown }).links)
  );
}

type PsCandidateSearch<R> = Readonly<{
  result: R | null;
  /** Products of the first term that returned any, for a looser second pick. */
  firstProducts: ParsedPlayStationProduct[];
  /** A valid Chihiro response without an accepted result: skip the heavy HTML fallback. */
  sawEmptyLinks: boolean;
}>;

/** Searches Chihiro term by term until `accept` returns a result. */
async function searchPsCandidates<R>(
  terms: readonly string[],
  accept: (products: ParsedPlayStationProduct[]) => R | null,
  options?: StoreRequestOptions,
): Promise<PsCandidateSearch<R>> {
  let firstProducts: ParsedPlayStationProduct[] = [];
  let sawEmptyLinks = false;
  const result = await firstResult(terms, async (term) => {
    try {
      const payload = await fetchPsJson(psSearchUrl(term), options);
      const products = parsePlayStationChihiroResponse(payload, getPsPathLocale());
      if (products.length > 0 && firstProducts.length === 0) firstProducts = products;
      const accepted = products.length > 0 ? accept(products) : null;
      if (accepted === null && hasLinksArray(payload)) sawEmptyLinks = true;
      return accepted;
    } catch (error) {
      if (options?.signal?.aborted) throw error;
      return null;
    }
  });
  return { result, firstProducts, sawEmptyLinks };
}

async function fetchPsSearchProducts(
  query: string,
  options?: StoreRequestOptions,
): Promise<ParsedPlayStationProduct[]> {
  const { result, sawEmptyLinks } = await searchPsCandidates(
    getPsSearchQueryCandidates(query),
    (products) => products,
    options,
  );
  if (result) return result;
  if (sawEmptyLinks) return [];

  try {
    const html = await fetchPsHtml(psLegacySearchUrl(query), options);
    return parsePlayStationSearchHtml(html, getPsPathLocale());
  } catch (error) {
    if (options?.signal?.aborted) throw error;
    return [];
  }
}

async function fetchPsDetailProduct(
  productId: string,
  options?: StoreRequestOptions,
): Promise<ParsedPlayStationProduct | null> {
  let catalogProduct: ParsedPlayStationProduct | null = null;
  try {
    const payload = await fetchPsJson(psProductUrl(productId), options);
    catalogProduct = parsePlayStationChihiroResponse(payload, getPsPathLocale(), true)[0] ?? null;
    if (catalogProduct && !isUnavailablePrice(catalogProduct.price)) return catalogProduct;
  } catch (error) {
    if (options?.signal?.aborted) throw error;
  }

  // Keep known game metadata when the price fallback is unavailable, so the
  // detail flow can still look up prices from the other stores.
  try {
    const html = await fetchPsHtml(psLegacyProductUrl(productId), options);
    return parsePlayStationProductHtml(html, productId, getPsPathLocale()) ?? catalogProduct;
  } catch (error) {
    if (options?.signal?.aborted || !catalogProduct) throw error;
    return catalogProduct;
  }
}

export async function searchPlayStation(
  query: string,
  options?: StoreRequestOptions,
): Promise<PlatformSearchHit[]> {
  if (!getPsCurrency()) return [];
  const products = await fetchPsSearchProducts(query, options);
  return products
    .filter((product) => product.id && product.title)
    .slice(0, 12)
    .map(productToHit);
}

async function ignoreUnlessAborted<T>(request: Promise<T>, signal: AbortSignal | undefined): Promise<T | null> {
  try {
    return await request;
  } catch (error) {
    if (signal?.aborted) throw error;
    return null;
  }
}

/** Chihiro search, then the legacy HTML search, then a looser pick among the first results. */
async function findPlayStationMatch(
  lookupTitle: string,
  matchTitle: string,
  options?: StoreRequestOptions,
): Promise<ParsedPlayStationProduct | null> {
  const pick = (products: ParsedPlayStationProduct[]) => pickBestAvailablePlayStationProduct(products, matchTitle);
  const search = await searchPsCandidates(getPsSearchQueryCandidates(lookupTitle), pick, options);
  if (search.result) return search.result;

  if (!search.sawEmptyLinks) {
    const html = await ignoreUnlessAborted(fetchPsHtml(psLegacySearchUrl(lookupTitle), options), options?.signal);
    const legacyMatch = html === null ? null : pick(parsePlayStationSearchHtml(html, getPsPathLocale()));
    if (legacyMatch) return legacyMatch;
  }
  return search.firstProducts.length > 0 ? pick(search.firstProducts) : null;
}

/** Search results can lack a price; the product page usually has it. */
async function withKnownPrice(
  product: ParsedPlayStationProduct,
  options?: StoreRequestOptions,
): Promise<ParsedPlayStationProduct> {
  if (!isUnavailablePrice(product.price)) return product;
  const detailed = await ignoreUnlessAborted(fetchPsDetailProduct(product.id, options), options?.signal);
  return detailed && !isUnavailablePrice(detailed.price) ? detailed : product;
}

export async function fetchPlayStationPrice(
  lookupTitle: string,
  matchTitle: string = lookupTitle,
  options?: StoreRequestOptions,
): Promise<PlatformPriceResult | null> {
  if (!getPsCurrency()) return null;
  const match = await findPlayStationMatch(lookupTitle, matchTitle, options);
  if (!match) return null;

  const product = await localizePsProduct(await withKnownPrice(match, options), options?.signal);
  if (isUnavailablePrice(product.price)) return null;
  return {
    platform: 'PlayStation',
    price: product.price,
    original_price: product.original_price,
    discount: product.discount,
    tier: 'console',
    store_url: product.store_url,
  };
}

const PS_GRAPHQL_URL = 'https://web.np.playstation.com/api/graphql/v1/op';
/** The store's own "All Deals" category; the id is shared by every region. */
const PS_ALL_DEALS_CATEGORY_ID = '3f772501-f6f8-49b7-abac-874a88ca4897';
const PS_CATEGORY_GRID_QUERY_HASH = '4ce7d410a4db2c8b635a48c1dcec375906ff63b19dadd87e073f8fd0c0481d35';
const PS_DEAL_IMAGE_ROLES = ['MASTER', 'GAMEHUB_COVER_ART', 'EDITION_KEY_ART'];

interface PsGridProduct {
  id?: string;
  name?: string;
  media?: { role?: string; type?: string; url?: string }[];
  price?: { basePrice?: string; discountedPrice?: string; discountText?: string; isFree?: boolean };
}

interface PsCategoryGridResponse {
  data?: { categoryGridRetrieve?: { products?: PsGridProduct[] } | null };
}

function psDealsUrl(limit: number): string {
  const variables = {
    id: PS_ALL_DEALS_CATEGORY_ID,
    pageArgs: { size: limit, offset: 0 },
    sortBy: null,
    filterBy: [],
    facetOptions: [],
  };
  const extensions = { persistedQuery: { version: 1, sha256Hash: PS_CATEGORY_GRID_QUERY_HASH } };
  return `${PS_GRAPHQL_URL}?operationName=categoryGridRetrieve&variables=${encodeURIComponent(JSON.stringify(variables))}&extensions=${encodeURIComponent(JSON.stringify(extensions))}`;
}

function psDealImage(product: PsGridProduct): string {
  const imagesByRole = new Map<string, string>();
  for (const media of product.media ?? []) {
    if (media.type === 'IMAGE' && media.role && media.url && !imagesByRole.has(media.role)) {
      imagesByRole.set(media.role, media.url);
    }
  }
  return PS_DEAL_IMAGE_ROLES.map((role) => imagesByRole.get(role)).find(Boolean) ?? '';
}

/** Games in the PlayStation Store's "All Deals" category for the selected country. */
export async function fetchPlayStationDeals(
  limit: number,
  options?: StoreRequestOptions,
): Promise<LiveGame[]> {
  const currency = getPsCurrency();
  if (!currency) return [];
  const pathLocale = getPsPathLocale();
  const [language = 'en', country = 'us'] = pathLocale.split('-');
  const data = await withRetry(
    () =>
      fetchJson<PsCategoryGridResponse>(
        psDealsUrl(limit),
        {
          headers: {
            Accept: 'application/json',
            Referer: 'https://store.playstation.com/',
            'Content-Type': 'application/json',
            'x-psn-store-locale-override': `${language}-${country.toUpperCase()}`,
          },
          signal: options?.signal,
        },
        STORE_CONFIG.timeout.long,
      ),
    0,
    options?.signal,
  );

  const games = await Promise.all(
    (data.data?.categoryGridRetrieve?.products ?? []).map(async (product) => {
      const discounted = product.price?.discountedPrice?.replaceAll('\u00a0', ' ');
      const base = product.price?.basePrice?.replaceAll('\u00a0', ' ');
      const percent = product.price?.discountText?.replaceAll(/\D/g, '');
      if (!product.id || !product.name || !discounted || !percent || product.price?.isFree) return null;
      const storeUrl = getPlayStationStoreUrl(product.id, pathLocale);
      return liveGameWithDeal(
        {
          id: `ps-${product.id}`,
          slug: `ps-${product.id}`,
          title: product.name,
          image_url: psDealImage(product),
          platform: 'PlayStation',
          store_url: storeUrl,
        },
        {
          platform: 'PlayStation',
          price: currency === 'TRY' ? discounted : await psPriceToTry(discounted, currency, options?.signal),
          original_price:
            base && currency !== 'TRY' ? await psPriceToTry(base, currency, options?.signal) : base ?? null,
          discount: `-${percent}%`,
          store_url: storeUrl,
          tier: 'console',
        },
      );
    }),
  );
  return games.flatMap((game) => (game && !isUnavailablePrice(game.price) ? [game] : []));
}

export async function fetchPlayStationDetails(
  slug: string,
  options?: StoreRequestOptions,
): Promise<LiveGame | null> {
  if (!getPsCurrency()) return null;
  const cleanId = slug.replace(/^ps-/, '').replace(/-E\d+$/i, '');
  const detail = await fetchPsDetailProduct(cleanId, options);
  if (!detail?.title) return null;
  const parsed = await localizePsProduct(detail, options?.signal);

  const game: LiveGame = {
    id: `ps-${parsed.id}`,
    slug: `ps-${parsed.id}`,
    title: parsed.title,
    image_url: parsed.image_url,
    platform: 'PlayStation',
    source_platform: 'PlayStation',
    price: parsed.price,
    discount: parsed.discount,
    rating: null,
    store_links: {
      PlayStation: parsed.store_url,
    },
  };

  if (parsed.description) game.description = parsed.description;
  if (parsed.original_price) game.original_price = parsed.original_price;
  if (parsed.release_date) game.release_date = parsed.release_date;
  if (parsed.developers) game.developers = parsed.developers;
  if (parsed.genres) game.genres = parsed.genres;
  if (parsed.platforms) game.platforms = parsed.platforms;
  if (parsed.screenshots) game.screenshots = parsed.screenshots;
  if (parsed.videos) game.videos = parsed.videos;
  if (parsed.price && !isUnavailablePrice(parsed.price)) {
    game.deals = [
      platformPriceToGameDeal({
        platform: 'PlayStation',
        price: parsed.price,
        original_price: parsed.original_price,
        discount: parsed.discount,
        store_url: parsed.store_url,
        tier: 'console',
      }),
    ];
  }
  return game;
}
