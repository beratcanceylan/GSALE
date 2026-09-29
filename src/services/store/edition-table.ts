import { baseTitle, editionKey, isDlcTitle, type EditionKey } from '@/services/store/editions';
import { scoreProductTitleMatch } from '@/services/store/match';
import type { GameDeal, PlatformPriceResult, StoreRequestOptions } from '@/services/store/types';

export type EditionOffer = Readonly<{
  platform: string;
  edition: EditionKey;
  /** Store product title, kept for tests and debugging. */
  title: string;
  /** Route id of the store product (same format as search hit ids). */
  id: string;
  price: PlatformPriceResult;
}>;

export type EditionOption = Readonly<{
  key: EditionKey;
  /** One deal per store, cheapest first; stores without this edition are absent. */
  deals: readonly GameDeal[];
}>;

export type EditionOffersFetcher = (title: string, options?: StoreRequestOptions) => Promise<EditionOffer[]>;

/** Most candidates a store contributes; keeps price conversions bounded. */
export const MAX_EDITION_CANDIDATES = 8;

const ROMAN_NUMERALS = new Set(['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii', 'xiii', 'xiv', 'xv', 'xvi']);

/** Numbers and Roman numerals of a title ("Hades II" → "ii"), which tell sequels apart. */
function sequelMarkers(title: string): string {
  const words = title.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  return words.filter((word) => /^\d+$/.test(word) || ROMAN_NUMERALS.has(word)).sort().join(' ');
}

/** The candidate's edition when it is an edition of `title`'s game, otherwise null. */
export function acceptEditionCandidate(candidateTitle: string, title: string): EditionKey | null {
  if (isDlcTitle(candidateTitle) && !isDlcTitle(title)) return null;
  const candidateBase = baseTitle(candidateTitle);
  const base = baseTitle(title);
  if (sequelMarkers(candidateBase) !== sequelMarkers(base)) return null;
  if (scoreProductTitleMatch(candidateBase, base) < 50) return null;
  return editionKey(candidateTitle);
}
