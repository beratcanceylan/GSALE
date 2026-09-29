import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Palette, Spacing, useType } from '@/constants/DesignSystem';

export function ScreenLoading({ message }: Readonly<{ message: string }>) {
  const type = useType();
  return (
    <View style={styles.container}>
      <ActivityIndicator color={Palette.textMuted} />
      <Text style={[type('body'), styles.text]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    backgroundColor: Palette.background,
  },
  text: {
    color: Palette.textMuted,
  },
});
