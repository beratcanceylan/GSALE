import type { ComponentType } from 'react';
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Palette, Size } from '@/constants/DesignSystem';

export type AppIconProps = Readonly<{
  size?: number;
  color?: ColorValue;
  fill?: string;
  style?: StyleProp<ViewStyle> | undefined;
}>;
export type AppIcon = ComponentType<AppIconProps>;

/** Local interface glyphs, drawn on the same grid and kept separate from store marks. */
function Glyph({ path, size = Size.icon, color = Palette.text, fill = 'none', style }: AppIconProps & { path: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style} accessible={false}>
      <Path d={path} stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" fill={fill === 'transparent' ? 'none' : fill} />
    </Svg>
  );
}

export function ArrowLeft(props: AppIconProps) {
  return <Glyph {...props} path="M19 12H5 M11 5l-7 7 7 7" />;
}

export function ChevronRight(props: AppIconProps) {
  return <Glyph {...props} path="m9 5 7 7-7 7" />;
}

export function Heart(props: AppIconProps) {
  return <Glyph {...props} path="M12 21 3.5 12.5C-2 7 5 0 12 7c7-7 14 0 8.5 5.5Z" />;
}

export function Home(props: AppIconProps) {
  return <Glyph {...props} path="m3 10 9-7 9 7v11h-6v-7H9v7H3Z" />;
}

export function Search(props: AppIconProps) {
  return <Glyph {...props} path="M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14 M15 15l6 6" />;
}

export function X(props: AppIconProps) {
  return <Glyph {...props} path="m5 5 14 14 M19 5 5 19" />;
}

export function Check(props: AppIconProps) {
  return <Glyph {...props} path="m4 12 5 5L20 6" />;
}

export function ExternalLink(props: AppIconProps) {
  return <Glyph {...props} path="M14 3h7v7 M21 3 10 14 M11 3H3v18h18v-8" />;
}

export function Bell(props: AppIconProps) {
  return <Glyph {...props} path="M4 17h16l-2-3V9a6 6 0 0 0-12 0v5Z M9 21h6" />;
}

export function Gift(props: AppIconProps) {
  return <Glyph {...props} path="M3 8h18v4H3Z M5 12v9h14v-9 M12 8v13 M12 8C2 8 5 0 9 4Zm0 0c10 0 7-8 3-4Z" />;
}

export function Settings(props: AppIconProps) {
  return <Glyph {...props} path="M4 5h16 M4 12h16 M4 19h16 M8 3v4 M16 10v4 M10 17v4" />;
}
