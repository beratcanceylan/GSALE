/**
 * Lightweight stand-ins for React Native, Expo and icon modules so screens and
 * components render under `bun test` with react-test-renderer. Import this file
 * before dynamically importing any UI module.
 */
import { mock } from 'bun:test';
import React, { type ReactNode } from 'react';

type Props = Record<string, unknown> & { children?: ReactNode };

/** A host element named like the native view, so tests can query by type. */
export function host(name: string) {
  function HostComponent(props: Props) {
    return React.createElement(name, props, props.children);
  }
  HostComponent.displayName = name;
  return HostComponent;
}

function Pressable(props: Props) {
  const { style, children, ...rest } = props;
  const resolvedStyle = typeof style === 'function' ? (style as (s: { pressed: boolean }) => unknown)({ pressed: true }) : style;
  const content = typeof children === 'function' ? (children as (s: { pressed: boolean }) => ReactNode)({ pressed: false }) : children;
  return React.createElement('Pressable', { ...rest, style: resolvedStyle }, content);
}

function Modal(props: Props) {
  return props['visible'] ? React.createElement('Modal', props, props.children) : null;
}

type ListProps = Props & {
  data?: readonly unknown[] | null;
  renderItem?: (info: { item: unknown; index: number }) => ReactNode;
  keyExtractor?: (item: unknown, index: number) => string;
  ListHeaderComponent?: ReactNode;
  ListEmptyComponent?: ReactNode;
  ListFooterComponent?: ReactNode;
  refreshControl?: ReactNode;
};

function FlatList(props: ListProps) {
  const data = props.data ?? [];
  const items = data.map((item, index) =>
    React.createElement(
      React.Fragment,
      { key: props.keyExtractor ? props.keyExtractor(item, index) : String(index) },
      props.renderItem?.({ item, index }),
    ),
  );
  return React.createElement(
    'FlatList',
    { ...props, data: undefined },
    props.ListHeaderComponent,
    items.length > 0 ? items : props.ListEmptyComponent,
    props.ListFooterComponent,
  );
}

function ScrollView(props: ListProps) {
  return React.createElement('ScrollView', props, props.refreshControl, props.children);
}

export const nativeState = {
  platform: 'ios' as 'ios' | 'android',
  insets: { top: 24, bottom: 0, left: 0, right: 0 },
  openedUrls: [] as string[],
  params: {} as Record<string, string | undefined>,
  router: {
    pushed: [] as unknown[],
    back: 0,
  },
  splashHidden: 0,
  splashShouldFail: false,
  rtl: { isRTL: false, allowed: false, forced: false },
};

export function resetNativeState(): void {
  nativeState.platform = 'ios';
  nativeState.openedUrls = [];
  nativeState.params = {};
  nativeState.router.pushed = [];
  nativeState.router.back = 0;
  nativeState.splashShouldFail = false;
  nativeState.rtl = { isRTL: false, allowed: false, forced: false };
}

mock.module('react-native', () => ({
  View: host('View'),
  Text: host('Text'),
  TextInput: host('TextInput'),
  ActivityIndicator: host('ActivityIndicator'),
  RefreshControl: host('RefreshControl'),
  Pressable,
  Modal,
  FlatList,
  ScrollView,
  StyleSheet: {
    create: <T,>(styles: T): T => styles,
    absoluteFill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
    absoluteFillObject: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
    hairlineWidth: 1,
  },
  Platform: {
    get OS() {
      return nativeState.platform;
    },
    select: <T,>(options: { ios?: T; android?: T; default?: T }) =>
      options[nativeState.platform] ?? options.default,
  },
  Linking: {
    openURL: async (url: string) => {
      nativeState.openedUrls.push(url);
    },
  },
  I18nManager: {
    get isRTL() {
      return nativeState.rtl.isRTL;
    },
    allowRTL: (allowed: boolean) => {
      nativeState.rtl.allowed = allowed;
    },
    forceRTL: (forced: boolean) => {
      nativeState.rtl.forced = forced;
    },
  },
}));

const ICONS = [
  'AlertCircle', 'ArrowLeft', 'Bell', 'Building2', 'Calendar', 'ExternalLink', 'Gamepad2', 'Gift',
  'Globe', 'Heart', 'Home', 'Info', 'MapPin', 'PlayCircle', 'Search', 'Settings', 'Star', 'X', 'XCircle',
];
mock.module('lucide-react-native', () => Object.fromEntries(ICONS.map((name) => [name, host(name)])));

mock.module('expo-image', () => ({ Image: host('Image') }));
mock.module('expo-status-bar', () => ({ StatusBar: host('StatusBar') }));
mock.module('react-native-svg', () => ({
  default: host('Svg'),
  Defs: host('Defs'),
  LinearGradient: host('LinearGradient'),
  Rect: host('Rect'),
  Stop: host('Stop'),
}));
mock.module('react-native-reanimated', () => ({
  default: { View: host('AnimatedView') },
  FadeIn: { duration: () => 'fade-in' },
  LinearTransition: { duration: () => 'linear-transition' },
}));
mock.module('react-native-safe-area-context', () => ({
  SafeAreaView: host('SafeAreaView'),
  useSafeAreaInsets: () => nativeState.insets,
}));
mock.module('expo-splash-screen', () => ({
  preventAutoHideAsync: async () => undefined,
  hideAsync: async () => {
    nativeState.splashHidden += 1;
    if (nativeState.splashShouldFail) throw new Error('splash already hidden');
  },
}));
type ScreenElementProps = { name: string; options?: Record<string, unknown>; listeners?: Record<string, () => void> };

/** Render navigator screens and expose listeners so tests can fire tab presses. */
function navigator(name: string) {
  function Navigator(props: Props & { screenOptions?: Record<string, unknown> }) {
    const screens = React.Children.toArray(props.children).filter(React.isValidElement<ScreenElementProps>);
    const rendered = screens.map((screen) => {
      const options = screen.props.options ?? {};
      const icon = options['tabBarIcon'];
      return React.createElement(
        `${name}.Screen`,
        { key: screen.props.name, name: screen.props.name, listeners: screen.props.listeners },
        typeof icon === 'function' ? (icon as (p: object) => ReactNode)({ color: '#fff', size: 24, focused: true }) : null,
      );
    });
    return React.createElement(name, { screenOptions: props.screenOptions }, rendered);
  }
  Navigator.Screen = host(`${name}.Screen`);
  return Navigator;
}

mock.module('expo-router', () => ({
  Tabs: navigator('Tabs'),
  Stack: navigator('Stack'),
  useRouter: () => ({
    push: (route: unknown) => {
      nativeState.router.pushed.push(route);
    },
    back: () => {
      nativeState.router.back += 1;
    },
  }),
  useLocalSearchParams: () => nativeState.params,
}));
mock.module('expo-router/react-navigation', () => ({
  DarkTheme: { dark: true },
  ThemeProvider: host('ThemeProvider'),
}));
mock.module('expo-router/entry', () => ({}));
