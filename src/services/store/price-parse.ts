export function isUnavailablePrice(str: string | undefined | null): boolean {
  if (!str) return true;
  const lower = str.toLowerCase();
  return (
    lower.includes('mevcut değil') ||
    lower.includes('uygun değil') ||
    lower.includes('not available') ||
    lower.includes('bilinmiyor')
  );
}

export function extractNumericPrice(str: string): number | null {
  const clean = str.replaceAll(/[^0-9.,]/g, '');
  if (!clean) return null;

  if (clean.includes(',')) {
    const value = Number.parseFloat(clean.replaceAll('.', '').replace(',', '.'));
    return Number.isFinite(value) ? value : null;
  }
  if (clean.includes('.')) {
    const parts = clean.split('.');
    const last = parts.at(-1);
    if (last?.length === 3 && parts.length > 1) {
      const value = Number.parseFloat(parts.join(''));
      return Number.isFinite(value) ? value : null;
    }
    const value = Number.parseFloat(clean);
    return Number.isFinite(value) ? value : null;
  }
  const value = Number.parseFloat(clean);
  return Number.isFinite(value) ? value : null;
}

/**
 * Parse a price string from any regional storefront. The last `.` or `,` is the
 * decimal separator only when one or two digits follow it; every other separator
 * (including spaces) groups thousands.
 */
export function parseLocalizedAmount(str: string): number | null {
  const clean = str.replaceAll(/[^0-9.,]/g, '');
  if (!/\d/.test(clean)) return null;
  const lastSeparator = Math.max(clean.lastIndexOf('.'), clean.lastIndexOf(','));
  const fraction = lastSeparator >= 0 ? clean.slice(lastSeparator + 1) : '';
  const hasDecimals = lastSeparator >= 0 && fraction.length >= 1 && fraction.length <= 2;
  const whole = (hasDecimals ? clean.slice(0, lastSeparator) : clean).replaceAll(/[.,]/g, '');
  const value = Number.parseFloat(hasDecimals ? `${whole}.${fraction}` : whole);
  return Number.isFinite(value) ? value : null;
}

export function isExplicitlyFreePrice(str: string | undefined | null): boolean {
  if (!str || isUnavailablePrice(str)) return false;
  const lower = str.toLowerCase().trim();
  const numeric = extractNumericPrice(str);
  if (numeric !== null && numeric > 0) return false;
  if (lower === 'ücretsiz' || lower === 'free') return true;
  if (/\bgame\s*pass\b/i.test(lower) || /\bfree\s*to\s*play\b/i.test(lower)) return false;
  if (/\bücretsiz\b/.test(lower)) return numeric === null || numeric === 0;
  if (/\bfree\b/.test(lower)) return numeric === null || numeric === 0;
  return numeric === 0;
}

export function formatTryPrice(amount: number): string {
  const formatted = amount.toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${formatted} TL`;
}

export function appendTrySuffixIfNeeded(priceStr: string): string {
  const trimmed = priceStr.trim();
  if (!trimmed || isUnavailablePrice(trimmed)) return trimmed;
  const lower = trimmed.toLowerCase();
  if (lower.includes('tl') || lower.includes('try') || lower.includes('₺') || lower.includes('$') || lower.includes('€')) {
    return trimmed;
  }
  if (/^\d+([.,]\d+)?$/.test(trimmed)) return `${trimmed} TL`;
  return trimmed;
}

export interface SteamPriceParts {
  currency?: string;
  final: number;
  initial: number;
  discount_percent: number;
  final_formatted?: string;
  initial_formatted?: string;
}

export function formatSteamPrice(overview: SteamPriceParts): {
  price: string;
  original_price: string | null;
} {
  if (overview.final_formatted?.trim()) {
    return {
      price: overview.final_formatted.trim(),
      original_price:
        overview.discount_percent > 0 && overview.initial_formatted?.trim()
          ? overview.initial_formatted.trim()
          : null,
    };
  }

  if (overview.currency === 'TRY') {
    return {
      price: formatTryPrice(overview.final / 100),
      original_price:
        overview.discount_percent > 0 ? formatTryPrice(overview.initial / 100) : null,
    };
  }

  const currency = overview.currency || 'USD';
  const price = `${(overview.final / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
  const original =
    overview.discount_percent > 0
      ? `${(overview.initial / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
      : null;
  return { price, original_price: original };
}
