import { describe, expect, test } from 'bun:test';

import '../../test-support/native-mocks';
import { allOfType, byLabel, render } from '../../test-support/render';


const { StoreLogo, StoreLogoRow } = await import('@/components/StoreLogo');

describe('StoreLogo', () => {
  test.each([['Steam'], ['Epic Games'], ['GOG'], ['PlayStation']] as const)('%s draws its mark', async (platform) => {
    const view = await render(<StoreLogo platform={platform} />);
    expect(byLabel(view.root, platform)).toBeDefined();
    expect(allOfType(view.root, 'Path')).toHaveLength(1);
    await view.unmount();
  });

  test.each([['Xbox'], ['Nintendo']] as const)('%s, without a licensed mark, shows its name', async (platform) => {
    const view = await render(<StoreLogo platform={platform} />);
    expect(allOfType(view.root, 'Path')).toHaveLength(0);
    expect(view.text()).toContain(platform);
    await view.unmount();
  });

  test('an unknown store renders nothing', async () => {
    const view = await render(<StoreLogo platform="Unknown" />);
    expect(view.renderer.toJSON()).toBeNull();
    await view.unmount();
  });

  test('a row lists stores in a fixed order and drops duplicates', async () => {
    const view = await render(<StoreLogoRow platforms={['PlayStation', 'Steam', 'Steam', 'Unknown', 'GOG']} />);
    const labels = view.root
      .findAll((node) => typeof node.type === 'string' && typeof node.props['accessibilityLabel'] === 'string')
      .map((node) => String(node.props['accessibilityLabel']));
    expect(labels).toEqual(['Steam', 'GOG', 'PlayStation']);
    await view.unmount();
  });
});
