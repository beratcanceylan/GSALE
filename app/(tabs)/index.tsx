import { Gamepad2 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { memo, useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { FeaturedDeal } from '@/components/FeaturedDeal';
import { GameCard } from '@/components/GameCard';
import { HomeTopBar } from '@/components/HomeTopBar';
import { ScreenLoading } from '@/components/ScreenLoading';
import { Palette, Spacing, Typography } from '@/constants/DesignSystem';
import { useScrollSafeAreaStyle } from '@/hooks/useScrollSafeAreaStyle';
import { type Game, type HomeSection } from '@/services/gameData';
import { homeStore } from '@/services/screenData';

/** Uniform card shape so strips from different stores line up. */
const STRIP_ASPECT_RATIO = 16 / 9;

function discountPercent(game: Game): number {
  return Number(game.discount.replace(/\D/g, '')) || 0;
}

/** The deepest discount across every store is the hero card. */
function pickFeaturedDeal(sections: HomeSection[]): Game | null {
  let best: Game | null = null;
  for (const section of sections) {
    for (const game of section.games) {
      if (!best || discountPercent(game) > discountPercent(best)) best = game;
    }
  }
  return best;
}

type HomeListHeaderProps = Readonly<{
  featuredDeal: Game | null;
  searchQuery: string;
  onChangeQuery: (query: string) => void;
  onSubmitSearch: () => void;
}>;

const HomeListHeader = memo(function HomeListHeader({
  featuredDeal,
  searchQuery,
  onChangeQuery,
  onSubmitSearch,
}: HomeListHeaderProps) {
  return (
    <View style={styles.listHeader}>
      <HomeTopBar
        searchQuery={searchQuery}
        onChangeQuery={onChangeQuery}
        onSubmitSearch={onSubmitSearch}
      />
      {featuredDeal ? <FeaturedDeal game={featuredDeal} /> : null}
    </View>
  );
});

const renderStripItem = ({ item }: { item: Game }) => (
  <GameCard game={item} variant="strip" aspectRatio={STRIP_ASPECT_RATIO} />
);

const PlatformStrip = memo(function PlatformStrip({ section }: Readonly<{ section: HomeSection }>) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{section.platform} · İndirimde</Text>
      <FlatList
        horizontal
        data={section.games}
        renderItem={renderStripItem}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.stripContent}
        initialNumToRender={3}
        maxToRenderPerBatch={4}
        windowSize={3}
      />
    </View>
  );
});

const renderSection = ({ item }: { item: HomeSection }) => <PlatformStrip section={item} />;

type HomeScreenLoadedProps = Readonly<{
  sections: HomeSection[];
  refreshing: boolean;
  searchQuery: string;
  onChangeQuery: (query: string) => void;
  onRefresh: () => void;
  onSubmitSearch: () => void;
}>;

function HomeScreenLoaded({
  sections,
  refreshing,
  searchQuery,
  onChangeQuery,
  onRefresh,
  onSubmitSearch,
}: HomeScreenLoadedProps) {
  const containerStyle = useScrollSafeAreaStyle();
  const featuredDeal = useMemo(() => pickFeaturedDeal(sections), [sections]);

  const listHeader = useMemo(
    () => (
      <HomeListHeader
        featuredDeal={featuredDeal}
        searchQuery={searchQuery}
        onChangeQuery={onChangeQuery}
        onSubmitSearch={onSubmitSearch}
      />
    ),
    [featuredDeal, onChangeQuery, onSubmitSearch, searchQuery],
  );

  return (
    <View style={[styles.container, containerStyle]}>
      <StatusBar style="light" />

      <FlatList
        data={sections}
        renderItem={renderSection}
        keyExtractor={(item) => item.platform}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        contentInsetAdjustmentBehavior="automatic"
        initialNumToRender={3}
        windowSize={5}
        refreshing={refreshing}
        onRefresh={onRefresh}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={listHeader}
        ListEmptyComponent={<EmptyState icon={Gamepad2} message="Şu an gösterilecek indirim bulunamadı" />}
      />
    </View>
  );
}

export default function HomeScreen() {
  const { push } = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const { data: sections, refreshing } = useSyncExternalStore(
    homeStore.subscribe,
    homeStore.getSnapshot,
  );

  const onRefresh = useCallback(() => {
    homeStore.load(true);
  }, []);

  const submitSearch = useCallback(() => {
    const q = searchQuery.trim();
    if (q.length < 2) return;
    push({ pathname: '/search', params: { q } });
  }, [push, searchQuery]);

  if (sections === null) {
    return <ScreenLoading message="İndirimler yükleniyor…" />;
  }

  return (
    <HomeScreenLoaded
      sections={sections}
      refreshing={refreshing}
      searchQuery={searchQuery}
      onChangeQuery={setSearchQuery}
      onRefresh={onRefresh}
      onSubmitSearch={submitSearch}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  listContent: {
    paddingBottom: Spacing.xl + Spacing.md,
  },
  listHeader: {
    gap: Spacing.sm,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  stripContent: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  sectionLabel: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
    color: Palette.textSecondary,
    fontSize: Typography.sectionLabel.fontSize,
    fontFamily: Typography.sectionLabel.fontFamily,
    lineHeight: Typography.sectionLabel.lineHeight,
    letterSpacing: Typography.sectionLabel.letterSpacing,
    textTransform: 'uppercase',
  },
});
