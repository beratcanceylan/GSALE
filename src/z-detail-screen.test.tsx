import { describe, expect, test } from 'bun:test';

import { nativeState, resetNativeState } from '../test-support/native-mocks';
import { gameDetailStoreMock } from '../test-support/screen-store-mocks';
import { allOfType, byLabel, fire, render, updateExternalStore, type Rendered } from '../test-support/render';
import { sqliteMock } from '../test-support/sqlite-mock';
import type { Game } from '@/services/gameData';

const GameDetailScreen = (await import('../app/game/[id]')).default;

const game: Game = {
  id: 'detail-screen-test', title: 'Hades', imageUrl: 'https://example.com/hero.jpg',
  platform: 'Steam', source_platform: 'Steam', price: '50,00 TL', originalPrice: '100,00 TL',
  discount: '-50%', url: 'https://store.steampowered.com/app/1/', rating: null,
  description: 'Escape the underworld', release_date: '2026-09-01', developers: ['Supergiant'], genres: ['Action'],
  screenshots: ['https://example.com/one.jpg', 'https://example.com/two.jpg'],
  videos: [
    { platform: 'youtube', id: 'youtube-1', url: 'https://www.youtube.com/watch?v=1' },
    { platform: 'mp4', id: 'video-2', url: 'https://example.com/trailer.mp4' },
  ],
  deals: [
    { platform: 'Steam', price: '50,00 TL', originalPrice: '100,00 TL', discount: '-50%', url: 'https://store.steampowered.com/app/1/' },
    { platform: 'Xbox', price: '60,00 TL', discount: '', url: 'https://www.xbox.com/games/store/1', subscriptionNote: 'Game Pass' },
    { platform: 'GOG', price: 'Bilinmiyor', discount: '', url: '' },
  ],
};

function pressableWithText(root: Rendered['root'], label: string): Rendered['root'] {
  const node = allOfType(root, 'Pressable').find((pressable) =>
    pressable.findAll((child) => String(child.type) === 'Text' && child.children.includes(label)).length > 0,
  );
  if (!node) throw new Error(`Pressable missing: ${label}`);
  return node;
}

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

  test('opens media, safe store links, favorite action and grouped prices', async () => {
    resetNativeState();
    nativeState.params = { id: game.id, platform: 'Steam' };
    gameDetailStoreMock.setSnapshot({ game, loading: false, error: null, version: 3 });
    const view = await render(<GameDetailScreen />);
    expect(view.text()).toContain('Escape the underworld');
    expect(view.text()).toContain('1 Eylül 2026');

    await fire(byLabel(view.root, 'Favorilere ekle'), 'onPress');
    expect(sqliteMock.favoriteRows.has(game.id)).toBeTrue();
    await fire(byLabel(view.root, 'Favorilerden çıkar'), 'onPress');
    expect(sqliteMock.favoriteRows.has(game.id)).toBeFalse();

    await fire(byLabel(view.root, 'En ucuz fiyat'), 'onPress');
    expect(nativeState.openedUrls).toContain('https://store.steampowered.com/app/1/');
    const videos = allOfType(view.root, 'Pressable').filter((node) => node.props['accessibilityLabel'] === 'Video izle');
    expect(videos).toHaveLength(2);
    const youtube = videos[0];
    const trailer = videos[1];
    if (!youtube || !trailer) throw new Error('video controls missing');
    await fire(youtube, 'onPress');
    expect(nativeState.openedUrls).toContain('https://www.youtube.com/watch?v=1');
    await fire(trailer, 'onPress');
    expect(allOfType(view.root, 'VideoView')).toHaveLength(1);
    await fire(byLabel(view.root, 'Videoyu kapat'), 'onPress');
    expect(allOfType(view.root, 'VideoView')).toHaveLength(0);

    const screenshot = allOfType(view.root, 'Pressable').find((node) => node.props['accessibilityLabel'] === 'Ekran görüntüsünü büyüt');
    if (!screenshot) throw new Error('screenshot control missing');
    await fire(screenshot, 'onPress');
    expect(allOfType(view.root, 'Modal')).toHaveLength(1);
    const modal = allOfType(view.root, 'Modal')[0];
    if (!modal) throw new Error('screenshot modal missing');
    const closeScreenshot = allOfType(modal, 'Pressable')[0];
    if (!closeScreenshot) throw new Error('screenshot close control missing');
    await fire(closeScreenshot, 'onPress');
    expect(allOfType(view.root, 'Modal')).toHaveLength(0);

    await fire(pressableWithText(view.root, 'Fiyatlar'), 'onPress');
    expect(view.text()).toContain('PC');
    expect(view.text()).toContain('Konsol');
    await fire(byLabel(view.root, 'Xbox mağazasında'), 'onPress');
    expect(nativeState.openedUrls).toContain('https://www.xbox.com/games/store/1');
    await view.unmount();
  });

  test('shows an unavailable price message for an unpriced game', async () => {
    resetNativeState();
    nativeState.params = { id: 'unpriced' };
    gameDetailStoreMock.setSnapshot({ game: { ...game, id: 'unpriced', imageUrl: '', screenshots: [], videos: [], deals: [] }, loading: false, error: null, version: 4 });
    const view = await render(<GameDetailScreen />);
    await fire(pressableWithText(view.root, 'Fiyatlar'), 'onPress');
    expect(view.text()).toContain('Fiyat bilgisi bulunamadı');
    await view.unmount();
  });

  test('falls back after broken hero images and sorts prices within one store', async () => {
    resetNativeState();
    nativeState.params = { id: 'fallback-images' };
    gameDetailStoreMock.setSnapshot({ game: {
      ...game,
      id: 'fallback-images',
      imageUrl: 'https://example.com/broken.jpg',
      screenshots: ['https://example.com/backup.jpg'],
      release_date: '2026-13-01',
      deals: [
        { platform: 'Steam', price: '75,00 TL', discount: '', url: 'https://store.steampowered.com/app/2/' },
        { platform: 'Steam', price: '25,00 TL', discount: '', url: 'https://store.steampowered.com/app/3/' },
      ],
    }, loading: false, error: null, version: 5 });
    const view = await render(<GameDetailScreen />);
    expect(view.text()).toContain('2026-13-01');
    const hero = () => allOfType(view.root, 'Image').find((node) =>
      node.props['accessibilityLabel'] === 'Hades kapak görseli');
    let failedImages = 0;
    while (hero() && failedImages < 8) {
      const image = hero();
      if (!image) break;
      await fire(image, 'onError');
      failedImages += 1;
    }
    expect(failedImages).toBeGreaterThan(1);
    expect(hero()).toBeUndefined();
    await fire(pressableWithText(view.root, 'Fiyatlar'), 'onPress');
    expect(view.text()).toContain('25,00 TL');
    await view.unmount();
  });

  test('shows non-ISO release dates as supplied', async () => {
    resetNativeState();
    nativeState.params = { id: 'upcoming-detail' };
    gameDetailStoreMock.setSnapshot({ game: {
      ...game, id: 'upcoming-detail', release_date: 'Coming soon',
    }, loading: false, error: null, version: 6 });
    const view = await render(<GameDetailScreen />);
    expect(view.text()).toContain('Coming soon');
    await view.unmount();
  });
});
