import { STORE_CONFIG, getSteamLang, getStoreCountry } from '@/services/store/config';
import { fetchJson, withRetry } from '@/services/store/fetch';
import { extractEdition, pickBestTitleMatch } from '@/services/store/match';
import { formatPriceAsTry } from '@/services/store/currency';
import { formatSteamPrice } from '@/services/store/price-parse';
import { platformPriceToGameDeal } from '@/services/store/deals';
import type {
  GameDeal,
  LiveGame,
  PlatformPriceResult,
  PlatformSearchHit,
  StoreRequestOptions,
} from '@/services/store/types';

interface SteamSearchResponse {
  items?: SteamSearchItem[];
}

interface SteamSearchItem {
  id: number;
  name: string;
  tiny_image?: string;
  price?: Partial<SteamPriceOverview>;
}

interface SteamPriceOverview {
  currency?: string;
  final: number;
  initial: number;
  discount_percent: number;
  final_formatted?: string;
  initial_formatted?: string;
}

interface SteamAppData {
  name?: string;
  header_image?: string;
  short_description?: string;
  is_free?: boolean;
  price_overview?: SteamPriceOverview;
  release_date?: { date?: string };
  developers?: string[];
  genres?: { description?: string }[];
  screenshots?: { path_full?: string }[];
  movies?: { id: number; thumbnail?: string; mp4?: { max?: string }; hls_h264?: string }[];
}

interface SteamAppDetailsResponse {
  [key: string]: { success?: boolean; data?: SteamAppData };
}

interface SteamFeaturedItem {
  id: number;
  name: string;
  header_image?: string;
  discount_percent?: number;
  currency?: string;
  original_price?: number;
  final_price?: number;
}

interface SteamFeaturedResponse {
  specials?: { items?: SteamFeaturedItem[] };
  top_sellers?: { items?: SteamFeaturedItem[] };
  new_releases?: { items?: SteamFeaturedItem[] };
}

function steamImage(appId: number | string, tiny?: string): string {
  if (tiny) return tiny.replace('https://steamcdn-a.akamaihd.net', 'https://cdn.akamai.steamstatic.com');
  return `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`;
}

function completeSteamPrice(overview: Partial<SteamPriceOverview>): SteamPriceOverview | null {
  if (typeof overview.final !== 'number' || !Number.isFinite(overview.final)) return null;
  const initial =
    typeof overview.initial === 'number' && Number.isFinite(overview.initial)
      ? overview.initial
      : overview.final;
  const discount =
    typeof overview.discount_percent === 'number' && Number.isFinite(overview.discount_percent)
      ? overview.discount_percent
      : initial > overview.final && initial > 0
        ? Math.round((1 - overview.final / initial) * 100)
        : 0;
  return {
    final: overview.final,
    initial,
    discount_percent: discount,
    ...(overview.currency !== undefined ? { currency: overview.currency } : {}),
    ...(overview.final_formatted !== undefined ? { final_formatted: overview.final_formatted } : {}),
    ...(overview.initial_formatted !== undefined ? { initial_formatted: overview.initial_formatted } : {}),
  };
}

async function steamPriceFromOverview(
  appId: string,
  overview: Partial<SteamPriceOverview>,
  signal?: StoreRequestOptions['signal'],
): Promise<PlatformPriceResult | null> {
  const price = completeSteamPrice(overview);
  if (!price) return null;

  if (price.final <= 0) {
    return {
      platform: 'Steam',
      price: 'Ücretsiz',
      original_price: null,
      discount: '',
      store_url: `https://store.steampowered.com/app/${appId}/`,
      tier: 'pc',
    };
  }

  if (price.currency === 'TRY') {
    const formatted = formatSteamPrice(price);
    return {
      platform: 'Steam',
      price: formatted.price,
      original_price: formatted.original_price,
      discount: price.discount_percent > 0 ? `-${price.discount_percent}%` : '',
      store_url: `https://store.steampowered.com/app/${appId}/`,
      tier: 'pc',
    };
  }

  const finalTry = await formatPriceAsTry(price.final / 100, price.currency, signal);
  const originalTry =
    price.discount_percent > 0
      ? await formatPriceAsTry(price.initial / 100, price.currency, signal)
      : null;
  return {
    platform: 'Steam',
    price: finalTry,
    original_price: originalTry,
    discount: price.discount_percent > 0 ? `-${price.discount_percent}%` : '',
    store_url: `https://store.steampowered.com/app/${appId}/`,
    tier: 'pc',
  };
}

