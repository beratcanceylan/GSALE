import { memo } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { CoverImage } from '@/components/CoverImage';
import { PriceTag } from '@/components/PriceTag';
import { StoreLogoRow } from '@/components/StoreLogo';
import { Palette, Spacing, useType } from '@/constants/DesignSystem';
import { useT } from '@/i18n';
import type { Game } from '@/services/gameData';
import { rememberDetailPreviews } from '@/services/store/detail-preview';
import { getDealPlatforms, getGameImageSources, isSafeExternalUrl } from '@/utils/gameDisplay';
import { cheapestDeal, priceView } from '@/utils/price';

type CoverCardProps = Readonly<{
  game: Game;
  /** Fixed width for horizontal strips; grids size the card by their column. */
  width?: number;
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

/** Cover art with the price tag on its corner, the title and the stores that sell it. */
function CoverCardView({ game, width }: CoverCardProps) {
  useT();
  const type = useType();
  const { push } = useRouter();
  const price = priceView(cheapestDeal(game.deals));

  const open = () => {
    if (game.externalUrl) {
      if (isSafeExternalUrl(game.externalUrl)) void Linking.openURL(game.externalUrl);
      return;
    }
    const platform = game.source_platform || game.platform;
    rememberCardPreview(game);
    push({ pathname: '/game/[id]', params: platform ? { id: game.id, platform } : { id: game.id } });
  };

  return (
    <Pressable
      onPress={open}
      style={({ pressed }) => [styles.card, width === undefined ? styles.fluid : { width }, pressed && styles.pressed]}
      accessibilityRole="link"
      accessibilityLabel={game.title}
    >
      <View>
        <CoverImage sources={getGameImageSources(game)} title={game.title} decorative />
        {price ? (
          <View style={styles.tagSpot}>
            <PriceTag price={price} />
          </View>
        ) : null}
      </View>
      <Text style={[type('heading'), styles.title]} numberOfLines={2}>
        {game.title}
      </Text>
      <View style={styles.meta}>
        <StoreLogoRow platforms={getDealPlatforms(game)} />
        {price?.original ? <Text style={[type('caption'), styles.original]}>{price.original}</Text> : null}
      </View>
    </Pressable>
  );
}

function sameCard(prev: CoverCardProps, next: CoverCardProps): boolean {
  const a = prev.game;
  const b = next.game;
  return (
    prev.width === next.width &&
    a.id === b.id &&
    a.title === b.title &&
    a.imageUrl === b.imageUrl &&
    a.deals === b.deals &&
    a.platforms === b.platforms
  );
}

export const CoverCard = memo(CoverCardView, sameCard);

const styles = StyleSheet.create({
  card: {
    gap: Spacing.sm,
  },
  fluid: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  tagSpot: {
    position: 'absolute',
    start: Spacing.sm,
    bottom: Spacing.sm,
  },
  title: {
    color: Palette.text,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  original: {
    color: Palette.textMuted,
    textDecorationLine: 'line-through',
    fontVariant: ['tabular-nums'],
  },
});
