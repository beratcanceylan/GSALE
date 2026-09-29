import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Palette, Spacing, useType } from '@/constants/DesignSystem';

/** A screen's title, left-aligned (start-aligned in RTL), with an optional trailing control. */
export function ScreenHeader({ title, trailing }: Readonly<{ title: string; trailing?: ReactNode }>) {
  const type = useType();
  return (
    <View style={styles.header}>
      <Text style={[type('display'), styles.title]} accessibilityRole="header" numberOfLines={1}>
        {title}
      </Text>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  title: {
    flex: 1,
    color: Palette.text,
  },
});
