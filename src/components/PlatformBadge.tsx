import { StyleSheet, Text, View } from 'react-native';

import { Palette, Radius, Spacing, Typography } from '@/constants/DesignSystem';
import { getPlatformShortName } from '@/utils/platform';

/** Store name as plain text; official store logos are not used in the app. */
export function PlatformBadge({ platform }: Readonly<{ platform: string }>) {
  return (
    <View style={styles.badge} accessible accessibilityLabel={`${platform} platformu`}>
      <Text style={styles.text} numberOfLines={1}>
        {getPlatformShortName(platform)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.xs / 2,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surfaceLight,
  },
  text: {
    color: Palette.textSecondary,
    fontSize: Typography.micro.fontSize,
    fontFamily: Typography.button.fontFamily,
    lineHeight: Typography.micro.lineHeight,
  },
});
