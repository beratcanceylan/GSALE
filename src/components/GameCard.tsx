import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image, type ImageSource } from 'expo-image';
import { Gamepad2, Star } from 'lucide-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useRouter } from 'expo-router';

import type { Game } from '@/services/gameData';
import { rememberDetailPreviews } from '@/services/store/detail-preview';
import { Palette, Radius, Spacing, Typography } from '@/constants/DesignSystem';
import { PlatformBadge } from '@/components/PlatformBadge';
import { getPlatformAspectRatio } from '@/utils/platform';
import {
  getDealPlatforms,
  getGameImageSources,
  getTitleInitial,
  isUnavailablePrice,
  resolveCardPrice,
} from '@/utils/gameDisplay';

type GameCardProps = Readonly<{
  game: Game;
  featuredLabel?: boolean;
  aspectRatio?: number;
  hidePrice?: boolean;
  /** `strip`: fixed-width card for horizontal home-page rows. */
  variant?: 'list' | 'strip';
}>;

type CardImageProps = Readonly<{
  sources: ImageSource[];
  title: string;
  aspectRatio: number;
  upcoming?: boolean;
  upcomingDate?: string;
}>;

function PlatformIcons({ platforms }: Readonly<{ platforms: string[] }>) {
  if (platforms.length === 0) return null;

  return (
    <View style={styles.platformIcons}>
      {platforms.map((platform) => (
        <PlatformBadge key={platform} platform={platform} />
      ))}
    </View>
  );
}

function CardImage({ sources, title, aspectRatio, upcoming, upcomingDate }: CardImageProps) {
  const [sourceIndex, setSourceIndex] = useState(0);
  const [showPlaceholder, setShowPlaceholder] = useState(sources.length === 0);
  const currentSource = sources[sourceIndex];

  const handleImageError = () => {
    if (sourceIndex + 1 < sources.length) {
      setSourceIndex((prev) => prev + 1);
      return;
    }
    setShowPlaceholder(true);
  };

  return (
    <View style={[styles.imageContainer, { aspectRatio }]}>
      {!showPlaceholder && currentSource ? (
        <Image
          source={currentSource}
          style={styles.image}
          contentFit="cover"
          cachePolicy="disk"
          enforceEarlyResizing
          recyclingKey={typeof currentSource === 'object' && 'uri' in currentSource ? currentSource.uri : title}
          accessibilityLabel={`${title} kapak görseli`}
          onError={handleImageError}
        />
      ) : (
        <View style={[styles.image, styles.placeholderImage]}>
          <Gamepad2 size={32} color={Palette.textTertiary} />
          <Text style={styles.placeholderText}>{getTitleInitial(title)}</Text>
        </View>
      )}
      {upcoming && upcomingDate ? (
        <View style={styles.upcomingBadge}>
          <Text style={styles.upcomingText}>{upcomingDate}</Text>
        </View>
      ) : null}
    </View>
  );
}

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

function GameCardComponent({
  game,
  featuredLabel = false,
  aspectRatio,
  hidePrice = false,
  variant = 'list',
}: GameCardProps) {
  const { push } = useRouter();
  const priceInfo = useMemo(() => resolveCardPrice(game), [game]);
  const imageSources = useMemo(() => getGameImageSources(game), [game]);
  const cardAspect = aspectRatio ?? getPlatformAspectRatio(game.source_platform);

  const discountPercent = (priceInfo.discount || '').replace(/\D/g, '');
  const platforms = getDealPlatforms(game);
  const showDiscount =
    priceInfo.purchasable &&
    Boolean(discountPercent) &&
    !isUnavailablePrice(priceInfo.originalPrice || '');
  const showOriginal =
    priceInfo.purchasable &&
    Boolean(priceInfo.originalPrice) &&
    !isUnavailablePrice(priceInfo.originalPrice || '');

  const handlePress = () => {
    const platformHint = game.source_platform || game.platform;
    rememberCardPreview(game);
    push({
      pathname: '/game/[id]',
      params: platformHint
        ? { id: game.id, platform: platformHint }
        : { id: game.id },
    });
  };

  const firstSource = imageSources[0];
  const imageCacheKey =
    firstSource && typeof firstSource === 'object' && 'uri' in firstSource
      ? firstSource.uri
      : game.id;

  const cardBody = (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.pressable, pressed && styles.pressablePressed]}
      accessibilityLabel={`${game.title} oyununa git`}
      accessibilityRole="button"
    >
      <View style={[styles.card, featuredLabel && styles.cardFeatured]}>
        <CardImage
          key={`${game.id}|${imageCacheKey}`}
          sources={imageSources}
          title={game.title}
          aspectRatio={cardAspect}
          {...(game.upcoming && game.upcoming_date_str
            ? { upcoming: true, upcomingDate: game.upcoming_date_str }
            : {})}
        />

        <View style={styles.infoSection}>
          <Text style={styles.title} numberOfLines={2}>
            {game.title}
          </Text>
        </View>

        {!hidePrice ? (
          <View style={styles.footer}>
            <View style={styles.footerRow}>
              {showDiscount ? (
                <View style={styles.discountBadge}>
                  <Text style={styles.discountText}>-{discountPercent}%</Text>
                </View>
              ) : null}
              {showOriginal ? (
                <Text style={styles.originalPrice}>{priceInfo.originalPrice}</Text>
              ) : null}
              {priceInfo.purchasable ? (
                <Text style={styles.price}>{priceInfo.price}</Text>
              ) : (
                <Text style={styles.unavailablePrice}>{priceInfo.unavailableLabel}</Text>
              )}
              <PlatformIcons platforms={platforms} />
            </View>
          </View>
        ) : platforms.length > 0 ? (
          <View style={[styles.footer, styles.platformOnlyFooter]}>
            <PlatformIcons platforms={platforms} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );

  return (
    <View style={variant === 'strip' ? styles.stripOuter : styles.outer}>
      {featuredLabel ? (
        <View style={styles.featuredLabelRow}>
          <Star size={14} color={Palette.accent} fill={Palette.accent} />
          <Text style={styles.featuredLabelText}>ÖNE ÇIKAN</Text>
        </View>
      ) : null}
      {featuredLabel ? (
        <Animated.View entering={FadeIn.duration(300)}>{cardBody}</Animated.View>
      ) : (
        cardBody
      )}
    </View>
  );
}

