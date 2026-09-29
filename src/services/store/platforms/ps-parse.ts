import { extractNumericPrice, formatTryPrice, isUnavailablePrice } from '@/services/store/price-parse';

const PS_STORE_BASE = 'https://store.playstation.com';

export interface ParsedPlayStationProduct {
  id: string;
  title: string;
  price: string;
  original_price: string | null;
  discount: string;
  image_url: string;
  store_url: string;
  platforms?: string[];
  /** Chihiro marks add-ons separately; they must not win a base-game price match. */
  is_add_on?: boolean;
}

interface ProductJsonLd {
  '@type'?: string;
  name?: string;
  description?: string;
  image?: string | string[];
  offers?: {
    '@type'?: string;
    price?: number | string;
    priceCurrency?: string;
  };
}

function decodeHtmlEntities(value: string): string {
  return value
    .replaceAll('&quot;', '"')
    .replaceAll('&amp;', '&')
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&#160;', ' ')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replaceAll(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)));
}

function normalizeText(value: string | undefined | null): string {
  if (!value) return '';
  return decodeHtmlEntities(value)
    .replaceAll('Â ', ' ')
    .replaceAll(/<[^<>]*>/g, ' ')
    .replaceAll('\u00a0', ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

function parseJsonStringLiteral(value: string | undefined): string {
  if (!value) return '';
  try {
    return normalizeText(JSON.parse(`"${value}"`) as string);
  } catch {
    return normalizeText(value.replaceAll(String.raw`\"`, '"'));
  }
}

function normalizePrice(value: string | undefined | null): string {
  const text = normalizeText(value);
  if (!text) return 'Bilinmiyor';
  const lower = text.toLowerCase();
  if (lower.includes('ücretsiz') || lower === 'free') return 'Ücretsiz';
  return withTlSuffix(text);
}

/** Normalises a trailing "TL" (any case, any spacing) to " TL". */
function withTlSuffix(text: string): string {
  return /tl$/i.test(text) ? `${text.slice(0, -2).trimEnd()} TL` : text;
}

function normalizeImageUrl(value: string): string {
  const decoded = decodeHtmlEntities(value).trim();
  if (!decoded) return '';

  try {
    const url = new URL(decoded.startsWith('//') ? `https:${decoded}` : decoded);
    if (url.hostname.includes('playstation')) {
      if (url.searchParams.get('thumb') === 'true' || url.searchParams.has('w')) {
        url.searchParams.set('w', '440');
        url.searchParams.delete('thumb');
      }
      return url.toString();
    }
  } catch {
    // Fall through to legacy normalization.
  }

  const queryIndex = decoded.indexOf('?');
  return queryIndex >= 0 ? decoded.slice(0, queryIndex) : decoded;
}

function stripPsQueryPunctuation(text: string): string {
  return text.replaceAll(/[™®©]/g, '').replaceAll(/['’`,.]/g, '');
}

/** Search terms to try in order: hyphen variants, the sanitized query, the raw query, then the part before ":". */
export function getPsSearchQueryCandidates(query: string): string[] {
  const rawTerm = query.trim().replaceAll(/\s+/g, '_');
  const sanitized = stripPsQueryPunctuation(query)
    .replaceAll(/[:/]/g, ' ')
    .replaceAll(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();

  const candidates = new Set<string>();
  if (sanitized.includes('-')) {
    candidates.add(sanitized.replaceAll('-', '').replaceAll(/\s+/g, '_'));
    candidates.add(sanitized.replaceAll('-', ' ').replaceAll(/\s+/g, '_'));
  }
  candidates.add(sanitized.replaceAll(/\s+/g, '_'));
  candidates.add(rawTerm);

  const colonIndex = query.indexOf(':');
  if (colonIndex > 0) {
    const prefix = stripPsQueryPunctuation(query.slice(0, colonIndex))
      .replaceAll(/[^\p{L}\p{N}\s-]/gu, ' ')
      .replaceAll(/\s+/g, '_')
      .trim();
    if (prefix.length >= 3) candidates.add(prefix);
  }

  candidates.delete('');
  return candidates.size > 0 ? [...candidates] : [rawTerm];
}

export function getPlayStationStoreUrl(productId: string, pathLocale: string): string {
  return `${PS_STORE_BASE}/${pathLocale}/product/${productId}`;
}

function absoluteStoreUrl(href: string | undefined, productId: string, pathLocale: string): string {
  if (!href) return getPlayStationStoreUrl(productId, pathLocale);
  if (href.startsWith('http')) return href;
  if (href.startsWith('/')) return `${PS_STORE_BASE}${href}`;
  return `${PS_STORE_BASE}/${pathLocale}/${href}`;
}

function discountFromText(text: string): string {
  const normalized = normalizeText(text);
  const match = /%\s*(\d{1,3})|(\d{1,3})\s*%/.exec(normalized);
  const percent = Number.parseInt(match?.[1] || match?.[2] || '', 10);
  if (!Number.isFinite(percent) || percent <= 0) return '';
  return `-${percent}%`;
}

function discountFromPrices(price: string, originalPrice: string | null): string {
  if (!originalPrice) return '';
  const current = extractNumericPrice(price);
  const original = extractNumericPrice(originalPrice);
  if (current === null || original === null || original <= 0 || current >= original) return '';
  return `-${Math.round((1 - current / original) * 100)}%`;
}

function parseTelemetryMeta(rawMeta: string): Record<string, unknown> | null {
  try {
    return JSON.parse(decodeHtmlEntities(rawMeta)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function tileChunkForMeta(html: string, metaIndex: number): string {
  const start = Math.max(0, html.lastIndexOf('<li', metaIndex));
  const end = html.indexOf('</li>', metaIndex);
  if (end === -1) return html.slice(start, metaIndex + 2500);
  return html.slice(start, end + 5);
}

export function parsePlayStationSearchHtml(
  html: string,
  pathLocale: string,
): ParsedPlayStationProduct[] {
  const products: ParsedPlayStationProduct[] = [];
  const seen = new Set<string>();
  const metaRegex = /data-telemetry-meta="([^"]+)"/g;
  let match: RegExpExecArray | null;

  while ((match = metaRegex.exec(html)) !== null) {
    const meta = parseTelemetryMeta(match[1] || '');
    const id = typeof meta?.['id'] === 'string' ? meta['id'] : '';
    const title = typeof meta?.['name'] === 'string' ? normalizeText(meta['name']) : '';
    if (!id || !title || seen.has(id)) continue;

    const chunk = tileChunkForMeta(html, match.index);
    const href = /href="([^"]*\/product\/[^"]+)"/i.exec(chunk)?.[1];
    const image = /<img\b[^>]*\bsrc="([^"]+)"/i.exec(chunk)?.[1] || '';
    const original = /<s\b[^>]*>([\s\S]*?)<\/s>/i.exec(chunk)?.[1];
    const price = normalizePrice(typeof meta?.['price'] === 'string' ? meta['price'] : '');
    const originalPrice = original ? normalizePrice(original) : null;

    products.push({
      id,
      title,
      price,
      original_price: originalPrice,
      discount: discountFromPrices(price, originalPrice),
      image_url: normalizeImageUrl(image),
      store_url: absoluteStoreUrl(decodeHtmlEntities(href || ''), id, pathLocale),
    });
    seen.add(id);
  }

  return products;
}

function parseJsonLd(html: string): ProductJsonLd | null {
  const scriptRegex = /<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(normalizeText(match[1] || '')) as ProductJsonLd;
      if (parsed['@type'] === 'Product' || parsed.name) return parsed;
    } catch {
      // Some store pages include non-product JSON-LD blobs; skip malformed ones.
    }
  }
  return null;
}

function extractJsonField(html: string, field: string): string {
  const fieldRegex = new RegExp(String.raw`"${field}"\s*:\s*"((?:\\.|[^"\\])*)"`);
  return parseJsonStringLiteral(fieldRegex.exec(html)?.[1]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function collectCacheRecords(value: unknown, records: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (!isRecord(value)) return records;
  const cache = value['cache'];
  if (isRecord(cache)) {
    for (const record of Object.values(cache)) {
      if (isRecord(record)) records.push(record);
    }
  }
  for (const child of Object.values(value)) {
    if (isRecord(child)) collectCacheRecords(child, records);
  }
  return records;
}

function parseJsonCacheRecords(html: string): Record<string, unknown>[] {
  const records: Record<string, unknown>[] = [];
  const scriptRegex = /<script\b[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse((match[1] || '').trim()) as unknown;
      collectCacheRecords(parsed, records);
    } catch {
      // Non-JSON application scripts are ignored.
    }
  }
  return records;
}

function stringField(record: Record<string, unknown> | undefined, field: string): string {
  const value = record?.[field];
  return typeof value === 'string' ? normalizeText(value) : '';
}

function firstStringField(records: Record<string, unknown>[], field: string): string {
  for (const record of records) {
    const value = stringField(record, field);
    if (value) return value;
  }
  return '';
}


type CtaPrice = { price: string; original_price: string | null; discount: string };

/** The non-subscription offer PlayStation applies to this SKU, if any. */
function applicableOffer(local: Record<string, unknown>): Record<string, unknown> | undefined {
  const telemetry = isRecord(local['telemetryMeta']) ? local['telemetryMeta'] : undefined;
  const skuDetail = isRecord(telemetry?.['skuDetail']) ? telemetry['skuDetail'] : undefined;
  const priceDetails: unknown[] = Array.isArray(skuDetail?.['skuPriceDetail']) ? skuDetail['skuPriceDetail'] : [];
  return priceDetails.find(
    (detail): detail is Record<string, unknown> =>
      isRecord(detail) && detail['offerApplicability'] === 'APPLICABLE' && !detail['offerIsTiedToSubscription'],
  );
}

/** The applicable offer's formatted prices win over the CTA's own, except "dahil" (included). */
function offerPrices(
  offer: Record<string, unknown> | undefined,
  price: string,
  original: string,
): { price: string; original: string } {
  if (!offer) return { price, original };
  const discounted = stringField(offer, 'discountPriceFormatted');
  const offerOriginal = stringField(offer, 'originalPriceFormatted');
  const usesDiscounted = Boolean(discounted) && !isUnavailablePrice(discounted) && discounted.toLowerCase() !== 'dahil';
  return {
    price: usesDiscounted ? discounted : price,
    original: offerOriginal && offerOriginal !== discounted ? offerOriginal : original,
  };
}

/** Price shown by one call-to-action record; null for subscription-only or price-less CTAs. */
function ctaPrice(cta: Record<string, unknown>): CtaPrice | null {
  const local = isRecord(cta['local']) ? cta['local'] : {};
  const priceObj = isRecord(cta['price']) ? cta['price'] : {};
  const discountBadge = stringField(local, 'discountBadgeText') || stringField(priceObj, 'displayDiscountText');
  const { price: finalPrice, original: finalOriginal } = offerPrices(
    applicableOffer(local),
    stringField(local, 'priceOrText') || stringField(priceObj, 'discountedPrice'),
    stringField(local, 'originalPrice') || stringField(priceObj, 'basePrice'),
  );

  const isFreeText = /ücretsiz|free/i.test(finalPrice);
  if (priceObj['isTiedToSubscription'] === true && isFreeText) return null;
  if (extractNumericPrice(finalPrice) === null && !isFreeText) return null;

  const price = normalizePrice(finalPrice);
  const originalPrice =
    extractNumericPrice(finalOriginal) !== null && finalOriginal !== finalPrice ? normalizePrice(finalOriginal) : null;
  return {
    price,
    original_price: originalPrice,
    discount: discountBadge ? discountFromText(discountBadge) : discountFromPrices(price, originalPrice),
  };
}

function extractProductPriceFromCacheRecords(
  cacheRecords: Record<string, unknown>[],
  productId: string,
): { price: string; original_price: string | null; discount: string } | null {
  const ctaRecords = cacheRecords.filter((r) => r['__typename'] === 'GameCTA');
  if (ctaRecords.length === 0) return null;

  const sortedCtas = [...ctaRecords].sort((a, b) => {
    const aId = stringField(a, 'id');
    const bId = stringField(b, 'id');
    const aMatchesProd = aId.includes(productId) ? 1 : 0;
    const bMatchesProd = bId.includes(productId) ? 1 : 0;
    if (aMatchesProd !== bMatchesProd) return bMatchesProd - aMatchesProd;

    const aIsAddToCart = a['type'] === 'ADD_TO_CART' ? 1 : 0;
    const bIsAddToCart = b['type'] === 'ADD_TO_CART' ? 1 : 0;
    if (aIsAddToCart !== bIsAddToCart) return bIsAddToCart - aIsAddToCart;

    const aPriceObj = isRecord(a['price']) ? a['price'] : {};
    const bPriceObj = isRecord(b['price']) ? b['price'] : {};
    const aSub = aPriceObj['isTiedToSubscription'] === true ? 1 : 0;
    const bSub = bPriceObj['isTiedToSubscription'] === true ? 1 : 0;
    if (aSub !== bSub) return aSub - bSub;

    return 0;
  });

  for (const cta of sortedCtas) {
    const price = ctaPrice(cta);
    if (price) return price;
  }

  return null;
}

function jsonLdImage(jsonLd: ProductJsonLd | null): string {
  return normalizeText(Array.isArray(jsonLd?.image) ? jsonLd.image[0] : jsonLd?.image);
}

/** Cached CTA price, then the page's `priceOrText`, then the JSON-LD offer. */
function productHtmlPrice(html: string, cachedPrice: CtaPrice | null, jsonLd: ProductJsonLd | null): string {
  const price = cachedPrice?.price ?? normalizePrice(extractJsonField(html, 'priceOrText'));
  const offerPrice = jsonLd?.offers?.price === undefined ? Number.NaN : Number(jsonLd.offers.price);
  if (!isUnavailablePrice(price) || !Number.isFinite(offerPrice)) return price;
  return offerPrice <= 0 ? 'Ücretsiz' : formatTryPrice(offerPrice);
}

function productHtmlOriginalPrice(html: string, cachedPrice: CtaPrice | null): string | null {
  if (cachedPrice) return cachedPrice.original_price;
  const raw = extractJsonField(html, 'originalPrice');
  return raw ? normalizePrice(raw) : null;
}

export function parsePlayStationProductHtml(
  html: string,
  productId: string,
  pathLocale: string,
): ParsedPlayStationProduct | null {
  const jsonLd = parseJsonLd(html);
  const cacheRecords = parseJsonCacheRecords(html);
  const productRecords = cacheRecords.filter((record) => stringField(record, 'id') === productId);
  const title =
    normalizeText(jsonLd?.name) ||
    firstStringField(productRecords, 'name') ||
    firstStringField(productRecords, 'invariantName');
  const cachedPrice = extractProductPriceFromCacheRecords(cacheRecords, productId);
  const price = productHtmlPrice(html, cachedPrice, jsonLd);
  if (!title && price === 'Bilinmiyor') return null;

  const originalPrice = productHtmlOriginalPrice(html, cachedPrice);
  const product: ParsedPlayStationProduct = {
    id: productId,
    title,
    price,
    original_price: originalPrice,
    discount:
      cachedPrice?.discount ||
      discountFromText(extractJsonField(html, 'discountBadgeText')) ||
      discountFromPrices(price, originalPrice),
    image_url: jsonLdImage(jsonLd),
    store_url: getPlayStationStoreUrl(productId, pathLocale),
  };
  return product;
}

/*
 * The current PlayStation Store is a client-rendered shell. Its search page
 * no longer contains the telemetry tiles parsed above, but the same store
 * exposes the lightweight Chihiro JSON endpoints used by its own clients.
 * Keep the HTML parser for old snapshots/tests and parse this response for
 * live requests so a shell response cannot silently erase PlayStation prices.
 */
interface ChihiroSkuLike {
  display_price?: unknown;
  price?: unknown;
}

interface ChihiroProductLike {
  id?: unknown;
  name?: unknown;
  short_name?: unknown;
  title_name?: unknown;
  long_desc?: unknown;
  images?: unknown;
  default_sku?: unknown;
  metadata?: unknown;
  playable_platform?: unknown;
  release_date?: unknown;
  provider_name?: unknown;
  top_category?: unknown;
  game_contentType?: unknown;
  mediaList?: unknown;
  star_rating?: unknown;
}

function chihiroSku(product: ChihiroProductLike): ChihiroSkuLike | null {
  return isRecord(product.default_sku) ? product.default_sku : null;
}

function chihiroString(value: unknown): string {
  return typeof value === 'string' ? normalizeText(value) : '';
}

function chihiroStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const text = chihiroString(item);
    return text ? [text] : [];
  });
}

