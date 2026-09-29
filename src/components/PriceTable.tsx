import { ExternalLink } from 'lucide-react-native';
import { I18nManager, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { PriceTag } from '@/components/PriceTag';
import { StoreLogo } from '@/components/StoreLogo';
import { Palette, Size, Spacing, useType } from '@/constants/DesignSystem';
import { useT } from '@/i18n';
import type { Deal } from '@/services/deal';
import { isSafeExternalUrl } from '@/utils/gameDisplay';
import { cheapestDeal, priceView, type PriceView } from '@/utils/price';

type PriceTableProps = Readonly<{
  deals: readonly Deal[];
  /** Stores that sell another edition but not this one. */
  missingStores: readonly string[];
}>;

function StoreName({ platform }: Readonly<{ platform: string }>) {
  const type = useType();
  return (
    <View style={styles.store}>
      <StoreLogo platform={platform} size={Size.logoLarge} color={Palette.text} />
      <Text style={[type('heading'), styles.storeName]} numberOfLines={1}>{platform}</Text>
    </View>
  );
}

function PlainPrice({ price }: Readonly<{ price: PriceView }>) {
  const type = useType();
  return (
    <View style={styles.plainPrice}>
      {price.discount ? <Text style={[type('label'), styles.discount]}>{price.discount}</Text> : null}
      <Text style={[type('price'), styles.priceText]}>{price.text}</Text>
    </View>
  );
}

function DealRow({ deal, lowest }: Readonly<{ deal: Deal; lowest: boolean }>) {
  const t = useT();
  const type = useType();
  const price = priceView(deal);
  const openable = isSafeExternalUrl(deal.url);

  return (
    <Pressable
      testID={`price-row-${deal.platform}`}
      onPress={() => {
        if (openable) void Linking.openURL(deal.url);
      }}
      disabled={!openable}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole="link"
      accessibilityLabel={t('detail.openStore', { store: deal.platform })}
    >
      <StoreName platform={deal.platform} />
      <View style={styles.priceColumn}>
        {price && lowest ? <PriceTag price={price} /> : null}
        {price && !lowest ? <PlainPrice price={price} /> : null}
        {price?.original ? <Text style={[type('caption'), styles.original]}>{price.original}</Text> : null}
        {lowest ? <Text style={[type('caption'), styles.lowest]}>{t('detail.lowest')}</Text> : null}
      </View>
      {openable ? (
        <ExternalLink
          size={Size.iconSmall}
          color={Palette.textMuted}
          style={I18nManager.isRTL ? styles.mirrored : undefined}
        />
      ) : null}
    </Pressable>
  );
}

function MissingRow({ platform }: Readonly<{ platform: string }>) {
  const t = useT();
  const type = useType();
  return (
    <View testID={`price-row-${platform}`} style={[styles.row, styles.missing]}>
      <StoreName platform={platform} />
      <Text style={[type('caption'), styles.missingText]}>{t('detail.notSoldHere')}</Text>
    </View>
  );
}

/** One row per store for the selected edition, cheapest first; the lowest wears the price tag. */
export function PriceTable({ deals, missingStores }: PriceTableProps) {
  const t = useT();
  const type = useType();
  const lowest = cheapestDeal(deals);
  if (deals.length === 0 && missingStores.length === 0) {
    return <Text style={[type('body'), styles.empty]}>{t('detail.noPrices')}</Text>;
  }
  return (
    <View>
      {deals.length === 0 ? <Text style={[type('body'), styles.empty]}>{t('detail.noPrices')}</Text> : null}
      {deals.map((deal) => <DealRow key={deal.platform} deal={deal} lowest={deal === lowest} />)}
      {missingStores.map((platform) => <MissingRow key={platform} platform={platform} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: Size.touch + Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: Size.hairline,
    borderBottomColor: Palette.line,
  },
  pressed: {
    backgroundColor: Palette.surface,
  },
  store: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  storeName: {
    flexShrink: 1,
    color: Palette.text,
  },
  priceColumn: {
    alignItems: 'flex-end',
    gap: Spacing.xxs,
  },
  plainPrice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  discount: {
    color: Palette.sale,
    fontVariant: ['tabular-nums'],
  },
  priceText: {
    color: Palette.text,
  },
  original: {
    color: Palette.textMuted,
    textDecorationLine: 'line-through',
    fontVariant: ['tabular-nums'],
  },
  lowest: {
    color: Palette.sale,
  },
  missing: {
    opacity: 0.5,
  },
  missingText: {
    color: Palette.textMuted,
  },
  empty: {
    color: Palette.textMuted,
    paddingVertical: Spacing.lg,
  },
  mirrored: {
    transform: [{ scaleX: -1 }],
  },
});
