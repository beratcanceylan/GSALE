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
  /**
   * `frame`: a fixed-ratio box (grids line up) showing the whole image inside it.
   * `natural`: the box takes the loaded image's own ratio, so nothing is cut or boxed.
   */
  fit?: 'frame' | 'natural';
}>;

/** Keeps extreme store art (tall posters, thin banners) from taking over the screen. */
const MIN_RATIO = 0.75;
const MAX_RATIO = 2.4;

function clampRatio(width: number, height: number): number | null {
  if (!(width > 0) || !(height > 0)) return null;
  return Math.min(MAX_RATIO, Math.max(MIN_RATIO, width / height));
}

function recyclingKeyFor(source: ImageSource, title: string): string {
  return typeof source === 'object' && 'uri' in source && source.uri ? source.uri : title;
}

/** Cover art that falls back through `sources`, then to the title's initial on a plain surface. */
export function CoverImage({
  sources,
  title,
  aspectRatio = Aspect.cover,
  flush = false,
  decorative = false,
  fit = 'frame',
}: CoverImageProps) {
  const type = useType();
  const [sourceIndex, setSourceIndex] = useState(0);
  const [naturalRatio, setNaturalRatio] = useState<number | null>(null);
  const current = sources[sourceIndex];
  const ratio = fit === 'natural' ? naturalRatio ?? aspectRatio : aspectRatio;

  return (
    <View style={[styles.frame, flush ? styles.flush : styles.rounded, { aspectRatio: ratio }]}>
      {current ? (
        <Image
          source={current}
          style={styles.fill}
          contentFit="contain"
          cachePolicy="disk"
          recyclingKey={recyclingKeyFor(current, title)}
          accessible={!decorative}
          {...(decorative ? {} : { accessibilityLabel: t('detail.cover', { title }) })}
          onError={() => { setSourceIndex((index) => index + 1); }}
          {...(fit === 'natural'
            ? { onLoad: (event: { source: { width: number; height: number } }) => { setNaturalRatio(clampRatio(event.source.width, event.source.height)); } }
            : {})}
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
    position: 'absolute',
    top: 0,
    start: 0,
    end: 0,
    bottom: 0,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    color: Palette.textFaint,
  },
});
