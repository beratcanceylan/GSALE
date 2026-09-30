import { describe, expect, test } from 'bun:test';

import { nativeState, resetNativeState } from '../test-support/native-mocks';
import { gameDetailStoreMock } from '../test-support/screen-store-mocks';
import { allOfType, byLabel, fire, render, updateExternalStore, type Rendered } from '../test-support/render';
import { sqliteMock } from '../test-support/sqlite-mock';
import { uiDeal } from '../test-support/deals';
import type { Game } from '@/services/gameData';

const GameDetailScreen = (await import('../app/game/[id]')).default;
const { formatMoney } = await import('@/i18n');

const steamBase = uiDeal({ platform: 'Steam', price: '50,00 TL', originalPrice: '100,00 TL', discount: '-50%', url: 'https://store.steampowered.com/app/1/' });
const epicBase = uiDeal({ platform: 'Epic Games', price: '45,00 TL', url: 'https://store.epicgames.com/p/hades' });
const steamDeluxe = uiDeal({ platform: 'Steam', price: '90,00 TL', url: 'https://store.steampowered.com/app/2/' });
const xboxDeluxe = uiDeal({ platform: 'Xbox', price: '95,00 TL', url: 'http://www.xbox.com/games/store/2' });

const game: Game = {
  id: 'detail-screen-test', title: 'Hades', imageUrl: 'https://example.com/hero.jpg',
  platform: 'Steam', source_platform: 'Steam', price: '90,00 TL', discount: '', url: '', rating: null,
  edition: 'deluxe',
  editions: [
    { key: 'base', deals: [epicBase, steamBase] },
    { key: 'deluxe', deals: [steamDeluxe, xboxDeluxe] },
  ],
  deals: [steamDeluxe, xboxDeluxe],
};

function rowFor(view: Rendered, store: string) {
  const row = view.root.findAll((node) => typeof node.type === 'string' && node.props['testID'] === `price-row-${store}`)[0];
  if (!row) throw new Error(`row missing: ${store}`);
  return row;
}

function textOf(node: Rendered['root']): string {
  return node
    .findAll((child) => String(child.type) === 'Text')
    .map((child) => child.children.filter((part): part is string => typeof part === 'string').join(''))
    .join(' ');
}

