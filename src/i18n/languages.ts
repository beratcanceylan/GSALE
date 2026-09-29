/**
 * App languages: the union of the store languages (Steam's list). `font: 'plex'`
 * means IBM Plex Sans covers the script (Latin, Cyrillic, Greek, Vietnamese);
 * 'system' uses the platform font.
 */
export const LANGUAGES = [
  { code: 'tr', nativeName: 'Türkçe', font: 'plex' },
  { code: 'en', nativeName: 'English', font: 'plex' },
  { code: 'de', nativeName: 'Deutsch', font: 'plex' },
  { code: 'fr', nativeName: 'Français', font: 'plex' },
  { code: 'es', nativeName: 'Español (España)', font: 'plex' },
  { code: 'es-419', nativeName: 'Español (Latinoamérica)', font: 'plex' },
  { code: 'pt', nativeName: 'Português (Portugal)', font: 'plex' },
  { code: 'pt-BR', nativeName: 'Português (Brasil)', font: 'plex' },
  { code: 'it', nativeName: 'Italiano', font: 'plex' },
  { code: 'nl', nativeName: 'Nederlands', font: 'plex' },
  { code: 'pl', nativeName: 'Polski', font: 'plex' },
  { code: 'ru', nativeName: 'Русский', font: 'plex' },
  { code: 'uk', nativeName: 'Українська', font: 'plex' },
  { code: 'cs', nativeName: 'Čeština', font: 'plex' },
  { code: 'hu', nativeName: 'Magyar', font: 'plex' },
  { code: 'ro', nativeName: 'Română', font: 'plex' },
  { code: 'bg', nativeName: 'Български', font: 'plex' },
  { code: 'el', nativeName: 'Ελληνικά', font: 'plex' },
  { code: 'da', nativeName: 'Dansk', font: 'plex' },
  { code: 'sv', nativeName: 'Svenska', font: 'plex' },
  { code: 'no', nativeName: 'Norsk', font: 'plex' },
  { code: 'fi', nativeName: 'Suomi', font: 'plex' },
  { code: 'vi', nativeName: 'Tiếng Việt', font: 'plex' },
  { code: 'id', nativeName: 'Bahasa Indonesia', font: 'plex' },
  { code: 'ja', nativeName: '日本語', font: 'system' },
  { code: 'ko', nativeName: '한국어', font: 'system' },
  { code: 'zh-Hans', nativeName: '简体中文', font: 'system' },
  { code: 'zh-Hant', nativeName: '繁體中文', font: 'system' },
  { code: 'th', nativeName: 'ไทย', font: 'system' },
  { code: 'ar', nativeName: 'العربية', font: 'system' },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

const CODES = new Set<string>(LANGUAGES.map((language) => language.code));
const RTL_LANGUAGES = new Set<LanguageCode>(['ar']);
const SYSTEM_FONT = new Set<LanguageCode>(LANGUAGES.flatMap((language) => (language.font === 'system' ? [language.code] : [])));

export function isLanguageCode(value: string | null | undefined): value is LanguageCode {
  return typeof value === 'string' && CODES.has(value);
}

export function isRtl(code: LanguageCode): boolean {
  return RTL_LANGUAGES.has(code);
}

export function usesSystemFont(code: LanguageCode): boolean {
  return SYSTEM_FONT.has(code);
}

const TRADITIONAL_CHINESE_REGIONS = new Set(['tw', 'hk', 'mo']);
const LATIN_AMERICAN_SPANISH = new Set(['419', 'mx', 'ar', 'co', 'cl', 'pe', 've', 'uy', 'py', 'bo', 'ec', 'cr', 'gt', 'hn', 'ni', 'pa', 'sv', 'do', 'pr', 'cu', 'us']);

function regionalLanguage(primary: string, parts: readonly string[]): LanguageCode | null {
  const rest = parts.slice(1);
  if (primary === 'zh') {
    if (rest.includes('hant') || rest.some((part) => TRADITIONAL_CHINESE_REGIONS.has(part))) return 'zh-Hant';
    return 'zh-Hans';
  }
  if (primary === 'es') return rest.some((part) => LATIN_AMERICAN_SPANISH.has(part)) ? 'es-419' : 'es';
  if (primary === 'pt') return rest.includes('br') ? 'pt-BR' : 'pt';
  if (primary === 'nb' || primary === 'nn') return 'no';
  return null;
}

/** Best supported language for a BCP-47 tag (e.g. "es-MX" → "es-419"), or null. */
export function matchLanguage(tag: string | null | undefined): LanguageCode | null {
  const parts = (tag ?? '').toLowerCase().split(/[-_]/).filter(Boolean);
  const primary = parts[0];
  if (!primary) return null;
  const regional = regionalLanguage(primary, parts);
  if (regional) return regional;
  return isLanguageCode(primary) ? primary : null;
}
