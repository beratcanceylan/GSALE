import { STORE_CONFIG, getStoreCountryConfig } from '@/services/store/config';
import { liveGameWithDeal, platformPriceToGameDeal } from '@/services/store/deals';
import { formatPriceAsTry } from '@/services/store/currency';
import { acceptEditionCandidate, MAX_EDITION_CANDIDATES, type EditionOffer } from '@/services/store/edition-table';
import { baseTitle } from '@/services/store/editions';
import { fetchJson, fetchPostJson, fetchText, throwIfAborted, withRetry } from '@/services/store/fetch';
import { firstResult } from '@/services/store/sequence';
import { pickXboxSearchImage } from '@/services/store/platforms/xbox-image';
import { xboxMetadataFromProduct } from '@/services/store/platforms/xbox-metadata';
import { getXboxListPrice, type XboxSelectedPrice } from '@/services/store/platforms/xbox-price';
import {
  parseXboxAutosuggestProductIds,
  parseXboxSearchProductIds,
} from '@/services/store/platforms/xbox-search';
import type {
  LiveGame,
  PlatformPriceResult,
  PlatformSearchHit,
  StoreRequestOptions,
} from '@/services/store/types';

interface XboxImage {
  ImagePurpose?: string;
  Uri?: string;
  Width?: number;
}

interface XboxLocalizedProperties {
  ProductTitle?: string;
  Images?: XboxImage[];
}

interface XboxDisplayProduct {
  ProductId?: string;
  LocalizedProperties?: XboxLocalizedProperties[];
  DisplaySkuAvailabilities?: {
    Availabilities?: {
      OrderManagementData?: { Price?: { CurrencyCode?: string; ListPrice?: number; MSRP?: number } };
    }[];
  }[];
}

interface XboxDisplayResponse {
  Products?: XboxDisplayProduct[];
}

type XboxSearchProduct = Readonly<{
  hit: PlatformSearchHit;
  product: XboxDisplayProduct;
}>;

function xboxMarket(): Readonly<{ market: string; language: string }> {
  const { code, storeLocale } = getStoreCountryConfig();
  return { market: code, language: `${storeLocale.slice(0, 2)}-${code}` };
}

function xboxStoreUrl(productId: string): string {
  return `https://www.xbox.com/${getStoreCountryConfig().storeLocale}/games/store/${productId}`;
}

function xboxCatalogUrl(bigIds: string, fieldsTemplate = 'details'): string {
  const { market, language } = xboxMarket();
  return `https://displaycatalog.mp.microsoft.com/v7.0/products?market=${market}&languages=${language}&bigIds=${encodeURIComponent(bigIds)}&fieldsTemplate=${encodeURIComponent(fieldsTemplate)}`;
}

function xboxAutosuggestUrl(query: string): string {
  const { market, language } = xboxMarket();
  const params = new URLSearchParams({
    languages: language,
    market,
    platformdependencyname: 'windows.xbox',
    productFamilyNames: 'Games,Apps',
    query,
  });
  return `https://displaycatalog.mp.microsoft.com/v7.0/productFamilies/autosuggest?${params.toString()}`;
}

function xboxQueryVariants(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length <= 4) return [trimmed];
  return [trimmed, words.slice(0, 4).join(' ')];
}

function getXboxTitle(product: XboxDisplayProduct): string {
  return product.LocalizedProperties?.[0]?.ProductTitle?.trim() || '';
}

function xboxProductToHit(product: XboxDisplayProduct): PlatformSearchHit | null {
  if (!product.ProductId) return null;
  const title = getXboxTitle(product);
  if (!title) return null;
  return {
    id: `xbox-${product.ProductId}`,
    slug: `xbox-${product.ProductId}`,
    title,
    image_url: pickXboxSearchImage(product),
    platform: 'Xbox',
    store_url: xboxStoreUrl(product.ProductId),
  };
}

