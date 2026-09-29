import { pickBestTitleMatch, scoreProductTitleMatch } from '@/services/store/match';
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
