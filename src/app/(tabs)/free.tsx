import { Gift } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { GameListItem } from '@/components/GameListItem';
import { ScreenHeader } from '@/components/ScreenHeader';
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

        {games.length === 0 ? (
          <View style={styles.center}>
            <Gift size={48} color={Palette.textTertiary} />
            <Text style={styles.emptyText}>Şu anda bedava oyun yok</Text>
          </View>
        ) : null}
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
    return (
      <View style={[styles.container, styles.center]}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color={Palette.accent} />
        <Text style={styles.loadingText}>Bedava oyunlar yükleniyor…</Text>
      </View>
    );
  }

  return <FreeGamesLoadedView games={games} refreshing={refreshing} onRefresh={onRefresh} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl + Spacing.sm,
  },
  loadingText: {
    color: Palette.textSecondary,
    marginTop: Spacing.sm + Spacing.xs,
    fontSize: Typography.body.fontSize,
    fontFamily: Typography.body.fontFamily,
  },
  listContent: {
    paddingBottom: Spacing.xl + Spacing.md,
  },
  emptyText: {
    color: Palette.textSecondary,
    marginTop: Spacing.sm + Spacing.xs,
    fontSize: Typography.body.fontSize,
    fontFamily: Typography.body.fontFamily,
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
