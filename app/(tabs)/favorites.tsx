import { StatusBar } from 'expo-status-bar';
import { useMemo, useState, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';

import { CoverGrid } from '@/components/CoverGrid';
import { EmptyState } from '@/components/EmptyState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SearchField } from '@/components/SearchField';
import { Palette, Spacing } from '@/constants/DesignSystem';
import { useScrollSafeAreaStyle } from '@/hooks/useScrollSafeAreaStyle';
import { useT } from '@/i18n';
import { mapDeal } from '@/services/deal';
import type { FavoriteGame } from '@/services/favorites';
import type { Game } from '@/services/gameData';
import { favoritesStore } from '@/services/screenData';

/** A saved favorite as a card; its last known price becomes the tag. */
function favoriteToGame(favorite: FavoriteGame): Game {
  const platform = favorite.platform || '';
  const deals = favorite.price
    ? [mapDeal({ platform, price: favorite.price, discount: favorite.discount || '', ...(favorite.original_price ? { original_price: favorite.original_price } : {}) })]
    : [];
  return {
    id: favorite.game_id,
    title: favorite.title,
    imageUrl: favorite.image_url || '',
    platform,
    price: favorite.price || '',
    discount: favorite.discount || '',
    url: '',
    deals,
    ...(platform ? { platforms: [platform] } : {}),
  };
}

export default function FavoritesScreen() {
  const t = useT();
  const containerStyle = useScrollSafeAreaStyle();
  const { data: favorites } = useSyncExternalStore(favoritesStore.subscribe, favoritesStore.getSnapshot);
  const [query, setQuery] = useState('');

  const games = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const matching = needle ? favorites.filter((favorite) => favorite.title.toLocaleLowerCase().includes(needle)) : favorites;
    return matching.map(favoriteToGame);
  }, [favorites, query]);

  const empty = query.trim()
    ? <EmptyState message={t('favorites.noMatch', { query: query.trim() })} />
    : <EmptyState message={t('favorites.empty')} />;

  return (
    <View style={[styles.container, containerStyle]}>
      <StatusBar style="light" />
      <ScreenHeader title={t('favorites.title')} />
      <CoverGrid
        games={games}
        header={
          <View style={styles.header}>
            {favorites.length > 0 ? (
              <SearchField value={query} onChangeText={setQuery} onSubmit={() => undefined} placeholder={t('favorites.search')} />
            ) : null}
          </View>
        }
        empty={empty}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  header: {
    paddingBottom: Spacing.lg,
  },
});
