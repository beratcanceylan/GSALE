import { getStoreCountry } from '@/services/store/config';
import { liveGameWithDeal, platformPriceToGameDeal } from '@/services/store/deals';
import { fetchJson, withRetry } from '@/services/store/fetch';
import { pickBestTitleMatch } from '@/services/store/match';
import { isUnavailablePrice } from '@/services/store/price-parse';
import {
  gogImage,
  gogMetadataFromProduct,
  pickGogProductById,
  gogPriceFromProduct,
  type GogExpandedProduct,
  type GogProduct,
} from '@/services/store/platforms/gog-price';
import type {
  LiveGame,
  PlatformPriceResult,
  PlatformSearchHit,
  StoreRequestOptions,
} from '@/services/store/types';

/** GOG catalog search works with en-US; tr-TR returns zero products. */
const GOG_CATALOG_LOCALE = 'en-US';

interface GogCatalogResponse {
  products?: GogProduct[];
}

function gogCatalogUrl(query: string, limit: number): string {
  const params = new URLSearchParams({
    query,
    order: 'desc:score',
    limit: String(limit),
    countryCode: getStoreCountry(),
    locale: GOG_CATALOG_LOCALE,
  });
  return `https://catalog.gog.com/v1/catalog?${params.toString()}`;
}

async function fetchGogCatalog(
  query: string,
  limit: number,
  options?: StoreRequestOptions,
): Promise<GogProduct[]> {
  const data = await withRetry(
    () => fetchJson<GogCatalogResponse>(gogCatalogUrl(query, limit), { signal: options?.signal }),
    0,
    options?.signal,
  );
  return data.products ?? [];
}

function uniqueQueries(values: (string | undefined)[]): string[] {
  const seen = new Set<string>();
  return values.flatMap((value) => {
    const query = value?.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!query || seen.has(query.toLowerCase())) return [];
    seen.add(query.toLowerCase());
    return [query];
  });
}

function gogExpandedImage(expanded: GogExpandedProduct | null): string {
  const images = expanded?.images;
  if (!images) return '';
  const image =
    images['productCard'] ||
    images['product_card'] ||
    images['logo2x'] ||
    images['logo'] ||
    images['background'] ||
    images['menuNotificationAv2'] ||
    images['menuNotificationAv'] ||
    '';
  return image.startsWith('//') ? `https:${image}` : image;
}

function gogProductFromExpanded(id: string, expanded: GogExpandedProduct): GogProduct {
  const numericId = Number.parseInt(String(expanded.id ?? id), 10);
  return {
    id: Number.isFinite(numericId) ? numericId : 0,
    title: expanded.title || expanded.slug?.replace(/[_-]+/g, ' ') || `GOG ${id}`,
    slug: expanded.slug || id,
    coverHorizontal: gogExpandedImage(expanded),
  };
}

async function fetchGogExpandedProduct(
  id: string,
  options?: StoreRequestOptions,
): Promise<GogExpandedProduct | null> {
  if (!/^\d+$/.test(id)) return null;
  try {
    return await withRetry(
      () =>
        fetchJson<GogExpandedProduct>(
          `https://api.gog.com/products/${encodeURIComponent(id)}?expand=description,screenshots,videos`,
          { signal: options?.signal },
        ),
      0,
      options?.signal,
    );
  } catch (error) {
    if (options?.signal?.aborted) throw error;
    return null;
  }
}

async function fetchGogCatalogProductById(
  id: string,
  expanded: GogExpandedProduct,
  options?: StoreRequestOptions,
): Promise<GogProduct | null> {
  const queries = uniqueQueries([expanded.title, expanded.slug]);

  for (const query of queries) {
    try {
      const products = await fetchGogCatalog(query, 20, options);
      const product = pickGogProductById(products, id);
      if (product) return product;
    } catch (error) {
      if (options?.signal?.aborted) throw error;
      // Try the next query; expanded product data can still populate the detail page.
    }
  }

  return null;
}

