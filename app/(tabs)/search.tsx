import { Gamepad2 } from 'lucide-react-native';
import { useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import {
  ActivityIndicator,
  FlatList,
  type ListRenderItem,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { GameListItem } from '@/components/GameListItem';
import { Palette, Spacing, Typography } from '@/constants/DesignSystem';
import { useScrollSafeAreaStyle } from '@/hooks/useScrollSafeAreaStyle';
import { type Game } from '@/services/gameData';
import { searchStore } from '@/services/screenData';

type SearchListHeaderProps = Readonly<{
  searchQuery: string;
  searching: boolean;
}>;

function SearchListHeader({ searchQuery, searching }: SearchListHeaderProps) {
  if (searchQuery.trim().length < 2) return null;

  return (
    <View style={styles.resultHeader}>
      <Text style={styles.resultLabel}>Arama sonuçları</Text>
      <Text style={styles.resultTitle} numberOfLines={1}>{searchQuery}</Text>
      {searching ? (
        <ActivityIndicator size="small" color={Palette.accent} style={styles.resultSpinner} />
      ) : null}
    </View>
  );
}

function parseQueryParam(value: string | string[] | undefined): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return '';
}

type SearchEmptyStateProps = Readonly<{
  searching: boolean;
  hasSearched: boolean;
}>;

function SearchEmptyState({ searching, hasSearched }: SearchEmptyStateProps) {
  if (searching) {
    return (
      <>
        <ActivityIndicator size="large" color={Palette.accent} />
        <Text style={styles.emptyText}>Aranıyor…</Text>
      </>
    );
  }

  if (hasSearched) {
    return (
      <>
        <Gamepad2 size={48} color={Palette.textTertiary} />
        <Text style={styles.emptyText}>Sonuç bulunamadı</Text>
      </>
    );
  }

  return (
    <Text style={styles.emptyText}>
      Arama yapmak için anasayfadaki arama çubuğunu kullanın.
    </Text>
  );
}

type SearchScreenBodyProps = Readonly<{
  routeQuery: string;
}>;

function SearchScreenBody({ routeQuery }: SearchScreenBodyProps) {
  const containerStyle = useScrollSafeAreaStyle();
  const { games, searchQuery, searching, hasSearched } = useSyncExternalStore(
    (onStoreChange) => searchStore.subscribeQuery(routeQuery, onStoreChange),
    searchStore.getSnapshot,
  );

  const renderGameItem: ListRenderItem<Game> = useCallback(
    (info) => <GameListItem game={info.item} hidePrice />,
    [],
  );

  const listHeader = useMemo(
    () => <SearchListHeader searchQuery={searchQuery} searching={searching} />,
    [searchQuery, searching],
  );

  return (
    <View style={[styles.container, containerStyle]}>
      <StatusBar style="light" />

      <FlatList
        data={games}
        renderItem={renderGameItem}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={listHeader}
        initialNumToRender={8}
        maxToRenderPerBatch={6}
        windowSize={5}
        removeClippedSubviews
        ListEmptyComponent={
          <View style={styles.center}>
            <SearchEmptyState searching={searching} hasSearched={hasSearched} />
          </View>
        }
      />
    </View>
  );
}

export default function SearchScreen() {
  const params = useLocalSearchParams<{ q?: string | string[] }>();
  const routeQuery = parseQueryParam(params.q);

  return <SearchScreenBody key={routeQuery} routeQuery={routeQuery} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  resultHeader: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  resultLabel: {
    color: Palette.textSecondary,
    fontSize: Typography.sectionLabel.fontSize,
    fontFamily: Typography.sectionLabel.fontFamily,
    lineHeight: Typography.sectionLabel.lineHeight,
    letterSpacing: Typography.sectionLabel.letterSpacing,
    textTransform: 'uppercase',
  },
  resultTitle: {
    color: Palette.text,
    fontSize: Typography.h2.fontSize,
    fontFamily: Typography.h2.fontFamily,
    lineHeight: Typography.h2.lineHeight,
    marginTop: Spacing.xs,
    paddingRight: Spacing.xl,
  },
  resultSpinner: {
    position: 'absolute',
    right: Spacing.md,
    bottom: Spacing.md + Spacing.xs,
  },
  listContent: {
    paddingBottom: Spacing.xl + Spacing.md,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl + Spacing.sm,
    marginTop: Spacing.xl * 2,
  },
  emptyText: {
    color: Palette.textSecondary,
    marginTop: Spacing.md,
    fontSize: Typography.body.fontSize,
    fontFamily: Typography.body.fontFamily,
    textAlign: 'center',
  },
});
