import { describe, expect, test } from 'bun:test';

import { getDealPlatforms, getGameImageSources, isSafeExternalUrl } from '@/utils/gameDisplay';

describe('getDealPlatforms', () => {
  test('keeps platforms exposed by store links even before a price is available', () => {
    const platforms = getDealPlatforms({
      platform: 'Steam',
      source_platform: 'Steam',
      deals: [],
      store_links: {
        Steam: 'https://store.steampowered.com/app/4356430/',
        PlayStation: 'https://store.playstation.com/tr-tr/product/example',
        Nintendo: 'https://www.nintendo.com/us/store/products/example/',
      },
    });

    expect(platforms).toEqual(['Steam', 'PlayStation', 'Nintendo']);
  });

  test('collapses hardware aliases into one store marker', () => {
    const platforms = getDealPlatforms({
      deals: [],
      platforms: ['PS5', 'Nintendo Switch 2', 'Steam'],
      store_links: {},
      platform: 'Steam',
      source_platform: 'Steam',
    });

    expect(platforms).toEqual(['PlayStation', 'Nintendo', 'Steam']);
  });
});

describe('external URL handoff', () => {
  test('accepts HTTPS store links and rejects non-HTTPS schemes', () => {
    expect(isSafeExternalUrl('https://store.example/game')).toBe(true);
    expect(isSafeExternalUrl('http://store.example/game')).toBe(false);
    expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeExternalUrl('not a URL')).toBe(false);
  });
});

describe('getGameImageSources', () => {
  test('prefers platform imageUrl before Steam deal fallback for non-Steam games', () => {
    const sources = getGameImageSources({
      id: 'xbox-abc',
      imageUrl: 'https://images.example/xbox-hero.jpg',
      source_platform: 'Xbox',
      platform: 'Xbox',
      deals: [
        {
          platform: 'Steam',
          price: '100 TL',
          discount: '',
          url: 'https://store.steampowered.com/app/730/',
        },
      ],
    });

    const uris = sources.map((source) =>
      typeof source === 'object' && 'uri' in source ? source.uri : '',
    );

    expect(uris[0]).toBe('https://images.example/xbox-hero.jpg');
    expect(uris.some((uri) => uri.includes('/apps/730/header.jpg'))).toBe(false);
  });

  test('includes Steam header fallbacks for Steam-sourced games', () => {
    const sources = getGameImageSources({
      id: '730',
      imageUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/730/header.jpg',
      source_platform: 'Steam',
      platform: 'Steam',
      deals: [],
    });

    const uris = sources.map((source) =>
      typeof source === 'object' && 'uri' in source ? source.uri : '',
    );

    expect(uris.length).toBeGreaterThan(0);
    expect(uris[0]).toContain('/apps/730/header.jpg');
  });
});
