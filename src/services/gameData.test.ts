import { describe, expect, mock, test } from 'bun:test';

import type { GameDetailResponse, GameSummary } from '@/services/api';

const summary: GameSummary = {
  id: '1', title: 'Example', image_url: 'https://example.com/cover.jpg', platform: 'Steam', rating: null,
  description: 'Story', genres: ['Action'], developers: ['Studio'], release_date: '2026-01-01',
  screenshots: ['https://example.com/shot.jpg'], videos: [{ platform: 'YouTube', id: 'clip' }],
  store_links: { Steam: 'https://store.steampowered.com/app/1/' }, platforms: ['Steam'],
  price: '100,00 TL', original_price: '200,00 TL', discount: '-50%',
  deals: [{ platform: 'Steam', price: '100,00 TL', original_price: '200,00 TL', discount: '-50%', store_url: 'https://store.steampowered.com/app/1/' }],
  upcoming: false, upcoming_date_str: 'soon',
};

let searchResults: GameSummary[] = [summary];
let detailResult: GameDetailResponse = {
  game: summary,
  prices: [{ id: 1, game_id: '1', platform: 'Steam', price: '100,00 TL', original_price: '200,00 TL', discount: '-50%', store_url: 'https://store.steampowered.com/app/1/', subscription_note: null, fetched_at: 1 }],
  meta: { prices_fetched_at: 1 },
};

mock.module('./api', () => ({
  searchGames: async () => searchResults,
  getGameDetail: async () => detailResult,
  getHomeSections: async () => [{ platform: 'Steam', games: searchResults }],
  getFreeGames: async () => searchResults,
}));

const { fetchFreeGames, fetchGameDetail, fetchHomeSections, fetchSearchResults } = await import('@/services/gameData');

describe('game data mapping', () => {
  test('maps complete summaries for search, home and free games', async () => {
    const [search] = await fetchSearchResults('Example');
    expect(search).toMatchObject({
      id: '1', title: 'Example', platform: 'Steam', source_platform: 'Steam',
      imageUrl: summary.image_url, description: 'Story', genres: ['Action'],
      developers: ['Studio'], release_date: '2026-01-01', screenshots: summary.screenshots,
      videos: summary.videos, store_links: summary.store_links, platforms: ['Steam'],
      price: '100,00 TL', originalPrice: '200,00 TL', discount: '-50%',
      upcoming: false, upcoming_date_str: 'soon',
    });
    expect(search?.deals[0]).toMatchObject({ platform: 'Steam', url: summary.deals?.[0]?.store_url });
    expect((await fetchHomeSections())[0]?.games[0]).toEqual(search);
    expect((await fetchFreeGames())[0]).toEqual(search);
  });

  test('maps detail prices, unknown values and empty details', async () => {
    expect(await fetchGameDetail('1')).toMatchObject({
      platform: 'Steam', price: '100,00 TL', originalPrice: '200,00 TL',
      deals: [{ url: 'https://store.steampowered.com/app/1/' }],
    });
    detailResult = {
      game: { id: '2', title: 'Unpriced', image_url: '', rating: null },
      prices: [{ id: 1, game_id: '2', platform: 'GOG', price: null, original_price: null, discount: null, store_url: null, subscription_note: null, fetched_at: 1 }],
      meta: { prices_fetched_at: null },
    };
    expect(await fetchGameDetail('2')).toMatchObject({
      platform: 'GOG', source_platform: '', price: 'Bilinmiyor', url: '',
      deals: [{ price: 'Bilinmiyor', discount: '', url: '' }],
    });
    detailResult = { ...detailResult, prices: [] };
    expect((await fetchGameDetail('2')).deals).toEqual([]);
  });

  test('uses platform fallbacks when a summary has no primary platform', async () => {
    searchResults = [{ id: '3', title: 'Console', image_url: '', platforms: ['Xbox'], rating: null }];
    const [game] = await fetchSearchResults('Console');
    expect(game?.platform).toBe('Xbox');
    expect(game?.source_platform).toBe('Xbox');
  });
});