function propsAreEqual(prev: GameCardProps, next: GameCardProps): boolean {
  if (prev.game.id !== next.game.id) return false;
  if (prev.game.price !== next.game.price) return false;
  if (prev.game.originalPrice !== next.game.originalPrice) return false;
  if (prev.game.discount !== next.game.discount) return false;
  if (prev.game.imageUrl !== next.game.imageUrl) return false;
  if (prev.game.platforms?.length !== next.game.platforms?.length) return false;
  if (prev.game.platforms?.some((platform, index) => platform !== next.game.platforms?.[index])) return false;
  if (prev.game.title !== next.game.title) return false;
  if (prev.game.deals.length !== next.game.deals.length) return false;
  if (prev.featuredLabel !== next.featuredLabel) return false;
  if (prev.hidePrice !== next.hidePrice) return false;
  if (prev.aspectRatio !== next.aspectRatio) return false;
  if (prev.variant !== next.variant) return false;

  for (let i = 0; i < prev.game.deals.length; i++) {
    const a = prev.game.deals[i];
    const b = next.game.deals[i];
    if (
      !a ||
      !b ||
      a.platform !== b.platform ||
      a.price !== b.price ||
      a.originalPrice !== b.originalPrice ||
      a.discount !== b.discount ||
      a.url !== b.url ||
      a.subscriptionNote !== b.subscriptionNote
    ) return false;
  }
  return true;
}

export const GameCard = React.memo(GameCardComponent, propsAreEqual);

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
  imageContainer: {
    width: '100%',
    backgroundColor: Palette.surfaceLight,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  placeholderText: {
    color: Palette.textTertiary,
    fontSize: Typography.caption.fontSize,
    fontFamily: Typography.caption.fontFamily,
  },
  upcomingBadge: {
    position: 'absolute',
    bottom: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: Palette.surface,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  upcomingText: {
    color: Palette.text,
    fontSize: Typography.micro.fontSize,
    fontFamily: Typography.micro.fontFamily,
    letterSpacing: Typography.micro.letterSpacing,
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
  footer: {
    paddingHorizontal: Spacing.sm + Spacing.xs,
    paddingVertical: Spacing.sm + Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
  },
  footerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  discountBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Palette.accent,
    backgroundColor: 'transparent',
  },
  discountText: {
    color: Palette.accent,
    fontSize: Typography.caption.fontSize,
    fontFamily: Typography.button.fontFamily,
  },
  originalPrice: {
    color: Palette.textTertiary,
    fontSize: Typography.caption.fontSize,
    fontFamily: Typography.caption.fontFamily,
    textDecorationLine: 'line-through',
  },
  price: {
    color: Palette.text,
    fontSize: Typography.price.fontSize,
    fontFamily: Typography.price.fontFamily,
  },
  unavailablePrice: {
    color: Palette.textSecondary,
    fontSize: Typography.body.fontSize,
    fontFamily: Typography.body.fontFamily,
  },
  platformIcons: {
    flexDirection: 'row',
    gap: Spacing.xs,
    alignItems: 'center',
    marginLeft: Spacing.xs,
  },
  platformOnlyFooter: {
    alignItems: 'flex-end',
  },
});
