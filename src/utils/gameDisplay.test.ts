import { describe, expect, test } from 'bun:test';

import type { Game } from '@/services/gameData';
import { uiDeal } from '../../test-support/deals';
import {
  getDealPlatforms,
  getGameImageSources,
  getTitleInitial,
  isSafeExternalUrl,
  resolveCardPrice,
} from '@/utils/gameDisplay';

function game(overrides: Partial<Game> = {}): Game {
  return {
    id: '1',
    title: 'Game',
    platform: 'Steam',
    discount: '',
    price: '',
    imageUrl: '',
    url: '',
    deals: [],
    ...overrides,
  };
}

const deal = (
  platform: string,
  price: string,
  extra: Partial<Pick<Game['deals'][number], 'discount' | 'originalPrice' | 'url' | 'subscriptionNote'>> = {},
) => uiDeal({ platform, price, ...extra });

describe('getTitleInitial', () => {
  test('uses the first letter, including Turkish letters', () => {
    expect(getTitleInitial('  şeytan')).toBe('Ş');
    expect(getTitleInitial('123 go')).toBe('G');
    expect(getTitleInitial('123')).toBe('?');
  });
});

describe('isSafeExternalUrl', () => {
  test('allows only https URLs', () => {
    expect(isSafeExternalUrl('https://store.steampowered.com/app/1')).toBeTrue();
    expect(isSafeExternalUrl('http://example.com')).toBeFalse();
    expect(isSafeExternalUrl('not a url')).toBeFalse();
    expect(isSafeExternalUrl('')).toBeFalse();
    expect(isSafeExternalUrl(null)).toBeFalse();
  });
});

describe('getGameImageSources', () => {
  test('falls back to Steam header art for Steam games', () => {
    const sources = getGameImageSources(
      game({
        id: '730',
        imageUrl: 'https://example.com/cover.jpg',
        source_platform: 'Steam',
        deals: [deal('Steam', '10 TL', { url: 'https://store.steampowered.com/app/570/' })],
      }),
    );
    expect(sources.map((source) => (source as { uri: string }).uri)).toEqual([
      'https://example.com/cover.jpg',
      'https://cdn.akamai.steamstatic.com/steam/apps/730/header.jpg',
      'https://cdn.cloudflare.steamstatic.com/steam/apps/730/header.jpg',
      'https://cdn.akamai.steamstatic.com/steam/apps/570/header.jpg',
      'https://cdn.cloudflare.steamstatic.com/steam/apps/570/header.jpg',
    ]);
  });

  test('uses a steam- prefixed id when there is no image, and nothing for other stores', () => {
    const steam = getGameImageSources(game({ id: 'steam-440', platform: 'Xbox', imageUrl: ' ' }));
    expect(steam).toHaveLength(2);
    expect(getGameImageSources(game({ id: 'ps-1', platform: 'PlayStation', imageUrl: '' }))).toEqual([]);
    const duplicate = getGameImageSources(game({ imageUrl: 'https://a/x.jpg', platform: 'Xbox' }));
    expect(duplicate).toHaveLength(1);
  });
});

describe('resolveCardPrice', () => {
  test('uses the best deal with its original price, or the game original price', () => {
    expect(
      resolveCardPrice(game({ deals: [deal('A', '10 TL', { discount: '-50%', originalPrice: '20 TL' })] })),
    ).toEqual({ purchasable: true, price: '10 TL', discount: '-50%', originalPrice: '20 TL' });
    expect(
      resolveCardPrice(game({ discount: '-10%', originalPrice: '30 TL', deals: [deal('A', '27 TL')] })),
    ).toEqual({ purchasable: true, price: '27 TL', discount: '-10%', originalPrice: '30 TL' });
    expect(resolveCardPrice(game({ deals: [deal('A', '27 TL')] }))).toEqual({
      purchasable: true,
      price: '27 TL',
      discount: '',
    });
  });

  test('falls back to the game price, then to an unavailable label', () => {
    expect(resolveCardPrice(game({ price: '5 TL', originalPrice: '9 TL', discount: '-40%' }))).toEqual({
      purchasable: true,
      price: '5 TL',
      discount: '-40%',
      originalPrice: '9 TL',
    });
    expect(resolveCardPrice(game({ price: '5 TL' }))).toEqual({ purchasable: true, price: '5 TL', discount: '' });
    expect(resolveCardPrice(game({ price: 'Bilinmiyor', deals: [deal('A', 'Bilinmiyor')] }))).toEqual({
      purchasable: false,
      price: '',
      discount: '',
    });
  });
});

describe('getDealPlatforms', () => {
  test('canonicalises store names from deals, platforms and store links', () => {
    expect(
      getDealPlatforms({
        platform: 'Steam',
        deals: [deal('PS5', '1 TL'), deal('epic', '1 TL')],
        platforms: ['Nintendo Switch', 'switch', ' '],
        store_links: { 'PlayStation 4': 'x', GOG: 'y' },
      }),
    ).toEqual(['PlayStation', 'Epic Games', 'Nintendo', 'GOG']);
  });

  test('falls back to the platform, then the source platform', () => {
    expect(getDealPlatforms({ platform: 'Xbox', deals: [] })).toEqual(['Xbox']);
    expect(getDealPlatforms({ platform: '', source_platform: 'GOG', deals: [] })).toEqual(['GOG']);
    expect(getDealPlatforms({ platform: '', deals: [] })).toEqual([]);
  });
});