async function searchXboxProductIds(
  query: string,
  options?: StoreRequestOptions,
): Promise<string[]> {
  const autosuggest: { succeeded: boolean } = { succeeded: false };
  const suggested = await firstResult(xboxQueryVariants(query), async (variant) => {
    try {
      const payload = await withRetry(
        () => fetchJson<unknown>(xboxAutosuggestUrl(variant), { signal: options?.signal }),
        0,
        options?.signal,
      );
      autosuggest.succeeded = true;
      const ids = parseXboxAutosuggestProductIds(payload);
      return ids.length > 0 ? ids : null;
    } catch (error) {
      if (options?.signal?.aborted) throw error;
      return null;
    }
  });
  if (suggested) return suggested;

  // A valid empty autosuggest response means the catalog has no candidates.
  // Avoid downloading the much heavier HTML shell in that normal case. Keep
  // the HTML parser as a resilience fallback when the catalog endpoint fails.
  if (autosuggest.succeeded) return [];

  const url = `https://www.xbox.com/${getStoreCountryConfig().storeLocale}/search?q=${encodeURIComponent(query)}`;
  const html = await withRetry(
    () => fetchText(url, { headers: { Referer: 'https://www.xbox.com/' }, signal: options?.signal }, STORE_CONFIG.timeout.long),
    0,
    options?.signal,
  );
  return parseXboxSearchProductIds(html);
}

async function fetchXboxCatalogProducts(
  bigIds: string[],
  options?: StoreRequestOptions,
  fieldsTemplate = 'details',
): Promise<XboxDisplayProduct[]> {
  if (bigIds.length === 0) return [];
  const catalog = await withRetry(
      () => fetchJson<XboxDisplayResponse>(xboxCatalogUrl(bigIds.join(','), fieldsTemplate), { signal: options?.signal }),
    0,
    options?.signal,
  );
  const order = new Map(bigIds.map((id, index) => [id, index]));
  return (catalog.Products ?? []).slice().sort((a, b) => {
    const aOrder = order.get(a.ProductId ?? '') ?? Number.MAX_SAFE_INTEGER;
    const bOrder = order.get(b.ProductId ?? '') ?? Number.MAX_SAFE_INTEGER;
    return aOrder - bOrder;
  });
}

async function searchXboxProducts(
  query: string,
  options?: StoreRequestOptions,
): Promise<XboxSearchProduct[]> {
  const ids = await searchXboxProductIds(query, options);
  if (ids.length === 0) return [];

  const products = await fetchXboxCatalogProducts(ids, options, 'browse');
  return products.flatMap((product) => {
    const hit = xboxProductToHit(product);
    return hit ? [{ hit, product }] : [];
  });
}

export async function searchXbox(
  query: string,
  options?: StoreRequestOptions,
): Promise<PlatformSearchHit[]> {
  const products = await searchXboxProducts(query, options);
  return products.map(({ hit }) => hit);
}

async function fetchXboxProduct(
  productId: string,
  options?: StoreRequestOptions,
): Promise<XboxDisplayProduct | null> {
  const cleanId = productId.replace(/^xbox-/, '');
  if (!/^[A-Za-z0-9-]+$/.test(cleanId)) return null;
  const products = await fetchXboxCatalogProducts([cleanId], options);
  return products[0] ?? null;
}

async function xboxPriceFromSelected(
  prices: XboxSelectedPrice,
  storeUrl: string | undefined,
  signal?: StoreRequestOptions['signal'],
): Promise<PlatformPriceResult> {
  const result: PlatformPriceResult = {
    platform: 'Xbox',
    price: prices.isFree ? 'Ücretsiz' : 'Bilinmiyor',
    original_price: null,
    discount: '',
    tier: 'console',
  };
  if (storeUrl) result.store_url = storeUrl;

  if (prices.isFree) return result;

  // A price without a currency is the market's own (TRY in Türkiye).
  const currency = prices.currency ?? 'TRY';
  result.price = await formatPriceAsTry(prices.list, currency, signal);
  if (prices.msrp > prices.list) {
    result.original_price = await formatPriceAsTry(prices.msrp, currency, signal);
    result.discount = `-${Math.round((1 - prices.list / prices.msrp) * 100)}%`;
  }
  return result;
}


const PC_ONLY_TITLE = /\(\s*PC\s*\)/i;

