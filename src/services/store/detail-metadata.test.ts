import { describe, expect, test } from 'bun:test';
import { mergeDetailMetadata, needsDetailMetadata } from '@/services/store/detail-metadata';
import type { LiveGame } from '@/services/store/types';

function game(overrides: Partial<LiveGame> = {}): LiveGame {
  return {
    id: 'base',
    title: 'Example Game',
    image_url: 'https://example.com/base.jpg',
    platform: 'Steam',
    source_platform: 'Steam',
    rating: null,
    ...overrides,
  };
}

describe('cross-store detail metadata', () => {
  test('detects missing descriptive metadata without depending on a title', () => {
    expect(needsDetailMetadata(game())).toBeTrue();
    expect(needsDetailMetadata(game({
      description: 'Description',
      release_date: '2026-05-26',
      developers: ['Studio'],
      genres: ['Action'],
    }))).toBeFalse();
  });

  test('fills missing fields from other platform details and preserves source fields', () => {
    const result = mergeDetailMetadata(
      game({ description: 'Source description', store_links: { Steam: 'https://steam.example' } }),
      [game({
        id: 'epic-id',
        platform: 'Epic Games',
        source_platform: 'Epic Games',
        description: 'Other description',
        release_date: '2026-05-26',
        developers: ['Studio'],
        genres: ['Action', 'Adventure'],
        store_links: { 'Epic Games': 'https://epic.example' },
        platforms: ['PC'],
      })],
    );

    expect(result.description).toBe('Source description');
    expect(result.release_date).toBe('2026-05-26');
    expect(result.developers).toEqual(['Studio']);
    expect(result.genres).toEqual(['Action', 'Adventure']);
    expect(result.store_links).toEqual({ Steam: 'https://steam.example', 'Epic Games': 'https://epic.example' });
    expect(result.platforms).toEqual(['PC']);
  });
});
