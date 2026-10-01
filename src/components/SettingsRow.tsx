import { ChevronRight } from '@/components/Icons';
import { I18nManager, Pressable, StyleSheet, Text, View } from 'react-native';

import { Palette, Size, Spacing, useType } from '@/constants/DesignSystem';

type SettingsRowProps = Readonly<{
  label: string;
  value?: string;
  hint?: string;
  onPress?: () => void;
}>;

/** A settings line: label (and hint) at the start, current value and a chevron at the end. */
export function SettingsRow({ label, value, hint, onPress }: SettingsRowProps) {
  const type = useType();
  const content = (
    <>
      <View style={styles.text}>
        <Text style={[type('body'), styles.label]}>{label}</Text>
        {hint ? <Text style={[type('caption'), styles.muted]}>{hint}</Text> : null}
      </View>
      {value ? <Text style={[type('body'), styles.muted]} numberOfLines={1}>{value}</Text> : null}
      {onPress ? (
        <ChevronRight size={Size.iconSmall} color={Palette.textMuted} style={I18nManager.isRTL ? styles.mirrored : undefined} />
      ) : null}
    </>
  );
  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
      {...(value ? { accessibilityValue: { text: value } } : {})}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: Size.touch + Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: Size.hairline,
    borderBottomColor: Palette.line,
  },
  pressed: {
    backgroundColor: Palette.surface,
  },
  text: {
    flex: 1,
    gap: Spacing.xxs,
  },
  label: {
    color: Palette.text,
  },
  muted: {
    color: Palette.textMuted,
  },
  mirrored: {
    transform: [{ scaleX: -1 }],
  },
});
