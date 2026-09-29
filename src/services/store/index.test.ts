import { describe, expect, mock, test } from 'bun:test';
import { getDetailPreview } from '@/services/store/detail-preview';

const searchCalls: { query: string; attachDeals: boolean | undefined }[] = [];

mock.module('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => undefined,
}));

mock.module('@/services/store/search', () => ({
  searchLiveGames: async (query: string, attachDeals?: boolean) => {
    searchCalls.push({ query, attachDeals });
    return [{ id: '9910999', title: query, image_url: '', platform: 'Steam', rating: null }];
  },
}));

const { searchGames } = await import('@/services/store/index');

describe('store search API', () => {
  test('returns search previews without attaching cross-platform deals', async () => {
    searchCalls.length = 0;

    await searchGames('Ready or Not');

    expect(searchCalls).toEqual([{ query: 'Ready or Not', attachDeals: false }]);
    expect(getDetailPreview('9910999', 'Steam')?.title).toBe('Ready or Not');
  });
});
