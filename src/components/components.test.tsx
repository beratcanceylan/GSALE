import { afterEach, describe, expect, test } from 'bun:test';

import { nativeState, resetNativeState } from '../../test-support/native-mocks';
import { allOfType, byLabel, fire, render } from '../../test-support/render';
import type { Game } from '@/services/gameData';

const { AppBackground } = await import('@/components/AppBackground');
const { CardFooter } = await import('@/components/CardFooter');
const { CardImage } = await import('@/components/CardImage');
const { EmptyState } = await import('@/components/EmptyState');
const { FeaturedDeal } = await import('@/components/FeaturedDeal');
const { GameCard } = await import('@/components/GameCard');
const { GameListItem } = await import('@/components/GameListItem');
const { GameSearchBar } = await import('@/components/GameSearchBar');
const { HomeTopBar } = await import('@/components/HomeTopBar');
const { PlatformBadge } = await import('@/components/PlatformBadge');
const { PlatformBadgeList } = await import('@/components/PlatformBadgeList');
const { ScreenHeader } = await import('@/components/ScreenHeader');
const { ScreenLoading } = await import('@/components/ScreenLoading');
const { useScrollSafeAreaStyle } = await import('@/hooks/useScrollSafeAreaStyle');
const { getPlatformAspectRatio, getPlatformShortName } = await import('@/utils/platform');
const { Gamepad2 } = await import('lucide-react-native');

const game: Game = {
  id: 'steam-10', title: 'Hades', platform: 'Steam', source_platform: 'Steam', imageUrl: 'https://example.com/hades.jpg',
  discount: '-50%', price: '50,00 TL', originalPrice: '100,00 TL', url: 'https://store.steampowered.com/app/10/',
  deals: [{ platform: 'Steam', price: '50,00 TL', originalPrice: '100,00 TL', discount: '-50%', url: 'https://store.steampowered.com/app/10/' }],
  platforms: ['Steam'], rating: null,
};

afterEach(() => { resetNativeState(); });

