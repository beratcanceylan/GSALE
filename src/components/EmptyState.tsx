import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { Palette, Spacing, Typography } from '@/constants/DesignSystem';

type EmptyStateProps = Readonly<{
  icon: LucideIcon;
  message: string;
}>;

/** Centered icon and message for a list with nothing to show. */
export function EmptyState({ icon: Icon, message }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Icon size={48} color={Palette.textTertiary} />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl + Spacing.sm,
  },
  message: {
    color: Palette.textSecondary,
    marginTop: Spacing.sm + Spacing.xs,
    fontSize: Typography.body.fontSize,
    fontFamily: Typography.body.fontFamily,
  },
});
