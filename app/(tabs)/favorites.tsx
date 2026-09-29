import React, { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Search, XCircle, Heart } from 'lucide-react-native';

import { GameListItem } from '@/components/GameListItem';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Palette, Radius, Spacing, Typography } from '@/constants/DesignSystem';
import { useScrollSafeAreaStyle } from '@/hooks/useScrollSafeAreaStyle';
import { type Game } from '@/services/gameData';
import { favoritesStore } from '@/services/screenData';

type FavoritesListHeaderProps = Readonly<{
  searchQuery: string;
  onChangeQuery: (query: string) => void;
  onClearQuery: () => void;
}>;

function FavoritesListHeader({ searchQuery, onChangeQuery, onClearQuery }: FavoritesListHeaderProps) {
  return (
    <>
      <ScreenHeader title="Favoriler" align="center" subtitle="Kaydettiğin oyunlar" />
      <View style={styles.searchContainer}>
        <Search size={18} color={Palette.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Favorilerde ara..."
          placeholderTextColor={Palette.textTertiary}
          value={searchQuery}
          onChangeText={onChangeQuery}
          returnKeyType="search"
          accessibilityLabel="Favorilerde ara"
          accessibilityRole="search"
        />
        {searchQuery.length > 0 ? (
          <Pressable
            onPress={onClearQuery}
            accessibilityLabel="Aramayı temizle"
            accessibilityRole="button"
          >
            <XCircle size={18} color={Palette.textSecondary} />
          </Pressable>
        ) : null}
      </View>
    </>
  );
}

export default function FavoritesScreen() {
  const containerStyle = useScrollSafeAreaStyle();
  const { data: favorites } = useSyncExternalStore(
    favoritesStore.subscribe,
    favoritesStore.getSnapshot,
  );
  const [searchQuery, setSearchQuery] = useState('');

  const filteredFavorites = React.useMemo(() => {
    if (!searchQuery.trim()) return favorites;
    const q = searchQuery.toLowerCase();
    return favorites.filter((f) => f.title.toLowerCase().includes(q));
  }, [favorites, searchQuery]);

  const games: Game[] = filteredFavorites.map((f) => ({
    id: f.game_id,
    title: f.title,
    imageUrl: f.image_url || '',
    platform: f.platform || '',
    price: f.price || '',
    originalPrice: f.original_price || undefined,
    discount: f.discount || '',
    url: '',
    deals: [],
  }));

  const renderGameItem = useCallback(
    ({ item }: { item: Game }) => <GameListItem game={item} />,
    [],
  );

  const listHeader = useMemo(
    () => (
      <FavoritesListHeader
        searchQuery={searchQuery}
        onChangeQuery={setSearchQuery}
        onClearQuery={() => {
          setSearchQuery('');
        }}
      />
    ),
    [searchQuery],
  );

  return (
    <View style={[styles.container, containerStyle]}>
      <FlatList
        data={games}
        renderItem={renderGameItem}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        contentInsetAdjustmentBehavior="automatic"
        initialNumToRender={8}
        maxToRenderPerBatch={6}
        windowSize={5}
        removeClippedSubviews
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <View style={styles.center}>
            <Heart size={48} color={Palette.textTertiary} />
            <Text style={styles.emptyTitle}>
              {searchQuery.trim() ? 'Sonuç bulunamadı' : 'Favoriler boş'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery.trim()
                ? 'Başka bir arama deneyin'
                : 'Oyun detayından kalp ikonuna basarak ekleyebilirsin'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  searchContainer: {
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
  searchInput: {
    flex: 1,
    fontSize: Typography.body.fontSize,
    fontFamily: Typography.body.fontFamily,
    color: Palette.text,
    padding: 0,
  },
  listContent: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl + Spacing.md,
    flexGrow: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl + Spacing.sm,
    marginTop: Spacing.xl * 3,
  },
  emptyTitle: {
    fontSize: Typography.h2.fontSize,
    fontFamily: Typography.h2.fontFamily,
    color: Palette.text,
    marginTop: Spacing.md,
  },
  emptySubtitle: {
    fontSize: Typography.body.fontSize,
    fontFamily: Typography.body.fontFamily,
    color: Palette.textSecondary,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
});
