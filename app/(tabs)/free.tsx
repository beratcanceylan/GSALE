import { Gift } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { GameListItem } from '@/components/GameListItem';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ScreenLoading } from '@/components/ScreenLoading';
import { Palette, Spacing, Typography } from '@/constants/DesignSystem';
import { useScrollSafeAreaStyle } from '@/hooks/useScrollSafeAreaStyle';
import { type Game } from '@/services/gameData';
import { freeGamesStore } from '@/services/screenData';

type FreeGamesLoadedViewProps = Readonly<{
  games: Game[];
  refreshing: boolean;
  onRefresh: () => void;
}>;

function FreeGamesLoadedView({ games, refreshing, onRefresh }: FreeGamesLoadedViewProps) {
  const containerStyle = useScrollSafeAreaStyle();
  const refreshControl = useMemo(
    () => (
      <RefreshControl
        refreshing={refreshing}
        onRefresh={onRefresh}
        tintColor={Palette.accent}
        colors={[Palette.accent]}
      />
    ),
    [onRefresh, refreshing],
  );

  const activeGames = games.filter((g) => !g.upcoming);
  const upcomingGames = games.filter((g) => g.upcoming);

  return (
    <View style={[styles.container, containerStyle]}>
      <StatusBar style="light" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={refreshControl}
      >
        <ScreenHeader title="Bedava Oyunlar" align="center" subtitle="Mağaza kampanyaları" />
        {activeGames.length > 0 ? (
          <View>
            <Text style={styles.sectionTitle}>Şu anda bedava</Text>
            {activeGames.map((game) => (
              <GameListItem key={game.id} game={game} hidePrice />
            ))}
          </View>
        ) : null}

        {upcomingGames.length > 0 ? (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Gelecek hafta</Text>
            {upcomingGames.map((game) => (
              <GameListItem key={game.id} game={game} hidePrice />
            ))}
          </View>
        ) : null}

        {games.length === 0 ? <EmptyState icon={Gift} message="Şu anda bedava oyun yok" /> : null}
      </ScrollView>
    </View>
  );
}

export default function FreeGamesScreen() {
  const { data: games, refreshing } = useSyncExternalStore(
    freeGamesStore.subscribe,
    freeGamesStore.getSnapshot,
  );

  const onRefresh = useCallback(() => {
    freeGamesStore.load(true);
  }, []);

  if (games === null) {
    return <ScreenLoading message="Bedava oyunlar yükleniyor…" />;
  }

  return <FreeGamesLoadedView games={games} refreshing={refreshing} onRefresh={onRefresh} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  listContent: {
    paddingBottom: Spacing.xl + Spacing.md,
  },
  sectionContainer: {
    marginTop: Spacing.lg,
  },
  sectionTitle: {
    fontSize: Typography.sectionLabel.fontSize,
    fontFamily: Typography.sectionLabel.fontFamily,
    lineHeight: Typography.sectionLabel.lineHeight,
    letterSpacing: Typography.sectionLabel.letterSpacing,
    color: Palette.textSecondary,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
  },
});
