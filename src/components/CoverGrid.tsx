import type { ReactElement } from 'react';
import { FlatList, StyleSheet } from 'react-native';

import { CoverCard } from '@/components/CoverCard';
import { Spacing } from '@/constants/DesignSystem';
import type { Game } from '@/services/gameData';

type CoverGridProps = Readonly<{
  games: readonly Game[];
  header?: ReactElement;
  empty: ReactElement;
  refreshing?: boolean;
  onRefresh?: () => void;
}>;

const renderCover = ({ item }: { item: Game }) => <CoverCard game={item} />;

/** Two columns of cover cards, used by search, free games and favorites. */
export function CoverGrid({ games, header, empty, refreshing, onRefresh }: CoverGridProps) {
  return (
    <FlatList
      data={games}
      renderItem={renderCover}
      keyExtractor={(item) => item.id}
      numColumns={2}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.content}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
      initialNumToRender={6}
      {...(onRefresh ? { onRefresh, refreshing: refreshing ?? false } : {})}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
    rowGap: Spacing.xl,
  },
  row: {
    gap: Spacing.md,
  },
});
