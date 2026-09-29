export const Font = {
  body: 'IBMPlexSans_400Regular',
  bodyMedium: 'IBMPlexSans_500Medium',
  bodySemiBold: 'IBMPlexSans_600SemiBold',
  bodyBold: 'IBMPlexSans_700Bold',
} as const;

export const Palette = {
  background: '#07070C',
  backgroundElevated: '#0E0E14',
  surface: '#141419',
  surfaceLight: '#1E1E26',
  surfaceHighlight: 'rgba(255,255,255,0.06)',
  border: '#2E2E38',

  text: '#F4F4F6',
  textSecondary: '#9A9AA6',
  textTertiary: '#6B6B78',

  accent: '#E8FF47',
  accentMuted: 'rgba(232,255,71,0.14)',
  accentSecondary: '#A0A5B1',

  deal: '#FF6B35',
  dealMuted: 'rgba(255,107,53,0.18)',
  success: '#3DDC97',
  error: '#FF5C7A',
  warning: '#FFB347',

  overlayLight: 'rgba(0,0,0,0.35)',
  overlayMedium: 'rgba(0,0,0,0.62)',
  overlayHeavy: 'rgba(0,0,0,0.94)',

  gamePass: '#198038',
  onGamePass: '#FFFFFF',
  onDeal: '#FFFFFF',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const Radius = {
  xs: 2,
  sm: 4,
  md: 6,
  lg: 8,
  xl: 10,
  full: 999,
};

export const Typography = {
  h1: {
    fontFamily: Font.bodyBold,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.2,
  },
  h2: {
    fontFamily: Font.bodyBold,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.1,
  },
  h3: {
    fontFamily: Font.bodySemiBold,
    fontSize: 16,
    lineHeight: 22,
  },
  body: {
    fontFamily: Font.body,
    fontSize: 14,
    lineHeight: 20,
  },
  caption: {
    fontFamily: Font.bodyMedium,
    fontSize: 12,
    lineHeight: 18,
  },
  button: {
    fontFamily: Font.bodyBold,
    fontSize: 14,
    lineHeight: 20,
  },
  price: {
    fontFamily: Font.bodyBold,
    fontSize: 15,
    lineHeight: 20,
  },
  priceHero: {
    fontFamily: Font.bodyBold,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: 0,
  },
  small: {
    fontFamily: Font.bodyBold,
    fontSize: 13,
    lineHeight: 18,
  },
  micro: {
    fontFamily: Font.bodyBold,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.6,
  },
  sectionLabel: {
    fontFamily: Font.bodySemiBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1,
  },
} as const;

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 10,
  },
};

const GENRE_PALETTE = [
  { bg: 'rgba(232,255,71,0.16)', text: '#E8FF47' },
  { bg: 'rgba(255,107,53,0.18)', text: '#FF8F6B' },
  { bg: 'rgba(61,220,151,0.16)', text: '#3DDC97' },
  { bg: 'rgba(120,140,255,0.18)', text: '#9AA8FF' },
  { bg: 'rgba(255,179,71,0.18)', text: '#FFB347' },
  { bg: 'rgba(255,92,122,0.16)', text: '#FF8FA3' },
] as const;

export function getGenreColor(genre: string): { bg: string; text: string } {
  let hash = 0;
  for (const char of genre) {
    // 32-bit wrap-around, like Java's String.hashCode.
    hash = Math.imul(Math.imul(hash, 31) + (char.codePointAt(0) ?? 0), 1);
  }
  const index = Math.abs(hash) % GENRE_PALETTE.length;
  return GENRE_PALETTE[index] ?? GENRE_PALETTE[0];
}
