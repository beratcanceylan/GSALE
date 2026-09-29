import { formatPriceAsTry } from '@/services/store/currency';

export interface GogMoney {
  amount?: string;
  currency?: string;
}

export interface GogPriceBlock {
  final?: string;
  base?: string;
  discount?: string | null;
  finalMoney?: GogMoney;
  baseMoney?: GogMoney;
}

export interface GogProduct {
  id: number;
  title: string;
  slug: string;
  coverHorizontal?: string;
  coverVertical?: string;
  storeLink?: string;
  price?: GogPriceBlock;
  screenshots?: string[];
  releaseDate?: string;
  storeReleaseDate?: string;
  developers?: string[];
  publishers?: string[];
  genres?: ({ name?: string } | string)[];
}

export interface GogExpandedProduct {
  id?: number | string;
  title?: string;
  slug?: string;
  images?: Record<string, string | undefined>;
  description?: {
    lead?: string;
    full?: string;
    whats_cool_about_it?: string;
  };
  screenshots?: { formatter_template_url?: string }[];
  videos?: {
    provider?: string;
    video_url?: string;
    thumbnail_url?: string;
  }[];
}

export function gogImage(product: GogProduct): string {
  return product.coverHorizontal || product.coverVertical || '';
}

function normalizeGogDiscount(value: string | null | undefined): string {
  const percent = Number.parseInt(/\d{1,3}/.exec(value ?? '')?.[0] ?? '', 10);
  if (!Number.isFinite(percent) || percent <= 0) return '';
  return `-${percent}%`;
}

export function pickGogProductById(products: GogProduct[], id: string | number): GogProduct | null {
  const normalizedId = String(id).replace(/^gog-/, '');
  return products.find((product) => String(product.id) === normalizedId) ?? null;
}

export async function gogPriceFromProduct(
  product: GogProduct,
  signal?: AbortSignal,
): Promise<{
  price: string;
  original_price: string | null;
  discount: string;
}> {
  const block = product.price;
  if (!block) {
    return { price: 'Bilinmiyor', original_price: null, discount: '' };
  }

  const finalAmount = Number.parseFloat(block.finalMoney?.amount ?? '');
  const baseAmount = Number.parseFloat(block.baseMoney?.amount ?? '');
  const finalCurrency = block.finalMoney?.currency;
  const baseCurrency = block.baseMoney?.currency;

  if (Number.isFinite(finalAmount)) {
    const price = await formatPriceAsTry(finalAmount, finalCurrency, signal);
    const hasDiscount =
      block.discount &&
      block.discount !== '0' &&
      Number.isFinite(baseAmount) &&
      baseAmount > finalAmount;
    const original_price = hasDiscount
      ? await formatPriceAsTry(baseAmount, baseCurrency ?? finalCurrency, signal)
      : null;
    const discount = hasDiscount ? normalizeGogDiscount(block.discount) : '';
    return { price, original_price, discount };
  }

  if (block.final?.trim()) {
    return {
      price: block.final.trim(),
      original_price: block.base?.trim() || null,
      discount: normalizeGogDiscount(block.discount),
    };
  }

  return { price: 'Bilinmiyor', original_price: null, discount: '' };
}
