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

/** Lowest purchasable ListPrice across SKUs. */
export function getXboxListPrice(product: XboxDisplayProductForPrice): XboxSelectedPrice | null {
  let best: XboxSelectedPrice | null = null;
  let free: XboxSelectedPrice | null = null;
  for (const sku of product.DisplaySkuAvailabilities ?? []) {
    for (const avail of sku.Availabilities ?? []) {
      const price = avail.OrderManagementData?.Price;
      if (!price) continue;
      const list = price.ListPrice ?? 0;
      const msrp = price.MSRP ?? 0;
      const currency = price.CurrencyCode;
      if (list === 0 && msrp === 0) {
        const candidate = { list: 0, msrp: 0, currency, isFree: true };
        if (!free || currency === 'TRY') {
          free = candidate;
        }
        continue;
      }
      if (list <= 0) continue;
      if (!best || list < best.list) {
        best = { list, msrp: msrp > 0 ? msrp : list, currency, isFree: false };
      }
    }
  }
  return best ?? free;
}
