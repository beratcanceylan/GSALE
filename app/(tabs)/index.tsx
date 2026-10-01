import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { memo, useMemo, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CoverGrid } from '@/components/CoverGrid';
import { CoverImage } from '@/components/CoverImage';
import { EmptyState } from '@/components/EmptyState';
import { PriceTag } from '@/components/PriceTag';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ScreenLoading } from '@/components/ScreenLoading';
import { StoreLogoRow } from '@/components/StoreLogo';
import { Palette, Spacing, useType } from '@/constants/DesignSystem';
import { useScrollSafeAreaStyle } from '@/hooks/useScrollSafeAreaStyle';
import { useT } from '@/i18n';
import type { Game } from '@/services/gameData';
import { baseTitle } from '@/services/store/editions';
import { homeStore } from '@/services/screenData';
import { getDealPlatforms, getGameImageSources } from '@/utils/gameDisplay';
import { cheapestDeal, priceView } from '@/utils/price';

/** The most popular game, full width above the grid. */
const LeadGame = memo(function LeadGame({ game }: Readonly<{ game: Game }>) {
  const type = useType();
  const { push } = useRouter();
  const price = priceView(cheapestDeal(game.deals));
  const platform = game.source_platform || game.platform;

  return (
    <Pressable
      onPress={() => {
        push({ pathname: '/game/[id]', params: platform ? { id: game.id, platform } : { id: game.id } });
      }}
      style={({ pressed }) => [styles.lead, pressed && styles.pressed]}
      accessibilityRole="link"
      accessibilityLabel={baseTitle(game.title)}
    >
      <View>
        <CoverImage sources={getGameImageSources(game)} title={game.title} decorative />
        {price ? (
          <View style={styles.leadTag}>
            <PriceTag price={price} size="large" />
          </View>
        ) : null}
      </View>
      <Text style={[type('title'), styles.text]} numberOfLines={2}>{baseTitle(game.title)}</Text>
      <StoreLogoRow platforms={getDealPlatforms(game)} />
    </Pressable>
  );
});

function HomeScreenLoaded({ games, refreshing }: Readonly<{ games: Game[]; refreshing: boolean }>) {
  const t = useT();
  const type = useType();
  const containerStyle = useScrollSafeAreaStyle();
  const [lead, ...rest] = games;

  const header = useMemo(
    () => (
      <View style={styles.header}>
        <ScreenHeader title="GSale" />
        {lead ? <LeadGame game={lead} /> : null}
        {rest.length > 0 ? (
          <Text style={[type('heading'), styles.text, styles.sectionTitle]} accessibilityRole="header">
            {t('home.popular')}
          </Text>
        ) : null}
      </View>
    ),
    [lead, rest.length, t, type],
  );
  const empty = useMemo(() => (lead ? <View /> : <EmptyState message={t('home.empty')} />), [lead, t]);

  return (
    <View style={[styles.container, containerStyle]}>
      <StatusBar style="light" />
      <CoverGrid games={rest} header={header} empty={empty} refreshing={refreshing} onRefresh={() => { homeStore.load(true); }} />
    </View>
  );
}

export default function HomeScreen() {
  const t = useT();
  const { data: games, refreshing } = useSyncExternalStore(homeStore.subscribe, homeStore.getSnapshot);
  if (games === null) return <ScreenLoading message={t('home.loading')} />;
  return <HomeScreenLoaded games={games} refreshing={refreshing} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  header: {
    gap: Spacing.lg,
    paddingBottom: Spacing.lg,
    marginHorizontal: -Spacing.lg,
  },
  lead: {
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  pressed: {
    opacity: 0.7,
  },
  leadTag: {
    position: 'absolute',
    start: Spacing.md,
    bottom: Spacing.md,
  },
  text: {
    color: Palette.text,
  },
  sectionTitle: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
});
