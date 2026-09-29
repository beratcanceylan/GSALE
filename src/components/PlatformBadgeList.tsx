import { StyleSheet, View } from 'react-native';

import { PlatformBadge } from '@/components/PlatformBadge';
import { Spacing } from '@/constants/DesignSystem';

export function PlatformBadgeList({ platforms }: Readonly<{ platforms: string[] }>) {
  if (platforms.length === 0) return null;

  return (
    <View style={styles.platformIcons}>
      {platforms.map((platform) => (
        <PlatformBadge key={platform} platform={platform} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  platformIcons: {
    flexDirection: 'row',
    gap: Spacing.xs,
    alignItems: 'center',
    marginLeft: Spacing.xs,
  },
});
