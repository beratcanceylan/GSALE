import type { LucideIcon } from 'lucide-react-native';
import { I18nManager, Pressable, StyleSheet } from 'react-native';

import { Palette, Radius, Size } from '@/constants/DesignSystem';

type IconButtonProps = Readonly<{
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  /** `scrim` sits on cover art; `plain` on the slate ground. */
  tone?: 'plain' | 'scrim';
  /** Arrows and chevrons point the other way in right-to-left layouts. */
  directional?: boolean;
  filled?: boolean;
}>;

export function IconButton({ icon: Icon, label, onPress, tone = 'plain', directional = false, filled = false }: IconButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.button, tone === 'scrim' && styles.scrim, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={Size.hairline}
    >
      <Icon
        size={Size.icon}
        color={Palette.text}
        fill={filled ? Palette.text : 'transparent'}
        style={directional && I18nManager.isRTL ? styles.mirrored : undefined}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: Size.touch,
    height: Size.touch,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
  },
  scrim: {
    backgroundColor: Palette.scrim,
  },
  pressed: {
    opacity: 0.6,
  },
  mirrored: {
    transform: [{ scaleX: -1 }],
  },
});
