import { Bell } from '@/components/Icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState, useSyncExternalStore } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { IconButton } from '@/components/IconButton';
import { OptionPicker } from '@/components/OptionPicker';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SettingsRow } from '@/components/SettingsRow';
import { Palette, Size, Spacing, useType } from '@/constants/DesignSystem';
import { useScrollSafeAreaStyle } from '@/hooks/useScrollSafeAreaStyle';
import { useT } from '@/i18n';
import { LANGUAGES, type LanguageCode } from '@/i18n/languages';
import { languageStore, setLanguage } from '@/i18n/languageStore';
import { applyLayoutDirection } from '@/i18n/rtl';
import { SUPPORTED_COUNTRIES, countryStore, setAppCountry, type CountryCode } from '@/services/country';

const APP_VERSION = '1.0.0';

type Picker = 'language' | 'country' | null;

export default function SettingsScreen() {
  const t = useT();
  const type = useType();
  const { push } = useRouter();
  const containerStyle = useScrollSafeAreaStyle();
  const [picker, setPicker] = useState<Picker>(null);
  const language = useSyncExternalStore(languageStore.subscribe, languageStore.getSnapshot);
  const country = useSyncExternalStore(countryStore.subscribe, countryStore.getSnapshot);

  const languageName = LANGUAGES.find((option) => option.code === language)?.nativeName ?? language;
  const countryName = t(`country.${country}`);

  const chooseLanguage = async (code: LanguageCode) => {
    setPicker(null);
    try {
      await setLanguage(code);
    } catch {
      // The switch already happened for this session; only saving it failed.
    }
    if (applyLayoutDirection(code)) {
      Alert.alert(t('settings.restartTitle'), t('settings.restartBody'));
    }
  };

  const chooseCountry = async (code: CountryCode) => {
    setPicker(null);
    await setAppCountry(code);
  };

  const bell = useMemo(
    () => <IconButton icon={Bell} label={t('notifications.title')} onPress={() => { push('/notifications'); }} />,
    [push, t],
  );

  return (
    <View style={[styles.container, containerStyle]}>
      <StatusBar style="light" />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.scroll}>
        <ScreenHeader title={t('settings.title')} trailing={bell} />
        <View style={styles.group}>
          <SettingsRow label={t('settings.language')} value={languageName} onPress={() => { setPicker('language'); }} />
          <SettingsRow
            label={t('settings.country')}
            value={countryName}
            hint={t('settings.countryHint')}
            onPress={() => { setPicker('country'); }}
          />
        </View>
        <View style={styles.about}>
          <Text style={[type('heading'), styles.text]} accessibilityRole="header">{t('settings.about')}</Text>
          <Text style={[type('body'), styles.muted]}>{t('settings.disclaimer')}</Text>
          <Text style={[type('caption'), styles.muted]}>{t('settings.version', { version: APP_VERSION })}</Text>
        </View>
      </ScrollView>

      {picker === 'language' ? (
        <OptionPicker
          title={t('settings.language')}
          searchPlaceholder={t('settings.searchLanguages')}
          options={LANGUAGES.map((option) => ({ value: option.code, label: option.nativeName }))}
          selected={language}
          onSelect={(code) => { void chooseLanguage(code); }}
          onClose={() => { setPicker(null); }}
        />
      ) : null}
      {picker === 'country' ? (
        <OptionPicker
          title={t('settings.country')}
          searchPlaceholder={t('settings.searchCountries')}
          options={SUPPORTED_COUNTRIES.map((option) => ({ value: option.code, label: t(`country.${option.code}`), detail: option.code }))}
          selected={country}
          onSelect={(code) => { void chooseCountry(code); }}
          onClose={() => { setPicker(null); }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  scroll: {
    paddingBottom: Spacing.xxl,
  },
  group: {
    borderTopWidth: Size.hairline,
    borderTopColor: Palette.line,
  },
  about: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl,
  },
  text: {
    color: Palette.text,
  },
  muted: {
    color: Palette.textMuted,
  },
});
