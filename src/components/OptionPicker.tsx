import { Check } from 'lucide-react-native';
import { memo, useCallback, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SearchField } from '@/components/SearchField';
import { Palette, Size, Spacing, useType } from '@/constants/DesignSystem';
import { useT } from '@/i18n';

export type PickerOption<T extends string> = Readonly<{ value: T; label: string; detail?: string }>;

type OptionPickerProps<T extends string> = Readonly<{
  title: string;
  searchPlaceholder: string;
  options: readonly PickerOption<T>[];
  selected: T;
  onSelect: (value: T) => void;
  onClose: () => void;
}>;

type OptionRowProps = Readonly<{
  value: string;
  label: string;
  detail: string | undefined;
  active: boolean;
  onSelect: (value: string) => void;
}>;

const OptionRow = memo(function OptionRow({ value, label, detail, active, onSelect }: OptionRowProps) {
  const type = useType();
  return (
    <Pressable
      onPress={() => { onSelect(value); }}
      style={({ pressed }) => [styles.option, pressed && styles.pressed]}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: active }}
    >
      <Text style={[type('body'), styles.optionLabel]}>{label}</Text>
      {detail ? <Text style={[type('caption'), styles.detail]}>{detail}</Text> : null}
      {active ? <Check size={Size.icon} color={Palette.text} /> : <View style={styles.checkSpace} />}
    </Pressable>
  );
});

/** Full-screen, searchable single choice list. Render it only while it is open. */
export function OptionPicker<T extends string>({ title, searchPlaceholder, options, selected, onSelect, onClose }: OptionPickerProps<T>) {
  const t = useT();
  const type = useType();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const needle = query.trim().toLocaleLowerCase();
  const visible = needle
    ? options.filter((option) => `${option.label} ${option.detail ?? ''} ${option.value}`.toLocaleLowerCase().includes(needle))
    : options;

  // Option values come from `options`, so the row's string is always a T.
  const select = useCallback((value: string) => { onSelect(value as T); }, [onSelect]);
  const renderOption = useCallback(
    ({ item }: { item: PickerOption<T> }) => (
      <OptionRow value={item.value} label={item.label} detail={item.detail} active={item.value === selected} onSelect={select} />
    ),
    [selected, select],
  );

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.sheet, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <Text style={[type('title'), styles.title]} accessibilityRole="header">{title}</Text>
          <Pressable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel={t('common.close')}>
            <Text style={[type('label'), styles.title]}>{t('common.close')}</Text>
          </Pressable>
        </View>
        <View style={styles.search}>
          <SearchField value={query} onChangeText={setQuery} onSubmit={() => undefined} placeholder={searchPlaceholder} />
        </View>
        <FlatList
          data={visible}
          keyExtractor={(item) => item.value}
          keyboardShouldPersistTaps="handled"
          renderItem={renderOption}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingStart: Spacing.lg,
    paddingTop: Spacing.md,
  },
  title: {
    color: Palette.text,
  },
  close: {
    minHeight: Size.touch,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  search: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: Size.touch + Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: Size.hairline,
    borderBottomColor: Palette.line,
  },
  pressed: {
    backgroundColor: Palette.surface,
  },
  optionLabel: {
    flex: 1,
    color: Palette.text,
  },
  detail: {
    color: Palette.textMuted,
  },
  checkSpace: {
    width: Size.icon,
  },
});
