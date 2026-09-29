import { describe, expect, mock, test } from 'bun:test';

mock.module('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => undefined,
}));

const { FetchError, withRetry } = await import('@/services/store/fetch');

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
});
