import { describe, expect, mock, test } from 'bun:test';

import { nativeState, resetNativeState } from '../../../test-support/native-mocks';
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

function optionLabels(view: Rendered): string[] {
  return view.root
    .findAll((node) => typeof node.type === 'string' && node.props['accessibilityRole'] === 'radio')
    .map((node) => String(node.props['accessibilityLabel']));
}

describe('settings screen', () => {
  test('language and country are separate, searchable and persisted', async () => {
    resetNativeState();
    await setLanguage('tr');
    await setAppCountry('TR');
    const view = await render(<SettingsScreen />);
    expect(view.text()).toContain('Ayarlar');
    expect(view.text()).toContain('Türkçe');
    expect(view.text()).toContain('Türkiye');

    await fire(byLabel(view.root, 'Dil'), 'onPress');
    await fire(byLabel(view.root, 'Dil ara'), 'onChangeText', 'port');
    expect(optionLabels(view)).toEqual(['Português (Portugal)', 'Português (Brasil)']);
    await fire(byLabel(view.root, 'Temizle'), 'onPress');
    await fire(byLabel(view.root, 'English'), 'onPress');
    expect(saved).toContainEqual(['gsale_locale', 'en']);
    expect(allOfType(view.root, 'Modal')).toHaveLength(0);
    expect(view.text()).toContain('Settings');

    await fire(byLabel(view.root, 'Country'), 'onPress');
    await fire(byLabel(view.root, 'Germany'), 'onPress');
    expect(saved).toContainEqual(['gsale_country', 'DE']);
    expect(view.text()).toContain('Germany');

    await fire(byLabel(view.root, 'Country'), 'onPress');
    await fire(byLabel(view.root, 'Close'), 'onPress');
    expect(allOfType(view.root, 'Modal')).toHaveLength(0);

    await fire(byLabel(view.root, 'Notifications'), 'onPress');
    expect(nativeState.router.pushed).toContain('/notifications');
    await view.unmount();
    await setAppCountry('TR');
    await setLanguage('tr');
  });

  test('switching to Arabic asks for a restart', async () => {
    resetNativeState();
    await setLanguage('tr');
    const view = await render(<SettingsScreen />);
    await fire(byLabel(view.root, 'Dil'), 'onPress');
    await fire(byLabel(view.root, 'العربية'), 'onPress');
    expect(nativeState.rtl.forced).toBeTrue();
    expect(nativeState.alerts).toHaveLength(1);
    await view.unmount();
    await setLanguage('tr');
  });
});
