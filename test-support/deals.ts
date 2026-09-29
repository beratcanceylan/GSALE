import { mapDeal, type Deal } from '@/services/deal';

type DealFields = Readonly<{
  platform: string;
  price: string;
  originalPrice?: string | undefined;
  discount?: string | undefined;
  url?: string | undefined;
  subscriptionNote?: string | undefined;
}>;

/** A UI deal built the way screens receive it (amounts derived from the store price text). */
export function uiDeal(fields: DealFields): Deal {
  return mapDeal({
    platform: fields.platform,
    price: fields.price,
    discount: fields.discount ?? '',
    ...(fields.originalPrice ? { original_price: fields.originalPrice } : {}),
    ...(fields.url ? { store_url: fields.url } : {}),
    ...(fields.subscriptionNote ? { subscription_note: fields.subscriptionNote } : {}),
  });
}
