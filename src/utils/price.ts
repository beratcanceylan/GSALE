import { formatMoney, formatPercent, t } from '@/i18n';
import type { Deal } from '@/services/deal';

export type PriceView =
  | Readonly<{ kind: 'amount'; text: string; original: string | null; discount: string | null }>
  | Readonly<{ kind: 'free' | 'gamePass'; text: string; original: null; discount: null }>;

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

/** What a price tag shows for `deal` in the app language; null when there is nothing to show. */
export function priceView(deal: Deal | null): PriceView | null {
  if (!deal) return null;
  if (deal.isFree) return { kind: 'free', text: t('price.free'), original: null, discount: null };
  if (deal.gamePass && deal.amount === null) return { kind: 'gamePass', text: t('price.gamePass'), original: null, discount: null };
  if (deal.amount === null) return null;
  const original = deal.originalAmount !== null && deal.originalAmount > deal.amount ? formatMoney(deal.originalAmount) : null;
  return {
    kind: 'amount',
    text: formatMoney(deal.amount),
    original,
    discount: deal.discountPercent > 0 ? formatPercent(-deal.discountPercent) : null,
  };
}
