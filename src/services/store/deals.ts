import { hitToLiveGame } from '@/services/store/merge';
import { isExplicitlyFreePrice, isUnavailablePrice } from '@/services/store/price-parse';
import type {
  GameDeal,
  LiveGame,
  PlatformPriceResult,
  PlatformSearchHit,
} from '@/services/store/types';

export function platformPriceToGameDeal(price: PlatformPriceResult): GameDeal {
  const deal: GameDeal = {
    platform: price.platform,
    price: price.price,
    discount: price.discount ?? '',
  };
  if (price.original_price) deal.original_price = price.original_price;
  if (price.store_url) deal.store_url = price.store_url;
  if (price.subscription_note) deal.subscription_note = price.subscription_note;
  if (price.tier) deal.tier = price.tier;
  return deal;
}

/** A store list entry (home page deals) carrying its own discounted price. */
export function liveGameWithDeal(hit: PlatformSearchHit, price: PlatformPriceResult): LiveGame {
  const deal = platformPriceToGameDeal(price);
  return {
    ...hitToLiveGame(hit),
    price: deal.price,
    discount: deal.discount,
    ...(deal.original_price ? { original_price: deal.original_price } : {}),
    deals: [deal],
  };
}

export function pickCheapestDeal(deals: GameDeal[]): GameDeal | null {
  const available = deals.filter((deal) => !isUnavailablePrice(deal.price));
  const paid = available.filter((deal) => !isExplicitlyFreePrice(deal.price));
  const pool = paid.length > 0 ? paid : available;
  const first = pool[0];
  if (!first) return null;

  return pool.reduce((best, deal) => {
    const bestNum = isExplicitlyFreePrice(best.price) ? 0 : parsePriceNum(best.price);
    const dealNum = isExplicitlyFreePrice(deal.price) ? 0 : parsePriceNum(deal.price);
    return dealNum < bestNum ? deal : best;
  }, first);
}

function parsePriceNum(str: string): number {
  if (isUnavailablePrice(str)) return 999999;
  if (isExplicitlyFreePrice(str)) return 0;
  const clean = str.replaceAll(/[^0-9.,]/g, '');
  if (!clean) return 999999;
  if (clean.includes(',')) {
    return Number.parseFloat(clean.replaceAll('.', '').replace(',', '.')) || 999999;
  }
  if (clean.includes('.')) {
    const parts = clean.split('.');
    const last = parts.at(-1);
    if (last?.length === 3 && parts.length > 1) {
      return Number.parseFloat(parts.join('')) || 999999;
    }
    return Number.parseFloat(clean) || 999999;
  }
  return Number.parseFloat(clean) || 999999;
}

export function applyDealsToGame(game: LiveGame, deals: GameDeal[]): LiveGame {
  const platforms = [...new Set([
    ...(game.platforms ?? []),
    ...deals.map((deal) => deal.platform),
  ].filter(Boolean))];
  const storeLinks = { ...(game.store_links ?? {}) };
  for (const deal of deals) {
    if (deal.store_url) storeLinks[deal.platform] = deal.store_url;
  }
  const next: LiveGame = { ...game, deals, platforms, store_links: storeLinks };
  const cheapest = pickCheapestDeal(deals);
  if (!cheapest) return next;
  const nextPrice = cheapest.price || next.price;
  if (nextPrice) next.price = nextPrice;
  if (cheapest.original_price) next.original_price = cheapest.original_price;
  next.discount = cheapest.discount || '';
  next.platform = cheapest.platform;
  return next;
}
