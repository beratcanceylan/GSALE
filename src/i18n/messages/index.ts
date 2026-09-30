import type { LanguageCode } from '@/i18n/languages';
import { ar } from '@/i18n/messages/ar';
import { bg } from '@/i18n/messages/bg';
import { cs } from '@/i18n/messages/cs';
import { da } from '@/i18n/messages/da';
import { de } from '@/i18n/messages/de';
import { el } from '@/i18n/messages/el';
import { en, type Messages } from '@/i18n/messages/en';
import { es } from '@/i18n/messages/es';
import { es419 } from '@/i18n/messages/es-419';
import { fi } from '@/i18n/messages/fi';
import { fr } from '@/i18n/messages/fr';
import { hu } from '@/i18n/messages/hu';
import { id } from '@/i18n/messages/id';
import { it } from '@/i18n/messages/it';
import { ja } from '@/i18n/messages/ja';
import { ko } from '@/i18n/messages/ko';
import { nl } from '@/i18n/messages/nl';
import { no } from '@/i18n/messages/no';
import { pl } from '@/i18n/messages/pl';
import { pt } from '@/i18n/messages/pt';
import { ptBR } from '@/i18n/messages/pt-BR';
import { ro } from '@/i18n/messages/ro';
import { ru } from '@/i18n/messages/ru';
import { sv } from '@/i18n/messages/sv';
import { th } from '@/i18n/messages/th';
import { tr } from '@/i18n/messages/tr';
import { uk } from '@/i18n/messages/uk';
import { vi } from '@/i18n/messages/vi';
import { zhHans } from '@/i18n/messages/zh-Hans';
import { zhHant } from '@/i18n/messages/zh-Hant';

export const CATALOGS: Readonly<Record<LanguageCode, Messages>> = {
  tr,
  en,
  de,
  fr,
  es,
  'es-419': es419,
  pt,
  'pt-BR': ptBR,
  it,
  nl,
  pl,
  ru,
  uk,
  cs,
  hu,
  ro,
  bg,
  el,
  da,
  sv,
  no,
  fi,
  vi,
  id,
  ja,
  ko,
  'zh-Hans': zhHans,
  'zh-Hant': zhHant,
  th,
  ar,
};
