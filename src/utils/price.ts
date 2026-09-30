import { formatMoney, formatPercent, t } from '@/i18n';
import type { Deal } from '@/services/deal';

export { cheapestDeal } from '@/services/deal';

export type PriceView =
  | Readonly<{ kind: 'amount'; text: string; original: string | null; discount: string | null }>
  | Readonly<{ kind: 'free'; text: string; original: null; discount: null }>;

/** What a price tag shows for `deal` in the app language; null when there is nothing to show. */
export function priceView(deal: Deal | null): PriceView | null {
  if (!deal) return null;
  if (deal.isFree) return { kind: 'free', text: t('price.free'), original: null, discount: null };
  if (deal.amount === null) return null;
  const original = deal.originalAmount !== null && deal.originalAmount > deal.amount ? formatMoney(deal.originalAmount) : null;
  return {
    kind: 'amount',
    text: formatMoney(deal.amount),
    original,
    discount: deal.discountPercent > 0 ? formatPercent(-deal.discountPercent) : null,
  };
}
