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
