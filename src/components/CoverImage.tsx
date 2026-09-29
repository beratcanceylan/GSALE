import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image, type ImageSource } from 'expo-image';

import { Aspect, Palette, Radius, useType } from '@/constants/DesignSystem';
import { t } from '@/i18n';
import { getTitleInitial } from '@/utils/gameDisplay';

type CoverImageProps = Readonly<{
  sources: ImageSource[];
  title: string;
  aspectRatio?: number;
  /** Square corners for edge-to-edge heroes. */
  flush?: boolean;
  /** Inside a labelled link the image needs no label of its own. */
  decorative?: boolean;
}>;

function recyclingKeyFor(source: ImageSource, title: string): string {
  return typeof source === 'object' && 'uri' in source && source.uri ? source.uri : title;
}

/** Cover art that falls back through `sources`, then to the title's initial on a plain surface. */
export function CoverImage({ sources, title, aspectRatio = Aspect.cover, flush = false, decorative = false }: CoverImageProps) {
  const type = useType();
  const [sourceIndex, setSourceIndex] = useState(0);
  const current = sources[sourceIndex];

  return (
    <View style={[styles.frame, flush ? styles.flush : styles.rounded, { aspectRatio }]}>
      {current ? (
        <Image
          source={current}
          style={styles.fill}
          contentFit="cover"
          cachePolicy="disk"
          recyclingKey={recyclingKeyFor(current, title)}
          accessible={!decorative}
          {...(decorative ? {} : { accessibilityLabel: t('detail.cover', { title }) })}
          onError={() => { setSourceIndex((index) => index + 1); }}
        />
      ) : (
        <View style={[styles.fill, styles.placeholder]}>
          <Text style={[type('display'), styles.initial]}>{getTitleInitial(title)}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: Palette.surface,
  },
  rounded: {
    borderRadius: Radius.md,
  },
  flush: {
    borderRadius: Radius.none,
  },
  fill: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    color: Palette.textFaint,
  },
});
