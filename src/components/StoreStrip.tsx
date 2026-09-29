import { memo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { CoverCard } from '@/components/CoverCard';
import { StoreLogo } from '@/components/StoreLogo';
import { Palette, Size, Spacing, useType } from '@/constants/DesignSystem';
import { useT } from '@/i18n';
import type { Game } from '@/services/gameData';

const renderStripCard = ({ item }: { item: Game }) => <CoverCard game={item} width={Size.stripCard} />;

/** One store's discounted games as a horizontal row of covers. */
export const StoreStrip = memo(function StoreStrip({ platform, games }: Readonly<{ platform: string; games: readonly Game[] }>) {
  const t = useT();
  const type = useType();
  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <StoreLogo platform={platform} size={Size.logoLarge} color={Palette.text} />
        <Text style={[type('heading'), styles.headingText]}>{t('home.onSale')}</Text>
      </View>
      <FlatList
        horizontal
        data={games}
        renderItem={renderStripCard}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
        initialNumToRender={3}
        maxToRenderPerBatch={4}
        windowSize={3}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  section: {
    gap: Spacing.md,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  headingText: {
    color: Palette.text,
  },
  strip: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
});
