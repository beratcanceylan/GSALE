import { describe, expect, test } from 'bun:test';

import { nativeState, resetNativeState } from '../../../test-support/native-mocks';
import { favoritesStoreMock, freeGamesStoreMock, homeStoreMock, searchStoreMock } from '../../../test-support/screen-store-mocks';
import { allOfType, byLabel, fire, render, updateExternalStore } from '../../../test-support/render';
import type { Game } from '@/services/gameData';

const HomeScreen = (await import('../../../app/(tabs)/index')).default;
const FreeGamesScreen = (await import('../../../app/(tabs)/free')).default;
const SearchScreen = (await import('../../../app/(tabs)/search')).default;
const FavoritesScreen = (await import('../../../app/(tabs)/favorites')).default;

const game: Game = {
  id: '1', title: 'Hades', imageUrl: '', platform: 'Steam', source_platform: 'Steam',
  price: '50,00 TL', originalPrice: '100,00 TL', discount: '-50%', url: '', deals: [], rating: null,
};

describe('tab screens', () => {

  test('free tab distinguishes current and upcoming promotions', async () => {
    freeGamesStoreMock.setSnapshot({ data: null, refreshing: false });
    const view = await render(<FreeGamesScreen />);
    expect(view.text()).toContain('Bedava oyunlar yükleniyor');
    await updateExternalStore(() => { freeGamesStoreMock.setSnapshot({ data: [], refreshing: false }); });
    expect(view.text()).toContain('Şu anda bedava oyun yok');
    await updateExternalStore(() => { freeGamesStoreMock.setSnapshot({ data: [game, { ...game, id: '2', title: 'Next Week', upcoming: true }], refreshing: false }); });
    expect(view.text()).toContain('Şu anda bedava');
    expect(view.text()).toContain('Gelecek hafta');
    const refresh = allOfType(view.root, 'RefreshControl')[0];
    if (!refresh) throw new Error('refresh control missing');
    await fire(refresh, 'onRefresh');
    expect(freeGamesStoreMock.loads.at(-1)).toBeTrue();
    await view.unmount();
  });

  test('search tab handles route query and each empty/result state', async () => {
    resetNativeState();
    nativeState.params = {};
    searchStoreMock.setSnapshot({ games: [], searchQuery: '', searching: false, hasSearched: false, version: 1 });
    const view = await render(<SearchScreen />);
    expect(view.text()).toContain('Arama yapmak için');
    nativeState.params = { q: 'Hades' };
    await view.update(<SearchScreen />);
    expect(searchStoreMock.queries).toContain('Hades');
    await updateExternalStore(() => { searchStoreMock.setSnapshot({ games: [], searchQuery: 'Hades', searching: true, hasSearched: true, version: 2 }); });
    expect(view.text()).toContain('Aranıyor');
    await updateExternalStore(() => { searchStoreMock.setSnapshot({ games: [], searchQuery: 'Hades', searching: false, hasSearched: true, version: 3 }); });
    expect(view.text()).toContain('Sonuç bulunamadı');
    await updateExternalStore(() => { searchStoreMock.setSnapshot({ games: [game], searchQuery: 'Hades', searching: false, hasSearched: true, version: 4 }); });
    expect(view.text()).toContain('Hades');
    await view.unmount();
  });

  test('favorites tab filters and clears locally', async () => {
    favoritesStoreMock.setSnapshot({ data: [], version: 1 });
    const view = await render(<FavoritesScreen />);
    expect(view.text()).toContain('Favoriler boş');
    await updateExternalStore(() => { favoritesStoreMock.setSnapshot({ data: [
      { game_id: '1', title: 'Hades', image_url: '', platform: 'Steam', price: '50,00 TL', discount: '-50%', original_price: '100,00 TL', created_at: 1 },
      { game_id: '2', title: 'Zelda', image_url: '', platform: 'Nintendo', price: '', discount: '', original_price: '', created_at: 2 },
    ], version: 2 }); });
    expect(view.text()).toContain('Hades');
    expect(view.text()).toContain('Zelda');
    await fire(byLabel(view.root, 'Favorilerde ara'), 'onChangeText', 'No match');
    expect(view.text()).toContain('Sonuç bulunamadı');
    await fire(byLabel(view.root, 'Aramayı temizle'), 'onPress');
    expect(view.text()).toContain('Hades');
    await view.unmount();
  });
});
