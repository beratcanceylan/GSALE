import { describe, expect, test } from 'bun:test';

import {
  formatSteamPrice,
  isExplicitlyFreePrice,
  isUnavailablePrice,
  parseLocalizedAmount,
} from '@/services/store/price-parse';

describe('store price-parse', () => {
  test('does not treat Game Pass copy as free', () => {
    expect(isExplicitlyFreePrice('Xbox Game Pass ile oyna')).toBeFalse();
    expect(isExplicitlyFreePrice('1.299,00 TL')).toBeFalse();
  });

  test('recognises explicit free labels', () => {
    expect(isExplicitlyFreePrice('Ücretsiz')).toBeTrue();
  });

  test('unavailable prices', () => {
    expect(isUnavailablePrice('Mevcut değil')).toBeTrue();
    expect(isUnavailablePrice('Bilinmiyor')).toBeTrue();
    expect(isUnavailablePrice('Uygun Değil')).toBeTrue();
  });

  test('steam uses formatted price when API provides it', () => {
    const formatted = formatSteamPrice({
      currency: 'USD',
      final: 4499,
      initial: 4499,
      discount_percent: 0,
      final_formatted: '$44.99 USD',
    });
    expect(formatted.price).toBe('$44.99 USD');
  });
});

describe('parseLocalizedAmount', () => {
  test('reads regional store price strings', () => {
    expect(parseLocalizedAmount('1.499,00 TL')).toBe(1499);
    expect(parseLocalizedAmount('$39.99')).toBe(39.99);
    expect(parseLocalizedAmount('€15,00')).toBe(15);
    expect(parseLocalizedAmount('£47.99')).toBe(47.99);
    expect(parseLocalizedAmount('¥1,760')).toBe(1760);
    expect(parseLocalizedAmount('Rs 2,499')).toBe(2499);
    expect(parseLocalizedAmount('UAH 1 649,00')).toBe(1649);
    expect(parseLocalizedAmount('US$99.99')).toBe(99.99);
    expect(parseLocalizedAmount('R$299,90')).toBe(299.9);
    expect(parseLocalizedAmount('5.720,00 TL')).toBe(5720);
    expect(parseLocalizedAmount('$1,234.5')).toBe(1234.5);
  });

  test('returns null when there is no number', () => {
    expect(parseLocalizedAmount('Ücretsiz')).toBeNull();
    expect(parseLocalizedAmount('')).toBeNull();
  });
});
