import { Globe, Info, MapPin, X } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View, Pressable, Modal, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ScreenHeader';
import { Font, Palette, Radius, Spacing, Typography } from '@/constants/DesignSystem';
import { SUPPORTED_COUNTRIES, getAppCountry, setAppCountry, type CountryCode } from '@/services/country';
import { t } from '@/i18n';
import { LANGUAGES, isLanguageCode } from '@/i18n/languages';
import { getLanguage, setLanguage } from '@/i18n/languageStore';
import { applyLayoutDirection } from '@/i18n/rtl';

const LANGUAGE_ITEMS = LANGUAGES.map((language) => ({ code: language.code, name: language.nativeName }));
const COUNTRY_ITEMS = SUPPORTED_COUNTRIES.map((country) => ({ code: country.code, name: t(`country.${country.code}`) }));

type PickerItem = Readonly<{ code: string; name: string }>;
type PickerKind = 'language' | 'country';

const PICKER_TITLES: Record<PickerKind, string> = {
  language: 'Dil Seçin',
  country: 'Ülke Seçin',
};

function findCountryCode(code: string): CountryCode | undefined {
  return SUPPORTED_COUNTRIES.find((country) => country.code === code)?.code;
}

export default function SettingsScreen() {
  const [picker, setPicker] = useState<PickerKind | null>(null);
  const [selectedLang, setSelectedLang] = useState<string>(() => getLanguage());
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(() => getAppCountry());
  const [settingHint, setSettingHint] = useState('');

  const currentLangName = LANGUAGE_ITEMS.find((l) => l.code === selectedLang)?.name || 'Türkçe';
  const currentCountryName =
    COUNTRY_ITEMS.find((c) => c.code === selectedCountry)?.name ?? 'Türkiye';

  const pickerItems: readonly PickerItem[] =
    picker === 'country' ? COUNTRY_ITEMS : LANGUAGE_ITEMS;
  const pickerSelectedCode = picker === 'country' ? selectedCountry : selectedLang;

  const handlePickerPress = useCallback(
    async (code: string) => {
      if (picker === 'country') {
        const country = findCountryCode(code);
        if (!country) return;
        setSelectedCountry(country);
        await setAppCountry(country);
        setSettingHint('Ülke kaydedildi. Yeni aramalar bu bölgenin fiyatlarıyla yapılacak.');
      } else {
        if (!isLanguageCode(code)) return;
        setSelectedLang(code);
        await setLanguage(code);
        applyLayoutDirection(code);
        setSettingHint('Dil kaydedildi. Yeni aramalar bu dilde yapılacak.');
      }
      setPicker(null);
    },
    [picker],
  );

  const renderPickerItem = useCallback(
    (info: { item: PickerItem }) => (
      <Pressable style={styles.langItem} onPress={() => void handlePickerPress(info.item.code)}>
        <Text
          style={[styles.langItemText, info.item.code === pickerSelectedCode && styles.langItemTextActive]}
        >
          {info.item.name}
        </Text>
      </Pressable>
    ),
    [pickerSelectedCode, handlePickerPress],
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />

      <ScreenHeader title="Ayarlar" align="center" />

      <View style={styles.content}>
        <Pressable
          style={styles.settingRow}
          onPress={() => {
            setPicker('language');
          }}
        >
          <View style={styles.settingRowLeft}>
            <Globe size={24} color={Palette.textSecondary} />
            <View>
              <Text style={styles.settingLabel}>Mağaza dili</Text>
              <Text style={styles.settingHint}>Steam ve bölgesel mağaza içerikleri</Text>
            </View>
          </View>
          <Text style={styles.settingValue}>{currentLangName}</Text>
        </Pressable>

        <Pressable
          style={styles.settingRow}
          onPress={() => {
            setPicker('country');
          }}
        >
          <View style={styles.settingRowLeft}>
            <MapPin size={24} color={Palette.textSecondary} />
            <View style={styles.settingTextBlock}>
              <Text style={styles.settingLabel}>Mağaza ülkesi</Text>
              <Text style={styles.settingHint}>
                Fiyatlar bu bölgenin mağazalarından gelir. Nintendo her zaman ABD eShop.
              </Text>
            </View>
          </View>
          <Text style={styles.settingValue}>{currentCountryName}</Text>
        </Pressable>

        {settingHint ? <Text style={styles.localeHint}>{settingHint}</Text> : null}

        <View style={styles.footer}>
          <Text style={styles.disclaimerText}>
            GSale bağımsız bir uygulamadır; hiçbir mağaza veya platform sahibiyle bağlantılı
            değildir. Adı geçen markalar ve oyun görselleri sahiplerine aittir. Fiyatlar
            mağazalardan alınır ve TL&apos;ye yaklaşık kurla çevrilir; satın alma her zaman resmi
            mağazada yapılır.
          </Text>
          <View style={styles.versionRow}>
            <Info size={14} color={Palette.textTertiary} />
            <Text style={styles.footerText}>GSale v1.0.0</Text>
          </View>
        </View>
      </View>

      <Modal visible={picker !== null} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{picker ? PICKER_TITLES[picker] : ''}</Text>
              <Pressable
                onPress={() => {
                  setPicker(null);
                }}
                hitSlop={10}
                accessibilityLabel="Kapat"
                accessibilityRole="button"
              >
                <X size={24} color={Palette.text} />
              </Pressable>
            </View>
            <FlatList
              data={pickerItems}
              keyExtractor={(item) => item.code}
              renderItem={renderPickerItem}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.langList}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Palette.surface,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    gap: Spacing.md,
  },
  settingRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  settingLabel: {
    fontSize: Typography.body.fontSize,
    fontFamily: Typography.body.fontFamily,
    color: Palette.text,
  },
  settingHint: {
    fontSize: Typography.caption.fontSize,
    fontFamily: Typography.caption.fontFamily,
    color: Palette.textTertiary,
    marginTop: Spacing.xs,
  },
  settingValue: {
    fontSize: Typography.body.fontSize,
    fontFamily: Font.bodyMedium,
    color: Palette.accent,
  },
  localeHint: {
    fontSize: Typography.caption.fontSize,
    fontFamily: Typography.caption.fontFamily,
    color: Palette.textSecondary,
    paddingHorizontal: Spacing.xs,
  },
  settingTextBlock: {
    flex: 1,
  },
  footer: {
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 'auto',
    marginBottom: Spacing.xl,
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  disclaimerText: {
    fontSize: Typography.caption.fontSize,
    fontFamily: Typography.caption.fontFamily,
    color: Palette.textTertiary,
    textAlign: 'center',
    paddingHorizontal: Spacing.xs,
  },
  footerText: {
    fontSize: Typography.caption.fontSize,
    fontFamily: Typography.caption.fontFamily,
    color: Palette.textTertiary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Palette.overlayMedium,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Palette.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  modalTitle: {
    fontSize: Typography.h2.fontSize,
    fontFamily: Typography.h2.fontFamily,
    color: Palette.text,
  },
  langList: {
    paddingBottom: Spacing.xl * 2,
  },
  langItem: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  langItemText: {
    fontSize: Typography.body.fontSize,
    fontFamily: Typography.body.fontFamily,
    color: Palette.textSecondary,
  },
  langItemTextActive: {
    color: Palette.text,
    fontFamily: Typography.h2.fontFamily,
  },
});
