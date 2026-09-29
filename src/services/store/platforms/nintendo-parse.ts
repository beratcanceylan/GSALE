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

/** Store-reported percentage, else derived from the regular and current price. */
function discountPercent(reported: number | null, current: number | null, original: number | null): number {
  if (reported !== null && reported > 0) return Math.round(reported);
  if (current === null || original === null || original <= 0) return 0;
  return Math.round((1 - current / original) * 100);
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
  const percent = discountPercent(numberValue(price['percentOff']), current, original);
  return {
    current: sale !== null && regular !== null && sale < regular ? sale : current,
    original,
    currency: stringValue(eshop['currency']) || stringValue(hit['currency']) || 'USD',
    discount: percent > 0 ? `-${percent}%` : '',
  };
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

  const platform = stringValue(value['platform']) || stringArray(value['corePlatforms'])[0];
  if (platform) parsed.platform = platform;
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
