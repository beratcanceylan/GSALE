import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Palette, Size, Spacing, useType } from '@/constants/DesignSystem';
import { formatMoney, useT } from '@/i18n';
import type { EditionKey } from '@/services/api';

export type EditionChoice = Readonly<{ key: EditionKey; lowest: number | null }>;

type EditionPickerProps = Readonly<{
  options: readonly EditionChoice[];
  selected: EditionKey | null;
  onSelect: (key: EditionKey) => void;
}>;

/** Editions as underlined tabs, each with its lowest price; hidden when there is only one. */
export function EditionPicker({ options, selected, onSelect }: EditionPickerProps) {
  const t = useT();
  const type = useType();
  if (options.length < 2) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} accessibilityRole="tablist">
      {options.map(({ key, lowest }) => {
        const active = key === selected;
        const name = t(`edition.${key}`);
        return (
          <Pressable
            key={key}
            onPress={() => { onSelect(key); }}
            style={styles.option}
            accessibilityRole="tab"
            accessibilityLabel={name}
            accessibilityState={{ selected: active }}
          >
            <Text style={[type('label'), active ? styles.activeText : styles.text]}>{name}</Text>
            <Text style={[type('caption'), styles.price]}>{lowest === null ? ' ' : formatMoney(lowest)}</Text>
            <View style={[styles.underline, active && styles.underlineActive]} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  option: {
    minHeight: Size.touch,
    gap: Spacing.xxs,
    paddingTop: Spacing.sm,
  },
  text: {
    color: Palette.textMuted,
  },
  activeText: {
    color: Palette.text,
  },
  price: {
    color: Palette.textMuted,
    fontVariant: ['tabular-nums'],
  },
  underline: {
    height: Spacing.xxs,
    marginTop: Spacing.xs,
    backgroundColor: 'transparent',
  },
  underlineActive: {
    backgroundColor: Palette.text,
  },
});
