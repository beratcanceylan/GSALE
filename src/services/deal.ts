import { isExplicitlyFreePrice, isUnavailablePrice, parseLocalizedAmount } from '@/services/store/price-parse';
import type { GameDeal } from '@/services/store/types';

export interface Deal {
  platform: string;
  price: string;
  originalPrice?: string | undefined;
  discount: string;
  url: string;
  subscriptionNote?: string | undefined;
  /** Price in Turkish lira; null when the store gave no usable price. Screens format it per language. */
  amount: number | null;
  originalAmount: number | null;
  /** Whole percent off (25 for "-25%"), 0 without a discount. */
  discountPercent: number;
  isFree: boolean;
  gamePass: boolean;
}

/** Amount of a store price string ("1.500,00 TL"); null for sentinels and unparseable text. */
function priceAmount(price: string | undefined): number | null {
  if (!price || isUnavailablePrice(price)) return null;
  if (isExplicitlyFreePrice(price)) return 0;
  return parseLocalizedAmount(price);
}

function discountPercentOf(discount: string): number {
  const percent = Number.parseInt(discount.replaceAll(/\D/g, ''), 10);
  return Number.isFinite(percent) && percent > 0 && percent < 100 ? percent : 0;
}

/** UI deal for one store price, with amounts derived once for every screen. */
export function mapDeal(deal: GameDeal): Deal {
  const isFree = isExplicitlyFreePrice(deal.price);
  const gamePass = /game\s*pass/i.test(`${deal.subscription_note ?? ''} ${deal.price}`);
  return {
    platform: deal.platform,
    price: deal.price,
    originalPrice: deal.original_price,
    discount: deal.discount,
    url: deal.store_url || '',
    subscriptionNote: deal.subscription_note,
    amount: gamePass && !isFree ? null : priceAmount(deal.price),
    originalAmount: priceAmount(deal.original_price),
    discountPercent: discountPercentOf(deal.discount),
    isFree,
    gamePass,
  };
}

/** A store listing that is free right now (free-games promotions). */
export function freeDeal(platform: string, url: string): Deal {
  return {
    platform,
    price: '',
    discount: '',
    url,
    amount: 0,
    originalAmount: null,
    discountPercent: 0,
    isFree: true,
    gamePass: false,
  };
}

function hasPrice(deal: Deal): boolean {
  return deal.isFree || deal.amount !== null;
}

/**
 * The deal to headline for a game: the cheapest paid one when any store sells it,
 * otherwise a free listing (free entries are often demos next to the paid game).
 */
export function cheapestDeal(deals: readonly Deal[]): Deal | null {
  let best: Deal | null = null;
  for (const deal of deals) {
    if (!hasPrice(deal)) continue;
    if (!best) {
      best = deal;
      continue;
    }
    const bestPaid = !best.isFree;
    const dealPaid = !deal.isFree;
    if (dealPaid !== bestPaid) {
      if (dealPaid) best = deal;
      continue;
    }
    if ((deal.amount ?? 0) < (best.amount ?? 0)) best = deal;
  }
  return best;
}
