import { platformPriceToGameDeal } from '@/services/store/deals';
import { compareEditions, editionKey, gameKey, isDlcTitle, type EditionKey } from '@/services/store/editions';
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

/**
 * The candidate's edition when it is an edition of `title`'s game, otherwise null. The base
 * titles must match exactly (after normalisation): expansions, spin-offs and sequels
 * ("Phantom Liberty", "Silksong", "Hades II") share words with the game but are other products.
 */
export function acceptEditionCandidate(candidateTitle: string, title: string): EditionKey | null {
  if (isDlcTitle(candidateTitle) && !isDlcTitle(title)) return null;
  const key = gameKey(title);
  if (!key || gameKey(candidateTitle) !== key) return null;
  return editionKey(candidateTitle);
}

function comparableAmount(deal: GameDeal): number {
  if (isExplicitlyFreePrice(deal.price)) return 0;
  return parseLocalizedAmount(deal.price) ?? Number.POSITIVE_INFINITY;
}

function byAmount(a: GameDeal, b: GameDeal): number {
  return comparableAmount(a) - comparableAmount(b);
}

/** Within one store and edition: a paid listing beats a free one (usually a demo), then the cheaper. */
function isBetterListing(deal: GameDeal, current: GameDeal): boolean {
  const dealFree = isExplicitlyFreePrice(deal.price);
  const currentFree = isExplicitlyFreePrice(current.price);
  if (dealFree !== currentFree) return currentFree;
  return comparableAmount(deal) < comparableAmount(current);
}

/** Groups offers into editions (base first), keeping each store's cheapest deal, cheapest store first. */
export function buildEditionTable(offers: readonly EditionOffer[]): EditionOption[] {
  const byEdition = new Map<EditionKey, Map<string, GameDeal>>();
  for (const offer of offers) {
    if (isUnavailablePrice(offer.price.price)) continue;
    const deal = platformPriceToGameDeal(offer.price);
    const stores = byEdition.get(offer.edition) ?? new Map<string, GameDeal>();
    const current = stores.get(offer.platform);
    if (!current || isBetterListing(deal, current)) stores.set(offer.platform, deal);
    byEdition.set(offer.edition, stores);
  }
  const keys = [...byEdition.keys()].sort(compareEditions);
  return keys.map((key) => ({ key, deals: [...(byEdition.get(key)?.values() ?? [])].sort(byAmount) }));
}
