import { Tabs } from 'expo-router';
import { StyleSheet, type ColorValue } from 'react-native';
import { Home, Heart, Gift, Settings } from 'lucide-react-native';

import { Palette, Spacing, Typography } from '@/constants/DesignSystem';
import { favoritesStore } from '@/services/screenData/favoritesStore';
import { freeGamesStore } from '@/services/screenData/freeGamesStore';
import { homeStore } from '@/services/screenData/homeStore';

type TabIconProps = Readonly<{ color: ColorValue; size: number }>;

function HomeTabIcon({ color, size }: TabIconProps) {
  return <Home size={size} color={color} />;
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
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: Palette.accent,
        tabBarInactiveTintColor: Palette.textTertiary,
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
        animation: 'shift',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Anasayfa',
          tabBarIcon: HomeTabIcon,
        }}
        listeners={tabScreenListeners.index}
      />
      <Tabs.Screen
        name="search"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: 'Favoriler',
          tabBarIcon: FavoritesTabIcon,
        }}
        listeners={tabScreenListeners.favorites}
      />
      <Tabs.Screen
        name="free"
        options={{
          title: 'Bedava',
          tabBarIcon: FreeTabIcon,
        }}
        listeners={tabScreenListeners.free}
      />
      <Tabs.Screen name="settings"
        options={{
          title: 'Ayarlar',
          tabBarIcon: SettingsTabIcon,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Palette.backgroundElevated,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xs,
    height: 64,
  },
  tabLabel: {
    fontSize: Typography.micro.fontSize,
    fontFamily: Typography.micro.fontFamily,
    marginTop: 2,
  },
  tabItem: {
    paddingVertical: Spacing.xs,
  },
});
