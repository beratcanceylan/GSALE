import { extractNumericPrice } from '@/services/store/price-parse';

const NINTENDO_WEB_BASE = 'https://www.nintendo.com';
const NINTENDO_ASSET_BASE = 'https://assets.nintendo.com/image/upload/q_auto/f_auto/';

export interface ParsedNintendoProduct {
  id: string;
  nsuid: string;
  title: string;
  price: number | null;
  original_price: number | null;
  currency: string;
  discount: string;
  image_url: string;
  store_url: string;
  description?: string;
  release_date?: string;
  developers?: string[];
  genres?: string[];
  platform?: string;
  is_add_on?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function numberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const numeric = extractNumericPrice(value);
    return numeric !== null && Number.isFinite(numeric) ? numeric : null;
  }
  return null;
}

function absoluteNintendoUrl(value: string): string {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  return `${NINTENDO_WEB_BASE}${value.startsWith('/') ? '' : '/'}${value}`;
}

function imageUrl(value: string): string {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  return `${NINTENDO_ASSET_BASE}${value.replace(/^\/+/, '')}`;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === 'string' && item.trim()) return [item.trim()];
    if (isRecord(item)) {
      const label = stringValue(item['label']);
      return label ? [label] : [];
    }
    return [];
  });
}

function priceParts(hit: Record<string, unknown>): {
  current: number | null;
  original: number | null;
  currency: string;
  discount: string;
} {
  const price = isRecord(hit['price']) ? hit['price'] : {};
  const eshop = isRecord(hit['eshopDetails']) ? hit['eshopDetails'] : {};
  const current =
    numberValue(price['finalPrice']) ??
    numberValue(price['salePrice']) ??
    numberValue(eshop['discountPrice']) ??
    numberValue(price['regPrice']) ??
    numberValue(eshop['regularPrice']);
  const regular =
    numberValue(price['regPrice']) ??
    numberValue(eshop['regularPrice']) ??
    numberValue(price['initialPrice']);
  const sale = numberValue(price['salePrice']) ?? numberValue(eshop['discountPrice']);
  const original = regular !== null && current !== null && regular > current ? regular : null;
  const rawPercent = numberValue(price['percentOff']);
  const percent = rawPercent !== null && rawPercent > 0
    ? Math.round(rawPercent)
    : current !== null && original !== null && original > 0
      ? Math.round((1 - current / original) * 100)
      : 0;
  return {
    current: sale !== null && regular !== null && sale < regular ? sale : current,
    original,
    currency: stringValue(eshop['currency']) || stringValue(hit['currency']) || 'USD',
    discount: percent > 0 ? `-${percent}%` : '',
  };
}

function productGenres(hit: Record<string, unknown>): string[] {
  return [...new Set([
    ...stringArray(hit['gameGenreLabels']),
    ...stringArray(hit['genres']),
  ])];
}

function productDevelopers(hit: Record<string, unknown>): string[] {
  return [...new Set([
    ...stringArray(hit['softwareDeveloper']),
    ...stringArray(hit['softwarePublisher']),
  ])];
}

/** Convert one current Nintendo.com Algolia hit into the store-neutral model. */
export function parseNintendoProduct(value: unknown): ParsedNintendoProduct | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value['objectID']) || stringValue(value['sku']) || stringValue(value['nsuid']);
  const nsuid = stringValue(value['nsuid']) || id;
  const title = stringValue(value['title']) || stringValue(value['name']);
  if (!id || !title) return null;

  const prices = priceParts(value);
  const productType = stringArray(value['productType']).join(' ').toLowerCase();
  const dlcType = stringValue(value['dlcType']).toLowerCase();
  const parsed: ParsedNintendoProduct = {
    id,
    nsuid,
    title,
    price: prices.current,
    original_price: prices.original,
    currency: prices.currency,
    discount: prices.discount,
    image_url: imageUrl(
      stringValue(value['productImageSquare']) ||
      stringValue(value['productImage']) ||
      stringValue(value['image']),
    ),
    store_url: absoluteNintendoUrl(stringValue(value['url']) || stringValue(value['productLink'])),
    is_add_on:
      productType.includes('dlc') ||
      productType.includes('addon') ||
      (Boolean(dlcType) && dlcType !== 'none' && dlcType !== 'null'),
  };

  const description = stringValue(value['description']);
  const releaseDate = stringValue(value['releaseDate']);
  const platform = stringValue(value['platform']) || stringArray(value['corePlatforms'])[0];
  const developers = productDevelopers(value);
  const genres = productGenres(value);
  if (description) parsed.description = description;
  if (releaseDate) parsed.release_date = releaseDate;
  if (platform) parsed.platform = platform;
  if (developers.length > 0) parsed.developers = developers;
  if (genres.length > 0) parsed.genres = genres;
  return parsed;
}

export function parseNintendoSearchResponse(value: unknown): ParsedNintendoProduct[] {
  const hits = isRecord(value) && Array.isArray(value['hits']) ? value['hits'] : [];
  const seen = new Set<string>();
  const products: ParsedNintendoProduct[] = [];
  for (const hit of hits) {
    const parsed = parseNintendoProduct(hit);
    if (!parsed || seen.has(parsed.id)) continue;
    seen.add(parsed.id);
    products.push(parsed);
  }
  return products;
}

export function pickBestNintendoProduct(
  products: ParsedNintendoProduct[],
  matchTitle: string,
): ParsedNintendoProduct | null {
  const available = products.filter((product) => !product.is_add_on && product.price !== null);
  const candidates = available.length > 0 ? available : products.filter((product) => !product.is_add_on);
  if (candidates.length === 0) return null;

  const normalizedSearch = matchTitle.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const searchWords = matchTitle.toLowerCase().split(/\s+/).filter((word) => word.length >= 2);
  const optionalWords = new Set([
    'edition',
    'enhanced',
    'legacy',
    'remastered',
    'definitive',
    'deluxe',
    'ultimate',
    'complete',
    'premium',
    'standard',
    'gold',
    'goty',
    'game',
    'nintendo',
    'switch',
    'switch2',
  ]);
  const isCompatibleTitle = (title: string): boolean => {
    const normalizedTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (normalizedTitle === normalizedSearch) return true;
    const titleWords = title.toLowerCase().split(/\s+/).filter((word) => word.length >= 2);
    const searchInTitle = searchWords.every((word) => titleWords.includes(word));
    const titleInSearch = titleWords.every((word) => searchWords.includes(word));
    if (!searchInTitle && !titleInSearch) return false;
    const extras = (searchInTitle ? titleWords : searchWords).filter(
      (word) => !(searchInTitle ? searchWords : titleWords).includes(word),
    );
    return extras.every((word) => optionalWords.has(word.replace(/[^a-z0-9]/g, '')));
  };

  let best: ParsedNintendoProduct | null = null;
  let bestScore = -1;
  for (const product of candidates) {
    const normalizedTitle = product.title.toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (!isCompatibleTitle(product.title)) continue;
    let score = 0;
    if (normalizedTitle === normalizedSearch) score += 100;
    else if (normalizedTitle.includes(normalizedSearch) || normalizedSearch.includes(normalizedTitle)) score += 70;
    const titleWords = product.title.toLowerCase();
    score += searchWords.filter((word) => titleWords.includes(word)).length * 10;
    if (score > bestScore) {
      best = product;
      bestScore = score;
    }
  }
  return bestScore >= 0 ? best : null;
}
