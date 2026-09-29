import { ArrowLeft, Heart, ExternalLink, AlertCircle, Gamepad2 } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState, useSyncExternalStore } from 'react';
import { Image } from 'expo-image';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Palette, Radius, Shadows, Spacing, Typography } from '@/constants/DesignSystem';
import { type Game } from '@/services/gameData';
import type { EditionKey } from '@/services/api';
import { gameDetailStore } from '@/services/screenData';
import { getPlatformAspectRatio } from '@/utils/platform';
import {
  getGameImageSources,
  getTitleInitial,
  isSafeExternalUrl,
  isUnavailablePrice,
  parseComparablePrice,
  pickBestDealForDisplay,
} from '@/utils/gameDisplay';
import { toggleFavorite, isFavorite as checkFavorite } from '@/services/favorites';
import { useScrollSafeAreaStyle } from '@/hooks/useScrollSafeAreaStyle';

function routeParam(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) return value;
  if (Array.isArray(value) && typeof value[0] === 'string' && value[0].length > 0) return value[0];
  return undefined;
}

function LoadingView({ onBack }: Readonly<{ onBack: () => void }>) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <Pressable
        onPress={onBack}
        style={[styles.loadingBackButton, { top: insets.top + Spacing.sm }]}
        accessibilityLabel="Geri dön"
        accessibilityRole="button"
      >
        <ArrowLeft size={20} color={Palette.text} />
      </Pressable>
      <ActivityIndicator size="large" color={Palette.accent} />
      <Text style={styles.loadingText}>Fiyatlar kontrol ediliyor…</Text>
    </View>
  );
}

function ErrorView({ message, onBack }: Readonly<{ message: string; onBack: () => void }>) {
  return (
    <View style={[styles.container, styles.center]}>
      <StatusBar style="light" />
      <AlertCircle size={48} color={Palette.textSecondary} />
      <Text style={styles.errorText}>{message}</Text>
      <Pressable onPress={onBack} style={styles.backButton} accessibilityLabel="Geri dön" accessibilityRole="button">
        <Text style={styles.backButtonText}>Geri Dön</Text>
      </Pressable>
    </View>
  );
}

function GameHeroImage({
  game,
  aspectRatio,
}: Readonly<{ game: Game; aspectRatio: number }>) {
  const sources = useMemo(() => getGameImageSources(game), [game]);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [showPlaceholder, setShowPlaceholder] = useState(sources.length === 0);
  const currentSource = sources[sourceIndex];

  const handleError = () => {
    if (sourceIndex + 1 < sources.length) {
      setSourceIndex((prev) => prev + 1);
      return;
    }
    setShowPlaceholder(true);
  };

  if (showPlaceholder || !currentSource) {
    return (
      <View style={[styles.heroBanner, styles.heroPlaceholder, { aspectRatio }]}>
        <Gamepad2 size={40} color={Palette.textTertiary} />
        <Text style={styles.heroPlaceholderText}>{getTitleInitial(game.title)}</Text>
      </View>
    );
  }

  return (
    <Image
      source={currentSource}
      style={[styles.heroBanner, { aspectRatio }]}
      contentFit="contain"
      accessibilityLabel={`${game.title} kapak görseli`}
      onError={handleError}
    />
  );
}

function GameHeroSection({ game, isFav, onToggleFav, onBack }: Readonly<{
  game: Game;
  isFav: boolean;
  onToggleFav: () => void;
  onBack: () => void;
}>) {
  const insets = useSafeAreaInsets();
  const aspectRatio = getPlatformAspectRatio(game.source_platform);
  const overlayTopPadding = Platform.OS === 'android' ? Spacing.sm : insets.top + Spacing.sm;
  return (
    <>
      <View style={styles.heroContainer}>
        <GameHeroImage game={game} aspectRatio={aspectRatio} />
        <View style={[styles.heroOverlay, { paddingTop: overlayTopPadding }]}>
          <Pressable onPress={onBack} style={styles.heroOverlayButton} accessibilityLabel="Geri dön" accessibilityRole="button">
            <ArrowLeft size={20} color={Palette.text} />
          </Pressable>
          <Pressable onPress={onToggleFav} style={styles.heroOverlayButton} accessibilityLabel={isFav ? 'Favorilerden çıkar' : 'Favorilere ekle'} accessibilityRole="button">
            <Heart size={20} color={Palette.text} fill={isFav ? Palette.text : 'transparent'} strokeWidth={2} />
          </Pressable>
        </View>
      </View>
      <View style={styles.heroInfo}>
        <Text style={styles.heroTitle} numberOfLines={2}>{game.title}</Text>
      </View>
    </>
  );
}

