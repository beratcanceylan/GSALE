import { describe, expect, test } from 'bun:test';

import { nativeState, resetNativeState } from '../../../test-support/native-mocks';
import { homeStoreMock } from '../../../test-support/screen-store-mocks';
import { allOfType, fire, render, updateExternalStore } from '../../../test-support/render';
import { uiDeal } from '../../../test-support/deals';
import type { Game } from '@/services/gameData';

const HomeScreen = (await import('../../../app/(tabs)/index')).default;

const game = (id: string, title: string, platforms: string[]): Game => ({
  id, title, imageUrl: '', platform: platforms[0] ?? '', source_platform: platforms[0] ?? '', price: '50,00 TL', discount: '',
  url: '', rating: null, platforms, deals: [uiDeal({ platform: platforms[0] ?? '', price: '50,00 TL' })],
});

const labelled = (view: Awaited<ReturnType<typeof render>>, label: string) =>
  view.root.findAll((node) => typeof node.type === 'string' && node.props['accessibilityLabel'] === label);

describe('home screen', () => {
  test('one mixed popular list: the first game leads, every card shows all its stores', async () => {
    resetNativeState();
    homeStoreMock.setSnapshot({ data: null, refreshing: false });
    const view = await render(<HomeScreen />);
    expect(view.text()).toContain('Popüler oyunlar yükleniyor');

    await updateExternalStore(() => { homeStoreMock.setSnapshot({ data: [], refreshing: false }); });
    expect(view.text()).toContain('Şu an gösterilecek oyun yok');

    await updateExternalStore(() => {
      homeStoreMock.setSnapshot({ data: [
        game('1', 'Hades', ['Steam', 'Epic Games', 'PlayStation']),
        game('e-2', 'Celeste', ['Epic Games']),
        game('xbox-3', 'Halo', ['Xbox']),
      ], refreshing: false });
    });
    expect(view.text()).toContain('Popüler');
    expect(view.text()).not.toContain('İndirimde');
    expect(labelled(view, 'PlayStation').length).toBeGreaterThan(0);
    expect(labelled(view, 'Xbox').length).toBeGreaterThan(0);

    const lead = labelled(view, 'Hades')[0];
    if (!lead) throw new Error('lead game missing');
    await fire(lead, 'onPress');
    expect(nativeState.router.pushed).toContainEqual({ pathname: '/game/[id]', params: { id: '1', platform: 'Steam' } });

    const list = allOfType(view.root, 'FlatList')[0];
    if (!list) throw new Error('home list missing');
    await fire(list, 'onRefresh');
    expect(homeStoreMock.loads.at(-1)).toBeTrue();
    await view.unmount();
  });
});
