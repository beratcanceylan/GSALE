import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { ADDITIONAL_STORE_MARKS, STORE_LOGO_PATHS } from '@/components/store-logo-paths';
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
  const mark = ADDITIONAL_STORE_MARKS[platform];
  const path = mark?.path ?? STORE_LOGO_PATHS[platform];
  if (path) {
    return (
      <Svg width={size} height={size} viewBox={mark?.viewBox ?? "0 0 24 24"} accessible accessibilityLabel={platform}>
        <Path d={path} fill={color} transform={mark?.transform} />
      </Svg>
    );
  }
  // Unknown giveaway stores use their name.
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
  const present = new Set(platforms.flatMap((platform) => {
    const name = platform.trim();
    return name ? [name] : [];
  }));
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
    flexWrap: 'wrap',
    flexShrink: 1,
    gap: Spacing.sm,
  },
  name: {
    includeFontPadding: false,
  },
});
