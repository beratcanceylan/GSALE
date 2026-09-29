import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { memo, useMemo, useSyncExternalStore } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { CoverImage } from '@/components/CoverImage';
import { EmptyState } from '@/components/EmptyState';
import { PriceTag } from '@/components/PriceTag';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ScreenLoading } from '@/components/ScreenLoading';
import { StoreLogoRow } from '@/components/StoreLogo';
import { StoreStrip } from '@/components/StoreStrip';
import { Palette, Spacing, useType } from '@/constants/DesignSystem';
import { useScrollSafeAreaStyle } from '@/hooks/useScrollSafeAreaStyle';
import { useT } from '@/i18n';
import type { Game, HomeSection } from '@/services/gameData';
import { homeStore } from '@/services/screenData';
import { getDealPlatforms, getGameImageSources } from '@/utils/gameDisplay';
import { cheapestDeal, priceView } from '@/utils/price';

function discountOf(game: Game): number {
  return cheapestDeal(game.deals)?.discountPercent ?? 0;
}

/** The deepest discount across every store leads the page. */
function pickFeatured(sections: readonly HomeSection[]): Game | null {
  let best: Game | null = null;
  for (const section of sections) {
    for (const game of section.games) {
      if (!best || discountOf(game) > discountOf(best)) best = game;
    }
  }
  return best;
}

const Featured = memo(function Featured({ game }: Readonly<{ game: Game }>) {
  const t = useT();
  const type = useType();
  const { push } = useRouter();
  const price = priceView(cheapestDeal(game.deals));
  const platform = game.source_platform || game.platform;

  return (
    <Pressable
      onPress={() => {
        push({ pathname: '/game/[id]', params: platform ? { id: game.id, platform } : { id: game.id } });
      }}
      style={({ pressed }) => [styles.featured, pressed && styles.pressed]}
      accessibilityRole="link"
      accessibilityLabel={game.title}
    >
      <View>
        <CoverImage sources={getGameImageSources(game)} title={game.title} decorative />
        {price ? (
          <View style={styles.featuredTag}>
            <PriceTag price={price} size="large" />
          </View>
        ) : null}
      </View>
      <Text style={[type('title'), styles.featuredTitle]} numberOfLines={2}>{game.title}</Text>
      <View style={styles.featuredMeta}>
        <StoreLogoRow platforms={getDealPlatforms(game)} />
        <Text style={[type('caption'), styles.muted]}>{t('home.biggestDiscount')}</Text>
      </View>
    </Pressable>
  );
});

const renderSection = ({ item }: { item: HomeSection }) => <StoreStrip platform={item.platform} games={item.games} />;

function HomeScreenLoaded({ sections, refreshing }: Readonly<{ sections: HomeSection[]; refreshing: boolean }>) {
  const t = useT();
  const containerStyle = useScrollSafeAreaStyle();
  const featured = useMemo(() => pickFeatured(sections), [sections]);

  return (
    <View style={[styles.container, containerStyle]}>
      <StatusBar style="light" />
      <FlatList
        data={sections}
        renderItem={renderSection}
        keyExtractor={(item) => item.platform}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        contentInsetAdjustmentBehavior="automatic"
        initialNumToRender={3}
        windowSize={5}
        refreshing={refreshing}
        onRefresh={() => { homeStore.load(true); }}
        ListHeaderComponent={
          <View style={styles.header}>
            <ScreenHeader title="GSale" />
            {featured ? <Featured game={featured} /> : null}
          </View>
        }
        ListEmptyComponent={<EmptyState message={t('home.empty')} />}
      />
    </View>
  );
}

export default function HomeScreen() {
  const t = useT();
  const { data: sections, refreshing } = useSyncExternalStore(homeStore.subscribe, homeStore.getSnapshot);
  if (sections === null) return <ScreenLoading message={t('home.loading')} />;
  return <HomeScreenLoaded sections={sections} refreshing={refreshing} />;
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
  header: {
    gap: Spacing.sm,
  },
  featured: {
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  pressed: {
    opacity: 0.7,
  },
  featuredTag: {
    position: 'absolute',
    start: Spacing.md,
    bottom: Spacing.md,
  },
  featuredTitle: {
    color: Palette.text,
  },
  featuredMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  muted: {
    color: Palette.textMuted,
  },
});
