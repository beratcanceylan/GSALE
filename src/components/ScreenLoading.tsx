import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Palette, Spacing, Typography } from '@/constants/DesignSystem';

/** Full-screen spinner shown until a tab's first load finishes. */
export function ScreenLoading({ message }: Readonly<{ message: string }>) {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ActivityIndicator size="large" color={Palette.accent} />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
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
