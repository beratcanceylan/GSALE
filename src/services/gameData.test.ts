import { describe, expect, mock, test } from 'bun:test';

import type { GameDetailResponse, GameSummary } from '@/services/api';

const summary: GameSummary = {
  id: '1', title: 'Example', image_url: 'https://example.com/cover.jpg', platform: 'Steam', rating: null,
  store_links: { Steam: 'https://store.steampowered.com/app/1/' }, platforms: ['Steam'],
  price: '100,00 TL', original_price: '200,00 TL', discount: '-50%',
  deals: [{ platform: 'Steam', price: '100,00 TL', original_price: '200,00 TL', discount: '-50%', store_url: 'https://store.steampowered.com/app/1/' }],
  upcoming: false, upcoming_date_str: 'soon',
};

let searchResults: GameSummary[] = [summary];
const steamDeal = { platform: 'Steam', price: '100,00 TL', original_price: '200,00 TL', discount: '-50%', store_url: 'https://store.steampowered.com/app/1/' };
let detailResult: GameDetailResponse = {
  game: { ...summary, edition: 'deluxe' },
  editions: [
    { key: 'base', deals: [{ platform: 'GOG', price: '80,00 TL', discount: '' }] },
    { key: 'deluxe', deals: [steamDeal] },
  ],
};

mock.module('./api', () => ({
  searchGames: async () => searchResults,
  getGameDetail: async () => detailResult,
  getPopularGames: async () => searchResults,
  getFreeGames: async () => searchResults,
}));

const { fetchFreeGames, fetchGameDetail, fetchPopularGames, fetchSearchResults } = await import('@/services/gameData');

describe('game data mapping', () => {
  test('maps complete summaries for search, home and free games', async () => {
    const [search] = await fetchSearchResults('Example');
    expect(search).toMatchObject({
      id: '1', title: 'Example', platform: 'Steam', source_platform: 'Steam',
      imageUrl: summary.image_url, store_links: summary.store_links, platforms: ['Steam'],
      price: '100,00 TL', originalPrice: '200,00 TL', discount: '-50%',
      upcoming: false, upcoming_date_str: 'soon',
    });
    expect(search?.deals[0]).toMatchObject({ platform: 'Steam', url: summary.deals?.[0]?.store_url });
    expect((await fetchPopularGames())[0]).toEqual(search);
    expect((await fetchFreeGames())[0]).toEqual(search);
  });

  test('maps every edition and shows the opened edition\'s deals', async () => {
    const game = await fetchGameDetail('1');
    expect(game).toMatchObject({
      edition: 'deluxe', platform: 'Steam', price: '100,00 TL', originalPrice: '200,00 TL',
      deals: [{ platform: 'Steam', url: 'https://store.steampowered.com/app/1/' }],
    });
    expect(game.editions?.map((option) => [option.key, option.deals.map((deal) => deal.platform)])).toEqual([
      ['base', ['GOG']],
      ['deluxe', ['Steam']],
    ]);
  });

  test('falls back to the first edition, and to no deals without editions', async () => {
    detailResult = { game: { id: '2', title: 'Unpriced', image_url: '', rating: null, edition: 'gold' }, editions: [
      { key: 'base', deals: [{ platform: 'GOG', price: '80,00 TL', discount: '' }] },
    ] };
    expect(await fetchGameDetail('2')).toMatchObject({ platform: 'GOG', source_platform: '', deals: [{ url: '' }] });
    detailResult = { ...detailResult, editions: [] };
    expect((await fetchGameDetail('2')).deals).toEqual([]);
  });

  test('deals carry language-neutral amounts for the UI', async () => {
    detailResult = { game: { id: '4', title: 'Amounts', image_url: '', rating: null, edition: 'base' }, editions: [{
      key: 'base',
      deals: [
        { platform: 'Steam', price: '1.500,00 TL', original_price: '2.000,00 TL', discount: '-25%' },
        { platform: 'Epic Games', price: 'Ücretsiz', discount: '' },
        { platform: 'GOG', price: 'Bilinmiyor', discount: '' },
        { platform: 'Xbox', price: 'Game Pass', discount: '', subscription_note: 'Game Pass' },
      ],
    }] };
    const deals = (await fetchGameDetail('4')).editions?.[0]?.deals ?? [];
    expect(deals.map(({ amount, originalAmount, discountPercent, isFree, gamePass }) => ({ amount, originalAmount, discountPercent, isFree, gamePass }))).toEqual([
      { amount: 1500, originalAmount: 2000, discountPercent: 25, isFree: false, gamePass: false },
      { amount: 0, originalAmount: null, discountPercent: 0, isFree: true, gamePass: false },
      { amount: null, originalAmount: null, discountPercent: 0, isFree: false, gamePass: false },
      { amount: null, originalAmount: null, discountPercent: 0, isFree: false, gamePass: true },
    ]);
  });

  test('uses platform fallbacks when a summary has no primary platform', async () => {
    searchResults = [{ id: '3', title: 'Console', image_url: '', platforms: ['Xbox'], rating: null }];
    const [game] = await fetchSearchResults('Console');
    expect(game?.platform).toBe('Xbox');
    expect(game?.source_platform).toBe('Xbox');
  });
});
