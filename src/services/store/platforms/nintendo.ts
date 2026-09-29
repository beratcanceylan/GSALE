import { STORE_CONFIG } from '@/services/store/config';
import { formatPriceAsTry } from '@/services/store/currency';
import { liveGameWithDeal, platformPriceToGameDeal } from '@/services/store/deals';
import { fetchJson, fetchPostJson, withRetry } from '@/services/store/fetch';
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

export async function searchNintendo(
  query: string,
  options?: StoreRequestOptions,
): Promise<PlatformSearchHit[]> {
  const products = await searchNintendoProducts(query, options);
  return products.flatMap((product) => (product.title && product.image_url ? [productToHit(product)] : []));
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
    products.map(async (product) => {
      if (product.is_add_on) return null;
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
