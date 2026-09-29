import { Search, X } from 'lucide-react-native';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Palette, Radius, Size, Spacing, useType } from '@/constants/DesignSystem';
import { useT } from '@/i18n';

type SearchFieldProps = Readonly<{
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}>;

export function SearchField({ value, onChangeText, onSubmit, placeholder, autoFocus = false }: SearchFieldProps) {
  const t = useT();
  const type = useType();
  return (
    <View style={styles.field}>
      <Search size={Size.iconSmall} color={Palette.textMuted} />
      <TextInput
        style={[type('body'), styles.input]}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder={placeholder ?? t('search.placeholder')}
        placeholderTextColor={Palette.textFaint}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        autoFocus={autoFocus}
        accessibilityLabel={placeholder ?? t('search.placeholder')}
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => { onChangeText(''); }}
          style={styles.clear}
          accessibilityRole="button"
          accessibilityLabel={t('common.clear')}
        >
          <X size={Size.iconSmall} color={Palette.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    height: Size.touch,
    paddingStart: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Palette.surfaceRaised,
  },
  input: {
    flex: 1,
    color: Palette.text,
    textAlign: 'auto',
  },
  clear: {
    width: Size.touch,
    height: Size.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
