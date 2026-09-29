import { formatPriceAsTry } from '@/services/store/currency';
import {
  extractNumericPrice,
  formatTryPrice,
  isUnavailablePrice,
} from '@/services/store/price-parse';

export interface EpicPriceElement {
  price?: {
    totalPrice?: {
      fmtPrice?: { originalPrice?: string; discountPrice?: string };
      discount?: number;
      currencyCode?: string;
    };
  };
}

function isTryCurrencyOrLabel(priceStr: string, currencyCode?: string): boolean {
  if (currencyCode === 'TRY' || currencyCode === 'TL') return true;
  const lower = priceStr.toLowerCase();
  return lower.includes('tl') || lower.includes('₺') || lower.includes('try');
}

function isFreePriceString(priceStr: string): boolean {
  const lower = priceStr.toLowerCase().trim();
  const numeric = extractNumericPrice(priceStr);
  if (lower === 'free' || lower === 'ücretsiz') return true;
  return numeric === 0;
}

async function formatEpicPriceString(
  priceStr: string,
  currencyCode?: string,
  signal?: AbortSignal,
): Promise<string> {
  const trimmed = priceStr.trim();
  if (!trimmed || isUnavailablePrice(trimmed)) return trimmed;
  if (isFreePriceString(trimmed)) return 'Ücretsiz';

  const numeric = extractNumericPrice(trimmed);
  if (numeric !== null && numeric >= 0) {
    if (isTryCurrencyOrLabel(trimmed, currencyCode)) {
      return formatTryPrice(numeric);
    }
    return formatPriceAsTry(numeric, currencyCode || 'USD', signal);
  }

  return trimmed;
}

function discountFromPrices(price: string, originalPrice: string | null): string {
  if (!originalPrice) return '';
  const current = extractNumericPrice(price);
  const original = extractNumericPrice(originalPrice);
  if (current === null || original === null || original <= 0 || current >= original) return '';
  return `-${Math.round((1 - current / original) * 100)}%`;
}

function discountFromAmounts(current: number, original: number): string {
  if (original <= 0 || current >= original) return '';
  return `-${Math.round((1 - current / original) * 100)}%`;
}

async function formatEpicNumericAmount(
  amount: number,
  currencyCode?: string,
  signal?: AbortSignal,
): Promise<string> {
  if (amount === 0) return 'Ücretsiz';
  if (currencyCode === 'TRY' || currencyCode === 'TL') {
    return formatTryPrice(amount);
  }
  return formatPriceAsTry(amount, currencyCode || 'USD', signal);
}

export async function epicPriceFromElement(
  el: EpicPriceElement,
  signal?: AbortSignal,
): Promise<{
  price: string;
  original_price: string | null;
  discount: string;
}> {
  const total = el.price?.totalPrice;
  const fmt = total?.fmtPrice;
  const currencyCode = total?.currencyCode;
  const priceStr = fmt?.discountPrice || fmt?.originalPrice || 'Bilinmiyor';

  if (isFreePriceString(priceStr)) {
    return { price: 'Ücretsiz', original_price: null, discount: '' };
  }

  const price = await formatEpicPriceString(priceStr, currencyCode, signal);
  const originalPrice =
    fmt?.originalPrice && fmt.originalPrice !== priceStr && !isFreePriceString(fmt.originalPrice)
      ? await formatEpicPriceString(fmt.originalPrice, currencyCode, signal)
      : null;

  return {
    price,
    original_price: originalPrice,
    discount: discountFromPrices(price, originalPrice),
  };
}

export interface EpicMinorUnitPrice {
  currencyCode?: string;
  originalPrice?: number | null;
  discountPrice?: number | null;
  discount?: number | null;
  decimals?: number | null;
}

export async function epicPriceFromMinorUnits(
  priceInfo: EpicMinorUnitPrice,
  signal?: AbortSignal,
): Promise<{
  price: string;
  original_price: string | null;
  discount: string;
}> {
  const decimals = Number.isFinite(priceInfo.decimals ?? 2) ? (priceInfo.decimals ?? 2) : 2;
  const divisor = 10 ** decimals;
  const originalMinor = priceInfo.originalPrice ?? priceInfo.discountPrice ?? 0;
  const currentMinor = priceInfo.discountPrice ?? originalMinor;
  const original = originalMinor / divisor;
  const current = currentMinor / divisor;

  if (current <= 0 && original <= 0) {
    return { price: 'Ücretsiz', original_price: null, discount: '' };
  }

  const price = await formatEpicNumericAmount(current, priceInfo.currencyCode, signal);
  const originalPrice =
    original > current
      ? await formatEpicNumericAmount(original, priceInfo.currencyCode, signal)
      : null;

  return {
    price,
    original_price: originalPrice,
    discount: discountFromAmounts(current, original),
  };
}
