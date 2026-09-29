import { describe, expect, mock, test } from 'bun:test';

mock.module('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => undefined,
}));

const { FetchError, fetchJson, fetchPostJson, fetchText, throwIfAborted, withRetry } =
  await import('@/services/store/fetch');

describe('store request retry policy', () => {
  test('does not retry ordinary client errors', async () => {
    let attempts = 0;

    await expect(
      withRetry(async () => {
        attempts += 1;
        throw new FetchError('HTTP 404', 404);
      }),
    ).rejects.toMatchObject({ status: 404 });

    expect(attempts).toBe(1);
  });

  test('keeps retrying transient server errors', async () => {
    let attempts = 0;

    await expect(
      withRetry(async () => {
        attempts += 1;
        if (attempts < 2) throw new FetchError('HTTP 503', 503);
        return 'ok';
      }),
    ).resolves.toBe('ok');

    expect(attempts).toBe(2);
  });

  test('keeps retrying timeout abort errors when the caller is not cancelled', async () => {
    let attempts = 0;

    await expect(
      withRetry(async () => {
        attempts += 1;
        if (attempts < 2) throw new DOMException('Timed out', 'AbortError');
        return 'ok';
      }),
    ).resolves.toBe('ok');

    expect(attempts).toBe(2);
  });

  test('does not invoke a cancelled request callback', async () => {
    const controller = new AbortController();
    controller.abort();
    let attempts = 0;

    await expect(
      withRetry(async () => {
        attempts += 1;
        return 'unexpected';
      }, 0, controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' });

    expect(attempts).toBe(0);
  });

  test('honors cancellation during the retry delay', async () => {
    const controller = new AbortController();
    let attempts = 0;
    const pending = withRetry(async () => {
      attempts += 1;
      throw new FetchError('HTTP 503', 503);
    }, 0, controller.signal);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    controller.abort('cancelled');
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(attempts).toBe(1);
    expect(() => throwIfAborted(controller.signal)).toThrow('aborted');
  });

  test('retries with an active caller signal', async () => {
    const controller = new AbortController();
    let attempts = 0;
    await expect(withRetry(async () => {
      attempts += 1;
      if (attempts === 1) throw new FetchError('HTTP 429', 429);
      return 'retried';
    }, 0, controller.signal)).resolves.toBe('retried');
    expect(attempts).toBe(2);
  });

  test('sets request headers, parses response bodies and reports HTTP errors', async () => {
    const originalFetch = globalThis.fetch;
    const calls: RequestInit[] = [];
    globalThis.fetch = async (_url, init) => {
      calls.push(init ?? {});
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };
    try {
      expect(await fetchJson('https://example.com/data')).toEqual({ ok: true });
      expect(await fetchPostJson('https://example.com/data', { id: 1 }, { 'X-Test': 'yes' }))
        .toEqual({ ok: true });
      expect(await fetchText('https://example.com/data', { headers: { 'User-Agent': 'custom' } }))
        .toBe('{"ok":true}');
      expect((calls[0]?.headers as Headers).get('User-Agent')).not.toBeNull();
      expect((calls[1]?.headers as Headers).get('X-Test')).toBe('yes');
      expect((calls[2]?.headers as Headers).get('User-Agent')).toBe('custom');
      globalThis.fetch = async () => new Response('missing', { status: 404 });
      await expect(fetchText('https://example.com/missing')).rejects.toMatchObject({ status: 404 });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('propagates caller and timeout aborts through fetch', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
    });
    try {
      const timeoutController = new AbortController();
      await expect(fetchText('https://example.com/slow', { signal: timeoutController.signal }, 1))
        .rejects.toMatchObject({ name: 'TimeoutError' });
      const callerController = new AbortController();
      const request = fetchText('https://example.com/slow', { signal: callerController.signal }, 1000);
      callerController.abort(new Error('caller stopped'));
      await expect(request).rejects.toThrow('caller stopped');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
