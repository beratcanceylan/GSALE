import { StyleSheet, Text, View } from 'react-native';

import { PlatformBadgeList } from '@/components/PlatformBadgeList';
import { Palette, Radius, Spacing, Typography } from '@/constants/DesignSystem';
import type { Game } from '@/services/gameData';
import { getDealPlatforms, isUnavailablePrice, resolveCardPrice } from '@/utils/gameDisplay';

type CardFooterProps = Readonly<{
  game: Game;
  hidePrice: boolean;
}>;

/** Price row (discount, original and current price) followed by the store badges. */
export function CardFooter({ game, hidePrice }: CardFooterProps) {
  const platforms = getDealPlatforms(game);

  if (hidePrice) {
    if (platforms.length === 0) return null;
    return (
      <View style={[styles.footer, styles.platformOnlyFooter]}>
        <PlatformBadgeList platforms={platforms} />
      </View>
    );
  }

  const priceInfo = resolveCardPrice(game);
  const discountPercent = priceInfo.discount.replaceAll(/\D/g, '');
  const hasOriginal = Boolean(priceInfo.originalPrice) && !isUnavailablePrice(priceInfo.originalPrice ?? '');
  const showDiscount = priceInfo.purchasable && Boolean(discountPercent) && !isUnavailablePrice(priceInfo.originalPrice ?? '');
  const showOriginal = priceInfo.purchasable && hasOriginal;

  return (
    <View style={styles.footer}>
      <View style={styles.footerRow}>
        {showDiscount ? (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>-{discountPercent}%</Text>
          </View>
        ) : null}
        {showOriginal ? <Text style={styles.originalPrice}>{priceInfo.originalPrice}</Text> : null}
        {priceInfo.purchasable ? (
          <Text style={styles.price}>{priceInfo.price}</Text>
        ) : (
          <Text style={styles.unavailablePrice}>{priceInfo.unavailableLabel}</Text>
        )}
        <PlatformBadgeList platforms={platforms} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  platformOnlyFooter: {
    alignItems: 'flex-end',
  },
});
