import { afterEach, describe, expect, test } from 'bun:test';

import {
  convertToTry,
  formatPriceAsTry,
  resetCurrencyCacheForTests,
  setFxRatesForTests,
  setUsdToTryRateForTests,
} from '@/services/store/currency';

afterEach(() => {
  resetCurrencyCacheForTests();
});

describe('store currency', () => {
  test('convertToTry leaves TRY unchanged', async () => {
    setUsdToTryRateForTests(40);
    expect(await convertToTry(254, 'TRY')).toBe(254);
    expect(await convertToTry(100, 'TL')).toBe(100);
  });

  test('convertToTry multiplies USD by cached rate', async () => {
    setUsdToTryRateForTests(40);
    expect(await convertToTry(10, 'USD')).toBe(400);
  });

  test('formatPriceAsTry uses Turkish locale suffix', async () => {
    setUsdToTryRateForTests(45);
    const formatted = await formatPriceAsTry(39.99, 'USD');
    expect(formatted).toContain('TL');
    expect(formatted).toMatch(/1\.799|1799/);
  });

  test('convertToTry converts other currencies through their USD rate', async () => {
    setFxRatesForTests({ USD: 1, TRY: 40, EUR: 0.8, JPY: 150 });
    expect(await convertToTry(8, 'EUR')).toBe(400);
    expect(await convertToTry(1500, 'jpy')).toBe(400);
  });

  test('unknown currencies are reported instead of being treated as USD', async () => {
    setUsdToTryRateForTests(40);
    expect(Number.isNaN(await convertToTry(10, 'GBP'))).toBe(true);
    expect(await formatPriceAsTry(10, 'GBP')).toBe('Bilinmiyor');
  });
});
