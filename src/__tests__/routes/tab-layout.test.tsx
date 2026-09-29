import { describe, expect, mock, test } from 'bun:test';

import '../../../test-support/native-mocks';
import '../../../test-support/sqlite-mock';
import { allOfType, render } from '../../../test-support/render';

mock.module('@/services/gameData', () => ({
  fetchHomeSections: () => Promise.resolve([]),
  fetchFreeGames: () => Promise.resolve([]),
}));

const { favoritesStore } = await import('@/services/screenData/favoritesStore');
const { freeGamesStore } = await import('@/services/screenData/freeGamesStore');
const { homeStore } = await import('@/services/screenData/homeStore');
const TabLayout = (await import('../../../app/(tabs)/_layout')).default;

describe('tab navigation', () => {
  test('renders every tab and routes tab presses to the right store', async () => {
    const called: string[] = [];
    const originalHome = homeStore.load;
    const originalFree = freeGamesStore.load;
    const originalFavorites = favoritesStore.load;
    Object.assign(homeStore, { load: (refresh: boolean) => { called.push(`home:${refresh}`); } });
    Object.assign(freeGamesStore, { load: (refresh: boolean) => { called.push(`free:${refresh}`); } });
    Object.assign(favoritesStore, { load: () => { called.push('favorites'); } });
    const view = await render(<TabLayout />);
    try {
      const screens = allOfType(view.root, 'Tabs.Screen');
      expect(screens.map((screen) => String(screen.props['name']))).toEqual([
        'index', 'search', 'favorites', 'free', 'settings',
      ]);
      const titles = screens.map((screen) => (screen.props['options'] as { title?: string; href?: null }));
      expect(titles.map((options) => options.title)).toEqual(['Anasayfa', 'Ara', 'Favoriler', 'Bedava', 'Ayarlar']);
      expect(titles.some((options) => options.href === null)).toBeFalse();
      for (const name of ['index', 'favorites', 'free']) {
        const screen = screens.find((item) => item.props['name'] === name);
        if (!screen) throw new Error(`Missing ${name} tab`);
        const listeners = screen.props['listeners'] as { tabPress: () => void };
        listeners.tabPress();
      }
      expect(called).toEqual(['home:true', 'favorites', 'free:true']);
    } finally {
      await view.unmount();
      Object.assign(homeStore, { load: originalHome });
      Object.assign(freeGamesStore, { load: originalFree });
      Object.assign(favoritesStore, { load: originalFavorites });
    }
  });
});