async function steamFeaturedDeal(
  item: SteamFeaturedItem,
  signal?: StoreRequestOptions['signal'],
): Promise<GameDeal | null> {
  // A zero final price is still authoritative (free-to-play). Keeping it on
  // the source game prevents the attach queue from querying Steam again.
  if (
    typeof item.final_price !== 'number' ||
    !Number.isFinite(item.final_price) ||
    item.final_price < 0
  ) return null;
  const price = completeSteamPrice({
    final: item.final_price,
    initial: item.original_price ?? item.final_price,
    discount_percent: item.discount_percent ?? 0,
    ...(item.currency !== undefined ? { currency: item.currency } : {}),
  });
  if (!price) return null;
  const result = await steamPriceFromOverview(String(item.id), price, signal);
  return result ? platformPriceToGameDeal(result) : null;
}

async function steamPriceFromAppData(
  appId: string,
  data: SteamAppData,
  options?: StoreRequestOptions,
): Promise<PlatformPriceResult | null> {
  if (data.is_free) {
    return {
      platform: 'Steam',
      price: 'Ücretsiz',
      original_price: null,
      discount: '',
      store_url: `https://store.steampowered.com/app/${appId}/`,
      tier: 'pc',
    };
  }
  return data.price_overview
    ? steamPriceFromOverview(appId, data.price_overview, options?.signal)
    : null;
}

type SteamSearchProduct = Readonly<{
  hit: PlatformSearchHit;
  price?: Partial<SteamPriceOverview>;
}>;

function steamSearchProduct(item: SteamSearchItem): SteamSearchProduct {
  return {
    hit: {
      id: String(item.id),
      slug: String(item.id),
      title: item.name,
      image_url: steamImage(item.id),
      platform: 'Steam',
      store_url: `https://store.steampowered.com/app/${item.id}/`,
    },
    ...(item.price ? { price: item.price } : {}),
  };
}

async function searchSteamProducts(
  query: string,
  options?: StoreRequestOptions,
): Promise<SteamSearchProduct[]> {
  const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(query)}&l=${getSteamLang()}&cc=${getStoreCountry()}`;
  const data = await withRetry(
    () => fetchJson<SteamSearchResponse>(url, { signal: options?.signal }),
    0,
    options?.signal,
  );
  const items = data.items ?? [];
  return items
    .filter((item) => item.id && item.name)
    .slice(0, 12)
    .map(steamSearchProduct);
}

export async function searchSteam(
  query: string,
  options?: StoreRequestOptions,
): Promise<PlatformSearchHit[]> {
  const products = await searchSteamProducts(query, options);
  return products.map((product) => product.hit);
}

/** Discounted titles from Steam's "specials" list for the selected country. */
export async function fetchSteamDeals(
  limit: number,
  options?: StoreRequestOptions,
): Promise<LiveGame[]> {
  const url = `https://store.steampowered.com/api/featuredcategories/?cc=${getStoreCountry()}&l=${getSteamLang()}`;
  const data = await withRetry(
    () => fetchJson<SteamFeaturedResponse>(url, { signal: options?.signal }, STORE_CONFIG.timeout.long),
    0,
    options?.signal,
  );

  const seen = new Set<number>();
  const items = (data.specials?.items ?? []).filter((item) => {
    if (!item.id || !item.name || !item.discount_percent || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  }).slice(0, limit);

  const deals = await Promise.all(items.map((item) => steamFeaturedDeal(item, options?.signal)));
  return items.flatMap((item, index) => {
    const deal = deals[index];
    if (!deal) return [];
    return [{
      id: String(item.id),
      slug: String(item.id),
      title: item.name,
      image_url: steamImage(item.id, item.header_image),
      platform: 'Steam',
      source_platform: 'Steam',
      price: deal.price,
      discount: deal.discount,
      ...(deal.original_price ? { original_price: deal.original_price } : {}),
      deals: [deal],
      rating: null,
      store_links: { Steam: `https://store.steampowered.com/app/${item.id}/` },
    }];
  });
}

async function fetchSteamAppData(
  appId: string,
  options?: StoreRequestOptions,
): Promise<SteamAppData | null> {
  if (!/^\d+$/.test(appId)) return null;
  const url = `https://store.steampowered.com/api/appdetails?appids=${encodeURIComponent(appId)}&cc=${getStoreCountry()}&l=${getSteamLang()}`;
  const res = await withRetry(
    () => fetchJson<SteamAppDetailsResponse>(url, { signal: options?.signal }),
    0,
    options?.signal,
  );
  return res[appId]?.data ?? null;
}

