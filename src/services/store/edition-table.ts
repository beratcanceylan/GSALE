import { platformPriceToGameDeal } from '@/services/store/deals';
import { baseTitle, compareEditions, editionKey, isDlcTitle, type EditionKey } from '@/services/store/editions';
import { scoreProductTitleMatch } from '@/services/store/match';
import { isExplicitlyFreePrice, isUnavailablePrice, parseLocalizedAmount } from '@/services/store/price-parse';
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

function comparableAmount(deal: GameDeal): number {
  if (isExplicitlyFreePrice(deal.price)) return 0;
  return parseLocalizedAmount(deal.price) ?? Number.POSITIVE_INFINITY;
}

function byAmount(a: GameDeal, b: GameDeal): number {
  return comparableAmount(a) - comparableAmount(b);
}

/** Groups offers into editions (base first), keeping each store's cheapest deal, cheapest store first. */
export function buildEditionTable(offers: readonly EditionOffer[]): EditionOption[] {
  const byEdition = new Map<EditionKey, Map<string, GameDeal>>();
  for (const offer of offers) {
    if (isUnavailablePrice(offer.price.price)) continue;
    const deal = platformPriceToGameDeal(offer.price);
    const stores = byEdition.get(offer.edition) ?? new Map<string, GameDeal>();
    const current = stores.get(offer.platform);
    if (!current || comparableAmount(deal) < comparableAmount(current)) stores.set(offer.platform, deal);
    byEdition.set(offer.edition, stores);
  }
  const keys = [...byEdition.keys()].sort(compareEditions);
  return keys.map((key) => ({ key, deals: [...(byEdition.get(key)?.values() ?? [])].sort(byAmount) }));
}