function BestPriceCard({ deal }: Readonly<{ deal: Game['deals'][number] }>) {
  return (
    <Pressable
      style={styles.bestPriceCard}
      onPress={() => {
        if (isSafeExternalUrl(deal.url)) void Linking.openURL(deal.url);
      }}
      accessibilityLabel={`En ucuz fiyat: ${deal.platform} ${deal.price}. Resmi mağazada açılır.`}
      accessibilityRole="link"
    >
      <View style={styles.bestPriceLeft}>
        <View style={styles.bestPriceInfo}>
          <Text style={styles.bestPlatformName}>{deal.platform}</Text>
          <View style={styles.bestPriceRowInner}>
            {deal.discount && deal.discount !== '0%' && deal.discount !== '0' ? (
              <View style={styles.discountBadge}><Text style={styles.discountText}>{deal.discount}</Text></View>
            ) : null}
            <View style={styles.pricesColumn}>
              {deal.originalPrice && deal.originalPrice !== deal.price && !isUnavailablePrice(deal.originalPrice) ? (
                <Text style={styles.bestOriginalPrice}>{deal.originalPrice}</Text>
              ) : null}
              <Text style={[styles.bestPrice, deal.originalPrice && deal.originalPrice !== deal.price && !isUnavailablePrice(deal.price) ? styles.discountedPrice : null]}>{deal.price}</Text>
            </View>
          </View>
        </View>
      </View>
      <View style={styles.buyButton}>
        <Text style={styles.buyButtonText}>Mağazada aç</Text>
        <ExternalLink size={18} color={Palette.background} />
      </View>
    </Pressable>
  );
}

const PLATFORM_ORDER: Record<string, number> = {
  Steam: 0,
  'Epic Games': 1,
  GOG: 2,
  Xbox: 3,
  PlayStation: 4,
  Nintendo: 5,
};

type GameDeal = Game['deals'][number];

function isGamePass(deal: GameDeal): boolean {
  return (
    deal.subscriptionNote?.toLowerCase().includes('game pass') ||
    deal.price.toLowerCase().includes('game pass')
  );
}

