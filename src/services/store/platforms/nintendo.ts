import { STORE_CONFIG } from '@/services/store/config';
import { formatPriceAsTry } from '@/services/store/currency';
import { liveGameWithDeal, platformPriceToGameDeal } from '@/services/store/deals';
import { fetchJson, fetchPostJson, withRetry } from '@/services/store/fetch';
import { getPriceLookupTitles } from '@/services/store/match';
import {
  parseNintendoProduct,
  parseNintendoSearchResponse,
  pickBestNintendoProduct,
  type ParsedNintendoProduct,
} from '@/services/store/platforms/nintendo-parse';
import type {
  LiveGame,
  PlatformPriceResult,
  PlatformSearchHit,
  StoreRequestOptions,
} from '@/services/store/types';

const NINTENDO_ALGOLIA_APP_ID = 'U3B6GR4UA3';
const NINTENDO_ALGOLIA_KEY = 'a29c6927638bfd8cee23993e51e721c9';
const NINTENDO_INDEX = 'store_game_en_us';
const NINTENDO_ALGOLIA_SEARCH_URL =
  `https://${NINTENDO_ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/${NINTENDO_INDEX}/query`;
const NINTENDO_ALGOLIA_MULTI_SEARCH_URL =
  `https://${NINTENDO_ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/*/queries`;
const NINTENDO_ALGOLIA_OBJECT_URL =
  `https://${NINTENDO_ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/${NINTENDO_INDEX}`;

function nintendoHeaders(): Record<string, string> {
  return {
    'X-Algolia-Application-Id': NINTENDO_ALGOLIA_APP_ID,
    'X-Algolia-API-Key': NINTENDO_ALGOLIA_KEY,
  };
}

const NINTENDO_ATTRIBUTES = [
  'objectID',
  'nsuid',
  'sku',
  'title',
  'description',
  'url',
  'productImageSquare',
  'productImage',
  'platform',
  'corePlatforms',
  'releaseDate',
  'price',
  'eshopDetails',
  'gameGenreLabels',
  'genres',
  'softwareDeveloper',
  'softwarePublisher',
  'productType',
  'dlcType',
];

async function queryNintendoProducts(
  body: Readonly<Record<string, unknown>>,
  options?: StoreRequestOptions,
): Promise<ParsedNintendoProduct[]> {
  const payload = await withRetry(
    () =>
      fetchPostJson<unknown>(
        NINTENDO_ALGOLIA_SEARCH_URL,
        { ...body, attributesToRetrieve: NINTENDO_ATTRIBUTES },
        nintendoHeaders(),
        STORE_CONFIG.timeout.long,
        options?.signal,
      ),
    0,
    options?.signal,
  );
  return parseNintendoSearchResponse(payload);
}

async function searchNintendoProducts(
  query: string,
  options?: StoreRequestOptions,
): Promise<ParsedNintendoProduct[]> {
  return queryNintendoProducts({ query: query.trim(), page: 0, hitsPerPage: 12 }, options);
}

async function fetchNintendoProduct(
  id: string,
  options?: StoreRequestOptions,
): Promise<ParsedNintendoProduct | null> {
  const payload = await withRetry(
    () =>
      fetchJson<unknown>(
        `${NINTENDO_ALGOLIA_OBJECT_URL}/${encodeURIComponent(id)}`,
        { headers: nintendoHeaders(), signal: options?.signal },
        STORE_CONFIG.timeout.long,
      ),
    0,
    options?.signal,
  );
  return parseNintendoProduct(payload);
}

function productToHit(product: ParsedNintendoProduct): PlatformSearchHit {
  return {
    id: `nintendo-${product.id}`,
    slug: `nintendo-${product.id}`,
    title: product.title,
    image_url: product.image_url,
    platform: 'Nintendo',
    store_url: product.store_url,
  };
}

async function productToPriceResult(
  product: ParsedNintendoProduct,
  signal?: StoreRequestOptions['signal'],
): Promise<PlatformPriceResult | null> {
  if (product.price === null || !Number.isFinite(product.price)) return null;
  const price =
    product.price <= 0
      ? 'Ücretsiz'
      : await formatPriceAsTry(product.price, product.currency, signal);
  const original_price =
    product.original_price !== null && product.original_price > product.price
      ? await formatPriceAsTry(product.original_price, product.currency, signal)
      : null;
  return {
    platform: 'Nintendo',
    price,
    original_price,
    discount: product.discount,
    tier: 'console',
    ...(product.store_url ? { store_url: product.store_url } : {}),
  };
}

/**
 * Resolve the home list's Nintendo prices with Algolia's multi-query endpoint.
 * One request can carry all title searches, while the standalone path above
 * remains available for search/detail screens and preserves its fallback.
 */
