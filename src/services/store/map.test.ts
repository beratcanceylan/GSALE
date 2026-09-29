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

  test('detail responses carry the opened edition and every edition option', () => {
    const editions = [{ key: 'base' as const, deals: [{ platform: 'Steam', price: '50,00 TL', discount: '-50%' }] }];
    const response = liveGameToDetailResponse({ game: { ...base, edition: 'deluxe' }, editions });
    expect(response.game).toMatchObject({ id: 'game-1', edition: 'deluxe' });
    expect(response.editions).toBe(editions);
  });

});