describe('game detail screen', () => {
  test('missing route, loading, and a load error with retry', async () => {
    resetNativeState();
    nativeState.params = {};
    const missing = await render(<GameDetailScreen />);
    expect(missing.text()).toContain('Oyun bulunamadı');
    await fire(byLabel(missing.root, 'Geri dön'), 'onPress');
    expect(nativeState.router.back).toBe(1);
    await missing.unmount();

    nativeState.params = { id: 'detail-screen-test', platform: 'Steam' };
    gameDetailStoreMock.setSnapshot({ game: null, selectedEdition: null, loading: true, error: null, version: 1 });
    const view = await render(<GameDetailScreen />);
    expect(view.text()).toContain('Fiyatlar kontrol ediliyor');
    await updateExternalStore(() => { gameDetailStoreMock.setSnapshot({ game: null, selectedEdition: null, loading: false, error: 'load-failed', version: 2 }); });
    expect(view.text()).toContain('Oyun bilgileri yüklenemedi');
    await fire(byLabel(view.root, 'Tekrar dene'), 'onPress');
    expect(gameDetailStoreMock.reloads).toContainEqual(['detail-screen-test', 'Steam']);
    await view.unmount();
  });

  test('a Deluxe route shows Deluxe prices and marks stores without Deluxe', async () => {
    resetNativeState();
    nativeState.params = { id: game.id, platform: 'Steam' };
    gameDetailStoreMock.setSnapshot({ game, selectedEdition: 'deluxe', loading: false, error: null, version: 3 });
    const view = await render(<GameDetailScreen />);
    const deluxeTab = byLabel(view.root, 'Deluxe');
    expect(deluxeTab.props['accessibilityState']).toMatchObject({ selected: true });
    expect(textOf(rowFor(view, 'Steam'))).toContain(formatMoney(90));
    expect(textOf(rowFor(view, 'Steam'))).toContain('En düşük');
    expect(textOf(rowFor(view, 'Epic Games'))).toContain('Bu sürüm yok');
    expect(view.text()).not.toContain('Genel Bakış');

    await fire(rowFor(view, 'Steam'), 'onPress');
    expect(nativeState.openedUrls).toContain('https://store.steampowered.com/app/2/');
    await fire(rowFor(view, 'Xbox'), 'onPress');
    expect(nativeState.openedUrls).not.toContain('http://www.xbox.com/games/store/2');
    await view.unmount();
  });

  test('choosing Standard shows the base prices without a new request', async () => {
    resetNativeState();
    nativeState.params = { id: game.id, platform: 'Steam' };
    gameDetailStoreMock.setSnapshot({ game, selectedEdition: 'deluxe', loading: false, error: null, version: 4 });
    const view = await render(<GameDetailScreen />);
    const reloads = gameDetailStoreMock.reloads.length;
    await fire(byLabel(view.root, 'Standart'), 'onPress');
    expect(gameDetailStoreMock.selections.at(-1)).toBe('base');
    expect(textOf(rowFor(view, 'Epic Games'))).toContain(formatMoney(45));
    expect(textOf(rowFor(view, 'Xbox'))).toContain('Bu sürüm yok');
    expect(gameDetailStoreMock.reloads).toHaveLength(reloads);
    await view.unmount();
  });

  test('favorites toggle, and one edition hides the picker', async () => {
    resetNativeState();
    nativeState.params = { id: 'single' };
    const single: Game = { ...game, id: 'single', edition: 'base', editions: [{ key: 'base', deals: [steamBase] }], deals: [steamBase] };
    gameDetailStoreMock.setSnapshot({ game: single, selectedEdition: 'base', loading: false, error: null, version: 5 });
    const view = await render(<GameDetailScreen />);
    expect(view.root.findAll((node) => node.props['accessibilityRole'] === 'tab')).toHaveLength(0);
    await fire(byLabel(view.root, 'Favorilere ekle'), 'onPress');
    expect(sqliteMock.favoriteRows.has('single')).toBeTrue();
    await fire(byLabel(view.root, 'Favorilerden çıkar'), 'onPress');
    expect(sqliteMock.favoriteRows.has('single')).toBeFalse();
    await view.unmount();
  });

  test('an edition no store sells says so', async () => {
    resetNativeState();
    nativeState.params = { id: 'unpriced' };
    gameDetailStoreMock.setSnapshot({ game: { ...game, id: 'unpriced', editions: [], deals: [] }, selectedEdition: null, loading: false, error: null, version: 6 });
    const view = await render(<GameDetailScreen />);
    expect(view.text()).toContain('Bu sürümü şu an satan mağaza yok');
    expect(allOfType(view.root, 'Image').length).toBeGreaterThan(0);
    await view.unmount();
  });

  test('a free edition reads "free" in the picker, and a favorite keeps the chosen edition price', async () => {
    resetNativeState();
    nativeState.params = { id: 'free-edition' };
    const freeBase = uiDeal({ platform: 'Epic Games', price: 'Ücretsiz', url: 'https://store.epicgames.com/p/x' });
    const freeGame: Game = { ...game, id: 'free-edition', edition: 'base', editions: [
      { key: 'base', deals: [freeBase] },
      { key: 'deluxe', deals: [steamDeluxe] },
    ], deals: [freeBase] };
    gameDetailStoreMock.setSnapshot({ game: freeGame, selectedEdition: 'deluxe', loading: false, error: null, version: 7 });
    const view = await render(<GameDetailScreen />);
    expect(textOf(byLabel(view.root, 'Standart'))).toContain('Ücretsiz');
    await fire(byLabel(view.root, 'Favorilere ekle'), 'onPress');
    expect(sqliteMock.favoriteRows.get('free-edition')).toMatchObject({ price: '90,00 TL' });
    await view.unmount();
  });
});
