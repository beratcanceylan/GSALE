import { ArrowLeft, Bell } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Palette, Radius, Spacing, Typography } from '@/constants/DesignSystem';

export default function NotificationsScreen() {
  const { back } = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            back();
          }}
          style={styles.backButton}
          accessibilityLabel="Geri dön"
          accessibilityRole="button"
        >
          <ArrowLeft size={20} color={Palette.text} />
        </Pressable>
        <Text style={styles.title}>Bildirimler</Text>
        <View style={styles.backSpacer} />
      </View>

      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Bell size={40} color={Palette.accent} />
        </View>
        <Text style={styles.emptyTitle}>Yakında</Text>
        <Text style={styles.text}>
          Fiyat düşüşü ve bedava oyun bildirimleri üzerinde çalışıyoruz.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingHorizontal: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backSpacer: {
    width: 40,
  },
  title: {
    fontSize: Typography.h2.fontSize,
    fontFamily: Typography.h2.fontFamily,
    color: Palette.text,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: Radius.full,
    backgroundColor: Palette.accentMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    fontSize: Typography.h2.fontSize,
    fontFamily: Typography.h2.fontFamily,
    color: Palette.text,
  },
  text: {
    color: Palette.textSecondary,
    fontSize: Typography.body.fontSize,
    fontFamily: Typography.body.fontFamily,
    textAlign: 'center',
    lineHeight: Typography.body.lineHeight,
  },
});
