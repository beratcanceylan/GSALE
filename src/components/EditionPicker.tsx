import { memo, useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Palette, Size, Spacing, useType } from '@/constants/DesignSystem';
import { formatMoney, useT } from '@/i18n';
import type { EditionKey } from '@/services/api';

export type EditionChoice = Readonly<{ key: EditionKey; lowest: number | null }>;

type EditionPickerProps = Readonly<{
  options: readonly EditionChoice[];
  selected: EditionKey | null;
  onSelect: (key: EditionKey) => void;
}>;

type EditionTabProps = Readonly<{ choice: EditionChoice; active: boolean; onSelect: (key: EditionKey) => void }>;

const EditionTab = memo(function EditionTab({ choice, active, onSelect }: EditionTabProps) {
  const t = useT();
  const type = useType();
  const name = t(`edition.${choice.key}`);
  return (
    <Pressable
      onPress={() => { onSelect(choice.key); }}
      style={styles.option}
      accessibilityRole="tab"
      accessibilityLabel={name}
      accessibilityState={{ selected: active }}
    >
      <Text style={[type('label'), active ? styles.activeText : styles.text]}>{name}</Text>
      <Text style={[type('caption'), styles.price]}>{choice.lowest === null ? ' ' : formatMoney(choice.lowest)}</Text>
      <View style={[styles.underline, active && styles.underlineActive]} />
    </Pressable>
  );
});

/** Editions as underlined tabs, each with its lowest price; hidden when there is only one. */
export function EditionPicker({ options, selected, onSelect }: EditionPickerProps) {
  const renderTab = useCallback(
    ({ item }: { item: EditionChoice }) => <EditionTab choice={item} active={item.key === selected} onSelect={onSelect} />,
    [selected, onSelect],
  );
  if (options.length < 2) return null;
  return (
    <FlatList
      horizontal
      data={options}
      keyExtractor={(item) => item.key}
      renderItem={renderTab}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityRole="tablist"
    />
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
