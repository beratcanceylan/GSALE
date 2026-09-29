import { STORE_CONFIG } from '@/services/store/config';

type FetchRequestInit = Omit<RequestInit, 'signal'> & {
  signal?: AbortSignal | undefined;
};

export class FetchError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'FetchError';
  }
}

function abortError(): Error {
  const error = new Error('The operation was aborted.');
  error.name = 'AbortError';
  return error;
}

function combineAbortSignals(
  callerSignal: AbortSignal | undefined,
  timeoutMs: number,
): { signal: AbortSignal; cleanup: () => void } {
  if (!callerSignal) {
    return { signal: AbortSignal.timeout(timeoutMs), cleanup: () => undefined };
  }

  const controller = new AbortController();
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const abortFromCaller = (): void => {
    controller.abort(callerSignal.reason);
  };
  const abortFromTimeout = (): void => {
    controller.abort(timeoutSignal.reason);
  };

  if (callerSignal.aborted) {
    abortFromCaller();
  } else {
    callerSignal.addEventListener('abort', abortFromCaller, { once: true });
  }
  timeoutSignal.addEventListener('abort', abortFromTimeout, { once: true });

  return {
    signal: controller.signal,
    cleanup: () => {
      callerSignal.removeEventListener('abort', abortFromCaller);
      timeoutSignal.removeEventListener('abort', abortFromTimeout);
    },
  };
}

async function fetchWithTimeout(
  url: string,
  init: FetchRequestInit = {},
  timeoutMs: number = STORE_CONFIG.timeout.short,
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has('User-Agent')) {
    headers.set('User-Agent', STORE_CONFIG.userAgent);
  }

  const { signal, cleanup } = combineAbortSignals(init.signal, timeoutMs);
  let res: Response;
  try {
    const { signal: _callerSignal, ...initWithoutSignal } = init;
    const requestInit: RequestInit = {
      ...initWithoutSignal,
      headers,
    };
    requestInit.signal = signal;
    res = await fetch(url, requestInit);
  } finally {
    cleanup();
  }

  if (!res.ok) {
    throw new FetchError(`HTTP ${res.status}`, res.status);
  }
  return res;
}

function isRetryableFetchError(error: unknown): boolean {
  if (!(error instanceof FetchError) || error.status === undefined) return true;
  return error.status === 408 || error.status === 429 || error.status >= 500;
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  throw signal.reason instanceof Error ? signal.reason : abortError();
}

async function waitForRetry(delayMs: number, signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal);
  if (!signal) {
    await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, delayMs);
    const onAbort = (): void => {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      reject(signal.reason instanceof Error ? signal.reason : abortError());
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  attempt = 0,
  signal?: AbortSignal,
): Promise<T> {
  throwIfAborted(signal);
  try {
    return await fn();
  } catch (err) {
    if (
      attempt >= STORE_CONFIG.retry.attempts ||
      signal?.aborted ||
      !isRetryableFetchError(err)
    ) {
      throw err;
    }
    await waitForRetry(STORE_CONFIG.retry.delayMs, signal);
    return withRetry(fn, attempt + 1, signal);
  }
}

export async function fetchJson<T>(
  url: string,
  init?: FetchRequestInit,
  timeoutMs: number = STORE_CONFIG.timeout.short,
): Promise<T> {
  const res = await fetchWithTimeout(url, init, timeoutMs);
  return res.json() as Promise<T>;
}

export async function fetchPostJson<T>(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
  timeoutMs: number = STORE_CONFIG.timeout.short,
  signal?: AbortSignal,
): Promise<T> {
  return fetchJson<T>(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
      ...(signal ? { signal } : {}),
    },
    timeoutMs,
  );
}

export async function fetchText(
  url: string,
  init?: FetchRequestInit,
  timeoutMs: number = STORE_CONFIG.timeout.long,
): Promise<string> {
  const res = await fetchWithTimeout(url, init, timeoutMs);
  return res.text();
}
