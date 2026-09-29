import { StyleSheet, Text, View } from 'react-native';

import { Palette, Radius, Spacing, useType } from '@/constants/DesignSystem';
import type { PriceView } from '@/utils/price';

type PriceTagProps = Readonly<{
  price: PriceView;
  size?: 'regular' | 'large';
}>;

/** The paper shelf tag: an optional green discount stub, then the price in dark ink. */
export function PriceTag({ price, size = 'regular' }: PriceTagProps) {
  const type = useType();
  const priceType = type(size === 'large' ? 'priceLarge' : 'price');
  return (
    <View style={styles.tag}>
      {price.discount ? (
        <View style={styles.stub}>
          <Text style={[type('label'), styles.stubText]}>{price.discount}</Text>
        </View>
      ) : null}
      <Text style={[priceType, styles.price, size === 'large' && styles.priceLarge]}>{price.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    flexDirection: 'row',
    alignItems: 'stretch',
    alignSelf: 'flex-start',
    borderRadius: Radius.sm,
    overflow: 'hidden',
    backgroundColor: Palette.tag,
  },
  stub: {
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
    backgroundColor: Palette.sale,
  },
  stubText: {
    color: Palette.onSale,
    fontVariant: ['tabular-nums'],
  },
  price: {
    color: Palette.onTag,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
  },
  priceLarge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
});
