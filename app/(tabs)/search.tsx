import { useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { CoverGrid } from '@/components/CoverGrid';
import { EmptyState } from '@/components/EmptyState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SearchField } from '@/components/SearchField';
import { Palette, Spacing, useType } from '@/constants/DesignSystem';
import { useScrollSafeAreaStyle } from '@/hooks/useScrollSafeAreaStyle';
import { plural, useT } from '@/i18n';
import { searchStore } from '@/services/screenData';

const MIN_QUERY_LENGTH = 2;

function parseQueryParam(value: string | string[] | undefined): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return '';
}

function SearchResults({ routeQuery }: Readonly<{ routeQuery: string }>) {
  const t = useT();
  const type = useType();
  const containerStyle = useScrollSafeAreaStyle();
  const [input, setInput] = useState(routeQuery);
  const [tooShort, setTooShort] = useState(false);
  const { games, searchQuery, searching, hasSearched } = useSyncExternalStore(
    (onStoreChange) => searchStore.subscribeQuery(routeQuery, onStoreChange),
    searchStore.getSnapshot,
  );

  const submit = () => {
    const query = input.trim();
    setTooShort(query.length < MIN_QUERY_LENGTH);
    if (query.length >= MIN_QUERY_LENGTH) searchStore.search(query);
  };

  let empty = <EmptyState message={t('search.hint')} />;
  if (searching) {
    empty = (
      <View style={styles.searching}>
        <ActivityIndicator color={Palette.textMuted} />
        <Text style={[type('body'), styles.muted]}>{t('search.loading')}</Text>
      </View>
    );
  } else if (hasSearched && !tooShort) {
    empty = <EmptyState message={t('search.empty', { query: searchQuery })} />;
  }

  const header = (
    <View style={styles.header}>
      <SearchField value={input} onChangeText={setInput} onSubmit={submit} autoFocus={routeQuery.length === 0} />
      {tooShort ? <Text style={[type('caption'), styles.muted]}>{t('search.hint')}</Text> : null}
      {games.length > 0 && !searching ? (
        <Text style={[type('caption'), styles.muted]}>{plural('search.resultCount', games.length)}</Text>
      ) : null}
    </View>
  );

  return (
    <View style={[styles.container, containerStyle]}>
      <StatusBar style="light" />
      <ScreenHeader title={t('tabs.search')} />
      <CoverGrid games={searching ? [] : games} header={header} empty={empty} />
    </View>
  );
}

export default function SearchScreen() {
  const params = useLocalSearchParams<{ q?: string | string[] }>();
  const routeQuery = parseQueryParam(params.q);
  return <SearchResults key={routeQuery} routeQuery={routeQuery} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  header: {
    gap: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  searching: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xxl,
  },
  muted: {
    color: Palette.textMuted,
  },
});
