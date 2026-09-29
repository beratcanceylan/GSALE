import { describe, expect, test } from 'bun:test';

import { nativeState, resetNativeState } from '../../../test-support/native-mocks';
import { homeStoreMock } from '../../../test-support/screen-store-mocks';
import { allOfType, fire, render, updateExternalStore } from '../../../test-support/render';
import { uiDeal } from '../../../test-support/deals';
import type { Game } from '@/services/gameData';

const HomeScreen = (await import('../../../app/(tabs)/index')).default;

const game = (id: string, title: string, platform: string, discount: string): Game => ({
  id, title, imageUrl: '', platform, source_platform: platform, price: '50,00 TL', discount, url: '', rating: null,
  deals: [uiDeal({ platform, price: '50,00 TL', originalPrice: '100,00 TL', discount })],
});

describe('home screen', () => {
  test('loading, empty, then the deepest discount first and one strip per store', async () => {
    resetNativeState();
    homeStoreMock.setSnapshot({ data: null, refreshing: false });
    const view = await render(<HomeScreen />);
    expect(view.text()).toContain('İndirimler yükleniyor');

    await updateExternalStore(() => { homeStoreMock.setSnapshot({ data: [], refreshing: false }); });
    expect(view.text()).toContain('Şu an gösterilecek indirim bulunamadı');

    await updateExternalStore(() => {
      homeStoreMock.setSnapshot({ data: [
        { platform: 'Steam', games: [game('1', 'Hades', 'Steam', '-50%'), game('2', 'Celeste', 'Steam', '-75%')] },
        { platform: 'Xbox', games: [game('xbox-3', 'Halo', 'Xbox', '-20%')] },
      ], refreshing: false });
    });
    expect(view.text()).toContain('Şu anki en büyük indirim');
    expect(view.text()).toContain('İndirimde');
    expect(view.root.findAll((node) => typeof node.type === 'string' && node.props['accessibilityLabel'] === 'Xbox').length).toBeGreaterThan(0);

    const featured = view.root.findAll((node) => node.props['accessibilityLabel'] === 'Celeste' && node.props['accessibilityRole'] === 'link')[0];
    if (!featured) throw new Error('featured deal missing');
    await fire(featured, 'onPress');
    expect(nativeState.router.pushed).toContainEqual({ pathname: '/game/[id]', params: { id: '2', platform: 'Steam' } });

    const list = allOfType(view.root, 'FlatList')[0];
    if (!list) throw new Error('home list missing');
    await fire(list, 'onRefresh');
    expect(homeStoreMock.loads.at(-1)).toBeTrue();
    await view.unmount();
  });
});
