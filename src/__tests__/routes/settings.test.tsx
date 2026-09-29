import { describe, expect, mock, test } from 'bun:test';

import '../../../test-support/native-mocks';
import { allOfType, byLabel, fire, render, type Rendered } from '../../../test-support/render';

const saved: [string, string][] = [];
mock.module('expo-secure-store', () => ({
  getItemAsync: () => Promise.resolve(null),
  setItemAsync: (key: string, value: string) => {
    saved.push([key, value]);
    return Promise.resolve();
  },
}));

const SettingsScreen = (await import('../../../app/(tabs)/settings')).default;
const { setAppCountry } = await import('@/services/country');
const { setLanguage } = await import('@/i18n/languageStore');

function pressableWithText(root: Rendered['root'], value: string): Rendered['root'] {
  const pressable = allOfType(root, 'Pressable').find((node) =>
    node.findAll((child) => String(child.type) === 'Text' && child.children.includes(value)).length > 0,
  );
  if (!pressable) throw new Error(`Pressable missing: ${value}`);
  return pressable;
}

describe('settings screen', () => {
  test('persists language and country selections and closes its picker', async () => {
    const view = await render(<SettingsScreen />);
    expect(view.text()).toContain('Mağaza dili');
    await fire(pressableWithText(view.root, 'Mağaza dili'), 'onPress');
    expect(view.text()).toContain('Dil Seçin');
    await fire(pressableWithText(view.root, 'English'), 'onPress');
    expect(saved.some(([key, value]) => key === 'gsale_locale' && value === 'en')).toBeTrue();
    expect(view.text()).toContain('Dil kaydedildi');

    await fire(pressableWithText(view.root, 'Mağaza ülkesi'), 'onPress');
    expect(view.text()).toContain('Ülke Seçin');
    await fire(pressableWithText(view.root, 'Almanya'), 'onPress');
    expect(saved.some(([key, value]) => key === 'gsale_country' && value === 'DE')).toBeTrue();
    expect(view.text()).toContain('Ülke kaydedildi');

    await fire(pressableWithText(view.root, 'Mağaza ülkesi'), 'onPress');
    await fire(byLabel(view.root, 'Kapat'), 'onPress');
    expect(allOfType(view.root, 'Modal')).toHaveLength(0);
    await view.unmount();
    await setAppCountry('TR');
    await setLanguage('tr');
  });
});
