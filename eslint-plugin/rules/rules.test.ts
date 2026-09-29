import { describe, expect, test } from 'bun:test';
import { Linter } from 'eslint';

import plugin from '../index';
import config from '../../eslint.config';

const linter = new Linter();

function diagnostics(source: string, rule: keyof typeof plugin.rules) {
  return linter.verify(source, [{
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    plugins: { gsale: plugin },
    rules: { [`gsale/${rule}`]: 'error' },
  }]);
}

describe('GSale ESLint rules', () => {
  test('includes the typed app rules and local plugin in the project config', () => {
    expect(config.some((entry) => entry.plugins?.['gsale'] === plugin)).toBeTrue();
  });
  test('design tokens rule reports literal typography, spacing, radius and color', () => {
    const source = `
      const styles = StyleSheet.create({
        card: {
          fontSize: 16,
          fontWeight: '500',
          padding: 12,
          borderRadius: 8,
          color: '#123456',
          backgroundColor: 'red',
        },
      });
    `;
    expect(diagnostics(source, 'enforce-design-tokens').map((item) => item.messageId)).toEqual([
      'noHardcodedTypography', 'noHardcodedTypography', 'noHardcodedSpacing',
      'noHardcodedRadius', 'noHardcodedColor', 'noHardcodedColor',
    ]);
  });

  test('design tokens rule allows tokens, calculated values and documented literals', () => {
    const source = `
      const outside = { padding: 12, color: 'red' };
      const styles = StyleSheet.create({
        card: {
          fontSize: Typography.body.fontSize,
          fontWeight: 'bold',
          lineHeight: Font.body,
          letterSpacing: 2 + 2,
          padding: Spacing.md,
          gap: 0,
          margin: 40,
          marginHorizontal: '50%',
          rowGap: 2 + 2,
          borderRadius: Radius.md,
          borderTopLeftRadius: 999,
          color: Palette.text,
          backgroundColor: 'transparent',
          borderColor: '#fff',
          tintColor: 'rgba(255, 255, 255, 0.05)',
          shadowColor: condition ? 'red' : 'blue',
          opacity: 0.5,
        },
        label: { fontWeight: 'normal', borderColor: '#000000' },
      });
      const other = make({ padding: 12, color: 'red' });
    `;
    expect(diagnostics(source, 'enforce-design-tokens')).toEqual([]);
  });

  test('design tokens rule catches unsupported values without reporting unrelated expressions', () => {
    const source = `
      const styles = StyleSheet.create({
        ['label']: {
          fontSize: 'large',
          padding: 2,
          borderRadius: 0,
          color: '',
          backgroundColor: '#eeeeee',
          borderColor: getColor(),
          margin: getSpacing(),
          lineHeight: getLineHeight(),
        },
      });
    `;
    expect(diagnostics(source, 'enforce-design-tokens').map((item) => item.messageId)).toEqual([
      'noHardcodedTypography', 'noHardcodedSpacing', 'noHardcodedRadius',
      'noHardcodedColor', 'noHardcodedColor',
    ]);
  });

  test('effects rule reports imports and direct or qualified calls', () => {
    const source = `
      import { useEffect, useLayoutEffect, useState } from 'react';
      useEffect(() => {});
      React.useLayoutEffect(() => {});
      navigation.useFocusEffect(() => {});
      useState(0);
    `;
    expect(diagnostics(source, 'no-react-effects').map((item) => item.messageId)).toEqual([
      'banned', 'banned', 'banned', 'banned', 'banned',
    ]);
  });

  test('image rule reports only react-native Image imports', () => {
    expect(diagnostics("import { Image as NativeImage, View } from 'react-native';", 'prefer-expo-image')
      .map((item) => item.messageId)).toEqual(['preferExpoImage']);
    expect(diagnostics("import { Image } from 'expo-image';", 'prefer-expo-image')).toEqual([]);
    expect(diagnostics("import { View } from 'react-native';", 'prefer-expo-image')).toEqual([]);
  });
});
