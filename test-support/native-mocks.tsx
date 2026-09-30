/**
 * Lightweight stand-ins for React Native, Expo and icon modules so screens and
 * components render under `bun test` with react-test-renderer. Import this file
 * before dynamically importing any UI module.
 */
import { mock } from 'bun:test';

import { FlatList, Modal, Pressable, ScrollView, Stack, Tabs } from './native-mock-components';

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
  alerts: [] as unknown[][],
};

export function resetNativeState(): void {
  nativeState.platform = 'ios';
  nativeState.openedUrls = [];
  nativeState.params = {};
  nativeState.router.pushed = [];
  nativeState.router.back = 0;
  nativeState.splashShouldFail = false;
  nativeState.rtl = { isRTL: false, allowed: false, forced: false };
  nativeState.alerts = [];
}

mock.module('react-native', () => ({
  View: 'View',
  Text: 'Text',
  TextInput: 'TextInput',
  ActivityIndicator: 'ActivityIndicator',
  RefreshControl: 'RefreshControl',
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
  Alert: {
    alert: (...args: unknown[]) => {
      nativeState.alerts.push(args);
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
  'AlertCircle', 'ArrowLeft', 'Bell', 'Check', 'ChevronRight', 'ExternalLink', 'Gamepad2', 'Gift',
  'Globe', 'Heart', 'Home', 'Info', 'MapPin', 'Search', 'Settings', 'X',
];
mock.module('lucide-react-native', () => Object.fromEntries(ICONS.map((name) => [name, name])));

mock.module('expo-image', () => ({ Image: 'Image' }));
/** In-memory secure store; tests that need to inspect writes mock it again after this import. */
const secureStoreValues = new Map<string, string>();
mock.module('expo-secure-store', () => ({
  getItemAsync: (key: string) => Promise.resolve(secureStoreValues.get(key) ?? null),
  setItemAsync: (key: string, value: string) => {
    secureStoreValues.set(key, value);
    return Promise.resolve();
  },
}));
mock.module('expo-status-bar', () => ({ StatusBar: 'StatusBar' }));
mock.module('react-native-svg', () => ({
  default: 'Svg',
  Defs: 'Defs',
  LinearGradient: 'LinearGradient',
  Rect: 'Rect',
  Stop: 'Stop',
  Path: 'Path',
}));
mock.module('react-native-reanimated', () => ({
  default: { View: 'AnimatedView' },
  FadeIn: { duration: () => 'fade-in' },
  LinearTransition: { duration: () => 'linear-transition' },
}));
mock.module('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
  useSafeAreaInsets: () => nativeState.insets,
}));
mock.module('expo-splash-screen', () => ({
  preventAutoHideAsync: async () => undefined,
  hideAsync: async () => {
    nativeState.splashHidden += 1;
    if (nativeState.splashShouldFail) throw new Error('splash already hidden');
  },
}));
mock.module('expo-router', () => ({
  Tabs,
  Stack,
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
  ThemeProvider: 'ThemeProvider',
}));
mock.module('expo-router/entry', () => ({}));