export async function fetchSteamDetails(
  appId: string,
  options?: StoreRequestOptions,
): Promise<LiveGame | null> {
  const cleanAppId = appId.replace(/^steam-/, '');
  const data = await fetchSteamAppData(cleanAppId, options);
  if (!data?.name) return null;

  const game: LiveGame = {
    id: cleanAppId,
    slug: cleanAppId,
    title: data.name,
    image_url: data.header_image ?? steamImage(cleanAppId),
    platform: 'Steam',
    source_platform: 'Steam',
    developers: data.developers ?? [],
    genres:
      data.genres?.flatMap((g) => {
        const description = g.description || '';
        return description ? [description] : [];
      }) ?? [],
    screenshots:
      data.screenshots?.flatMap((s) => {
        const path = s.path_full || '';
        return path ? [path] : [];
      }) ?? [],
    videos:
      data.movies?.flatMap((m) => {
        const url = m.hls_h264 || m.mp4?.max || '';
        return url ? [{ platform: 'steam', id: String(m.id), url, thumbnail: m.thumbnail || '' }] : [];
      }) ?? [],
    rating: null,
    store_links: { Steam: `https://store.steampowered.com/app/${cleanAppId}/` },
  };
  if (data.short_description) game.description = data.short_description;
  if (data.release_date?.date) game.release_date = data.release_date.date;
  const sourcePrice = await steamPriceFromAppData(cleanAppId, data, options);
  if (sourcePrice) game.deals = [platformPriceToGameDeal(sourcePrice)];
  return game;
}

function isPrimeUpgradeTitle(title: string): boolean {
  return /\b(prime|seçkin|secKin|status\s+upgrade|yükseltme|yukseltme)\b/i.test(title);
}

function pickSteamPriceMatch(
  products: SteamSearchProduct[],
  edition: string,
  matchTitle: string,
): SteamSearchProduct | undefined {
  const hits = products.map((product) => product.hit);
  let match =
    edition === 'base'
      ? undefined
      : hits.find((hit) => extractEdition(hit.title) === edition);

  if (!match && isPrimeUpgradeTitle(matchTitle)) {
    match = hits.find((hit) => isPrimeUpgradeTitle(hit.title));
  }

  match ??= pickBestTitleMatch(hits, matchTitle, (hit) => hit.title) ?? undefined;

  if (match && isPrimeUpgradeTitle(matchTitle) && !isPrimeUpgradeTitle(match.title)) {
    const upgradeHit = hits.find((hit) => isPrimeUpgradeTitle(hit.title));
    if (upgradeHit) match = upgradeHit;
  }

  return products.find((product) => product.hit === match);
}

export async function fetchSteamPrice(
  lookupTitle: string,
  edition: string,
  matchTitle: string = lookupTitle,
  options?: StoreRequestOptions,
): Promise<PlatformPriceResult | null> {
  const products = await searchSteamProducts(lookupTitle, options);
  const match = pickSteamPriceMatch(products, edition, matchTitle);

  if (!match) return null;

  const { hit } = match;
  const directPrice = match.price
    ? await steamPriceFromOverview(hit.id, match.price, options?.signal)
    : null;
  if (directPrice) return directPrice;

  const data = await fetchSteamAppData(hit.id, options);
  if (!data) return null;

  if (data.is_free) {
    return {
      platform: 'Steam',
      price: 'Ücretsiz',
      original_price: null,
      discount: '',
      store_url: `https://store.steampowered.com/app/${hit.id}/`,
      tier: 'pc',
    };
  }

  const price = data.price_overview;
  if (!price) {
    return {
      platform: 'Steam',
      price: 'Bilinmiyor',
      discount: '',
      store_url: `https://store.steampowered.com/app/${hit.id}/`,
      tier: 'pc',
    };
  }

  return steamPriceFromOverview(hit.id, price, options?.signal);
}

export async function fetchSteamFreeGames(options?: StoreRequestOptions): Promise<LiveGame[]> {
  const url = `https://store.steampowered.com/api/featuredcategories/?cc=${getStoreCountry()}&l=${getSteamLang()}`;
  const data = await withRetry(
    () => fetchJson<SteamFeaturedResponse>(url, { signal: options?.signal }, STORE_CONFIG.timeout.long),
    0,
    options?.signal,
  );
  const freeItems = (data as { free_to_play?: { items?: { id: number; name: string; header_image?: string }[] } })
    .free_to_play?.items;

  if (!freeItems?.length) return [];

  return freeItems.slice(0, 20).map((item) => ({
    id: String(item.id),
    slug: String(item.id),
    title: item.name,
    image_url: steamImage(item.id, item.header_image),
    platform: 'Steam',
    source_platform: 'Steam',
    price: 'Ücretsiz',
    discount: '',
    rating: null,
  }));
}
