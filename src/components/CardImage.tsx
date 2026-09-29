import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image, type ImageSource } from 'expo-image';
import { Gamepad2 } from 'lucide-react-native';

import { Palette, Radius, Spacing, Typography } from '@/constants/DesignSystem';
import { getTitleInitial } from '@/utils/gameDisplay';

type CardImageProps = Readonly<{
  sources: ImageSource[];
  title: string;
  aspectRatio: number;
  upcomingDate?: string | undefined;
}>;

function recyclingKeyFor(source: ImageSource, title: string): string {
  return typeof source === 'object' && 'uri' in source && source.uri ? source.uri : title;
}

/** Cover image that falls back through `sources`, then to a placeholder with the title initial. */
export function CardImage({ sources, title, aspectRatio, upcomingDate }: CardImageProps) {
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
          recyclingKey={recyclingKeyFor(currentSource, title)}
          accessibilityLabel={`${title} kapak görseli`}
          onError={handleImageError}
        />
      ) : (
        <View style={[styles.image, styles.placeholderImage]}>
          <Gamepad2 size={32} color={Palette.textTertiary} />
          <Text style={styles.placeholderText}>{getTitleInitial(title)}</Text>
        </View>
      )}
      {upcomingDate ? (
        <View style={styles.upcomingBadge}>
          <Text style={styles.upcomingText}>{upcomingDate}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
});
