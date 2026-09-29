import { describe, expect, test } from 'bun:test';

import { nativeState, resetNativeState } from '../../../test-support/native-mocks';
import { favoritesStoreMock, freeGamesStoreMock, searchStoreMock } from '../../../test-support/screen-store-mocks';
import { allOfType, byLabel, fire, render, updateExternalStore } from '../../../test-support/render';
import type { Game } from '@/services/gameData';

const FreeGamesScreen = (await import('../../../app/(tabs)/free')).default;
const SearchScreen = (await import('../../../app/(tabs)/search')).default;
const FavoritesScreen = (await import('../../../app/(tabs)/favorites')).default;

const game: Game = {
  id: '1', title: 'Hades', imageUrl: '', platform: 'Epic Games', source_platform: 'Epic Games',
  price: '', discount: '', url: '', deals: [], rating: null,
};

describe('search tab', () => {
  test('starts from the route query, ignores one letter and shows each state', async () => {
    resetNativeState();
    nativeState.params = { q: 'Hades' };
    searchStoreMock.setSnapshot({ games: [], searchQuery: 'Hades', searching: true, hasSearched: true, version: 1 });
    const view = await render(<SearchScreen />);
    expect(searchStoreMock.queries).toContain('Hades');
    expect(view.text()).toContain('Bütün mağazalarda aranıyor');

    await updateExternalStore(() => { searchStoreMock.setSnapshot({ games: [], searchQuery: 'Hades', searching: false, hasSearched: true, version: 2 }); });
    expect(view.text()).toContain('“Hades” için oyun bulunamadı');

    await updateExternalStore(() => {
      searchStoreMock.setSnapshot({ games: [game, { ...game, id: '2', title: 'Hades II' }, { ...game, id: '3', title: 'Hades Deluxe' }], searchQuery: 'Hades', searching: false, hasSearched: true, version: 3 });
    });
    expect(view.text()).toContain('3 oyun');
    expect(view.text()).toContain('Hades II');

    const input = allOfType(view.root, 'TextInput')[0];
    if (!input) throw new Error('search field missing');
    await fire(input, 'onChangeText', 'x');
    await fire(allOfType(view.root, 'TextInput')[0] ?? input, 'onSubmitEditing');
    expect(searchStoreMock.searches).not.toContain('x');
    expect(view.text()).toContain('En az 2 harf yazın');
    await fire(allOfType(view.root, 'TextInput')[0] ?? input, 'onChangeText', ' Celeste ');
    await fire(allOfType(view.root, 'TextInput')[0] ?? input, 'onSubmitEditing');
    expect(searchStoreMock.searches).toContain('Celeste');
    await view.unmount();
  });
});

describe('free tab', () => {
  test('loading, empty, then free-now and free-next groups with free price tags', async () => {
    freeGamesStoreMock.setSnapshot({ data: null, refreshing: false });
    const view = await render(<FreeGamesScreen />);
    expect(view.text()).toContain('Bedava oyunlar yükleniyor');
    await updateExternalStore(() => { freeGamesStoreMock.setSnapshot({ data: [], refreshing: false }); });
    expect(view.text()).toContain('Şu an bedava oyun yok');
    await updateExternalStore(() => {
      freeGamesStoreMock.setSnapshot({ data: [game, { ...game, id: '2', title: 'Next Week', upcoming: true }], refreshing: false });
    });
    expect(view.text()).toContain('Şu an bedava');
    expect(view.text()).toContain('Yakında bedava');
    expect(view.text()).toContain('Ücretsiz');
    const list = allOfType(view.root, 'FlatList')[0];
    if (!list) throw new Error('free list missing');
    await fire(list, 'onRefresh');
    expect(freeGamesStoreMock.loads.at(-1)).toBeTrue();
    await view.unmount();
  });
});

describe('favorites tab', () => {
  test('lists saved games with their price, filters and clears locally', async () => {
    favoritesStoreMock.setSnapshot({ data: [], version: 1 });
    const view = await render(<FavoritesScreen />);
    expect(view.text()).toContain('Favorilere eklediğiniz oyunlar burada görünür');
    await updateExternalStore(() => { favoritesStoreMock.setSnapshot({ data: [
      { game_id: '1', title: 'Hades', image_url: '', platform: 'Steam', price: '50,00 TL', discount: '-50%', original_price: '100,00 TL', created_at: 1 },
      { game_id: '2', title: 'Zelda', image_url: '', platform: 'Nintendo', price: '', discount: '', original_price: '', created_at: 2 },
    ], version: 2 }); });
    expect(view.text()).toContain('Hades');
    expect(view.text()).toContain('Zelda');
    await fire(byLabel(view.root, 'Favorilerde ara'), 'onChangeText', 'No match');
    expect(view.text()).toContain('“No match” ile eşleşen favori yok');
    await fire(byLabel(view.root, 'Temizle'), 'onPress');
    expect(view.text()).toContain('Hades');
    await view.unmount();
  });
});
