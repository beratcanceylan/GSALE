import { pickBestTitleMatch, scoreProductTitleMatch } from '@/services/store/match';
import { cleanStoreText, uniqueNonEmpty, type DetailMetadata } from '@/services/store/metadata';
import type { PlatformSearchHit } from '@/services/store/types';

export interface EpicOfferImage {
  type?: string;
  url?: string;
}

export interface EpicOffer {
  id?: string;
  namespace?: string;
  title?: string;
  description?: string;
  longDescription?: string | null;
  releaseDate?: string | null;
  pcReleaseDate?: string | null;
  developerDisplayName?: string | null;
  publisherDisplayName?: string | null;
  productSlug?: string | null;
  urlSlug?: string | null;
  url?: string | null;
  offerType?: string;
  keyImages?: EpicOfferImage[];
  tags?: { name?: string | null }[];
  seller?: { name?: string | null } | null;
  customAttributes?: Record<string, unknown> | { key?: string; value?: unknown }[];
}

export interface EpicMediaOutput {
  key?: string | null;
  url?: string | null;
}

export interface EpicMediaVideo {
  outputs?: EpicMediaOutput[];
}

export interface EpicMediaResponse {
  images?: { src?: string | null }[];
  videos?: EpicMediaVideo[];
}

export function epicImage(el: { keyImages?: EpicOfferImage[] }): string {
  const images = el.keyImages ?? [];
  const wide =
    images.find((i) => i.type === 'OfferImageWide') ||
    images.find((i) => i.type === 'DieselStoreFrontWide');
  const tall =
    images.find((i) => i.type === 'Thumbnail') ||
    images.find((i) => i.type === 'OfferImageTall');
  return wide?.url || tall?.url || images[0]?.url || '';
}

export function epicDetailImage(
  offer: { keyImages?: EpicOfferImage[] },
  media?: EpicMediaResponse | null,
): string {
  return media?.images?.find((image) => image.src)?.src || epicImage(offer);
}

const EPIC_DETAIL_IMAGE_TYPES = new Set([
  'dieselgamebox',
  'dieselgameboxwide',
  'dieselstorefrontwide',
  'offerimagewide',
  'featuredmedia',
]);

export function epicOfferToGameMedia(offer: { keyImages?: EpicOfferImage[] }): DetailMetadata {
  const metadata: DetailMetadata = {};
  const screenshotUrls: (string | null | undefined)[] = [];
  for (const image of offer.keyImages ?? []) {
    if (EPIC_DETAIL_IMAGE_TYPES.has((image.type ?? '').toLowerCase())) {
      screenshotUrls.push(image.url);
    }
  }
  const screenshots = uniqueNonEmpty(screenshotUrls).slice(0, 12);

  if (screenshots.length > 0) metadata.screenshots = screenshots;
  return metadata;
}

export function getEpicRouteSlug(el: EpicOffer): string {
  if (el.namespace && el.id) return `${el.namespace}_${el.id}`;
  return el.productSlug || el.urlSlug || el.id || '';
}