describe('shared game components', () => {
  test('image moves through alternate sources, then shows its initial', async () => {
    const view = await render(<CardImage
      sources={[{ uri: 'https://example.com/one.jpg' }, { uri: 'https://example.com/two.jpg' }]}
      title="Hades" aspectRatio={2} upcomingDate="Soon"
    />);
    expect(view.text()).toContain('Soon');
    expect(allOfType(view.root, 'Image')[0]?.props['source']).toEqual({ uri: 'https://example.com/one.jpg' });
    const firstImage = allOfType(view.root, 'Image')[0];
    if (!firstImage) throw new Error('first image missing');
    await fire(firstImage, 'onError');
    expect(allOfType(view.root, 'Image')[0]?.props['source']).toEqual({ uri: 'https://example.com/two.jpg' });
    const secondImage = allOfType(view.root, 'Image')[0];
    if (!secondImage) throw new Error('second image missing');
    await fire(secondImage, 'onError');
    expect(view.text()).toContain('H');
    await view.unmount();

    const empty = await render(<CardImage sources={[]} title="Zelda" aspectRatio={1} />);
    expect(empty.text()).toContain('Z');
    expect(allOfType(empty.root, 'Image')).toHaveLength(0);
    await empty.unmount();
  });

  test('cards show prices and open a detail route with a saved preview', async () => {
    const view = await render(<GameCard game={game} featuredLabel variant="strip" />);
    expect(view.text()).toContain('ÖNE ÇIKAN');
    expect(view.text()).toContain('50,00 TL');
    await fire(byLabel(view.root, 'Hades oyununa git'), 'onPress');
    expect(nativeState.router.pushed).toEqual([{ pathname: '/game/[id]', params: { id: 'steam-10', platform: 'Steam' } }]);
    const firstDeal = game.deals[0];
    if (!firstDeal) throw new Error('fixture deal missing');
    await view.update(<GameCard game={{
      ...game, platforms: ['Steam'], deals: [{ ...firstDeal }],
    }} featuredLabel variant="strip" />);
    await view.update(<GameCard game={{ ...game, price: '40,00 TL', deals: [] }} />);
    expect(view.text()).toContain('40,00 TL');
    await view.unmount();

    const featured = await render(<FeaturedDeal game={game} />);
    expect(featured.text()).toContain('ÖNE ÇIKAN');
    await featured.unmount();
    const list = await render(<GameListItem game={game} aspectRatio={1} hidePrice />);
    expect(list.text()).toContain('Steam');
    await list.unmount();
  });

  test('footer handles hidden, unavailable and discounted prices', async () => {
    const empty = await render(<CardFooter game={{ ...game, platform: '', source_platform: '', platforms: [], deals: [] }} hidePrice />);
    expect(empty.renderer.toJSON()).toBeNull();
    await empty.unmount();

    const hidden = await render(<CardFooter game={game} hidePrice />);
    expect(hidden.text()).toContain('Steam');
    expect(hidden.text()).not.toContain('50,00 TL');
    await hidden.unmount();

    const normal = await render(<CardFooter game={game} hidePrice={false} />);
    expect(normal.text()).toContain('- 50 %');
    expect(normal.text()).toContain('100,00 TL');
    await normal.unmount();

    const unavailable = await render(<CardFooter game={{ ...game, price: 'Bilinmiyor', deals: [] }} hidePrice={false} />);
    expect(unavailable.text()).toContain('Fiyat bilinmiyor');
    await unavailable.unmount();
  });

  test('search controls call their callbacks and navigation', async () => {
    const changes: string[] = [];
    let submits = 0;
    const view = await render(<GameSearchBar value="Had" onChangeText={(value) => changes.push(value)} onSubmit={() => { submits += 1; }} />);
    await fire(byLabel(view.root, 'Oyun ara'), 'onChangeText', 'Hades');
    await fire(byLabel(view.root, 'Ara'), 'onPress');
    expect(changes).toEqual(['Hades']);
    expect(submits).toBe(1);
    await view.update(<GameSearchBar value="Hades" onChangeText={() => undefined} onSubmit={() => undefined} showSubmitButton={false} noMargin />);
    expect(allOfType(view.root, 'Pressable')).toHaveLength(0);
    await view.unmount();

    const home = await render(<HomeTopBar searchQuery="" onChangeQuery={() => undefined} onSubmitSearch={() => undefined} />);
    await fire(byLabel(home.root, 'Bildirimler'), 'onPress');
    expect(nativeState.router.pushed).toContain('/notifications');
    await home.unmount();
  });

  test('headers, badges and empty states render readable labels', async () => {
    const header = await render(<ScreenHeader title="Games" subtitle="Today" align="center" trailing={<Gamepad2 />} />);
    expect(header.text()).toContain('Games Today');
    await header.update(<ScreenHeader title="Games" />);
    expect(header.text()).toBe('Games');
    await header.unmount();

    const badges = await render(<PlatformBadgeList platforms={['Epic Games', 'PlayStation']} />);
    expect(badges.text()).toContain('Epic PS');
    await badges.update(<PlatformBadgeList platforms={[]} />);
    expect(badges.renderer.toJSON()).toBeNull();
    await badges.unmount();
    const badge = await render(<PlatformBadge platform="Custom Store" />);
    expect(badge.text()).toBe('Custom Store');
    await badge.unmount();

    const empty = await render(<EmptyState icon={Gamepad2} message="No games" />);
    expect(empty.text().trim()).toBe('No games');
    await empty.unmount();
    const loading = await render(<ScreenLoading message="Loading" />);
    expect(loading.text().trim()).toBe('Loading');
    await loading.unmount();
  });

  test('background hides the splash after first layout, even if hide rejects', async () => {
    nativeState.splashShouldFail = true;
    const view = await render(<AppBackground><Gamepad2 /></AppBackground>);
    const root = allOfType(view.root, 'View')[0];
    if (!root) throw new Error('background missing');
    await fire(root, 'onLayout');
    await fire(root, 'onLayout');
    expect(nativeState.splashHidden).toBe(1);
    await view.unmount();
  });

  test('platform labels and safe area styles follow the device', async () => {
    expect(getPlatformShortName(' epic games ')).toBe('Epic');
    expect(getPlatformShortName('Unknown')).toBe('Unknown');
    expect(getPlatformAspectRatio('PlayStation')).toBe(1);
    expect(getPlatformAspectRatio()).toBe(460 / 215);

    function SafeAreaProbe() { return <ScreenHeader title={JSON.stringify(useScrollSafeAreaStyle())} />; }
    const view = await render(<SafeAreaProbe />);
    expect(view.text()).toContain('"flex":1');
    nativeState.platform = 'android';
    await view.update(<SafeAreaProbe />);
    expect(view.text()).toContain('"paddingTop":24');
    await view.unmount();
  });
});
