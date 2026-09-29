import { afterEach, describe, expect, test } from 'bun:test';

import {
  convertToTry,
  formatPriceAsTry,
  getUsdToTryRate,
  resetCurrencyCacheForTests,
  setFxRatesForTests,
  setUsdToTryRateForTests,
  waitForAbortable,
} from '@/services/store/currency';

const originalFetch = globalThis.fetch;

afterEach(() => {
  resetCurrencyCacheForTests();
  globalThis.fetch = originalFetch;
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
    expect(Number.isNaN(await convertToTry(10, 'GBP'))).toBeTrue();
    expect(await formatPriceAsTry(10, 'GBP')).toBe('Bilinmiyor');
  });

  test('fetches rates once and reuses the cached value', async () => {
    const urls: string[] = [];
    globalThis.fetch = async (input) => {
      urls.push(String(input));
      return Response.json({ result: 'success', rates: { TRY: 42, EUR: 0.84 } });
    };
    expect(await getUsdToTryRate()).toBe(42);
    expect(await convertToTry(2, 'EUR')).toBe(100);
    expect(urls).toEqual(['https://open.er-api.com/v6/latest/USD']);
  });

  test('uses the fallback rate after HTTP and malformed response failures', async () => {
    globalThis.fetch = async () => new Response('', { status: 503 });
    expect(await getUsdToTryRate()).toBe(45);
    resetCurrencyCacheForTests();
    globalThis.fetch = async () => Response.json({ result: 'error', rates: { TRY: 0 } });
    expect(await getUsdToTryRate()).toBe(45);
  });

  test('preserves a cached rate when refreshing fails', async () => {
    setFxRatesForTests({ USD: 1, TRY: 41 });
    const originalNow = Date.now;
    const nextTime = originalNow() + 7 * 60 * 60 * 1000;
    Date.now = () => nextTime;
    globalThis.fetch = async () => { throw new Error('offline'); };
    try {
      expect(await getUsdToTryRate()).toBe(41);
    } finally {
      Date.now = originalNow;
    }
  });

  test('a cancelled waiter does not cancel another rate request', async () => {
    let finishRequest: ((response: Response) => void) | undefined;
    globalThis.fetch = async () => new Promise<Response>((resolve) => { finishRequest = resolve; });
    const controller = new AbortController();
    const cancelled = getUsdToTryRate(controller.signal);
    const active = getUsdToTryRate();
    controller.abort(new Error('cancelled'));
    await expect(cancelled).rejects.toThrow('cancelled');
    finishRequest?.(Response.json({ result: 'success', rates: { TRY: 43 } }));
    expect(await active).toBe(43);
  });

  test('rejects an already cancelled waiter and handles non-Error reasons', async () => {
    const controller = new AbortController();
    controller.abort('cancelled');
    globalThis.fetch = async () => Response.json({ result: 'success', rates: { TRY: 40 } });
    await expect(getUsdToTryRate(controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });

  test('non-finite amounts and missing currency retain their contract', async () => {
    setFxRatesForTests({ USD: 1, TRY: 40 });
    expect(Number.isNaN(await convertToTry(Number.NaN, 'USD'))).toBeTrue();
    expect(await convertToTry(2)).toBe(80);
    expect(await formatPriceAsTry(Number.NaN, 'TRY')).toBe('Bilinmiyor');
  });

  test('forwards a rejected shared request to a waiting caller', async () => {
    const controller = new AbortController();
    await expect(waitForAbortable(Promise.reject('offline'), controller.signal))
      .rejects.toThrow('offline');
  });

  test('aborts the FX request when its timeout expires', async () => {
    const originalTimeout = AbortSignal.timeout;
    AbortSignal.timeout = () => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(new DOMException('Timed out', 'TimeoutError')), 0);
      return controller.signal;
    };
    globalThis.fetch = (_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
    });
    try {
      expect(await getUsdToTryRate()).toBe(45);
    } finally {
      AbortSignal.timeout = originalTimeout;
    }
  });
});
