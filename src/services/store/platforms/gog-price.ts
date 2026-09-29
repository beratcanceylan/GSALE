import { formatPriceAsTry } from '@/services/store/currency';
import {
  cleanStoreText,
  normalizeDottedDate,
  uniqueNonEmpty,
  type DetailMetadata,
} from '@/services/store/metadata';

export interface GogMoney {
  amount?: string;
  currency?: string;
}

export interface GogPriceBlock {
  final?: string;
  base?: string;
  discount?: string | null;
  finalMoney?: GogMoney;
  baseMoney?: GogMoney;
}

export interface GogProduct {
  id: number;
  title: string;
  slug: string;
  coverHorizontal?: string;
  coverVertical?: string;
  storeLink?: string;
  price?: GogPriceBlock;
  screenshots?: string[];
  releaseDate?: string;
  storeReleaseDate?: string;
  developers?: string[];
  publishers?: string[];
  genres?: ({ name?: string } | string)[];
}

export interface GogExpandedProduct {
  id?: number | string;
  title?: string;
  slug?: string;
  images?: Record<string, string | undefined>;
  description?: {
    lead?: string;
    full?: string;
    whats_cool_about_it?: string;
  };
  screenshots?: { formatter_template_url?: string }[];
  videos?: {
    provider?: string;
    video_url?: string;
    thumbnail_url?: string;
  }[];
}

export function gogImage(product: GogProduct): string {
  return product.coverHorizontal || product.coverVertical || '';
}

export function gogScreenshotUrl(url: string): string {
  return url.replaceAll('{formatter}', '1920');
}

function gogYoutubeVideoId(url: string): string {
  if (!/(^https?:)?\/\/([^/]+\.)?(youtube\.com|youtube-nocookie\.com|youtu\.be)\//i.test(url)) return '';
  const embed = /\/embed\/([^?/#]+)/.exec(url)?.[1];
  const watch = /[?&]v=([^?&#]+)/.exec(url)?.[1];
  const short = /youtu\.be\/([^?/#]+)/.exec(url)?.[1];
  return embed || watch || short || '';
}

function gogVideoUrl(id: string, fallback: string): string {
  return id ? `https://www.youtube.com/watch?v=${id}` : fallback;
}

function normalizeGogDiscount(value: string | null | undefined): string {
  const percent = Number.parseInt(/\d{1,3}/.exec(value ?? '')?.[0] ?? '', 10);
  if (!Number.isFinite(percent) || percent <= 0) return '';
  return `-${percent}%`;
}

export function pickGogProductById(products: GogProduct[], id: string | number): GogProduct | null {
  const normalizedId = String(id).replace(/^gog-/, '');
  return products.find((product) => String(product.id) === normalizedId) ?? null;
}

export function gogMetadataFromProduct(
  product: GogProduct,
  expanded?: GogExpandedProduct | null,
): DetailMetadata {
  const metadata: DetailMetadata = {};
  const description = cleanStoreText(
    expanded?.description?.full ||
      expanded?.description?.lead ||
      expanded?.description?.whats_cool_about_it ||
      '',
  );
  const releaseDate = normalizeDottedDate(product.releaseDate || product.storeReleaseDate);
  const developers = uniqueNonEmpty([...(product.developers ?? []), ...(product.publishers ?? [])]);
  const genres = uniqueNonEmpty(
    (product.genres ?? []).map((genre) => (typeof genre === 'string' ? genre : genre.name)),
  );
  const screenshots = uniqueNonEmpty(
    (expanded?.screenshots?.length ? expanded.screenshots.map((s) => s.formatter_template_url) : product.screenshots)
      ?.map((url) => (url ? gogScreenshotUrl(url) : '')) ?? [],
  );
  const videos = (expanded?.videos ?? []).flatMap((video) => {
    if (!video.video_url) return [];
    const id = gogYoutubeVideoId(video.video_url);
    if (!id) return [];
    const item: NonNullable<DetailMetadata['videos']>[number] = {
      platform: 'youtube',
      id,
      url: gogVideoUrl(id, video.video_url),
    };
    if (video.thumbnail_url) item.thumbnail = video.thumbnail_url;
    return [item];
  });

  if (description) metadata.description = description;
  if (releaseDate) metadata.release_date = releaseDate;
  if (developers.length > 0) metadata.developers = developers;
  if (genres.length > 0) metadata.genres = genres;
  if (screenshots.length > 0) metadata.screenshots = screenshots;
  if (videos.length > 0) metadata.videos = videos;
  return metadata;
}

export async function gogPriceFromProduct(
  product: GogProduct,
  signal?: AbortSignal,
): Promise<{
  price: string;
  original_price: string | null;
  discount: string;
}> {
  const block = product.price;
  if (!block) {
    return { price: 'Bilinmiyor', original_price: null, discount: '' };
  }

  const finalAmount = Number.parseFloat(block.finalMoney?.amount ?? '');
  const baseAmount = Number.parseFloat(block.baseMoney?.amount ?? '');
  const finalCurrency = block.finalMoney?.currency;
  const baseCurrency = block.baseMoney?.currency;

  if (Number.isFinite(finalAmount)) {
    const price = await formatPriceAsTry(finalAmount, finalCurrency, signal);
    const hasDiscount =
      block.discount &&
      block.discount !== '0' &&
      Number.isFinite(baseAmount) &&
      baseAmount > finalAmount;
    const original_price = hasDiscount
      ? await formatPriceAsTry(baseAmount, baseCurrency ?? finalCurrency, signal)
      : null;
    const discount = hasDiscount ? normalizeGogDiscount(block.discount) : '';
    return { price, original_price, discount };
  }

  if (block.final?.trim()) {
    return {
      price: block.final.trim(),
      original_price: block.base?.trim() || null,
      discount: normalizeGogDiscount(block.discount),
    };
  }

  return { price: 'Bilinmiyor', original_price: null, discount: '' };
}
