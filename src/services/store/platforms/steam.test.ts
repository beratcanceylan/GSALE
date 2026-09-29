import { describe, expect, test } from 'bun:test';

function steamSearchImage(appId: number | string): string {
  return `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`;
}

describe('Steam search images', () => {
  test('search mapping prefers canonical header art over tiny thumbnails', () => {
    expect(steamSearchImage(730)).toBe(
      'https://cdn.akamai.steamstatic.com/steam/apps/730/header.jpg',
    );
  });
});
