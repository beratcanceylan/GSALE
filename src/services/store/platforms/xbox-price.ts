export interface XboxCatalogPrice {
  CurrencyCode?: string;
  ListPrice?: number;
  MSRP?: number;
}

export interface XboxDisplayProductForPrice {
  DisplaySkuAvailabilities?: {
    Availabilities?: { OrderManagementData?: { Price?: XboxCatalogPrice } }[];
  }[];
}

export interface XboxSelectedPrice {
  list: number;
  msrp: number;
  currency?: string | undefined;
  isFree: boolean;
}

function skuPrices(product: XboxDisplayProductForPrice): XboxCatalogPrice[] {
  return (product.DisplaySkuAvailabilities ?? []).flatMap((sku) =>
    (sku.Availabilities ?? []).flatMap((availability) => {
      const price = availability.OrderManagementData?.Price;
      return price ? [price] : [];
    }),
  );
}

/** Lowest purchasable ListPrice across SKUs; a free SKU (TRY preferred) when nothing is paid. */
export function getXboxListPrice(product: XboxDisplayProductForPrice): XboxSelectedPrice | null {
  let best: XboxSelectedPrice | null = null;
  let free: XboxSelectedPrice | null = null;
  for (const price of skuPrices(product)) {
    const list = price.ListPrice ?? 0;
    const msrp = price.MSRP ?? 0;
    const currency = price.CurrencyCode;
    if (list === 0 && msrp === 0) {
      if (!free || currency === 'TRY') free = { list: 0, msrp: 0, currency, isFree: true };
    } else if (list > 0 && (!best || list < best.list)) {
      best = { list, msrp: msrp > 0 ? msrp : list, currency, isFree: false };
    }
  }
  return best ?? free;
}
