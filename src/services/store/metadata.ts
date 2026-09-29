import type { LiveGame } from '@/services/store/types';

export type DetailMetadata = Partial<
  Pick<LiveGame, 'description' | 'release_date' | 'developers' | 'genres' | 'screenshots' | 'videos'>
>;

export function uniqueNonEmpty(values: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const clean = value?.replace(/\s+/g, ' ').trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    result.push(clean);
  }
  return result;
}

export function cleanStoreText(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .replaceAll(/<\s*br\s*\/?>/gi, ' ')
    .replaceAll(/<\/p\s*>/gi, ' ')
    .replaceAll(/<[^<>]*>/g, ' ')
    .replaceAll(/!\[[^[\]]*]\([^()]*\)/g, ' ')
    .replaceAll(/\[[^[\]]*]\([^()]*\)/g, ' ')
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&#160;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeDottedDate(value: string | null | undefined): string {
  const clean = value?.trim() ?? '';
  const match = /^(\d{4})\.(\d{2})\.(\d{2})$/.exec(clean);
  if (!match) return clean;
  return `${match[1]}-${match[2]}-${match[3]}`;
}
