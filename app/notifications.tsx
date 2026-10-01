import { ArrowLeft } from '@/components/Icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { IconButton } from '@/components/IconButton';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Palette, Spacing } from '@/constants/DesignSystem';
import { useT } from '@/i18n';

export default function NotificationsScreen() {
  const t = useT();
  const { back } = useRouter();
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />
      <View style={styles.back}>
        <IconButton icon={ArrowLeft} label={t('common.back')} onPress={() => { back(); }} directional />
      </View>
      <ScreenHeader title={t('notifications.title')} />
      <EmptyState message={t('notifications.empty')} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  back: {
    paddingHorizontal: Spacing.sm,
  },
});
