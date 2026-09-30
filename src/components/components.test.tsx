import { afterEach, describe, expect, test } from 'bun:test';

import { nativeState, resetNativeState } from '../../test-support/native-mocks';
import { allOfType, byLabel, fire, render, updateExternalStore } from '../../test-support/render';
import { uiDeal } from '../../test-support/deals';
import type { Game } from '@/services/gameData';


const { AppBackground } = await import('@/components/AppBackground');
const { markStartupReady } = await import('@/services/startup');
const { CoverCard } = await import('@/components/CoverCard');
const { CoverImage } = await import('@/components/CoverImage');
const { EmptyState } = await import('@/components/EmptyState');
const { ScreenHeader } = await import('@/components/ScreenHeader');
const { ScreenLoading } = await import('@/components/ScreenLoading');
const { SearchField } = await import('@/components/SearchField');
const { useScrollSafeAreaStyle } = await import('@/hooks/useScrollSafeAreaStyle');
const { formatMoney, formatPercent } = await import('@/i18n');
const { setLanguage } = await import('@/i18n/languageStore');

const game: Game = {
  id: '10', title: 'Hades', platform: 'Steam', source_platform: 'Steam', imageUrl: 'https://example.com/hades.jpg',
  discount: '-50%', price: '50,00 TL', originalPrice: '100,00 TL', url: 'https://store.steampowered.com/app/10/',
  deals: [uiDeal({ platform: 'Steam', price: '50,00 TL', originalPrice: '100,00 TL', discount: '-50%', url: 'https://store.steampowered.com/app/10/' })],
  platforms: ['Steam', 'GOG'], rating: null,
};

afterEach(async () => {
  resetNativeState();
  await setLanguage('tr');
});

describe('CoverCard', () => {
  test('shows the discount, both prices and store marks, and opens the detail', async () => {
    const view = await render(<CoverCard game={game} />);
    expect(view.text()).toContain(formatPercent(-50));
    expect(view.text()).toContain(formatMoney(50));
    expect(view.text()).toContain(formatMoney(100));
    expect(byLabel(view.root, 'Steam')).toBeDefined();
    expect(byLabel(view.root, 'GOG')).toBeDefined();
    await fire(byLabel(view.root, 'Hades'), 'onPress');
    expect(nativeState.router.pushed).toContainEqual({ pathname: '/game/[id]', params: { id: '10', platform: 'Steam' } });
    await view.unmount();
  });

  test('a third-party giveaway opens its HTTPS link instead of a detail screen', async () => {
    const giveaway = { ...game, id: 'gamerpower-1', externalUrl: 'https://www.gamerpower.com/open/1', platforms: ['IndieGala'] };
    const view = await render(<CoverCard game={giveaway} />);
    expect(view.text()).toContain('IndieGala');
    await fire(byLabel(view.root, 'Hades'), 'onPress');
    expect(nativeState.openedUrls).toContain('https://www.gamerpower.com/open/1');
    expect(nativeState.router.pushed).toHaveLength(0);
    await view.unmount();
  });

  test('a game without a price shows no price tag but keeps the store marks', async () => {
    const view = await render(<CoverCard game={{ ...game, price: '', discount: '', originalPrice: undefined, deals: [] }} />);
    expect(view.text()).not.toContain(formatMoney(50));
    expect(byLabel(view.root, 'Steam')).toBeDefined();
    await view.unmount();
  });

  test('a free game says free in the app language', async () => {
    await setLanguage('en');
    const view = await render(<CoverCard game={{ ...game, deals: [uiDeal({ platform: 'Steam', price: 'Ücretsiz' })] }} />);
    expect(view.text()).toContain('Free');
    await view.unmount();
  });

  test('Arabic drops the Latin font family', async () => {
    await setLanguage('ar');
    const view = await render(<CoverCard game={game} />);
    const title = view.root.findAll((node) => String(node.type) === 'Text' && node.children.includes('Hades'))[0];
    const styles = [title?.props['style']].flat(3).filter(Boolean) as { fontFamily?: string }[];
    expect(styles.some((style) => style.fontFamily)).toBeFalse();
    await view.unmount();
  });
});

