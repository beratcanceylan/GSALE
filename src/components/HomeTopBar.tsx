import { Bell } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { GameSearchBar } from '@/components/GameSearchBar';
import { Palette, Radius, Spacing } from '@/constants/DesignSystem';

type HomeTopBarProps = Readonly<{
  searchQuery: string;
  onChangeQuery: (text: string) => void;
  onSubmitSearch: () => void;
}>;

export function HomeTopBar({ searchQuery, onChangeQuery, onSubmitSearch }: HomeTopBarProps) {
  const { push } = useRouter();

  return (
    <View style={styles.row}>
      <View style={styles.searchWrap}>
        <GameSearchBar
          noMargin
          value={searchQuery}
          onChangeText={onChangeQuery}
          onSubmit={onSubmitSearch}
        />
      </View>
      <Pressable
        onPress={() => {
          push('/notifications');
        }}
        style={styles.iconButton}
        accessibilityLabel="Bildirimler"
        accessibilityRole="button"
      >
        <Bell size={22} color={Palette.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  searchWrap: {
    flex: 1,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
