import { describe, expect, test } from 'bun:test';

import { applyDealsToGame } from '@/services/store/deals';
import { mergeSearchHits } from '@/services/store/merge';
import type { PlatformSearchHit } from '@/services/store/types';

function hit(title: string): PlatformSearchHit {
  return {
    id: title,
    slug: title,
    title,
    image_url: `https://images.example/${encodeURIComponent(title)}.jpg`,
    platform: 'Xbox',
  };
}

describe('search hit merge', () => {
  test('keeps deal store links and platform availability on trending cards', () => {
    const game = {
      id: '4356430',
      title: 'NBA 2K27',
      image_url: 'https://images.example/nba.jpg',
      platform: 'Steam',
      rating: null,
    };

    const merged = applyDealsToGame(game, [
      { platform: 'Steam', price: '3.387,18 TL', discount: '', store_url: 'https://steam.example/nba' },
      { platform: 'PlayStation', price: '3.999,00 TL', discount: '', store_url: 'https://ps.example/nba' },
      { platform: 'Nintendo', price: '3.387,18 TL', discount: '', store_url: 'https://nintendo.example/nba' },
    ]);

    expect(merged.platforms).toEqual(['Steam', 'PlayStation', 'Nintendo']);
    expect(merged.store_links).toEqual({
      Steam: 'https://steam.example/nba',
      PlayStation: 'https://ps.example/nba',
      Nintendo: 'https://nintendo.example/nba',
    });
  });

  test('filters Fortnite currency and pack results when searching for the base game', () => {
    const games = mergeSearchHits(
      [
        hit('Fortnite'),
        hit('Fortnite - 800 V-Papel'),
        hit('Fortnite - Retro Dalgası Tarz Paketi'),
        hit('Fortnite Battle Royale'),
      ],
      'Fortnite',
    );

    expect(games.map((game) => game.title)).toEqual(['Fortnite']);
  });

  test('dedupes Fortnite Save the World variants to one result', () => {
    const games = mergeSearchHits(
      [
        { ...hit('Fortnite: Save the World'), platform: 'Epic Games', id: 'epic-stw-1', slug: 'stw-1' },
        { ...hit('Fortnite Dünyayı Kurtar'), platform: 'Epic Games', id: 'epic-stw-2', slug: 'stw-2' },
        hit('Fortnite'),
      ],
      'Fortnite',
    );

    const stwTitles = games
      .map((game) => game.title)
      .filter((title) => /save the world|dünyayı kurtar/i.test(title));
    expect(stwTitles).toHaveLength(1);
    expect(games.some((game) => game.title === 'Fortnite')).toBe(true);
  });

  test('keeps explicit currency results when the query asks for currency', () => {
    const games = mergeSearchHits([hit('Fortnite - 800 V-Papel')], 'Fortnite V-Papel');

    expect(games.map((game) => game.title)).toEqual(['Fortnite - 800 V-Papel']);
  });

  test('prefers sharper artwork when duplicate titles come from the same search', () => {
    const games = mergeSearchHits(
      [
        { ...hit('Fortnite'), image_url: 'https://cdn.example/Fortnite-520x292.jpg' },
        { ...hit('Fortnite'), image_url: 'https://cdn.example/Fortnite-2560x1440.jpg' },
      ],
      'Fortnite',
    );

    expect(games[0]?.image_url).toBe('https://cdn.example/Fortnite-2560x1440.jpg');
  });

  test('keeps every platform and store link when duplicate titles merge', () => {
    const games = mergeSearchHits(
      [
        { ...hit('NBA 2K27'), platform: 'PlayStation', id: 'ps-nba', slug: 'ps-nba', store_url: 'https://ps.example/nba' },
        { ...hit('NBA 2K27'), platform: 'Nintendo', id: 'nintendo-nba', slug: 'nintendo-nba', store_url: 'https://nintendo.example/nba' },
        { ...hit('NBA 2K27'), platform: 'Steam', id: 'steam-nba', slug: 'steam-nba', store_url: 'https://steam.example/nba' },
      ],
      'NBA 2K27',
    );

    expect(games).toHaveLength(1);
    expect(games[0]?.platform).toBe('Steam');
    expect(games[0]?.platforms).toEqual(['Steam', 'PlayStation', 'Nintendo']);
    expect(games[0]?.store_links).toEqual({
      PlayStation: 'https://ps.example/nba',
      Nintendo: 'https://nintendo.example/nba',
      Steam: 'https://steam.example/nba',
    });
  });

  test('prefers base game over deluxe edition and preserves base store links regardless of arrival order', () => {
    const gamesDeluxeFirst = mergeSearchHits(
      [
        { ...hit('007 First Light - Deluxe Edition'), platform: 'PlayStation', id: 'ps-deluxe', slug: 'ps-deluxe', store_url: 'https://ps.example/deluxe' },
        { ...hit('007 First Light'), platform: 'PlayStation', id: 'ps-base', slug: 'ps-base', store_url: 'https://ps.example/base' },
        { ...hit('007 First Light'), platform: 'Steam', id: 'steam-base', slug: 'steam-base', store_url: 'https://steam.example/base' },
      ],
      '007 First Light',
    );

    expect(gamesDeluxeFirst).toHaveLength(1);
    expect(gamesDeluxeFirst[0]?.title).toBe('007 First Light');
    expect(gamesDeluxeFirst[0]?.store_links?.['PlayStation']).toBe('https://ps.example/base');
    expect(gamesDeluxeFirst[0]?.store_links?.['Steam']).toBe('https://steam.example/base');

    const gamesBaseFirst = mergeSearchHits(
      [
        { ...hit('007 First Light'), platform: 'PlayStation', id: 'ps-base', slug: 'ps-base', store_url: 'https://ps.example/base' },
        { ...hit('007 First Light - Deluxe Edition'), platform: 'PlayStation', id: 'ps-deluxe', slug: 'ps-deluxe', store_url: 'https://ps.example/deluxe' },
        { ...hit('007 First Light'), platform: 'Steam', id: 'steam-base', slug: 'steam-base', store_url: 'https://steam.example/base' },
      ],
      '007 First Light',
    );

    expect(gamesBaseFirst).toHaveLength(1);
    expect(gamesBaseFirst[0]?.title).toBe('007 First Light');
    expect(gamesBaseFirst[0]?.store_links?.['PlayStation']).toBe('https://ps.example/base');
    expect(gamesBaseFirst[0]?.store_links?.['Steam']).toBe('https://steam.example/base');
  });
});
