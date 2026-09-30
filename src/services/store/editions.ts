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
  | 'vault';

const EDITION_ORDER: readonly EditionKey[] = [
  'base', 'enhanced', 'deluxe', 'gold', 'premium', 'ultimate', 'champion', 'vault', 'legendary',
  'complete', 'definitive', 'goty', 'directors-cut', 'anniversary', 'special', 'collector',
];

type Token = Readonly<{ word: string; start: number }>;

/** Lists are written naturally and compared after the same normalisation as title words. */
function normalizedSet(words: readonly string[]): ReadonlySet<string> {
  return new Set(words.map(normalizeWord));
}

/** "Edition" in the store languages we support. */
const EDITION_WORDS = normalizedSet([
  'edition', 'edición', 'edição', 'edizione', 'wydanie', 'edycja', 'издание', 'видання', 'editie', 'utgåva',
  'udgave', 'utgave', 'painos', 'kiadás', 'ediția', 'έκδοση', 'sürüm', 'sürümü', 'bundle', 'paket', 'paketi',
  'エディション', '版', '에디션', '版本',
]);

/**
 * Edition names per key, as word sequences. `paired` names only count next to an
 * edition word ("Gold Edition", not "Gold Rush"); bare names count on their own.
 * Order matters: the first key with a match wins.
 */
const EDITION_NAMES: readonly Readonly<{ key: EditionKey; paired: boolean; names: readonly string[] }>[] = [
  { key: 'directors-cut', paired: false, names: ['directors cut', 'director cut', 'yonetmenin surumu', 'yonetmenin'] },
  { key: 'goty', paired: false, names: ['game of the year', 'goty', 'yilin oyunu'] },
  // A cross-gen bundle is the standard product on PlayStation, not an edition of its own.
  { key: 'base', paired: false, names: ['cross gen'] },
  { key: 'enhanced', paired: false, names: ['enhanced'] },
  { key: 'ultimate', paired: true, names: ['ultimate', 'ultime', 'nihai', 'ostateczna', 'アルティメット', '얼티밋', '终极'] },
  { key: 'deluxe', paired: true, names: ['deluxe', 'lüks', 'делюкс', 'デラックス', '디럭스', '豪华'] },
  { key: 'gold', paired: true, names: ['gold', 'altın', 'oro', 'or', 'ouro', 'złota', 'золотое', 'золоте', 'ゴールド', '골드', '黄金'] },
  { key: 'premium', paired: true, names: ['premium', 'seçkin', 'プレミアム', '프리미엄'] },
  { key: 'complete', paired: true, names: ['complete', 'completa', 'komplett', 'kompletna', 'tam', 'полное', 'повне', 'コンプリート', '컴플리트', '完整'] },
  { key: 'definitive', paired: true, names: ['definitive', 'definitiva'] },
  { key: 'legendary', paired: true, names: ['legendary', 'legendaire', 'legendaria', 'efsanevi'] },
  { key: 'champion', paired: true, names: ['champion', 'champions', 'sampiyon'] },
  { key: 'vault', paired: true, names: ['vault', 'kasa'] },
  { key: 'collector', paired: true, names: ['collectors', 'collector', 'koleksiyon', 'koleksiyoncu'] },
  { key: 'anniversary', paired: true, names: ['anniversary', 'anniversaire', 'aniversario', 'yildonumu'] },
  { key: 'special', paired: true, names: ['special', 'speciale', 'especial', 'ozel'] },
];

const STANDARD_NAMES = normalizedSet(['standard', 'standart', 'estándar', 'standardowa', 'стандартное', 'стандартне', 'スタンダード', '스탠다드', '标准']);

/** "Digital" before an edition name belongs to the edition ("Digital Deluxe Edition"). */
const DIGITAL_WORDS = normalizedSet(['digital', 'dijital', 'digitale', 'numérique', 'cyfrowa', 'цифровое', 'цифрове', 'デジタル', '디지털']);

/** Trailing platform phrases stores append to a product title, longest first. */
const PLATFORM_PHRASES: readonly (readonly string[])[] = [
  'xbox series x s', 'xbox series x', 'xbox series', 'xbox one', 'nintendo switch 2', 'nintendo switch',
  'playstation 5', 'playstation 4', 'ps5 version', 'ps4 version', 'pc', 'ps4', 'ps5', 'windows', 'xbox', 'and', 've',
].map((phrase) => phrase.split(' '));

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
    if (!word) continue;
    // CJK titles glue "edition" to the name ("デラックス版"); split it off so it pairs like a word.
    if (word.length > 1 && word.endsWith('版')) {
      tokens.push({ word: word.slice(0, -1), start: match.index }, { word: '版', start: match.index + match[0].length - 1 });
      continue;
    }
    tokens.push({ word, start: match.index });
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
      const phrase = name.split(' ').map(normalizeWord);
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
  return previous && STANDARD_NAMES.has(previous) ? last - 1 : last;
}

/** Leading "Édition Définitive de …" form: the index after "de/of/di/von". */
function leadingEditionEnd(tokens: readonly Token[], match: EditionMatch | null): number {
  if (match?.from !== 0) return 0;
  const connector = tokens[match.to]?.word;
  return connector && ['de', 'of', 'di', 'von', 'del'].includes(connector) ? match.to + 1 : 0;
}

function trailingPlatformLength(tokens: readonly Token[], end: number): number {
  for (const phrase of PLATFORM_PHRASES) {
    const start = end - phrase.length;
    if (start >= 1 && phrase.every((word, offset) => tokens[start + offset]?.word === word)) return phrase.length;
  }
  return 0;
}

function stripTrailingPlatforms(tokens: readonly Token[], end: number): number {
  let cut = end;
  for (let length = trailingPlatformLength(tokens, cut); length > 0; length = trailingPlatformLength(tokens, cut)) {
    cut -= length;
  }
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

/** Comparable identity of a game across stores: its base title as lower-case letters and digits only. */
export function gameKey(title: string): string {
  return tokenize(baseTitle(title)).map((token) => token.word).join('');
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
  'subscription', 'upgrade', 'yukseltme', 'genisleme', 'bundle', 'pass',
]);
/** Words that make an edition-named product an add-on ("Premium Edition Upgrade"). */
const EDITION_DLC_WORDS = normalizedSet(['dlc', 'expansion', 'season', 'upgrade', 'yükseltme', 'addon', 'soundtrack']);

export function isDlcTitle(title: string): boolean {
  const tokens = tokenize(title);
  if (findEdition(tokens)) return tokens.some((token) => EDITION_DLC_WORDS.has(token.word));
  if (/\bonline:/i.test(title)) return true;
  const joined = ` ${tokens.map((token) => token.word).join(' ')} `;
  if (DLC_PHRASES.some((phrase) => joined.includes(` ${phrase} `))) return true;
  return tokens.some((token) => DLC_WORDS.has(token.word));
}
