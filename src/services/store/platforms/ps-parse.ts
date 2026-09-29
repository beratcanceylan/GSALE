import { scoreProductTitleMatch } from '@/services/store/match';
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
  description?: string;
  release_date?: string;
  developers?: string[];
  genres?: string[];
  platforms?: string[];
  screenshots?: string[];
  videos?: { platform: string; id: string; url?: string; thumbnail?: string }[];
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
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)));
}

function normalizeText(value: string | undefined | null): string {
  if (!value) return '';
  return decodeHtmlEntities(value)
    .replaceAll('Â ', ' ')
    .replace(/<[^>]*>/g, ' ')
    .replaceAll('\u00a0', ' ')
    .replace(/\s+/g, ' ')
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
  return text.replace(/\s*TL$/i, ' TL');
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

export function getPsSearchQueryCandidates(query: string): string[] {
  const candidates: string[] = [];
  const rawTerm = query.trim().replace(/\s+/g, '_');

  const sanitized = query
    .replace(/[™®©]/g, '')
    .replace(/['’`,\.]/g, '')
    .replace(/[:/]/g, ' ')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const sanitizedTerm = sanitized.replace(/\s+/g, '_');

  if (sanitized.includes('-')) {
    const noHyphen = sanitized.replace(/-/g, '').replace(/\s+/g, '_');
    if (noHyphen && !candidates.includes(noHyphen)) candidates.push(noHyphen);
    const spaceHyphen = sanitized.replace(/-/g, ' ').replace(/\s+/g, '_');
    if (spaceHyphen && !candidates.includes(spaceHyphen)) candidates.push(spaceHyphen);
  }

  if (sanitizedTerm && !candidates.includes(sanitizedTerm)) {
    candidates.push(sanitizedTerm);
  }
  if (rawTerm && !candidates.includes(rawTerm)) {
    candidates.push(rawTerm);
  }

  const colonIndex = query.indexOf(':');
  if (colonIndex > 0) {
    const prefix = query
      .slice(0, colonIndex)
      .replace(/[™®©]/g, '')
      .replace(/['’`,\.]/g, '')
      .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
      .replace(/\s+/g, '_')
      .trim();
    if (prefix && !candidates.includes(prefix) && prefix.length >= 3) {
      candidates.push(prefix);
    }
  }

  return candidates.length > 0 ? candidates : [rawTerm];
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

function parseLocalizedGenres(record: Record<string, unknown> | undefined): string[] {
  const raw = record?.['localizedGenres'];
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((genre) => {
    if (!isRecord(genre)) return [];
    const value = genre['value'];
    return typeof value === 'string' && value.trim() ? [normalizeText(value)] : [];
  });
}

function firstStringField(records: Record<string, unknown>[], field: string): string {
  for (const record of records) {
    const value = stringField(record, field);
    if (value) return value;
  }
  return '';
}

function mergedLocalizedGenres(records: Record<string, unknown>[]): string[] {
  const seen = new Set<string>();
  return records.flatMap((record) =>
    parseLocalizedGenres(record).flatMap((genre) => {
      const key = genre.toLowerCase();
      if (seen.has(key)) return [];
      seen.add(key);
      return [genre];
    }),
  );
}

function addConceptScreenshot(
  url: string,
  screenshots: string[],
  seenScreenshots: Set<string>,
): void {
  if (seenScreenshots.has(url)) return;
  seenScreenshots.add(url);
  screenshots.push(url);
}

function addConceptVideo(
  url: string,
  videos: NonNullable<ParsedPlayStationProduct['videos']>,
  seenVideos: Set<string>,
): void {
  if (seenVideos.has(url)) return;
  seenVideos.add(url);
  videos.push({ platform: 'ps', id: `ps-video-${videos.length}`, url });
}

function collectConceptMediaFromRecord(
  record: Record<string, unknown>,
  screenshots: string[],
  videos: NonNullable<ParsedPlayStationProduct['videos']>,
  seenScreenshots: Set<string>,
  seenVideos: Set<string>,
): void {
  const meta = record['personalizedMeta'];
  if (!isRecord(meta) || !Array.isArray(meta['media'])) return;

  for (const media of meta['media']) {
    if (!isRecord(media)) continue;
    const url = stringField(media, 'url');
    if (!url) continue;

    const role = stringField(media, 'role').toUpperCase();
    const type = stringField(media, 'type').toUpperCase();
    if (role === 'SCREENSHOT' && type === 'IMAGE') {
      addConceptScreenshot(url, screenshots, seenScreenshots);
      continue;
    }
    if (role === 'PREVIEW' && type === 'VIDEO') {
      addConceptVideo(url, videos, seenVideos);
    }
  }
}

function parseConceptMedia(records: Record<string, unknown>[]): Pick<ParsedPlayStationProduct, 'screenshots' | 'videos'> {
  const screenshots: string[] = [];
  const videos: NonNullable<ParsedPlayStationProduct['videos']> = [];
  const seenScreenshots = new Set<string>();
  const seenVideos = new Set<string>();

  for (const record of records) {
    collectConceptMediaFromRecord(record, screenshots, videos, seenScreenshots, seenVideos);
  }

  const parsed: Pick<ParsedPlayStationProduct, 'screenshots' | 'videos'> = {};
  if (screenshots.length > 0) parsed.screenshots = screenshots;
  if (videos.length > 0) parsed.videos = videos;
  return parsed;
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
    const local = isRecord(cta['local']) ? cta['local'] : {};
    const priceObj = isRecord(cta['price']) ? cta['price'] : {};
    const rawPrice = stringField(local, 'priceOrText') || stringField(priceObj, 'discountedPrice');
    const rawOriginal = stringField(local, 'originalPrice') || stringField(priceObj, 'basePrice');
    const discountBadge = stringField(local, 'discountBadgeText') || stringField(priceObj, 'displayDiscountText');

    const telemetry = isRecord(local['telemetryMeta']) ? local['telemetryMeta'] : undefined;
    const skuDetail = isRecord(telemetry?.['skuDetail']) ? telemetry['skuDetail'] : undefined;
    const priceDetails = Array.isArray(skuDetail?.['skuPriceDetail']) ? skuDetail['skuPriceDetail'] : [];
    const applicableOffer = priceDetails.find(
      (p) => isRecord(p) && p['offerApplicability'] === 'APPLICABLE' && !p['offerIsTiedToSubscription'],
    ) as Record<string, unknown> | undefined;

    let finalPrice = rawPrice;
    let finalOriginal = rawOriginal;

    if (applicableOffer) {
      const discFormatted = stringField(applicableOffer, 'discountPriceFormatted');
      const origFormatted = stringField(applicableOffer, 'originalPriceFormatted');
      if (discFormatted && !isUnavailablePrice(discFormatted) && discFormatted.toLowerCase() !== 'dahil') {
        finalPrice = discFormatted;
      }
      if (origFormatted && origFormatted !== discFormatted) {
        finalOriginal = origFormatted;
      }
    }

    if (priceObj['isTiedToSubscription'] === true && /ücretsiz|free/i.test(finalPrice)) {
      continue;
    }

    if (extractNumericPrice(finalPrice) !== null || /ücretsiz|free/i.test(finalPrice)) {
      const normPrice = normalizePrice(finalPrice);
      const normOriginal =
        extractNumericPrice(finalOriginal) !== null && finalOriginal !== finalPrice
          ? normalizePrice(finalOriginal)
          : null;
      const discount = discountBadge ? discountFromText(discountBadge) : discountFromPrices(normPrice, normOriginal);
      return {
        price: normPrice,
        original_price: normOriginal,
        discount,
      };
    }
  }

  return null;
}

export function parsePlayStationProductHtml(
  html: string,
  productId: string,
  pathLocale: string,
): ParsedPlayStationProduct | null {
  const jsonLd = parseJsonLd(html);
  const cacheRecords = parseJsonCacheRecords(html);
  const productRecords = cacheRecords.filter((record) => stringField(record, 'id') === productId);
  const fallbackTitle = firstStringField(productRecords, 'name') || firstStringField(productRecords, 'invariantName');
  const title = normalizeText(jsonLd?.name) || fallbackTitle;
  const image =
    Array.isArray(jsonLd?.image)
      ? normalizeText(jsonLd.image[0])
      : normalizeText(jsonLd?.image);
  const description = normalizeText(jsonLd?.description);
  const publisher = firstStringField(productRecords, 'publisherName');
  const releaseDate = firstStringField(productRecords, 'releaseDate');
  const genres = mergedLocalizedGenres(productRecords);
  const media = parseConceptMedia(cacheRecords);
  const cachedPrice = extractProductPriceFromCacheRecords(cacheRecords, productId);
  let price = cachedPrice?.price ?? normalizePrice(extractJsonField(html, 'priceOrText'));
  if (isUnavailablePrice(price) && jsonLd?.offers?.price !== undefined) {
    const jsonLdNum = Number(jsonLd.offers.price);
    if (Number.isFinite(jsonLdNum)) {
      price = jsonLdNum <= 0 ? 'Ücretsiz' : formatTryPrice(jsonLdNum);
    }
  }
  const originalPriceRaw = extractJsonField(html, 'originalPrice');
  const originalPrice =
    cachedPrice !== null
      ? cachedPrice.original_price
      : (originalPriceRaw ? normalizePrice(originalPriceRaw) : null);
  const discount =
    cachedPrice?.discount ||
    discountFromText(extractJsonField(html, 'discountBadgeText')) ||
    discountFromPrices(price, originalPrice);

  if (!title && price === 'Bilinmiyor') return null;

  const product: ParsedPlayStationProduct = {
    id: productId,
    title,
    price,
    original_price: originalPrice,
    discount,
    image_url: image,
    store_url: getPlayStationStoreUrl(productId, pathLocale),
  };
  if (description) product.description = description;
  if (releaseDate) product.release_date = releaseDate;
  if (publisher) product.developers = [publisher];
  if (genres.length > 0) product.genres = genres;
  if (media.screenshots) product.screenshots = media.screenshots;
  if (media.videos) product.videos = media.videos;
  return product;
}

export function cleanPsProductTitle(title: string): string {
  if (!title) return '';
  return title
    .replace(/[™®©]/g, '')
    .replace(
      /\s*[-–—]?\s*(Standart|Lüks|Deluxe|D[iİıI]j[iİıI]tal\s+Deluxe|D[iİıI]j[iİıI]tal|Seçk[iİıI]n|Özel|N[iİıI]ha[iİıI]|Gen[iİıI]şlet[iİıI]lm[iİıI]ş|Tam|Complete|Yönetmen[iİıI]n)\s*Sürüm[üu]?/gi,
      '',
    )
    .replace(
      /\s*[-–—]?\s*(Deluxe|Ultimate|Definitive|Enhanced|GOTY|Game of the Year|Complete|Special|Remastered|Anniversary|Collector|Standard|Director'?s Cut)\s*Edition/gi,
      '',
    )
    .replace(
      /\s*[-–—]?\s*(Deluxe|Ultimate|Definitive|Enhanced|GOTY|Game of the Year|Complete|Special|Remastered|Anniversary|Collector|Standard|Director'?s Cut)\b/gi,
      '',
    )
    .replace(/\s*[-–—]?\s*(Cross-Gen|Çapraz Nesil)(\s*(Paket[iİıI]?|Bundle))?/gi, '')
    .replace(/\b(PS4\s*(ve|&|\/)\s*PS5|PS5\s*(ve|&|\/)\s*PS4)\b/gi, '')
    .replace(/\bPS[45]\b/gi, '')
    .replace(/\bPlayStation\s*[45]\b/gi, '')
    .replace(/(?:^|\s)(Sürüm[üu]?|Edition|Console\s+Edition|Bundle|Paket[iİıI]?|Başlatıcısı|Launcher)(?:\s|$)/gi, ' ')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s*[-–—:/]+\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasLegacyOnlyPlayStationPlatform(product: ParsedPlayStationProduct): boolean {
  if (!product.platforms || product.platforms.length === 0) return false;
  const hasModern = product.platforms.some((p) => /ps[45]|playstation\s*[45]/i.test(p));
  const hasLegacy = product.platforms.some((p) => /ps[23]|vita|psp/i.test(p));
  return hasLegacy && !hasModern;
}

export type PsEditionType =
  | 'base'
  | 'deluxe'
  | 'ultimate'
  | 'complete'
  | 'goty'
  | 'gold'
  | 'premium'
  | 'collector'
  | 'special'
  | 'directors_cut'
  | 'anniversary'
  | 'vault'
  | 'bundle';

const PS_STANDARD_REGEX =
  /\b(standart|standard)(?:\s*(?:s[üÜuU]r[üÜuU]m[üÜuU]?|edition))?\b/iu;

const PS_DIRECTORS_CUT_REGEX =
  /\b(director'?s\s*cut|y[öÖoO]netmen[iİıI]n\s*s[üÜuU]r[üÜuU]m[üÜuU]?)\b/iu;

const PS_DELUXE_REGEX =
  /\b(deluxe|l[üÜuU]ks|d[iİıI]j[iİıI]tal\s+deluxe|digital\s+deluxe|d[iİıI]j[iİıI]tal\s+l[üÜuU]ks|digital\s+l[üÜuU]ks)\b/iu;

const PS_ULTIMATE_REGEX =
  /\b(ultimate|n[iİıI]ha[iİıI]\s*s[üÜuU]r[üÜuU]m[üÜuU]?|n[iİıI]ha[iİıI])\b/iu;

const PS_COMPLETE_REGEX =
  /\b(complete(?:\s+edition)?|tam\s*s[üÜuU]r[üÜuU]m[üÜuU]?)\b/iu;

const PS_GOTY_REGEX =
  /\b(goty|game\s+of\s+the\s+year|y[ıI]l[ıI]n\s+oyunu)\b/iu;

const PS_GOLD_REGEX =
  /\b(gold(?:\s+edition)?|alt[ıI]n\s*s[üÜuU]r[üÜuU]m[üÜuU]?)\b/iu;

const PS_PREMIUM_REGEX =
  /\b(premium(?:\s+edition)?|se[çc]k[iİıI]n\s*s[üÜuU]r[üÜuU]m[üÜuU]?|se[çc]k[iİıI]n)\b/iu;

const PS_COLLECTOR_REGEX =
  /\b(collector'?s?(?:\s*edition)?|koleks[iİıI]yon(?:cu)?\s*s[üÜuU]r[üÜuU]m[üÜuU]?)\b/iu;

const PS_VAULT_REGEX =
  /\b(vault(?:\s+edition)?|kasa\s*s[üÜuU]r[üÜuU]m[üÜuU]?)\b/iu;

const PS_SPECIAL_REGEX =
  /\b(special(?:\s+edition)?|[öÖoO]zel\s*s[üÜuU]r[üÜuU]m[üÜuU]?|[öÖoO]zel)\b/iu;

const PS_ANNIVERSARY_REGEX =
  /\b(anniversary(?:\s+edition)?|y[ıI]ld[öÖoO]n[üÜuU]m[üÜuU]?(?:\s*s[üÜuU]r[üÜuU]m[üÜuU]?)?)\b/iu;

function hasPsBundleEdition(title: string): boolean {
  const withoutCrossGen = title.replace(
    /\s*[-–—]?\s*(cross-gen|[çc]apraz\s+nes[iİıI]l)(\s*(paket[iİıI]?|bundle))?\b/giu,
    ' ',
  );
  return /\b(bundle|paket[iİıI]?)\b/iu.test(withoutCrossGen);
}

export function extractPsEdition(title: string): PsEditionType {
  if (!title) return 'base';
  if (PS_STANDARD_REGEX.test(title)) return 'base';
  if (PS_DIRECTORS_CUT_REGEX.test(title)) return 'directors_cut';
  if (PS_DELUXE_REGEX.test(title)) return 'deluxe';
  if (PS_ULTIMATE_REGEX.test(title)) return 'ultimate';
  if (PS_COMPLETE_REGEX.test(title)) return 'complete';
  if (PS_GOTY_REGEX.test(title)) return 'goty';
  if (PS_GOLD_REGEX.test(title)) return 'gold';
  if (PS_PREMIUM_REGEX.test(title)) return 'premium';
  if (PS_COLLECTOR_REGEX.test(title)) return 'collector';
  if (PS_VAULT_REGEX.test(title)) return 'vault';
  if (PS_SPECIAL_REGEX.test(title)) return 'special';
  if (PS_ANNIVERSARY_REGEX.test(title)) return 'anniversary';
  if (hasPsBundleEdition(title)) return 'bundle';
  return 'base';
}

function normalizeTitleForExactCheck(title: string): string {
  return title
    .toLowerCase()
    .replace(/[™®©]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

export function scorePlayStationProduct(
  product: ParsedPlayStationProduct,
  searchTitle: string,
): number {
  const cleanedSearch = cleanPsProductTitle(searchTitle);
  const cleanedTitle = cleanPsProductTitle(product.title);

  const scoreCleaned = cleanedSearch
    ? scoreProductTitleMatch(cleanedTitle, cleanedSearch)
    : 0;
  const scoreCleanTitleMatch = scoreProductTitleMatch(cleanedTitle, searchTitle);
  const scoreRaw = scoreProductTitleMatch(product.title, searchTitle);
  let titleScore = Math.max(scoreCleaned, scoreCleanTitleMatch, scoreRaw);

  if (titleScore < 50) return 0;

  const searchEdition = extractPsEdition(searchTitle);
  const productEdition = extractPsEdition(product.title);

  if (searchEdition === 'base') {
    if (productEdition === 'base') {
      titleScore += 15;
    } else {
      titleScore = Math.max(50, titleScore - 25);
    }
  } else {
    if (productEdition === searchEdition) {
      titleScore += 25;
    } else if (productEdition === 'base') {
      titleScore = Math.max(50, titleScore - 15);
    } else {
      titleScore = Math.max(50, titleScore - 25);
    }
  }

  const normSearch = normalizeTitleForExactCheck(searchTitle);
  const normProduct = normalizeTitleForExactCheck(product.title);
  if (normSearch && normProduct === normSearch) {
    titleScore += 10;
  }

  return Math.max(0, titleScore);
}

export function pickBestAvailablePlayStationProduct(
  products: ParsedPlayStationProduct[],
  matchTitle: string,
): ParsedPlayStationProduct | null {
  const nonAddOns = products.filter((product) => !product.is_add_on);
  const modernProducts = nonAddOns.filter((product) => !hasLegacyOnlyPlayStationPlatform(product));
  const candidatePool = modernProducts.length > 0 ? modernProducts : nonAddOns;

  const available = candidatePool.filter((product) => !isUnavailablePrice(product.price));

  const matchCandidate = (pool: ParsedPlayStationProduct[]): ParsedPlayStationProduct | null => {
    let best: ParsedPlayStationProduct | null = null;
    let bestScore = 0;

    for (const product of pool) {
      const score = scorePlayStationProduct(product, matchTitle);
      if (score < 50) continue;

      if (score > bestScore) {
        best = product;
        bestScore = score;
      } else if (score === bestScore && best !== null) {
        const currentPrice = extractNumericPrice(product.price);
        const bestPrice = extractNumericPrice(best.price);
        if (currentPrice !== null && bestPrice !== null && currentPrice < bestPrice) {
          best = product;
        }
      }
    }

    return bestScore >= 50 ? best : null;
  };

  return matchCandidate(available) ?? matchCandidate(candidatePool);
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
  if (normalizedDisplay) return normalizedDisplay.replace(/\s*TL$/i, ' TL');
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
  return raw ? raw.replaceAll('Â ', ' ').replace(/\s*TL$/i, ' TL') : null;
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

function chihiroGenres(product: ChihiroProductLike): string[] {
  if (!isRecord(product.metadata)) return [];
  const values: string[] = [];
  for (const key of ['genre', 'game_genre', 'genres']) {
    const metadata = product.metadata[key];
    if (isRecord(metadata)) values.push(...chihiroStringArray(metadata['values']));
    else values.push(...chihiroStringArray(metadata));
  }
  return [...new Set(values)];
}

function chihiroMedia(product: ChihiroProductLike): Pick<ParsedPlayStationProduct, 'screenshots' | 'videos'> {
  if (!isRecord(product.mediaList)) return {};
  const mediaList = product.mediaList;
  const screenshots: string[] = [];
  const videos: NonNullable<ParsedPlayStationProduct['videos']> = [];
  const addScreenshot = (value: unknown): void => {
    const url = chihiroString(value);
    if (url && !screenshots.includes(url)) screenshots.push(url);
  };

  const rawScreenshots = Array.isArray(mediaList['screenshots']) ? mediaList['screenshots'] : [];
  for (const raw of rawScreenshots) {
    if (!isRecord(raw)) continue;
    addScreenshot(raw['url']);
  }

  const rawPreviews = Array.isArray(mediaList['previews']) ? mediaList['previews'] : [];
  for (const raw of rawPreviews) {
    if (!isRecord(raw)) continue;
    const url = chihiroString(raw['url']);
    if (!url) continue;
    videos.push({ platform: 'ps', id: `ps-video-${videos.length}`, url });
    if (Array.isArray(raw['shots'])) {
      for (const shot of raw['shots']) {
        if (isRecord(shot)) addScreenshot(shot['url']);
        else addScreenshot(shot);
      }
    }
  }

  return {
    ...(screenshots.length > 0 ? { screenshots } : {}),
    ...(videos.length > 0 ? { videos } : {}),
  };
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

  const description = chihiroString(product.long_desc);
  const releaseDate = chihiroString(product.release_date);
  const provider = chihiroString(product.provider_name);
  const platforms = chihiroPlatforms(product);
  const genres = chihiroGenres(product);
  if (description) parsed.description = description;
  if (releaseDate) parsed.release_date = releaseDate;
  if (provider) parsed.developers = [provider];
  if (genres.length > 0) parsed.genres = genres;
  if (platforms.length > 0) parsed.platforms = platforms;
  if (detail) Object.assign(parsed, chihiroMedia(product));
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
