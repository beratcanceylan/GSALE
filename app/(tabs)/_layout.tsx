import { Tabs } from 'expo-router';
import { StyleSheet, type ColorValue } from 'react-native';
import { Gift, Heart, Home, Search, Settings } from '@/components/Icons';

import { Palette, Size, Spacing, useType } from '@/constants/DesignSystem';
import { useT } from '@/i18n';
import { favoritesStore } from '@/services/screenData/favoritesStore';
import { freeGamesStore } from '@/services/screenData/freeGamesStore';
import { homeStore } from '@/services/screenData/homeStore';

type TabIconProps = Readonly<{ color: ColorValue; size: number }>;

function HomeTabIcon({ color, size }: TabIconProps) {
  return <Home size={size} color={color} />;
}

function SearchTabIcon({ color, size }: TabIconProps) {
  return <Search size={size} color={color} />;
}

function FavoritesTabIcon({ color, size }: TabIconProps) {
  return <Heart size={size} color={color} />;
}

function FreeTabIcon({ color, size }: TabIconProps) {
  return <Gift size={size} color={color} />;
}

function SettingsTabIcon({ color, size }: TabIconProps) {
  return <Settings size={size} color={color} />;
}

const tabScreenListeners = {
  index: {
    tabPress: () => {
      homeStore.load(true);
    },
  },
  favorites: {
    tabPress: () => {
      favoritesStore.load();
    },
  },
  free: {
    tabPress: () => {
      freeGamesStore.load(true);
    },
  },
} as const;

export default function TabLayout() {
  const t = useT();
  const type = useType();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: Palette.text,
        tabBarInactiveTintColor: Palette.textFaint,
        tabBarLabelStyle: type('caption'),
        tabBarItemStyle: styles.tabItem,
        sceneStyle: styles.scene,
        animation: 'shift',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: t('tabs.home'), tabBarIcon: HomeTabIcon }}
        listeners={tabScreenListeners.index}
      />
      <Tabs.Screen name="search" options={{ title: t('tabs.search'), tabBarIcon: SearchTabIcon }} />
      <Tabs.Screen
        name="favorites"
        options={{ title: t('tabs.favorites'), tabBarIcon: FavoritesTabIcon }}
        listeners={tabScreenListeners.favorites}
      />
      <Tabs.Screen
        name="free"
        options={{ title: t('tabs.free'), tabBarIcon: FreeTabIcon }}
        listeners={tabScreenListeners.free}
      />
      <Tabs.Screen name="settings" options={{ title: t('tabs.settings'), tabBarIcon: SettingsTabIcon }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Palette.background,
    borderTopWidth: Size.hairline,
    borderTopColor: Palette.line,
    height: Size.tabBar,
  },
  tabItem: {
    paddingVertical: Spacing.xs,
  },
  scene: {
    backgroundColor: Palette.background,
  },
});