function chihiroPrice(product: ChihiroProductLike): string {
  const sku = chihiroSku(product);
  const display = chihiroString(sku?.display_price);
  const amount = typeof sku?.price === 'number' ? sku.price : Number(sku?.price);
  const normalizedDisplay = display.replaceAll('Â ', ' ');
  const lower = normalizedDisplay.toLowerCase();
  if (lower.includes('free') || lower.includes('ucretsiz') || lower.includes('ücretsiz')) {
    return '\u00dccretsiz';
  }
  if (normalizedDisplay) return withTlSuffix(normalizedDisplay);
  if (Number.isFinite(amount)) {
    if (amount <= 0) return '\u00dccretsiz';
    return formatTryPrice(amount / 100);
  }
  return 'Bilinmiyor';
}

function chihiroOriginalPrice(product: ChihiroProductLike): string | null {
  const record = product as Record<string, unknown>;
  const sku = chihiroSku(product) as Record<string, unknown> | null;
  const raw =
    chihiroString(record['original_price']) ||
    chihiroString(record['originalPrice']) ||
    chihiroString(sku?.['original_price']) ||
    chihiroString(sku?.['originalPrice']);
  return raw ? withTlSuffix(raw.replaceAll('Â ', ' ')) : null;
}

function chihiroDiscount(product: ChihiroProductLike, price: string, original: string | null): string {
  const record = product as Record<string, unknown>;
  const sku = chihiroSku(product) as Record<string, unknown> | null;
  const raw = record['discount'] ?? record['discount_percent'] ?? sku?.['discount_percent'];
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return `-${Math.round(raw)}%`;
  return discountFromPrices(price, original);
}

