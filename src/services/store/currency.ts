import { formatTryPrice } from '@/services/store/price-parse';

const FX_URL = 'https://open.er-api.com/v6/latest/USD';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const FALLBACK_USD_TO_TRY = 45;

/** Units of each currency per 1 USD. */
type FxRates = Readonly<Record<string, number>>;

interface ErApiResponse {
  result?: string;
  rates?: Record<string, number>;
}

let cachedRates: FxRates | null = null;
let cachedAt = 0;
let inflight: Promise<FxRates> | null = null;

function isTryCurrency(currency: string | undefined | null): boolean {
  if (!currency) return false;
  const upper = currency.toUpperCase();
  return upper === 'TRY' || upper === 'TL';
}

function fallbackRates(): FxRates {
  return { USD: 1, TRY: FALLBACK_USD_TO_TRY };
}

async function fetchFxRatesFromNetwork(): Promise<FxRates> {
  const timeoutSignal = AbortSignal.timeout(8000);
  const requestController = new AbortController();
  const abortFromTimeout = (): void => {
    requestController.abort(timeoutSignal.reason);
  };

  timeoutSignal.addEventListener('abort', abortFromTimeout, { once: true });

  let res: Response;
  try {
    res = await fetch(FX_URL, { signal: requestController.signal });
  } finally {
    timeoutSignal.removeEventListener('abort', abortFromTimeout);
  }
  if (!res.ok) {
    throw new Error(`FX HTTP ${res.status}`);
  }
  const data = (await res.json()) as ErApiResponse;
  const tryRate = data.rates?.['TRY'];
  if (data.result === 'success' && data.rates && typeof tryRate === 'number' && tryRate > 0) {
    return { ...data.rates, USD: 1 };
  }
  throw new Error('FX response missing TRY rate');
}

function abortReason(signal: AbortSignal): Error {
  if (signal.reason instanceof Error) return signal.reason;
  const error = new Error('The operation was aborted.');
  error.name = 'AbortError';
  return error;
}

export function waitForAbortable<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(abortReason(signal));

  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => {
      signal.removeEventListener('abort', onAbort);
      reject(abortReason(signal));
    };
    signal.addEventListener('abort', onAbort, { once: true });
    void promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

async function getFxRates(signal?: AbortSignal): Promise<FxRates> {
  const now = Date.now();
  if (cachedRates !== null && now - cachedAt < CACHE_TTL_MS) {
    return cachedRates;
  }

  if (!inflight) {
    const request = (async () => {
      try {
        const rates = await fetchFxRatesFromNetwork();
        cachedRates = rates;
        cachedAt = Date.now();
        return rates;
      } catch {
        return cachedRates ?? fallbackRates();
      }
    })();
    inflight = request;
    void request.finally(() => {
      if (inflight === request) inflight = null;
    });
  }

  return waitForAbortable(inflight, signal);
}

export async function getUsdToTryRate(signal?: AbortSignal): Promise<number> {
  const rates = await getFxRates(signal);
  return rates['TRY'] ?? FALLBACK_USD_TO_TRY;
}

/**
 * Convert a numeric amount to TRY; TRY/TL amounts pass through unchanged.
 * A missing currency is treated as USD. Returns NaN for a currency without a known rate.
 */
export async function convertToTry(
  amount: number,
  currency?: string | null,
  signal?: AbortSignal,
): Promise<number> {
  if (!Number.isFinite(amount)) return amount;
  if (isTryCurrency(currency)) return amount;
  const rates = await getFxRates(signal);
  const code = (currency || 'USD').toUpperCase();
  const perUsd = rates[code];
  const tryPerUsd = rates['TRY'];
  if (!perUsd || !tryPerUsd) return Number.NaN;
  return (amount / perUsd) * tryPerUsd;
}

/** Format a numeric amount as TRY after conversion when needed. */
export async function formatPriceAsTry(
  amount: number,
  currency?: string | null,
  signal?: AbortSignal,
): Promise<string> {
  const tryAmount = await convertToTry(amount, currency, signal);
  return Number.isFinite(tryAmount) ? formatTryPrice(tryAmount) : 'Bilinmiyor';
}

/** Reset cache (tests only). */
export function resetCurrencyCacheForTests(): void {
  cachedRates = null;
  cachedAt = 0;
  inflight = null;
}

/** Pin the USD→TRY rate only (tests only). */
export function setUsdToTryRateForTests(rate: number): void {
  setFxRatesForTests({ USD: 1, TRY: rate });
}

/** Pin FX rates as units per 1 USD (tests only). */
export function setFxRatesForTests(rates: FxRates): void {
  cachedRates = rates;
  cachedAt = Date.now();
  inflight = null;
}
