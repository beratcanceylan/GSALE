import { foldTurkishI } from '@/services/store/text';

export type EditionKey =
  | 'base'
  | 'deluxe'
  | 'ultimate'
  | 'gold'
  | 'goty'
  | 'complete'
  | 'definitive'
  | 'premium'
  | 'collector'
  | 'special'
  | 'anniversary'
  | 'directors-cut'
  | 'enhanced'
  | 'legendary'
  | 'champion'
  | 'vault'
  | 'cross-gen';

export const EDITION_ORDER: readonly EditionKey[] = [
  'base', 'enhanced', 'deluxe', 'gold', 'premium', 'ultimate', 'champion', 'vault', 'legendary',
  'complete', 'definitive', 'goty', 'directors-cut', 'anniversary', 'special', 'collector', 'cross-gen',
];

type Token = Readonly<{ word: string; start: number }>;

/** "Edition" in the store languages we support (accents stripped, Turkish i folded). */
const EDITION_WORDS = new Set([
  'edition', 'edicion', 'edicao', 'edizione', 'wydanie', 'издание', 'editie', 'utgava', 'udgave',
  'utgave', 'painos', 'kiadas', 'editia', 'εκδοση', 'surum', 'surumu', 'bundle', 'paket', 'paketi',
]);

/**
 * Edition names per key, as word sequences. `paired` names only count next to an
 * edition word ("Gold Edition", not "Gold Rush"); bare names count on their own.
 * Order matters: the first key with a match wins.
 */
const EDITION_NAMES: readonly Readonly<{ key: EditionKey; paired: boolean; names: readonly string[] }>[] = [
  { key: 'directors-cut', paired: false, names: ['directors cut', 'director cut', 'yonetmenin surumu', 'yonetmenin'] },
  { key: 'goty', paired: false, names: ['game of the year', 'goty', 'yilin oyunu'] },
  { key: 'cross-gen', paired: false, names: ['cross gen'] },
  { key: 'enhanced', paired: false, names: ['enhanced'] },
  { key: 'ultimate', paired: true, names: ['ultimate', 'ultime', 'nihai'] },
  { key: 'deluxe', paired: true, names: ['deluxe', 'luks'] },
  { key: 'gold', paired: true, names: ['gold', 'altin', 'oro', 'or', 'ouro'] },
  { key: 'premium', paired: true, names: ['premium', 'seckin'] },
  { key: 'complete', paired: true, names: ['complete', 'completa', 'komplett', 'tam'] },
  { key: 'definitive', paired: true, names: ['definitive', 'definitiva'] },
  { key: 'legendary', paired: true, names: ['legendary', 'legendaire', 'legendaria', 'efsanevi'] },
  { key: 'champion', paired: true, names: ['champion', 'champions', 'sampiyon'] },
  { key: 'vault', paired: true, names: ['vault', 'kasa'] },
  { key: 'collector', paired: true, names: ['collectors', 'collector', 'koleksiyon', 'koleksiyoncu'] },
  { key: 'anniversary', paired: true, names: ['anniversary', 'anniversaire', 'aniversario', 'yildonumu'] },
  { key: 'special', paired: true, names: ['special', 'speciale', 'especial', 'ozel'] },
];

const STANDARD_NAMES = ['standard', 'standart', 'estandar'];

/** "Digital" before an edition name belongs to the edition ("Digital Deluxe Edition"). */
const DIGITAL_WORDS = new Set(['digital', 'dijital', 'digitale', 'numerique', 'cyfrowa', 'цифровое']);

const PLATFORM_WORDS = new Set(['pc', 'ps4', 'ps5', 'windows', 'xbox', 'and', 've', 'series']);