/** Every edition of `title`'s game on Xbox, from one search with the base title; console listings win over "(PC)" twins. */
export async function fetchXboxEditionOffers(
  title: string,
  options?: StoreRequestOptions,
): Promise<EditionOffer[]> {
  const products = await searchXboxProducts(baseTitle(title), options);
  throwIfAborted(options?.signal);
  const accepted = products.flatMap(({ hit, product }) => {
    const edition = acceptEditionCandidate(hit.title, title);
    const prices = getXboxListPrice(product);
    return edition && prices ? [{ hit, edition, prices }] : [];
  });
  const consoleEditions = new Set(accepted.filter(({ hit }) => !PC_ONLY_TITLE.test(hit.title)).map(({ edition }) => edition));
  const preferred = accepted
    .filter(({ hit, edition }) => !PC_ONLY_TITLE.test(hit.title) || !consoleEditions.has(edition))
    .slice(0, MAX_EDITION_CANDIDATES);

  const offers = await Promise.all(preferred.map(async ({ hit, edition, prices }): Promise<EditionOffer> => ({
    platform: 'Xbox',
    edition,
    title: hit.title,
    id: hit.id,
    price: await xboxPriceFromSelected(prices, hit.store_url, options?.signal),
  })));
  throwIfAborted(options?.signal);
  return offers;
}

const XBOX_BROWSE_URL = 'https://emerald.xboxservices.com/xboxcomfd/browse';
const XBOX_DEALS_CHANNEL = 'DynamicChannel.GameDeals';

interface XboxBrowseResponse {
  channels?: Record<string, { products?: { productId?: string }[] }>;
}

/** Product ids of xbox.com's "Game Deals" channel for the selected market. */
async function fetchXboxDealIds(options?: StoreRequestOptions): Promise<string[]> {
  const { language } = xboxMarket();
  const data = await withRetry(
    () =>
      fetchPostJson<XboxBrowseResponse>(
        `${XBOX_BROWSE_URL}?locale=${encodeURIComponent(language)}`,
        {
          Filters: 'e30=',
          ReturnFilters: false,
          ChannelKeyToBeUsedInResponse: 'GameDeals',
          ChannelId: XBOX_DEALS_CHANNEL,
        },
        {
          'x-ms-api-version': '1.1',
          'MS-CV': 'gsale.0',
          Referer: 'https://www.xbox.com/',
        },
        STORE_CONFIG.timeout.long,
        options?.signal,
      ),
    0,
    options?.signal,
  );
  return (data.channels?.['GameDeals']?.products ?? []).flatMap((product) =>
    product.productId ? [product.productId] : [],
  );
}

export async function fetchXboxDeals(
  limit: number,
  options?: StoreRequestOptions,
): Promise<LiveGame[]> {
  const ids = (await fetchXboxDealIds(options)).slice(0, limit);
  const products = await fetchXboxCatalogProducts(ids, options);
  const games = await Promise.all(products.map(async (product) => {
    const hit = xboxProductToHit(product);
    const selected = getXboxListPrice(product);
    if (!hit || !selected || selected.isFree) return null;
    const price = await xboxPriceFromSelected(selected, hit.store_url, options?.signal);
    return price.discount ? liveGameWithDeal(hit, price) : null;
  }));
  return games.flatMap((game) => (game ? [game] : []));
}

export async function fetchXboxDetails(
  slug: string,
  options?: StoreRequestOptions,
): Promise<LiveGame | null> {
  const product = await fetchXboxProduct(slug, options);
  const title = product ? getXboxTitle(product) : '';
  if (!product || !title) return null;
  const id = product.ProductId || slug.replace(/^xbox-/, '');
  const sourcePrice = getXboxListPrice(product);
  const deal = sourcePrice
    ? platformPriceToGameDeal(
        await xboxPriceFromSelected(
          sourcePrice,
          xboxStoreUrl(id),
          options?.signal,
        ),
      )
    : null;

  return {
    id: `xbox-${id}`,
    slug: `xbox-${id}`,
    title,
    image_url: pickXboxSearchImage(product),
    platform: 'Xbox',
    source_platform: 'Xbox',
    ...xboxMetadataFromProduct(product),
    rating: null,
    store_links: { Xbox: xboxStoreUrl(id) },
    ...(deal ? { deals: [deal] } : {}),
  };
}
