import { describe, expect, test } from 'bun:test';

import '../../../test-support/sqlite-mock';
const { toggleFavorite } = await import('@/services/favorites');
const { favoritesStore } = await import('@/services/screenData/favoritesStore');

describe('favorites screen store', () => {
  test('loads once on subscription, publishes changes and removes listeners', () => {
    let notifications = 0;
    const unsubscribe = favoritesStore.subscribe(() => { notifications += 1; });
    const unsubscribeSecond = favoritesStore.subscribe(() => { notifications += 1; });
    const version = favoritesStore.getSnapshot().version;
    const favorite = { id: 'screen-store-favorite', title: 'Favorite' };
    if (favoritesStore.getSnapshot().data.some((row) => row.game_id === favorite.id)) {
      toggleFavorite(favorite);
    }
    toggleFavorite(favorite);
    favoritesStore.load();
    expect(favoritesStore.getSnapshot().data.map((row) => row.game_id)).toContain(favorite.id);
    expect(favoritesStore.getSnapshot().version).toBe(version + 1);
    expect(notifications).toBeGreaterThan(1);
    unsubscribeSecond();
    unsubscribe();
    toggleFavorite(favorite);
    const before = notifications;
    favoritesStore.load();
    expect(notifications).toBe(before);
  });
});
