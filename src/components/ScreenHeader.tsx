import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Palette, Spacing, Typography } from '@/constants/DesignSystem';

type ScreenHeaderProps = Readonly<{
  title: string;
  align?: 'left' | 'center';
  trailing?: ReactNode;
  subtitle?: string;
}>;

export function ScreenHeader({ title, align = 'left', trailing, subtitle }: ScreenHeaderProps) {
  return (
    <View style={[styles.header, align === 'center' && styles.headerCenter]}>
      <View style={styles.titleBlock}>
        <Text style={[styles.title, align === 'center' && styles.titleCenter]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, align === 'center' && styles.subtitleCenter]}>{subtitle}</Text>
        ) : null}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  headerCenter: {
    justifyContent: 'center',
  },
  titleBlock: {
    flex: 1,
    gap: Spacing.xs,
  },
  title: {
    fontSize: Typography.h1.fontSize,
    fontFamily: Typography.h1.fontFamily,
    color: Palette.text,
    letterSpacing: Typography.h1.letterSpacing,
  },
  titleCenter: {
    textAlign: 'center',
  },
  subtitle: {
    fontSize: Typography.caption.fontSize,
    fontFamily: Typography.caption.fontFamily,
    color: Palette.textSecondary,
  },
  subtitleCenter: {
    textAlign: 'center',
  },
  trailing: {
    marginLeft: Spacing.sm,
  },
});
