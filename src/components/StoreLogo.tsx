import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { STORE_LOGO_PATHS } from '@/components/store-logo-paths';
import { Palette, Size, Spacing, useType } from '@/constants/DesignSystem';

/** Display order everywhere stores are listed together. */
const STORE_ORDER = ['Steam', 'Epic Games', 'GOG', 'Xbox', 'PlayStation', 'Nintendo'] as const;

type StoreLogoProps = Readonly<{
  platform: string;
  size?: number;
  color?: string;
}>;

/** A store's mark, or its name where no licensed mark exists. */
export function StoreLogo({ platform, size = Size.logo, color = Palette.textMuted }: StoreLogoProps) {
  const type = useType();
  const path = STORE_LOGO_PATHS[platform];
  if (path) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" accessible accessibilityLabel={platform}>
        <Path d={path} fill={color} />
      </Svg>
    );
  }
  // No licensed mark (Xbox, Nintendo, itch.io, IndieGala…): the store's name stands in.
  if (!platform.trim()) return null;
  return (
    <Text
      style={[type('label'), styles.name, { color, lineHeight: size }]}
      accessibilityLabel={platform}
      numberOfLines={1}
    >
      {platform}
    </Text>
  );
}

/** Stores in a fixed order (known stores first), each once. */
export function StoreLogoRow({ platforms, size, color }: Readonly<{ platforms: readonly string[]; size?: number; color?: string }>) {
  const present = new Set(platforms.map((platform) => platform.trim()).filter(Boolean));
  const known: readonly string[] = STORE_ORDER;
  const stores = [...STORE_ORDER.filter((store) => present.has(store)), ...[...present].filter((store) => !known.includes(store))];
  if (stores.length === 0) return null;
  return (
    <View style={styles.row}>
      {stores.map((store) => (
        <StoreLogo
          key={store}
          platform={store}
          {...(size === undefined ? {} : { size })}
          {...(color === undefined ? {} : { color })}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  name: {
    includeFontPadding: false,
  },
});
