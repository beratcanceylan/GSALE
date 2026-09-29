import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Palette, Radius, Size, Spacing, useType } from '@/constants/DesignSystem';

type EmptyStateProps = Readonly<{
  message: string;
  action?: Readonly<{ label: string; onPress: () => void }>;
}>;

/** What to show when a list is empty or failed, with the one action that helps. */
export function EmptyState({ message, action }: EmptyStateProps) {
  const type = useType();
  return (
    <View style={styles.container}>
      <Text style={[type('body'), styles.message]}>{message}</Text>
      {action ? (
        <Pressable
          onPress={action.onPress}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={action.label}
        >
          <Text style={[type('label'), styles.actionText]}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxl,
  },
  message: {
    color: Palette.textMuted,
    textAlign: 'center',
  },
  action: {
    minHeight: Size.touch,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    backgroundColor: Palette.surfaceRaised,
  },
  pressed: {
    opacity: 0.7,
  },
  actionText: {
    color: Palette.text,
  },
});
