import { useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
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
  // null until the user types: the field shows the route query until then.
  const [edited, setEdited] = useState<string | null>(null);
  const input = edited ?? routeQuery;
  const [tooShort, setTooShort] = useState(false);
  const { games, searchQuery, searching, hasSearched } = useSyncExternalStore(
    (onStoreChange) => searchStore.subscribeQuery(routeQuery, onStoreChange),
    searchStore.getSnapshot,
  );

  const submit = useCallback(() => {
    const query = input.trim();
    setTooShort(query.length < MIN_QUERY_LENGTH);
    if (query.length >= MIN_QUERY_LENGTH) searchStore.search(query);
  }, [input]);

  const empty = useMemo(() => {
    if (searching) {
      return (
        <View style={styles.searching}>
          <ActivityIndicator color={Palette.textMuted} />
          <Text style={[type('body'), styles.muted]}>{t('search.loading')}</Text>
        </View>
      );
    }
    if (hasSearched && !tooShort) return <EmptyState message={t('search.empty', { query: searchQuery })} />;
    return <EmptyState message={t('search.hint')} />;
  }, [searching, hasSearched, tooShort, searchQuery, type, t]);

  const resultCount = games.length > 0 && !searching ? plural('search.resultCount', games.length) : null;
  const header = useMemo(
    () => (
      <View style={styles.header}>
        <SearchField value={input} onChangeText={setEdited} onSubmit={submit} autoFocus={routeQuery.length === 0} />
        {tooShort ? <Text style={[type('caption'), styles.muted]}>{t('search.hint')}</Text> : null}
        {resultCount ? <Text style={[type('caption'), styles.muted]}>{resultCount}</Text> : null}
      </View>
    ),
    [input, submit, routeQuery, tooShort, type, t, resultCount],
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