describe('CoverImage', () => {
  test('falls back through its sources, then to the title initial', async () => {
    const view = await render(<CoverImage sources={[{ uri: 'https://a/1.jpg' }, { uri: 'https://a/2.jpg' }]} title="Hades" />);
    const image = () => allOfType(view.root, 'Image')[0];
    await fire(image() ?? view.root, 'onError');
    expect(image()?.props['source']).toEqual({ uri: 'https://a/2.jpg' });
    await fire(image() ?? view.root, 'onError');
    expect(image()).toBeUndefined();
    expect(view.text()).toContain('H');
    await view.unmount();
  });
});

describe('CoverImage fit', () => {
  const frameOf = (view: Awaited<ReturnType<typeof render>>) => allOfType(view.root, 'View')[0];
  const flatten = (style: unknown) => Object.assign({}, ...[style].flat(3).filter(Boolean)) as Record<string, unknown>;

  test('the whole image is shown inside a card frame', async () => {
    const view = await render(<CoverImage sources={[{ uri: 'https://a/square.jpg' }]} title="Hades" />);
    expect(allOfType(view.root, 'Image')[0]?.props['contentFit']).toBe('contain');
    await view.unmount();
  });

  test('natural fit sizes the frame to the loaded image, so nothing is cut', async () => {
    const view = await render(<CoverImage sources={[{ uri: 'https://a/square.jpg' }]} title="Hades" fit="natural" />);
    const image = allOfType(view.root, 'Image')[0];
    if (!image) throw new Error('image missing');
    await fire(image, 'onLoad', { source: { width: 600, height: 600 } });
    expect(flatten(frameOf(view)?.props['style'])['aspectRatio']).toBe(1);
    await fire(image, 'onLoad', { source: { width: 460, height: 215 } });
    expect(flatten(frameOf(view)?.props['style'])['aspectRatio']).toBeGreaterThan(2);
    await view.unmount();
  });
});

describe('SearchField', () => {
  test('clears its text and submits', async () => {
    const changes: string[] = [];
    let submitted = 0;
    const view = await render(<SearchField value="hades" onChangeText={(text) => { changes.push(text); }} onSubmit={() => { submitted += 1; }} />);
    await fire(byLabel(view.root, 'Temizle'), 'onPress');
    expect(changes).toEqual(['']);
    await fire(allOfType(view.root, 'TextInput')[0] ?? view.root, 'onSubmitEditing');
    expect(submitted).toBe(1);
    await view.update(<SearchField value="" onChangeText={() => undefined} onSubmit={() => undefined} />);
    expect(view.root.findAll((node) => node.props['accessibilityLabel'] === 'Temizle')).toHaveLength(0);
    await view.unmount();
  });
});

describe('screen chrome', () => {
  test('header, empty state with action and loading render their text', async () => {
    const header = await render(<ScreenHeader title="Oyunlar" />);
    expect(header.text()).toBe('Oyunlar');
    await header.unmount();

    let retried = 0;
    const empty = await render(<EmptyState message="Hiç oyun yok" action={{ label: 'Tekrar dene', onPress: () => { retried += 1; } }} />);
    expect(empty.text()).toContain('Hiç oyun yok');
    await fire(byLabel(empty.root, 'Tekrar dene'), 'onPress');
    expect(retried).toBe(1);
    await empty.unmount();

    const loading = await render(<ScreenLoading message="Yükleniyor" />);
    expect(loading.text().trim()).toBe('Yükleniyor');
    await loading.unmount();
  });

  test('the app waits for language and country before showing content, then hides the splash', async () => {
    nativeState.splashShouldFail = true;
    const view = await render(<AppBackground><ScreenHeader title="content" /></AppBackground>);
    expect(view.text()).not.toContain('content');
    await updateExternalStore(() => { markStartupReady(); });
    expect(view.text()).toContain('content');
    const content = allOfType(view.root, 'View')[1];
    if (!content) throw new Error('content view missing');
    await fire(content, 'onLayout');
    await fire(content, 'onLayout');
    expect(nativeState.splashHidden).toBe(1);
    await view.unmount();
  });

  test('safe area styles follow the device', async () => {
    function SafeAreaProbe() { return <ScreenHeader title={JSON.stringify(useScrollSafeAreaStyle())} />; }
    const view = await render(<SafeAreaProbe />);
    expect(view.text()).toContain('"flex":1');
    nativeState.platform = 'android';
    await view.update(<SafeAreaProbe />);
    expect(view.text()).toContain('"paddingTop":24');
    await view.unmount();
  });
});