function gogProductToHit(product: GogProduct): PlatformSearchHit {
  return {
    id: `gog-${product.id}`,
    slug: `gog-${product.id}`,
    title: product.title,
    image_url: gogImage(product),
    platform: 'GOG',
    store_url: product.storeLink || `https://www.gog.com/game/${product.slug}`,
  };
}

export async function searchGog(
  query: string,
  options?: StoreRequestOptions,
): Promise<PlatformSearchHit[]> {
  const products = await fetchGogCatalog(query, 12, options);
  return products.map(gogProductToHit);
}

/** Trending discounted games from the GOG catalog for the selected country. */
export async function fetchGogDeals(
  limit: number,
  options?: StoreRequestOptions,
): Promise<LiveGame[]> {
  const params = new URLSearchParams({
    order: 'desc:trending',
    discounted: 'eq:true',
    productType: 'in:game,pack',
    limit: String(limit),
    countryCode: getStoreCountry(),
    locale: GOG_CATALOG_LOCALE,
  });
  const data = await withRetry(
    () => fetchJson<GogCatalogResponse>(`https://catalog.gog.com/v1/catalog?${params.toString()}`, { signal: options?.signal }),
    0,
    options?.signal,
  );
  const games = await Promise.all((data.products ?? []).map(async (product) => {
    const hit = gogProductToHit(product);
    const priced = await gogPriceFromProduct(product, options?.signal);
    if (!priced.discount) return null;
    return liveGameWithDeal(hit, {
      platform: 'GOG',
      price: priced.price,
      original_price: priced.original_price,
      discount: priced.discount,
      tier: 'pc',
      ...(hit.store_url ? { store_url: hit.store_url } : {}),
    });
  }));
  return games.flatMap((game) => (game ? [game] : []));
}

export async function fetchGogPrice(
  lookupTitle: string,
  matchTitle: string = lookupTitle,
  options?: StoreRequestOptions,
): Promise<PlatformPriceResult | null> {
  const products = await fetchGogCatalog(lookupTitle, 12, options);
  const match = pickBestTitleMatch(products, matchTitle, (product) => product.title);
  if (!match) return null;

  const priced = await gogPriceFromProduct(match, options?.signal);

  return {
    platform: 'GOG',
    price: priced.price,
    original_price: priced.original_price,
    discount: priced.discount,
    store_url: match.storeLink || `https://www.gog.com/game/${match.slug}`,
    tier: 'pc',
  };
}

export async function fetchGogDetails(
  slug: string,
  options?: StoreRequestOptions,
): Promise<LiveGame | null> {
  const id = slug.replace(/^gog-/, '');
  if (!/^\d+$/.test(id)) return null;
  const expanded = await fetchGogExpandedProduct(id, options);
  if (!expanded) return null;

  const catalogProduct = await fetchGogCatalogProductById(id, expanded, options);
  const product = catalogProduct ?? gogProductFromExpanded(id, expanded);
  const priced = catalogProduct
    ? await gogPriceFromProduct(catalogProduct, options?.signal)
    : { price: 'Bilinmiyor', original_price: null, discount: '' };
  const metadata = gogMetadataFromProduct(product, expanded);

  const game: LiveGame = {
    id: `gog-${product.id}`,
    slug: `gog-${product.id}`,
    title: product.title,
    image_url: gogImage(product),
    platform: 'GOG',
    source_platform: 'GOG',
    price: priced.price,
    discount: priced.discount,
    ...metadata,
    rating: null,
    store_links: {
      GOG: product.storeLink || `https://www.gog.com/game/${product.slug}`,
    },
  };
  if (priced.original_price) game.original_price = priced.original_price;
  if (!isUnavailablePrice(priced.price)) {
    game.deals = [
      platformPriceToGameDeal({
        platform: 'GOG',
        price: priced.price,
        original_price: priced.original_price,
        discount: priced.discount,
        store_url: product.storeLink || `https://www.gog.com/game/${product.slug}`,
        tier: 'pc',
      }),
    ];
  }
  return game;
}