function chihiroImage(product: ChihiroProductLike): string {
  if (!Array.isArray(product.images)) return '';
  const images = product.images.filter(isRecord);
  const preferred =
    images.find((image) => image['type'] === 10) ??
    images.find((image) => image['type'] === 1) ??
    images[0];
  return normalizeImageUrl(chihiroString(preferred?.['url']));
}

function chihiroPlatforms(product: ChihiroProductLike): string[] {
  return chihiroStringArray(product.playable_platform);
}

function chihiroProductToParsed(
  product: ChihiroProductLike,
  pathLocale: string,
  detail = false,
): ParsedPlayStationProduct | null {
  const id = chihiroString(product.id);
  if (!id) return null;
  const title = chihiroString(detail ? product.title_name || product.name : product.name || product.title_name || product.short_name);
  if (!title) return null;

  const price = chihiroPrice(product);
  const originalPrice = chihiroOriginalPrice(product);
  const topCategory = chihiroString(product.top_category).toLowerCase();
  const contentType = chihiroString(product.game_contentType).toLowerCase();
  const sku = chihiroSku(product) as Record<string, unknown> | null;
  const rawEligibilities = Array.isArray(sku?.['eligibilities']) ? sku['eligibilities'] : [];
  const requiresEntitlement = rawEligibilities.some((item) => {
    if (!isRecord(item)) return false;
    const operand = stringField(item, 'operand').toUpperCase();
    const operator = stringField(item, 'operator').toUpperCase();
    return operand === 'IS_ACTIVE' && operator === 'TRUE';
  });

  const parsed: ParsedPlayStationProduct = {
    id,
    title,
    price,
    original_price: originalPrice,
    discount: chihiroDiscount(product, price, originalPrice),
    image_url: chihiroImage(product),
    store_url: getPlayStationStoreUrl(id, pathLocale),
    is_add_on:
      topCategory.includes('add_on') ||
      topCategory.includes('addon') ||
      contentType.includes('add_on') ||
      requiresEntitlement,
  };

  const platforms = chihiroPlatforms(product);
  if (platforms.length > 0) parsed.platforms = platforms;
  return parsed;
}

/** Parse either a Chihiro tumbler search payload or a container product payload. */
export function parsePlayStationChihiroResponse(
  value: unknown,
  pathLocale: string,
  detail = false,
): ParsedPlayStationProduct[] {
  const rawProducts =
    !detail && isRecord(value) && Array.isArray(value['links']) ? value['links'] : [value];
  const seen = new Set<string>();
  const products: ParsedPlayStationProduct[] = [];
  for (const raw of rawProducts) {
    if (!isRecord(raw)) continue;
    const parsed = chihiroProductToParsed(raw, pathLocale, detail);
    if (!parsed || seen.has(parsed.id)) continue;
    seen.add(parsed.id);
    products.push(parsed);
  }
  return products;
}
