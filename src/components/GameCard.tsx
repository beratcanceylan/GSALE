import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Star } from 'lucide-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useRouter } from 'expo-router';

import { CardFooter } from '@/components/CardFooter';
import { CardImage } from '@/components/CardImage';
import { Palette, Radius, Spacing, Typography } from '@/constants/DesignSystem';
import type { Game } from '@/services/gameData';
import { rememberDetailPreviews } from '@/services/store/detail-preview';
import { getGameImageSources } from '@/utils/gameDisplay';
import { getPlatformAspectRatio } from '@/utils/platform';

type GameCardProps = Readonly<{
  game: Game;
  featuredLabel?: boolean;
  aspectRatio?: number;
  hidePrice?: boolean;
  /** `strip`: fixed-width card for horizontal home-page rows. */
  variant?: 'list' | 'strip';
}>;

function rememberCardPreview(game: Game): void {
  rememberDetailPreviews([{
    id: game.id,
    title: game.title,
    image_url: game.imageUrl,
    platform: game.source_platform || game.platform,
    rating: game.rating ?? null,
    ...(game.platforms ? { platforms: game.platforms } : {}),
    ...(game.store_links ? { store_links: game.store_links } : {}),
  }]);
}

function imageCacheKey(game: Game, sources: ReturnType<typeof getGameImageSources>): string {
  const first = sources[0];
  return first && typeof first === 'object' && 'uri' in first && first.uri ? first.uri : game.id;
}

function GameCardView({
  game,
  featuredLabel = false,
  aspectRatio,
  hidePrice = false,
  variant = 'list',
}: GameCardProps) {
  const { push } = useRouter();
  const imageSources = getGameImageSources(game);
  const upcomingDate = game.upcoming ? game.upcoming_date_str : undefined;

  const handlePress = () => {
    const platformHint = game.source_platform || game.platform;
    rememberCardPreview(game);
    push({
      pathname: '/game/[id]',
      params: platformHint ? { id: game.id, platform: platformHint } : { id: game.id },
    });
  };

  const cardBody = (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.pressable, pressed && styles.pressablePressed]}
      accessibilityLabel={`${game.title} oyununa git`}
      accessibilityRole="button"
    >
      <View style={[styles.card, featuredLabel && styles.cardFeatured]}>
        <CardImage
          key={`${game.id}|${imageCacheKey(game, imageSources)}`}
          sources={imageSources}
          title={game.title}
          aspectRatio={aspectRatio ?? getPlatformAspectRatio(game.source_platform)}
          upcomingDate={upcomingDate}
        />
        <View style={styles.infoSection}>
          <Text style={styles.title} numberOfLines={2}>
            {game.title}
          </Text>
        </View>
        <CardFooter game={game} hidePrice={hidePrice} />
      </View>
    </Pressable>
  );

  return (
    <View style={variant === 'strip' ? styles.stripOuter : styles.outer}>
      {featuredLabel ? (
        <>
          <View style={styles.featuredLabelRow}>
            <Star size={14} color={Palette.accent} fill={Palette.accent} />
            <Text style={styles.featuredLabelText}>ÖNE ÇIKAN</Text>
          </View>
          <Animated.View entering={FadeIn.duration(300)}>{cardBody}</Animated.View>
        </>
      ) : (
        cardBody
      )}
    </View>
  );
}

const COMPARED_PROPS = ['featuredLabel', 'hidePrice', 'aspectRatio', 'variant'] as const;
const COMPARED_GAME_FIELDS = ['id', 'price', 'originalPrice', 'discount', 'imageUrl', 'title'] as const;
const COMPARED_DEAL_FIELDS = ['platform', 'price', 'originalPrice', 'discount', 'url', 'subscriptionNote'] as const;

function sameFields<T>(a: T, b: T, keys: readonly (keyof T)[]): boolean {
  return keys.every((key) => a[key] === b[key]);
}

function sameItems<T>(a: readonly T[], b: readonly T[], same: (x: T, y: T) => boolean): boolean {
  return a.length === b.length && a.every((item, index) => {
    const other = b[index];
    return other !== undefined && same(item, other);
  });
}

/** Re-render only when something the card shows changes. */
function propsAreEqual(prev: GameCardProps, next: GameCardProps): boolean {
  return (
    sameFields(prev, next, COMPARED_PROPS) &&
    sameFields(prev.game, next.game, COMPARED_GAME_FIELDS) &&
    prev.game.platforms?.length === next.game.platforms?.length &&
    sameItems(prev.game.platforms ?? [], next.game.platforms ?? [], Object.is) &&
    sameItems(prev.game.deals, next.game.deals, (a, b) => sameFields(a, b, COMPARED_DEAL_FIELDS))
  );
}

export const GameCard = React.memo(GameCardView, propsAreEqual);

const styles = StyleSheet.create({
  outer: {
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  stripOuter: {
    width: 240,
  },
  featuredLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  featuredLabelText: {
    color: Palette.accent,
    fontSize: Typography.sectionLabel.fontSize,
    fontFamily: Typography.sectionLabel.fontFamily,
    letterSpacing: Typography.sectionLabel.letterSpacing,
  },
  pressable: {
    borderRadius: Radius.lg,
  },
  pressablePressed: {
    opacity: 0.92,
  },
  card: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Palette.border,
  },
  cardFeatured: {
    borderColor: Palette.accentMuted,
  },
  infoSection: {
    paddingHorizontal: Spacing.sm + Spacing.xs,
    paddingTop: Spacing.sm + Spacing.xs,
    paddingBottom: Spacing.sm,
  },
  title: {
    color: Palette.text,
    fontSize: Typography.h3.fontSize,
    fontFamily: Typography.h3.fontFamily,
    lineHeight: Typography.h3.lineHeight,
  },
});
