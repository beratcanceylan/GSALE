import { describe, expect, test } from 'bun:test';

import { nativeState, resetNativeState } from '../test-support/native-mocks';
import { gameDetailStoreMock } from '../test-support/screen-store-mocks';
import { allOfType, byLabel, fire, render, updateExternalStore } from '../test-support/render';
import { sqliteMock } from '../test-support/sqlite-mock';
import type { Game } from '@/services/gameData';

const GameDetailScreen = (await import('../app/game/[id]')).default;

const steam = { platform: 'Steam', price: '50,00 TL', originalPrice: '100,00 TL', discount: '-50%', url: 'https://store.steampowered.com/app/1/' };
const xbox = { platform: 'Xbox', price: '60,00 TL', discount: '', url: 'https://www.xbox.com/games/store/1', subscriptionNote: 'Game Pass' };
const steamDeluxe = { platform: 'Steam', price: '90,00 TL', discount: '', url: 'https://store.steampowered.com/app/2/' };

const game: Game = {
  id: 'detail-screen-test', title: 'Hades', imageUrl: 'https://example.com/hero.jpg',
  platform: 'Steam', source_platform: 'Steam', price: '50,00 TL', originalPrice: '100,00 TL',
  discount: '-50%', url: 'https://store.steampowered.com/app/1/', rating: null,
  edition: 'base',
  editions: [
    { key: 'base', deals: [steam, xbox] },
    { key: 'deluxe', deals: [steamDeluxe] },
  ],
  deals: [steam, xbox],
};

describe('game detail screen', () => {
  test('handles missing routes, loading and request errors', async () => {
    resetNativeState();
    nativeState.params = {};
    const missing = await render(<GameDetailScreen />);
    expect(missing.text()).toContain('Oyun bulunamadı');
    await fire(byLabel(missing.root, 'Geri dön'), 'onPress');
    expect(nativeState.router.back).toBe(1);
    await missing.unmount();

    nativeState.params = { id: 'detail-screen-test', platform: 'Steam' };
    gameDetailStoreMock.setSnapshot({ game: null, loading: true, error: null, version: 1 });
    const view = await render(<GameDetailScreen />);
    expect(view.text()).toContain('Fiyatlar kontrol ediliyor');
    await updateExternalStore(() => { gameDetailStoreMock.setSnapshot({ game: null, loading: false, error: 'Network failed', version: 2 }); });
    expect(view.text()).toContain('Network failed');
    await view.unmount();
  });

  test('shows prices without overview, metadata or media, and opens safe store links', async () => {
    resetNativeState();
    nativeState.params = { id: game.id, platform: 'Steam' };
    gameDetailStoreMock.setSnapshot({ game, selectedEdition: 'base', loading: false, error: null, version: 3 });
    const view = await render(<GameDetailScreen />);
    expect(view.text()).not.toContain('Genel Bakış');
    expect(allOfType(view.root, 'VideoView')).toHaveLength(0);
    expect(view.text()).toContain('60,00 TL');

    await fire(byLabel(view.root, 'Favorilere ekle'), 'onPress');
    expect(sqliteMock.favoriteRows.has(game.id)).toBeTrue();
    await fire(byLabel(view.root, 'Favorilerden çıkar'), 'onPress');
    expect(sqliteMock.favoriteRows.has(game.id)).toBeFalse();

    await fire(byLabel(view.root, 'Xbox mağazasında'), 'onPress');
    expect(nativeState.openedUrls).toContain('https://www.xbox.com/games/store/1');
    await view.unmount();
  });

  test('switching edition shows that edition\'s prices', async () => {
    resetNativeState();
    nativeState.params = { id: game.id, platform: 'Steam' };
    gameDetailStoreMock.setSnapshot({ game, selectedEdition: 'base', loading: false, error: null, version: 4 });
    const view = await render(<GameDetailScreen />);
    await fire(byLabel(view.root, 'deluxe'), 'onPress');
    expect(gameDetailStoreMock.selections).toContain('deluxe');
    expect(view.text()).toContain('90,00 TL');
    expect(view.text()).not.toContain('60,00 TL');
    await view.unmount();
  });

  test('shows an unavailable price message for an edition without prices', async () => {
    resetNativeState();
    nativeState.params = { id: 'unpriced' };
    gameDetailStoreMock.setSnapshot({
      game: { ...game, id: 'unpriced', imageUrl: '', editions: [], deals: [] },
      selectedEdition: null, loading: false, error: null, version: 5,
    });
    const view = await render(<GameDetailScreen />);
    expect(view.text()).toContain('Fiyat bilgisi bulunamadı');
    await view.unmount();
  });

  test('falls back after broken hero images', async () => {
    resetNativeState();
    nativeState.params = { id: 'fallback-images' };
    gameDetailStoreMock.setSnapshot({
      game: { ...game, id: 'fallback-images', imageUrl: 'https://example.com/broken.jpg' },
      selectedEdition: 'base', loading: false, error: null, version: 6,
    });
    const view = await render(<GameDetailScreen />);
    const hero = () => allOfType(view.root, 'Image').find((node) => node.props['accessibilityLabel'] === 'Hades kapak görseli');
    let failedImages = 0;
    while (hero() && failedImages < 8) {
      const image = hero();
      if (!image) break;
      await fire(image, 'onError');
      failedImages += 1;
    }
    expect(failedImages).toBeGreaterThan(0);
    expect(hero()).toBeUndefined();
    await view.unmount();
  });
});
