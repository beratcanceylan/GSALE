import { describe, expect, mock, test } from 'bun:test';

import '../../test-support/native-mocks';

mock.module('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => undefined,
}));

const { Font, Palette, typeFor } = await import('@/constants/DesignSystem');

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
  const [r = 0, g = 0, b = 0] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

describe('design tokens', () => {
  test('text colours meet WCAG AA on the background and surfaces', () => {
    for (const ground of [Palette.background, Palette.surface]) {
      expect(contrast(Palette.text, ground)).toBeGreaterThanOrEqual(7);
      expect(contrast(Palette.textMuted, ground)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(Palette.sale, ground)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(Palette.onTag, Palette.tag)).toBeGreaterThanOrEqual(7);
  });

  test('the old neon accent and near-black ground are gone', () => {
    const colours = Object.values(Palette).map((value) => value.toUpperCase());
    expect(colours).not.toContain('#E8FF47');
    expect(colours).not.toContain('#07070C');
  });

  test('scripts IBM Plex Sans lacks fall back to the platform font', () => {
    expect(typeFor('title', true).fontFamily).toBeUndefined();
    expect(typeFor('title', false).fontFamily).toBe(Font.semibold);
    expect(typeFor('price', false).fontVariant).toEqual(['tabular-nums']);
  });
});
