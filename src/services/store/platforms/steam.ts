import { STORE_CONFIG, getSteamLang, getStoreCountry } from '@/services/store/config';
import { fetchJson, throwIfAborted, withRetry } from '@/services/store/fetch';
import { acceptEditionCandidate, MAX_EDITION_CANDIDATES, type EditionOffer } from '@/services/store/edition-table';
import { baseTitle, editionKey } from '@/services/store/editions';
import { pickBestTitleMatch } from '@/services/store/match';
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
  package_groups?: { subs?: SteamPackageSub[] }[];
}

interface SteamPackageSub {
  packageid: number;
  option_text?: string;
  percent_savings?: number;
  price_in_cents_with_discount?: number;
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

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function derivedDiscountPercent(final: number, initial: number): number {
  return initial > final && initial > 0 ? Math.round((1 - final / initial) * 100) : 0;
}

function completeSteamPrice(overview: Partial<SteamPriceOverview>): SteamPriceOverview | null {
  if (!isFiniteNumber(overview.final)) return null;
  const initial = isFiniteNumber(overview.initial) ? overview.initial : overview.final;
  const discount = isFiniteNumber(overview.discount_percent)
    ? overview.discount_percent
    : derivedDiscountPercent(overview.final, initial);
  return {
    final: overview.final,
    initial,
    discount_percent: discount,
    ...(overview.currency !== undefined ? { currency: overview.currency } : {}),
    ...(overview.final_formatted !== undefined ? { final_formatted: overview.final_formatted } : {}),
    ...(overview.initial_formatted !== undefined ? { initial_formatted: overview.initial_formatted } : {}),
  };
}

function steamStoreUrl(appId: number | string): string {
  return `https://store.steampowered.com/app/${appId}/`;
}

/** A price with no amounts: free-to-play or unknown. */
function steamFixedPrice(appId: string, label: string): PlatformPriceResult {
  return {
    platform: 'Steam',
    price: label,
    original_price: null,
    discount: '',
    store_url: steamStoreUrl(appId),
    tier: 'pc',
  };
}

async function steamPriceFromOverview(
  appId: string,
  overview: Partial<SteamPriceOverview>,
  signal?: StoreRequestOptions['signal'],
): Promise<PlatformPriceResult | null> {
  const price = completeSteamPrice(overview);
  if (!price) return null;

  if (price.final <= 0) return steamFixedPrice(appId, 'Ücretsiz');

  if (price.currency === 'TRY') {
    const formatted = formatSteamPrice(price);
    return {
      platform: 'Steam',
      price: formatted.price,
      original_price: formatted.original_price,
      discount: price.discount_percent > 0 ? `-${price.discount_percent}%` : '',
      store_url: steamStoreUrl(appId),
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
    store_url: steamStoreUrl(appId),
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
  if (data.is_free) return steamFixedPrice(appId, 'Ücretsiz');
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
      store_url: steamStoreUrl(item.id),
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
      store_links: { Steam: steamStoreUrl(item.id) },
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
    store_links: { Steam: steamStoreUrl(cleanAppId) },
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
      : hits.find((hit) => editionKey(hit.title) === edition);

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
  return (await steamPriceFromAppData(hit.id, data, options)) ?? steamFixedPrice(hit.id, 'Bilinmiyor');
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

/** "Buy ELDEN RING Deluxe Edition - ₺1.999,00" → "ELDEN RING Deluxe Edition". */
function steamPackageTitle(optionText: string): string {
  const dash = optionText.lastIndexOf(' - ');
  const withoutPrice = dash > 0 ? optionText.slice(0, dash) : optionText;
  return withoutPrice.replace(/^(?:buy|satın al|acheter|kaufen|comprar|acquista|kup)\s+/iu, '').trim();
}

function steamPackageOverview(sub: SteamPackageSub, currency: string | undefined): Partial<SteamPriceOverview> | null {
  const final = sub.price_in_cents_with_discount;
  if (!isFiniteNumber(final)) return null;
  const savings = isFiniteNumber(sub.percent_savings) ? sub.percent_savings : 0;
  const initial = savings > 0 && savings < 100 ? Math.round(final / (1 - savings / 100)) : final;
  return { final, initial, discount_percent: savings, ...(currency ? { currency } : {}) };
}

/** Editions Steam sells as packages of one app ("Deluxe Edition" subs of the base game). */
async function steamPackageOffers(
  appId: string,
  title: string,
  options?: StoreRequestOptions,
): Promise<EditionOffer[]> {
  const data = await fetchSteamAppData(appId, options);
  const currency = data?.price_overview?.currency;
  const subs = (data?.package_groups ?? []).flatMap((group) => group.subs ?? []);
  const offers = await Promise.all(subs.map(async (sub): Promise<EditionOffer | null> => {
    const packageTitle = steamPackageTitle(sub.option_text ?? '');
    const edition = acceptEditionCandidate(packageTitle, title);
    const overview = steamPackageOverview(sub, currency);
    if (!edition || !overview) return null;
    const price = await steamPriceFromOverview(appId, overview, options?.signal);
    if (!price) return null;
    return {
      platform: 'Steam',
      edition,
      title: packageTitle,
      id: appId,
      price: { ...price, store_url: `https://store.steampowered.com/sub/${sub.packageid}/` },
    };
  }));
  return offers.flatMap((offer) => (offer ? [offer] : []));
}

/** Every edition of `title`'s game on Steam: search apps plus the base app's packages. */
export async function fetchSteamEditionOffers(
  title: string,
  options?: StoreRequestOptions,
): Promise<EditionOffer[]> {
  const products = await searchSteamProducts(baseTitle(title), options);
  throwIfAborted(options?.signal);
  const accepted = products
    .flatMap((product) => {
      const edition = acceptEditionCandidate(product.hit.title, title);
      return edition ? [{ product, edition }] : [];
    })
    .slice(0, MAX_EDITION_CANDIDATES);

  const appOffers = await Promise.all(accepted.map(async ({ product, edition }): Promise<EditionOffer | null> => {
    if (!product.price) return null;
    const price = await steamPriceFromOverview(product.hit.id, product.price, options?.signal);
    return price ? { platform: 'Steam', edition, title: product.hit.title, id: product.hit.id, price } : null;
  }));
  throwIfAborted(options?.signal);

  const baseApp = accepted.find(({ edition }) => edition === 'base')?.product.hit.id;
  const packages = baseApp ? await steamPackageOffers(baseApp, title, options) : [];
  throwIfAborted(options?.signal);
  return [...appOffers.flatMap((offer) => (offer ? [offer] : [])), ...packages];
}