function normalizeWord(word: string): string {
  return foldTurkishI(word.toLowerCase())
    .normalize('NFD')
    .replaceAll(/\p{M}/gu, '')
    .replaceAll(/['’]/g, '');
}

function tokenize(title: string): Token[] {
  const tokens: Token[] = [];
  for (const match of title.matchAll(/[\p{L}\p{N}'’]+/gu)) {
    const word = normalizeWord(match[0]);
    if (word) tokens.push({ word, start: match.index });
  }
  return tokens;
}

type EditionMatch = Readonly<{ key: EditionKey; from: number; to: number }>;

function phraseAt(tokens: readonly Token[], index: number, phrase: readonly string[]): boolean {
  return phrase.every((word, offset) => tokens[index + offset]?.word === word);
}

function isEditionWord(tokens: readonly Token[], index: number): boolean {
  const token = tokens[index];
  return token !== undefined && EDITION_WORDS.has(token.word);
}

/** Token range [from, to) of the name at `index`, widened to an adjacent edition word. */
function pairedRange(tokens: readonly Token[], index: number, length: number): { from: number; to: number } | null {
  const before = isEditionWord(tokens, index - 1);
  const after = isEditionWord(tokens, index + length);
  if (!before && !after) return null;
  let from = before ? index - 1 : index;
  if (DIGITAL_WORDS.has(tokens[from - 1]?.word ?? '')) from -= 1;
  return { from, to: after ? index + length + 1 : index + length };
}

function findEdition(tokens: readonly Token[]): EditionMatch | null {
  for (const { key, paired, names } of EDITION_NAMES) {
    for (const name of names) {
      const phrase = name.split(' ');
      for (let index = 0; index < tokens.length; index += 1) {
        if (!phraseAt(tokens, index, phrase)) continue;
        if (!paired) return { key, from: index, to: index + phrase.length };
        const range = pairedRange(tokens, index, phrase.length);
        if (range) return { key, ...range };
      }
    }
  }
  return null;
}

export function editionKey(title: string): EditionKey {
  return findEdition(tokenize(title))?.key ?? 'base';
}

/** Start of a trailing "Standard Edition" / bare edition word ending before `end`, else `end`. */
function trailingEditionStart(tokens: readonly Token[], end: number): number {
  const last = end - 1;
  if (last < 1 || !isEditionWord(tokens, last)) return end;
  const previous = tokens[last - 1]?.word;
  return previous && STANDARD_NAMES.includes(previous) ? last - 1 : last;
}

/** Leading "Édition Définitive de …" form: the index after "de/of/di/von". */
function leadingEditionEnd(tokens: readonly Token[], match: EditionMatch | null): number {
  if (match?.from !== 0) return 0;
  const connector = tokens[match.to]?.word;
  return connector && ['de', 'of', 'di', 'von', 'del'].includes(connector) ? match.to + 1 : 0;
}

function stripTrailingPlatforms(tokens: readonly Token[], end: number): number {
  let cut = end;
  while (cut > 1 && PLATFORM_WORDS.has(tokens[cut - 1]?.word ?? '')) cut -= 1;
  return cut;
}

function trimSeparators(text: string): string {
  let end = text.length;
  while (end > 0 && ' :–—-|,/&'.includes(text.charAt(end - 1))) end -= 1;
  return text.slice(0, end).trim();
}

function removeTrailingParentheses(title: string): string {
  let current = title.trim();
  while (current.endsWith(')')) {
    const open = current.lastIndexOf('(');
    if (open <= 0) break;
    current = current.slice(0, open).trim();
  }
  return current;
}

/** Title without edition, platform and parenthesised suffixes, used to group every edition of one game. */
export function baseTitle(title: string): string {
  const cleaned = removeTrailingParentheses(title.replaceAll(/[™®©]/g, ''));
  const tokens = tokenize(cleaned);
  const match = findEdition(tokens);
  const startToken = leadingEditionEnd(tokens, match);

  let endToken = stripTrailingPlatforms(tokens, tokens.length);
  endToken = match && match.from > startToken ? match.from : trailingEditionStart(tokens, endToken);
  endToken = stripTrailingPlatforms(tokens, endToken);
  if (endToken <= startToken) return trimSeparators(cleaned);

  const startOffset = tokens[startToken]?.start ?? 0;
  const endOffset = tokens[endToken]?.start ?? cleaned.length;
  return trimSeparators(cleaned.slice(startOffset, endOffset)).replaceAll(/\s+/g, ' ');
}

export function compareEditions(a: EditionKey, b: EditionKey): number {
  return EDITION_ORDER.indexOf(a) - EDITION_ORDER.indexOf(b);
}

const DLC_PHRASES = [
  'season pass', 'sezon bileti', 'battle pass', 'fortnite crew', 'criminal enterprise', 'great white',
  'lost and', 'story pack', 'v bucks', 'v papel', 'add on',
];
const DLC_WORDS = new Set([
  'dlc', 'pack', 'paket', 'paketi', 'season', 'cash', 'shark', 'karti', 'addon', 'expansion', 'starter',
  'soundtrack', 'artbook', 'skin', 'skins', 'coin', 'coins', 'credit', 'credits', 'points', 'membership',
  'subscription', 'upgrade', 'yukseltme', 'genisleme', 'bundle',
]);
const EDITION_DLC_WORDS = new Set(['dlc', 'expansion', 'season']);

export function isDlcTitle(title: string): boolean {
  const tokens = tokenize(title);
  if (findEdition(tokens)) return tokens.some((token) => EDITION_DLC_WORDS.has(token.word));
  if (/\bonline:/i.test(title)) return true;
  const joined = ` ${tokens.map((token) => token.word).join(' ')} `;
  if (DLC_PHRASES.some((phrase) => joined.includes(` ${phrase} `))) return true;
  return tokens.some((token) => DLC_WORDS.has(token.word));
}
