import { useSyncExternalStore } from 'react';
import type { TextStyle } from 'react-native';

import { usesSystemFont } from '@/i18n/languages';
import { languageStore } from '@/i18n/languageStore';

/**
 * GSale design tokens. Cover art carries the colour; the interface stays a quiet
 * slate so covers read first. The one loud element is the paper price tag.
 */
export const Palette = {
  /** Slate ground behind the covers. */
  background: '#1A1C22',
  /** Image placeholders, pressed rows, skeletons. */
  surface: '#23262E',
  /** Inputs and chips. */
  surfaceRaised: '#2C3038',
  line: '#353944',

  text: '#ECEAE4',
  textMuted: '#A9A7AE',
  textFaint: '#6F6D75',

  /** Paper shelf tag that carries a price. */
  tag: '#F2E6C9',
  onTag: '#1A1C22',
  /** Discounts and the lowest price. */
  sale: '#7BD88F',
  onSale: '#10301A',
  danger: '#F07178',

  /** Behind icons that sit on top of cover art. */
  scrim: 'rgba(26,28,34,0.78)',
} as const;

export const Spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const Radius = {
  none: 0,
  sm: 2,
  md: 4,
  full: 999,
} as const;

export const Size = {
  touch: 44,
  icon: 20,
  iconSmall: 16,
  logo: 16,
  logoLarge: 20,
  tabBar: 56,
  stripCard: 264,
  hairline: 1,
  skeletonLine: 14,
} as const;

export const Aspect = {
  cover: 16 / 9,
} as const;

export const Font = {
  regular: 'IBMPlexSans_400Regular',
  medium: 'IBMPlexSans_500Medium',
  semibold: 'IBMPlexSans_600SemiBold',
  bold: 'IBMPlexSans_700Bold',
} as const;

type TypeToken = Readonly<Pick<TextStyle, 'fontFamily' | 'fontSize' | 'lineHeight' | 'letterSpacing' | 'fontVariant'>>;

export const Typography = {
  display: { fontFamily: Font.bold, fontSize: 28, lineHeight: 34, letterSpacing: -0.4 },
  title: { fontFamily: Font.semibold, fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
  heading: { fontFamily: Font.semibold, fontSize: 15, lineHeight: 20 },
  body: { fontFamily: Font.regular, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: Font.medium, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: Font.regular, fontSize: 12, lineHeight: 16 },
  price: { fontFamily: Font.semibold, fontSize: 15, lineHeight: 20, fontVariant: ['tabular-nums'] },
  priceLarge: { fontFamily: Font.bold, fontSize: 22, lineHeight: 26, fontVariant: ['tabular-nums'] },
} as const satisfies Record<string, TypeToken>;

export type TypeName = keyof typeof Typography;

/** A type token, without the custom family for scripts IBM Plex Sans does not cover. */
export function typeFor(name: TypeName, systemFont: boolean): TypeToken {
  const token: TypeToken = Typography[name];
  if (!systemFont) return token;
  const { fontFamily: _family, ...rest } = token;
  return rest;
}

const typeWithPlex = (name: TypeName) => typeFor(name, false);
const typeWithSystemFont = (name: TypeName) => typeFor(name, true);

/** `typeFor` bound to the app language; stable per font, re-renders when the language changes. */
export function useType(): (name: TypeName) => TypeToken {
  const language = useSyncExternalStore(languageStore.subscribe, languageStore.getSnapshot);
  return usesSystemFont(language) ? typeWithSystemFont : typeWithPlex;
}
