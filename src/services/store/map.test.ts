import { describe, expect, test } from 'bun:test';

import { liveGameToDetailResponse, liveGameToSummary } from '@/services/store/map';
import type { LiveGame } from '@/services/store/types';

const base: LiveGame = {
  id: 'game-1',
  title: 'Example',
  image_url: 'https://example.com/cover.jpg',
  platform: 'Steam',
  rating: null,
};

describe('live game API mapping', () => {
  test('keeps every optional summary field and normalizes deals', () => {
    const game: LiveGame = {
      ...base,
      source_platform: 'Xbox',
      description: 'A game',
      genres: ['Action'],
      developers: ['Studio'],
      release_date: '2026-01-01',
      screenshots: ['https://example.com/shot.jpg'],
      videos: [{ platform: 'YouTube', id: 'clip' }],
      store_links: { Steam: 'https://store.steampowered.com/app/1/' },
      platforms: ['Steam'],
      price: '50,00 TL',
      original_price: '100,00 TL',
      discount: '-50%',
      deals: [{ platform: 'Steam', price: '50,00 TL', original_price: '100,00 TL', discount: '-50%' }],
      upcoming: false,
      upcoming_date_str: 'soon',
    };
    expect(liveGameToSummary(game)).toMatchObject({
      id: 'game-1',
      source_platform: 'Xbox',
      description: 'A game',
      genres: ['Action'],
      developers: ['Studio'],
      release_date: '2026-01-01',
      screenshots: ['https://example.com/shot.jpg'],
      videos: [{ id: 'clip' }],
      store_links: game.store_links,
      platforms: ['Steam'],
      price: '50,00 TL',
      original_price: '100,00 TL',
      discount: '-50%',
      deals: [{ platform: 'Steam', price: '50,00 TL' }],
      upcoming: false,
      upcoming_date_str: 'soon',
    });
  });

  test('maps deals to timestamped prices and leaves absent values null', () => {
    const response = liveGameToDetailResponse({
      ...base,
      deals: [
        { platform: 'Steam', price: '50,00 TL', discount: '-50%', store_url: 'https://store.steampowered.com/app/1/' },
        { platform: 'GOG', price: '60,00 TL', discount: '' },
      ],
    }, 123);
    expect(response.prices).toEqual([
      {
        id: 1, game_id: 'game-1', platform: 'Steam', price: '50,00 TL', original_price: null,
        discount: '-50%', store_url: 'https://store.steampowered.com/app/1/', subscription_note: null, fetched_at: 123,
      },
      {
        id: 2, game_id: 'game-1', platform: 'GOG', price: '60,00 TL', original_price: null,
        discount: null, store_url: null, subscription_note: null, fetched_at: 123,
      },
    ]);
    expect(response.meta.prices_fetched_at).toBe(123);
    expect(liveGameToDetailResponse(base, 123).meta.prices_fetched_at).toBeNull();
  });
});
