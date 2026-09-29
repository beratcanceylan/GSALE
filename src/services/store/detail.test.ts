import { afterEach, describe, expect, mock, test } from 'bun:test';
import { getDetailPreview, rememberDetailPreviews } from '@/services/store/detail-preview';

mock.module('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => undefined,
}));

const { fetchGameDetailLive } = await import('@/services/store/detail');
const originalFetch = globalThis.fetch;

describe('detail navigation fallback', () => {
  afterEach(() => { globalThis.fetch = originalFetch; });

  for (const mode of ['HTTP failure', 'missing product']) {
    test(`fetches live prices from the search preview after ${mode}`, async () => {
      const id = mode === 'HTTP failure' ? '3768760' : '9910876';
      const title = mode === 'HTTP failure' ? '007 First Light' : 'GSALE Detail Fallback';
      rememberDetailPreviews([{
        id, title, platform: 'Steam', image_url: 'https://example.com/game.jpg', rating: null,
        deals: [{ platform: 'Steam', price: '1,00 TL', discount: '' }],
      }]);
      globalThis.fetch = async (input) => {
        const url = String(input);
        if (url.includes('/api/appdetails')) {
          return mode === 'HTTP failure'
            ? new Response('', { status: 403 })
            : Response.json({ [id]: { success: false } });
        }
        if (url.includes('/api/storesearch')) {
          return Response.json({ items: [{
            id: Number(id), name: title,
            price: { currency: 'TRY', final: 150000, initial: 150000 },
          }] });
        }
        return new Response('', { status: 404 });
      };

      const game = await fetchGameDetailLive(id, 'Steam');

      expect(game?.title).toBe(title);
      expect(game?.deals?.[0]?.price).toBe('1.500,00 TL');
      expect(getDetailPreview(id, 'Steam')?.deals).toBeUndefined();
      expect(getDetailPreview(id, 'Xbox')).toBeNull();
    });
  }

  test('preserves errors when no matching preview is available', async () => {
    globalThis.fetch = async () => new Response('', { status: 403 });
    await expect(fetchGameDetailLive('9910877', 'Steam')).rejects.toMatchObject({ status: 403 });
  });

  test('does not use a preview to hide caller cancellation', async () => {
    rememberDetailPreviews([{
      id: '9910878', title: 'Cancelled detail', platform: 'Steam', image_url: '', rating: null,
    }]);
    const controller = new AbortController();
    controller.abort();
    await expect(fetchGameDetailLive('9910878', 'Steam', { signal: controller.signal }))
      .rejects.toMatchObject({ name: 'AbortError' });
  });
});