function epicProductPath(el: EpicOffer): string | null {
  const raw = el.productSlug || el.urlSlug || el.url;
  if (!raw) return null;
  return raw.replace(/^\/+/, '').replace(/^p\//, '');
}

export function epicOfferToSearchHit(el: EpicOffer): PlatformSearchHit | null {
  if (!el.title) return null;
  const slug = getEpicRouteSlug(el);
  if (!slug) return null;

  const productPath = epicProductPath(el);
  return {
    id: `epic-${slug}`,
    slug,
    title: el.title,
    image_url: epicImage(el),
    platform: 'Epic Games',
    store_url: productPath
      ? `https://store.epicgames.com/p/${productPath}`
      : 'https://store.epicgames.com/',
  };
}

function offerPriority(offer: EpicOffer, searchTitle: string): number {
  const titleScore = scoreProductTitleMatch(offer.title, searchTitle);
  const type = offer.offerType?.toUpperCase() ?? '';
  let score = titleScore;
  if (type === 'BASE_GAME') score += 25;
  if (type === 'DLC' || type === 'ADD_ON') score -= 35;
  if (type === 'OTHERS') score -= 15;

  // Epic often indexes one mobile offer beside the storefront offer. Prefer
  // the storefront record because it carries richer description/media data.
  const slug = `${offer.productSlug ?? ''} ${offer.urlSlug ?? ''}`.toLowerCase();
  const mobileAttribute = Array.isArray(offer.customAttributes)
    ? offer.customAttributes.some((attribute) =>
        (typeof attribute.key === 'string' && /(?:ios|android)/i.test(attribute.key)) ||
        (typeof attribute.value === 'string' && /(?:ios|android)/i.test(attribute.value)),
      )
    : Object.entries(offer.customAttributes ?? {}).some(([key, value]) =>
        /(?:ios|android)/i.test(key) || (typeof value === 'string' && /(?:ios|android)/i.test(value)),
      );
  if (/(^|[-_])(ios|android)([-_]|$)/i.test(slug) || mobileAttribute) score -= 24;
  if (offer.description || offer.longDescription) score += 4;
  if ((offer.keyImages?.length ?? 0) >= 3) score += 2;
  return score;
}

export function pickBestEpicOffer<T extends EpicOffer>(
  offers: T[],
  searchTitle: string,
): T | null {
  const titleMatch = pickBestTitleMatch(offers, searchTitle, (offer) => offer.title ?? '');
  if (!titleMatch) return null;

  let best = titleMatch;
  let bestScore = offerPriority(titleMatch, searchTitle);
  for (const offer of offers) {
    const score = offerPriority(offer, searchTitle);
    if (score > bestScore) {
      best = offer;
      bestScore = score;
    }
  }
  return best;
}

export function pickBestEpicOfferForTitles<T extends EpicOffer>(
  offers: T[],
  searchTitles: string[],
): T | null {
  for (const title of searchTitles) {
    const match = pickBestEpicOffer(offers, title);
    if (match) return match;
  }
  return null;
}

/** Collapse duplicate Epic listings to one representative product per title. */
export function pickBestEpicOffers<T extends EpicOffer>(offers: T[], searchTitle: string): T[] {
  const bestByTitle = new Map<string, { offer: T; score: number }>();
  for (const offer of offers) {
    const title = offer.title?.trim();
    if (!title) continue;
    const key = title.toLowerCase();
    const score = offerPriority(offer, searchTitle);
    const current = bestByTitle.get(key);
    if (!current || score > current.score) {
      bestByTitle.set(key, { offer, score });
    }
  }
  return [...bestByTitle.values()].map((entry) => entry.offer);
}

const EPIC_TAG_DENYLIST = new Set([
  'achievements',
  'epic mega sale',
  'windows',
  'mac os',
  'recommend this game',
  'great for beginners',
]);

export function epicMetadataFromOffer(offer: EpicOffer): DetailMetadata {
  const metadata: DetailMetadata = {};
  const description = cleanStoreText(offer.description || offer.longDescription || '');
  const developers = uniqueNonEmpty([
    offer.developerDisplayName,
    offer.publisherDisplayName,
    offer.seller?.name,
  ]);
  const genreNames: (string | null | undefined)[] = [];
  for (const tag of offer.tags ?? []) {
    const name = tag.name;
    if (!EPIC_TAG_DENYLIST.has((name ?? '').trim().toLowerCase())) {
      genreNames.push(name);
    }
  }
  const genres = uniqueNonEmpty(genreNames).slice(0, 8);

  if (description) metadata.description = description;
  const releaseDate = offer.pcReleaseDate || offer.releaseDate || '';
  if (releaseDate) metadata.release_date = releaseDate;
  if (developers.length > 0) metadata.developers = developers;
  if (genres.length > 0) metadata.genres = genres;
  return metadata;
}

function pickEpicVideoUrl(outputs: EpicMediaOutput[] | undefined): string {
  const preferred =
    outputs?.find((output) => output.key === 'high') ||
    outputs?.find((output) => output.key === 'medium') ||
    outputs?.find((output) => output.key === 'low') ||
    outputs?.find((output) => output.url && output.key !== 'thumbnail');
  return preferred?.url ?? '';
}

function pickEpicVideoThumbnail(outputs: EpicMediaOutput[] | undefined): string {
  return outputs?.find((output) => output.key === 'thumbnail')?.url ?? '';
}

export function epicMediaToGameMedia(media: EpicMediaResponse | null | undefined): DetailMetadata {
  const metadata: DetailMetadata = {};
  const screenshots = uniqueNonEmpty((media?.images ?? []).map((image) => image.src));
  const videos = (media?.videos ?? []).flatMap((video, index) => {
    const url = pickEpicVideoUrl(video.outputs);
    if (!url) return [];
    const item: NonNullable<DetailMetadata['videos']>[number] = {
      platform: 'epic',
      id: `epic-video-${index}`,
      url,
    };
    const thumbnail = pickEpicVideoThumbnail(video.outputs);
    if (thumbnail) item.thumbnail = thumbnail;
    return [item];
  });

  if (screenshots.length > 0) metadata.screenshots = screenshots;
  if (videos.length > 0) metadata.videos = videos;
  return metadata;
}
