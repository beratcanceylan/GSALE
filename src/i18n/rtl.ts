import { I18nManager } from 'react-native';

import { isRtl, type LanguageCode } from '@/i18n/languages';

/**
 * Sets the native layout direction for `language`. React Native only applies a new
 * direction after a restart, so this returns true when the running layout differs.
 */
export function applyLayoutDirection(language: LanguageCode): boolean {
  const rtl = isRtl(language);
  I18nManager.allowRTL(rtl);
  I18nManager.forceRTL(rtl);
  return I18nManager.isRTL !== rtl;
}
