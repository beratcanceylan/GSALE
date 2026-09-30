import { Alert } from 'react-native';

import { t } from '@/i18n';
import { loadLanguage } from '@/i18n/languageStore';
import { applyLayoutDirection } from '@/i18n/rtl';

/** Loads the saved (or device) language; a layout-direction change only applies after a restart, so say so. */
export async function loadAppLanguage(): Promise<void> {
  const language = await loadLanguage();
  if (applyLayoutDirection(language)) {
    Alert.alert(t('settings.restartTitle'), t('settings.restartBody'));
  }
}
