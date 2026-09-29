import { Search } from 'lucide-react-native';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Palette, Radius, Spacing, Typography } from '@/constants/DesignSystem';

type GameSearchBarProps = Readonly<{
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  noMargin?: boolean;
  showSubmitButton?: boolean;
}>;

export function GameSearchBar({
  value,
  onChangeText,
  onSubmit,
  placeholder = 'Oyun ara...',
  noMargin = false,
  showSubmitButton = true,
}: GameSearchBarProps) {
  return (
    <View style={[styles.container, noMargin && styles.containerFlush]}>
      <Search size={18} color={Palette.textSecondary} />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={Palette.textTertiary}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        returnKeyType="search"
        accessibilityLabel="Oyun ara"
        accessibilityRole="search"
      />
      {showSubmitButton ? (
        <Pressable
          onPress={onSubmit}
          style={styles.submitButton}
          accessibilityLabel="Ara"
          accessibilityRole="button"
        >
          <Search size={18} color={Palette.background} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.surface,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.sm + Spacing.xs,
    paddingVertical: Spacing.sm + Radius.xs,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    gap: Spacing.sm,
  },
  containerFlush: {
    marginHorizontal: 0,
    marginBottom: 0,
  },
  input: {
    flex: 1,
    fontSize: Typography.body.fontSize,
    fontFamily: Typography.body.fontFamily,
    color: Palette.text,
    padding: 0,
  },
  submitButton: {
    backgroundColor: Palette.accent,
    padding: Spacing.sm,
    borderRadius: Radius.md,
  },
});