function DealPriceCard({ deal }: Readonly<{ deal: GameDeal }>) {
  return (
    <Pressable
      style={styles.priceCard}
      onPress={() => {
        if (isSafeExternalUrl(deal.url)) void Linking.openURL(deal.url);
      }}
      accessibilityLabel={`${deal.platform} mağazasında ${deal.price} fiyatına git`}
      accessibilityRole="link"
    >
      <View style={styles.priceLeft}>
        <View style={styles.priceInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
            <Text style={styles.platformName}>{deal.platform}</Text>
            {isGamePass(deal) ? (
              <View style={styles.gamePassBadge}>
                <Text style={styles.gamePassText}>Game Pass</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.priceRow}>
            {deal.discount && deal.discount !== '0%' && deal.discount !== '0' ? (
              <View style={styles.discountBadge}><Text style={styles.discountText}>{deal.discount}</Text></View>
            ) : null}
            <View style={styles.pricesColumn}>
              {deal.originalPrice && deal.originalPrice !== deal.price && !isUnavailablePrice(deal.originalPrice) ? (
                <Text style={styles.originalPrice}>{deal.originalPrice}</Text>
              ) : null}
              <Text style={[styles.currentPrice, deal.originalPrice && deal.originalPrice !== deal.price && !isUnavailablePrice(deal.price) ? styles.discountedPrice : null]}>{deal.price}</Text>
            </View>
          </View>
        </View>
      </View>
      {isUnavailablePrice(deal.price) ? null : (
        <View style={styles.priceRight}>
          <Text style={styles.buyText}>Mağazada aç</Text>
          <ExternalLink size={16} color={Palette.text} />
        </View>
      )}
    </Pressable>
  );
}

function PricesTab({ deals }: Readonly<{ deals: Game['deals'] }>) {
  const availableDeals = deals.filter(d => !isUnavailablePrice(d.price));

  if (availableDeals.length === 0) {
    return (
      <View style={styles.pricesSection}>
        <Text style={styles.noPricesText}>Fiyat bilgisi bulunamadı.</Text>
      </View>
    );
  }

  const sortedDeals = availableDeals.slice().sort((a, b) => {
    const aOrder = PLATFORM_ORDER[a.platform] ?? 99;
    const bOrder = PLATFORM_ORDER[b.platform] ?? 99;
    if (aOrder !== bOrder) return aOrder - bOrder;
    const aNum = parseComparablePrice(a.price);
    const bNum = parseComparablePrice(b.price);
    return aNum - bNum;
  });

  const pcDeals = sortedDeals.filter(d => ['Steam', 'Epic Games', 'GOG'].includes(d.platform));
  const consoleDeals = sortedDeals.filter(d => ['Xbox', 'PlayStation', 'Nintendo'].includes(d.platform));

  return (
    <View style={styles.pricesSection}>
      {pcDeals.length > 0 ? (
        <View style={styles.platformGroup}>
          <Text style={styles.platformGroupTitle}>PC</Text>
          {pcDeals.map((deal) => (
            <DealPriceCard key={`${deal.platform}-${deal.url}-${deal.price}`} deal={deal} />
          ))}
        </View>
      ) : null}
      {consoleDeals.length > 0 ? (
        <View style={styles.platformGroup}>
          <Text style={styles.platformGroupTitle}>Konsol</Text>
          {consoleDeals.map((deal) => (
            <DealPriceCard key={`${deal.platform}-${deal.url}-${deal.price}`} deal={deal} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function EditionChips({ editions, selected, onSelect }: Readonly<{
  editions: readonly { key: EditionKey }[];
  selected: EditionKey | null;
  onSelect: (key: EditionKey) => void;
}>) {
  if (editions.length < 2) return null;
  return (
    <View style={styles.editionRow}>
      {editions.map(({ key }) => (
        <Pressable
          key={key}
          onPress={() => { onSelect(key); }}
          style={[styles.editionChip, key === selected && styles.editionChipActive]}
          accessibilityLabel={key}
          accessibilityRole="tab"
          accessibilityState={{ selected: key === selected }}
        >
          <Text style={[styles.editionText, key === selected && styles.editionTextActive]}>{key}</Text>
        </Pressable>
      ))}
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
  const [isFav, setIsFav] = useState(() => checkFavorite(game.id));
  const deals = game.editions?.find((option) => option.key === selectedEdition)?.deals ?? game.deals;
  const cheapestDeal = useMemo(() => pickBestDealForDisplay(deals), [deals]);
  const scrollSafeAreaStyle = useScrollSafeAreaStyle();

  return (
    <View style={[styles.container, scrollSafeAreaStyle]}>
      <StatusBar style="light" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="automatic"
      >
        <GameHeroSection
          game={game}
          isFav={isFav}
          onToggleFav={() => {
            const favPayload: Parameters<typeof toggleFavorite>[0] = {
              id: game.id,
              title: game.title,
              imageUrl: game.imageUrl,
              platform: game.platform,
              price: game.price,
              discount: game.discount,
            };
            if (game.originalPrice !== undefined) {
              favPayload.originalPrice = game.originalPrice;
            }
            setIsFav(toggleFavorite(favPayload));
          }}
          onBack={onBack}
        />
        <EditionChips editions={game.editions ?? []} selected={selectedEdition} onSelect={onSelectEdition} />
        {cheapestDeal ? <BestPriceCard deal={cheapestDeal} /> : null}
        <PricesTab deals={deals} />
      </ScrollView>
    </View>
  );
}

type GameDetailContentProps = Readonly<{
  slug: string;
  platformHint?: string;
}>;

function GameDetailContent({ slug, platformHint }: GameDetailContentProps) {
  const { back } = useRouter();
  const { game, selectedEdition, loading, error } = useSyncExternalStore(
    (onStoreChange) => gameDetailStore.subscribe(slug, platformHint, onStoreChange),
    () => gameDetailStore.getSnapshot(slug, platformHint),
  );

  if (loading) return <LoadingView onBack={() => { back(); }} />;
  if (error || !game) {
    return <ErrorView message={error || 'Oyun bulunamadı.'} onBack={() => { back(); }} />;
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
  const { id, platform } = useLocalSearchParams();
  const { back } = useRouter();
  const slug = routeParam(id);
  const platformHint = routeParam(platform);

  if (!slug) {
    return <ErrorView message="Oyun bulunamadı." onBack={() => { back(); }} />;
  }

  const routeKey = `${slug}|${platformHint ?? ''}`;
  const contentProps =
    platformHint === undefined ? { slug } : { slug, platformHint };

  return (
    <GameDetailContent
      key={routeKey}
      {...contentProps}
    />
  );
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
    padding: 40,
  },
  loadingText: {
    color: Palette.textSecondary,
    fontSize: Typography.body.fontSize,
    fontFamily: Typography.body.fontFamily,
  },
  errorText: {
    color: Palette.text,
    fontSize: Typography.h3.fontSize,
    fontFamily: Typography.h3.fontFamily,
  },
  backButton: {
    marginTop: Spacing.md,
  },
  backButtonText: {
    color: Palette.text,
    fontSize: Typography.button.fontSize,
    fontFamily: Typography.button.fontFamily,
  },
  scrollContent: {
    paddingBottom: Spacing.xl * 2,
  },

  // Hero
  heroContainer: {
    width: '100%',
    overflow: 'hidden',
  },
  heroBanner: {
    width: '100%',
    backgroundColor: Palette.surfaceLight,
  },
  heroPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  heroPlaceholderText: {
    color: Palette.textTertiary,
    fontSize: Typography.caption.fontSize,
    fontFamily: Typography.caption.fontFamily,
  },
  heroOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
  },
  loadingBackButton: {
    position: 'absolute',
    left: Spacing.md,
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: Palette.overlayMedium,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroOverlayButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: Palette.overlayMedium,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroInfo: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  heroTitle: {
    fontSize: Typography.h1.fontSize,
    fontFamily: Typography.h1.fontFamily,
    color: Palette.text,
    lineHeight: Typography.h1.lineHeight,
    letterSpacing: Typography.h1.letterSpacing,
  },

  // Editions
  editionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  editionChip: {
    paddingHorizontal: Spacing.sm + Spacing.xs,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  editionChipActive: {
    backgroundColor: Palette.surfaceLight,
  },
  editionText: {
    color: Palette.textSecondary,
    fontSize: Typography.caption.fontSize,
    fontFamily: Typography.caption.fontFamily,
  },
  editionTextActive: {
    color: Palette.text,
  },

  // Best Price
  bestPriceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    padding: Spacing.sm + Spacing.xs,
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    ...Shadows.sm,
  },
  bestPriceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + Spacing.xs,
  },
  bestPriceInfo: {
    gap: Spacing.xs,
  },
  bestPlatformName: {
    fontSize: Typography.caption.fontSize,
    fontFamily: Typography.caption.fontFamily,
    color: Palette.textSecondary,
  },
  bestPriceRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  bestOriginalPrice: {
    color: Palette.textTertiary,
    fontSize: Typography.caption.fontSize,
    textDecorationLine: 'line-through',
  },
  bestPrice: {
    color: Palette.text,
    fontSize: Typography.h2.fontSize,
    fontFamily: Typography.h2.fontFamily,
  },
  buyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Palette.accent,
    paddingHorizontal: Spacing.md + Spacing.xs,
    paddingVertical: Spacing.sm + Spacing.xs,
    borderRadius: Radius.lg,
  },
  buyButtonText: {
    color: Palette.background,
    fontSize: Typography.button.fontSize,
    fontFamily: Typography.button.fontFamily,
  },

  // About

  // Prices
  pricesSection: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  platformGroup: {
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  platformGroupTitle: {
    fontSize: Typography.sectionLabel.fontSize,
    fontFamily: Typography.sectionLabel.fontFamily,
    lineHeight: Typography.sectionLabel.lineHeight,
    letterSpacing: Typography.sectionLabel.letterSpacing,
    color: Palette.textSecondary,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
  },
  noPricesText: {
    color: Palette.textSecondary,
    fontSize: Typography.body.fontSize,
    fontFamily: Typography.body.fontFamily,
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
  priceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.sm + Spacing.xs,
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    ...Shadows.sm,
  },
  priceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + Spacing.xs,
  },
  priceInfo: {
    gap: Spacing.xs,
  },
  platformName: {
    fontSize: Typography.caption.fontSize,
    fontFamily: Typography.caption.fontFamily,
    color: Palette.textSecondary,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  pricesColumn: {
    justifyContent: 'center',
  },
  discountBadge: {
    backgroundColor: Palette.deal,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
  },
  discountText: {
    color: Palette.onDeal,
    fontFamily: Typography.button.fontFamily,
    fontSize: Typography.body.fontSize,
  },
  originalPrice: {
    color: Palette.textTertiary,
    fontSize: Typography.caption.fontSize,
    textDecorationLine: 'line-through',
  },
  currentPrice: {
    fontSize: Typography.price.fontSize,
    fontFamily: Typography.price.fontFamily,
    color: Palette.text,
  },
  gamePassBadge: {
    backgroundColor: Palette.onGamePass,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Palette.gamePass,
  },
  gamePassText: {
    color: Palette.gamePass,
    fontSize: Typography.micro.fontSize,
    fontFamily: Typography.micro.fontFamily,
    letterSpacing: Typography.micro.letterSpacing,
  },
  discountedPrice: {
    color: Palette.text,
  },
  priceRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  buyText: {
    fontSize: Typography.caption.fontSize,
    fontFamily: Typography.caption.fontFamily,
    color: Palette.text,
  },
});
