import { describe, expect, test } from 'bun:test';

import { sqliteMock } from '../../test-support/sqlite-mock';

const { getFavorites, isFavorite, toggleFavorite } = await import('@/services/favorites');

describe('favorites persistence', () => {
  test('creates the table once, adds a favorite and removes it on the next toggle', () => {
    const game = { id: 'fav-1', title: 'Favorite', imageUrl: 'https://example.com/a.jpg', platform: 'Steam', price: '10,00 TL', discount: '-50%', originalPrice: '20,00 TL' };
    expect(isFavorite(game.id)).toBeFalse();
    expect(toggleFavorite(game)).toBeTrue();
    expect(isFavorite(game.id)).toBeTrue();
    expect(getFavorites()[0]).toMatchObject({ game_id: 'fav-1', title: 'Favorite', original_price: '20,00 TL' });
    expect(toggleFavorite(game)).toBeFalse();
    expect(getFavorites()).toEqual([]);
    expect(sqliteMock.favoriteOpens).toBe(1);
    expect(sqliteMock.favoriteStatements.filter((sql) => sql.includes('CREATE TABLE'))).toHaveLength(1);
  });

  test('stores empty strings for missing optional fields', () => {
    expect(toggleFavorite({ id: 'fav-2', title: 'Plain' })).toBeTrue();
    expect(getFavorites()[0]).toMatchObject({ image_url: '', platform: '', price: '', discount: '', original_price: '' });
  });
});