export async function fetchNintendoPrices(
  titles: readonly string[],
  options?: StoreRequestOptions,
): Promise<Map<string, PlatformPriceResult | null>> {
  const groupedQueries = new Map<string, string[]>();
  for (const title of titles) {
    const variants = getPriceLookupTitles(title);
    for (const query of variants.length > 0 ? variants : [title]) {
      const key = query.toLowerCase();
      const owners = groupedQueries.get(key) ?? [];
      if (!owners.includes(title)) owners.push(title);
      groupedQueries.set(key, owners);
    }
  }
  if (groupedQueries.size === 0) return new Map();

  const queries = [...groupedQueries.keys()];
  const resultsByTitle = new Map<string, ParsedNintendoProduct[]>();
  // Algolia accepts up to 50 requests in one multi-query payload. Keep the
  // chunks bounded without changing the app's per-store concurrency setting.
  for (let offset = 0; offset < queries.length; offset += 50) {
    const chunk = queries.slice(offset, offset + 50);
    const payload = await withRetry(
      () =>
        fetchPostJson<unknown>(
          NINTENDO_ALGOLIA_MULTI_SEARCH_URL,
          {
            requests: chunk.map((query) => ({
              indexName: NINTENDO_INDEX,
              params: `query=${encodeURIComponent(query)}&hitsPerPage=12&page=0`,
            })),
          },
          nintendoHeaders(),
          STORE_CONFIG.timeout.long,
          options?.signal,
        ),
      0,
      options?.signal,
    );
    const results =
      typeof payload === 'object' && payload !== null && Array.isArray((payload as { results?: unknown[] }).results)
        ? (payload as { results: unknown[] }).results
        : [];
    for (let index = 0; index < chunk.length; index += 1) {
      const products = parseNintendoSearchResponse(results[index]);
      for (const title of groupedQueries.get(chunk[index] ?? '') ?? []) {
        const current = resultsByTitle.get(title) ?? [];
        current.push(...products);
        resultsByTitle.set(title, current);
      }
    }
  }

  const output = new Map<string, PlatformPriceResult | null>();
  for (const title of titles) {
    const match = pickBestNintendoProduct(resultsByTitle.get(title) ?? [], title);
    output.set(title, match ? await productToPriceResult(match, options?.signal) : null);
  }
  return output;
}

export async function searchNintendo(
  query: string,
  options?: StoreRequestOptions,
): Promise<PlatformSearchHit[]> {
  const products = await searchNintendoProducts(query, options);
  return products
    .filter((product) => product.title && product.image_url)
    .map(productToHit);
}

/** Discounted games from the US eShop "Deals" filter. */
export async function fetchNintendoDeals(
  limit: number,
  options?: StoreRequestOptions,
): Promise<LiveGame[]> {
  const products = await queryNintendoProducts(
    { query: '', page: 0, hitsPerPage: limit, filters: 'topLevelFilters:"Deals"' },
    options,
  );
  const games = await Promise.all(
    products
      .filter((product) => !product.is_add_on)
      .map(async (product) => {
        const price = await productToPriceResult(product, options?.signal);
        return price?.discount ? liveGameWithDeal(productToHit(product), price) : null;
      }),
  );
  return games.flatMap((game) => (game ? [game] : []));
}

export async function fetchNintendoPrice(
  lookupTitle: string,
  matchTitle: string = lookupTitle,
  options?: StoreRequestOptions,
): Promise<PlatformPriceResult | null> {
  const products = await searchNintendoProducts(lookupTitle, options);
  const match = pickBestNintendoProduct(products, matchTitle);
  return match ? productToPriceResult(match, options?.signal) : null;
}

export async function fetchNintendoDetails(
  slug: string,
  options?: StoreRequestOptions,
): Promise<LiveGame | null> {
  const cleanId = slug.replace(/^nintendo-/, '');
  const product = await fetchNintendoProduct(cleanId, options);
  if (!product?.title) return null;

  const storeUrl = product.store_url || `https://www.nintendo.com/us/store/products/${cleanId}/`;
  const game: LiveGame = {
    id: `nintendo-${product.id}`,
    slug: `nintendo-${product.id}`,
    title: product.title,
    image_url: product.image_url,
    platform: 'Nintendo',
    source_platform: 'Nintendo',
    rating: null,
    store_links: { Nintendo: storeUrl },
    platforms: [product.platform || 'Nintendo Switch'],
  };
  if (product.description) game.description = product.description;
  if (product.release_date) game.release_date = product.release_date;
  if (product.developers) game.developers = product.developers;
  if (product.genres) game.genres = product.genres;

  const sourcePrice = await productToPriceResult(product, options?.signal);
  if (sourcePrice) game.deals = [platformPriceToGameDeal(sourcePrice)];
  return game;
}
