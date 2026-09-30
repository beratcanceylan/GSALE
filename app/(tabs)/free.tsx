import { StatusBar } from 'expo-status-bar';
import { useSyncExternalStore } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { CoverCard } from '@/components/CoverCard';
import { EmptyState } from '@/components/EmptyState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ScreenLoading } from '@/components/ScreenLoading';
import { Palette, Spacing, useType } from '@/constants/DesignSystem';
import { useScrollSafeAreaStyle } from '@/hooks/useScrollSafeAreaStyle';
import { useT } from '@/i18n';
import { freeDeal } from '@/services/deal';
import type { Game } from '@/services/gameData';
import { freeGamesStore } from '@/services/screenData';

type FreeRow = Readonly<{ key: string; title: string; games: Game[] }>;

/** Games free right now carry a free price tag; upcoming ones are shown without a price. */
function asFreeNow(game: Game): Game {
  const platform = game.source_platform || game.platform;
  return { ...game, deals: [freeDeal(platform, game.url)] };
}

function pairs(games: readonly Game[]): Game[][] {
  const rows: Game[][] = [];
  for (let index = 0; index < games.length; index += 2) rows.push(games.slice(index, index + 2));
  return rows;
}

function FreeSection({ section }: Readonly<{ section: FreeRow }>) {
  const type = useType();
  return (
    <View style={styles.section}>
      <Text style={[type('heading'), styles.sectionTitle]} accessibilityRole="header">{section.title}</Text>
      {pairs(section.games).map((row) => (
        <View key={row.map((game) => game.id).join('|')} style={styles.row}>
          {row.map((game) => <CoverCard key={game.id} game={game} />)}
          {row.length === 1 ? <View style={styles.spacer} /> : null}
        </View>
      ))}
    </View>
  );
}

const renderSection = ({ item }: { item: FreeRow }) => <FreeSection section={item} />;

function FreeGamesLoaded({ games, refreshing }: Readonly<{ games: Game[]; refreshing: boolean }>) {
  const t = useT();
  const containerStyle = useScrollSafeAreaStyle();
  const now: Game[] = [];
  const next: Game[] = [];
  for (const game of games) {
    if (game.upcoming) next.push(game);
    else now.push(asFreeNow(game));
  }
  const sections: FreeRow[] = [
    ...(now.length > 0 ? [{ key: 'now', title: t('free.title'), games: now }] : []),
    ...(next.length > 0 ? [{ key: 'next', title: t('free.upcoming'), games: next }] : []),
  ];

  return (
    <View style={[styles.container, containerStyle]}>
      <StatusBar style="light" />
      <FlatList
        data={sections}
        renderItem={renderSection}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.list}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={() => { freeGamesStore.load(true); }}
        ListHeaderComponent={<ScreenHeader title={t('tabs.free')} />}
        ListEmptyComponent={<EmptyState message={t('free.empty')} />}
      />
    </View>
  );
}

export default function FreeGamesScreen() {
  const t = useT();
  const { data: games, refreshing } = useSyncExternalStore(freeGamesStore.subscribe, freeGamesStore.getSnapshot);
  if (games === null) return <ScreenLoading message={t('free.loading')} />;
  return <FreeGamesLoaded games={games} refreshing={refreshing} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  list: {
    gap: Spacing.xxl,
    paddingBottom: Spacing.xxl,
  },
  section: {
    gap: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  sectionTitle: {
    color: Palette.text,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  spacer: {
    flex: 1,
  },
});
