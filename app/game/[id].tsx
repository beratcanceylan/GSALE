import { ArrowLeft, Heart } from '@/components/Icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState, useSyncExternalStore } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CoverImage } from '@/components/CoverImage';
import { EditionPicker, type EditionChoice } from '@/components/EditionPicker';
import { EmptyState } from '@/components/EmptyState';
import { IconButton } from '@/components/IconButton';
import { PriceTable } from '@/components/PriceTable';
import { Aspect, Palette, Radius, Size, Spacing, useType } from '@/constants/DesignSystem';
import { useT } from '@/i18n';
import type { EditionKey } from '@/services/api';
import type { Deal } from '@/services/deal';
import { isFavorite as checkFavorite, toggleFavorite } from '@/services/favorites';
import type { Game } from '@/services/gameData';
import { gameDetailStore } from '@/services/screenData';
import { getGameImageSources } from '@/utils/gameDisplay';
import { cheapestDeal } from '@/utils/price';

function routeParam(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) return value;
  if (Array.isArray(value) && typeof value[0] === 'string' && value[0].length > 0) return value[0];
  return undefined;
}

type EditionView = Readonly<{ deals: Deal[]; missingStores: string[]; choices: EditionChoice[] }>;

/** The selected edition's deals, and the stores that sell another edition but not this one. */
function editionView(game: Game, selected: EditionKey | null): EditionView {
  const editions = game.editions ?? [];
  const deals = editions.find((option) => option.key === selected)?.deals ?? game.deals;
  const selling = new Set(deals.map((deal) => deal.platform));
  const everyStore = new Set(editions.flatMap((option) => option.deals.map((deal) => deal.platform)));
  const missingStores = [...everyStore].filter((platform) => !selling.has(platform));
  const choices = editions.map((option) => {
    const lowest = cheapestDeal(option.deals);
    return { key: option.key, lowest: lowest?.amount ?? null, free: lowest?.isFree ?? false };
  });
  return { deals, missingStores, choices };
}

/** The favorite remembers the price of the edition on screen. */
function favoritePayload(game: Game, deals: readonly Deal[]): Parameters<typeof toggleFavorite>[0] {
  const deal = cheapestDeal(deals);
  const payload: Parameters<typeof toggleFavorite>[0] = {
    id: game.id,
    title: game.title,
    imageUrl: game.imageUrl,
    platform: deal?.platform ?? game.platform,
    price: deal?.price ?? game.price,
    discount: deal?.discount ?? game.discount,
  };
  const originalPrice = deal?.originalPrice ?? game.originalPrice;
  if (originalPrice !== undefined) payload.originalPrice = originalPrice;
  return payload;
}

type FavoriteControl = Readonly<{ active: boolean; onToggle: () => void }>;

function TopBar({ onBack, favorite }: Readonly<{ onBack: () => void; favorite?: FavoriteControl }>) {
  const t = useT();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.topBar, { paddingTop: insets.top + Spacing.sm }]} pointerEvents="box-none">
      <IconButton icon={ArrowLeft} label={t('common.back')} onPress={onBack} tone="plain" directional />
      {favorite ? (
        <IconButton
          icon={Heart}
          label={favorite.active ? t('favorites.remove') : t('favorites.add')}
          onPress={favorite.onToggle}
          tone="plain"
          filled={favorite.active}
        />
      ) : null}
    </View>
  );
}

const SKELETON_ROWS = ['first', 'second', 'third'] as const;

function LoadingView({ onBack }: Readonly<{ onBack: () => void }>) {
  const t = useT();
  const type = useType();
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <TopBar onBack={onBack} />
      <View style={styles.heroPlaceholder} />
      <View style={styles.body}>
        <Text style={[type('body'), styles.muted]}>{t('detail.loading')}</Text>
        <View style={styles.skeleton}>
          {SKELETON_ROWS.map((row) => <View key={row} style={styles.skeletonRow} />)}
        </View>
      </View>
    </View>
  );
}

function ErrorView({ message, onBack, onRetry }: Readonly<{ message: string; onBack: () => void; onRetry?: () => void }>) {
  const t = useT();
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <TopBar onBack={onBack} />
      <View style={styles.center}>
        <EmptyState message={message} {...(onRetry ? { action: { label: t('common.retry'), onPress: onRetry } } : {})} />
      </View>
    </View>
  );
}

type GameDetailLoadedProps = Readonly<{
  game: Game;
  selectedEdition: EditionKey | null;
  onSelectEdition: (key: EditionKey) => void;
  onBack: () => void;
}>;

function GameDetailLoaded({ game, selectedEdition, onSelectEdition, onBack }: GameDetailLoadedProps) {
  const t = useT();
  const type = useType();
  const [isFav, setIsFav] = useState(() => checkFavorite(game.id));
  const { deals, missingStores, choices } = editionView(game, selectedEdition);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <TopBar
        onBack={onBack}
        favorite={{ active: isFav, onToggle: () => { setIsFav(toggleFavorite(favoritePayload(game, deals))); } }}
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <CoverImage sources={getGameImageSources(game)} title={game.title} flush fit="natural" />
        <View style={styles.titleBlock}>
          <Text style={[type('display'), styles.title]} accessibilityRole="header">{game.title}</Text>
        </View>
        <EditionPicker options={choices} selected={selectedEdition} onSelect={onSelectEdition} />
        <View style={styles.body}>
          <Text style={[type('heading'), styles.title]} accessibilityRole="header">{t('detail.prices')}</Text>
          <PriceTable deals={deals} missingStores={missingStores} />
        </View>
      </ScrollView>
    </View>
  );
}

function GameDetailContent({ slug, platformHint }: Readonly<{ slug: string; platformHint?: string }>) {
  const t = useT();
  const { back } = useRouter();
  const { game, selectedEdition, loading, error } = useSyncExternalStore(
    (onStoreChange) => gameDetailStore.subscribe(slug, platformHint, onStoreChange),
    () => gameDetailStore.getSnapshot(slug, platformHint),
  );

  if (loading) return <LoadingView onBack={() => { back(); }} />;
  if (error || !game) {
    return (
      <ErrorView
        message={error ? t('detail.error') : t('detail.notFound')}
        onBack={() => { back(); }}
        onRetry={() => { gameDetailStore.reload(slug, platformHint); }}
      />
    );
  }

  return (
    <GameDetailLoaded
      key={game.id}
      game={game}
      selectedEdition={selectedEdition ?? null}
      onSelectEdition={(key) => { gameDetailStore.selectEdition(slug, platformHint, key); }}
      onBack={() => { back(); }}
    />
  );
}

export default function GameDetailScreen() {
  const t = useT();
  const { id, platform } = useLocalSearchParams();
  const { back } = useRouter();
  const slug = routeParam(id);
  const platformHint = routeParam(platform);

  if (!slug) return <ErrorView message={t('detail.notFound')} onBack={() => { back(); }} />;

  return (
    <GameDetailContent
      key={`${slug}|${platformHint ?? ''}`}
      slug={slug}
      {...(platformHint === undefined ? {} : { platformHint })}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
  },
  scroll: {
    paddingBottom: Spacing.xxl,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  heroPlaceholder: {
    width: '100%',
    aspectRatio: Aspect.cover,
    backgroundColor: Palette.surface,
  },
  titleBlock: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  title: {
    color: Palette.text,
  },
  body: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  muted: {
    color: Palette.textMuted,
  },
  skeleton: {
    gap: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  skeletonRow: {
    height: Size.skeletonLine,
    borderRadius: Radius.sm,
    backgroundColor: Palette.surface,
  },
});
