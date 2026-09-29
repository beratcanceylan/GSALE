import { baseTitle, isDlcTitle } from '@/services/store/editions';

function normalize(title: string): string {
  return title
    .toLowerCase()
    .replace(/[™®©]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function getSignificantWords(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[™®©]/g, '')
    .split(/\s+/)
    .filter((w) => w.length >= 3 || /^\d+$/.test(w));
}

function isCounterStrikeGoTitle(title: string): boolean {
  const normalized = normalize(title);
  return normalized.includes('globaloffensive') || /\bcsgo\b/.test(normalized);
}

function isCounterStrike2Title(title: string): boolean {
  const normalized = normalize(title);
  return normalized.includes('counterstrike2') || /\bcs2\b/.test(normalized);
}

function hasCounterStrikeProductMismatch(a: string, b: string): boolean {
  const aGo = isCounterStrikeGoTitle(a);
  const bGo = isCounterStrikeGoTitle(b);
  const a2 = isCounterStrike2Title(a);
  const b2 = isCounterStrike2Title(b);
  return (aGo && b2 && !bGo) || (bGo && a2 && !aGo);
}

function isPrimeUpgradeTitle(title: string): boolean {
  return /\b(prime|seçkin|secKin|status\s+upgrade|yükseltme|yukseltme)\b/i.test(title);
}

function fortniteSaveTheWorldKey(title: string): string | null {
  if (!/\bfortnite\b/i.test(title)) return null;
  if (/\b(save the world|dünyayı kurtar|dunyayi kurtar)\b/i.test(title)) {
    return 'fortnite save the world';
  }
  return null;
}

/** Canonical key for cross-platform search dedupe. */
export function canonicalMergeTitleKey(title: string): string {
  const cleaned = cleanTitleForCrossPlatform(title).toLowerCase().trim();
  const saveTheWorld = fortniteSaveTheWorldKey(title);
  if (saveTheWorld) return saveTheWorld;
  if (cleaned === 'fortnite battle royale') return 'fortnite';
  return cleaned;
}

function isGenericCounterStrikeSearch(search: string): boolean {
  return /\bcounter[\s-]?strike\b/i.test(search)
    && !isCounterStrikeGoTitle(search)
    && !isCounterStrike2Title(search);
}

function gtaVersion(title: string): string | null {
  const match = /\b(?:grand\s+theft\s+auto|gta)\s*(vi|iv|v|6|5|4)\b/i.exec(title);
  const version = match?.[1]?.toLowerCase();
  if (!version) return null;
  if (version === 'vi' || version === '6') return '6';
  if (version === 'v' || version === '5') return '5';
  return '4';
}

function hasGrandTheftAutoVersionMismatch(a: string, b: string): boolean {
  const aVersion = gtaVersion(a);
  const bVersion = gtaVersion(b);
  return Boolean(aVersion && bVersion && aVersion !== bVersion);
}

function mentionsGrandTheftAuto(title: string): boolean {
  return /\b(?:grand\s+theft\s+auto|gta)\b/i.test(title);
}

function hasGrandTheftAutoMissingVersionMismatch(foundTitle: string, searchTitle: string): boolean {
  return Boolean(gtaVersion(searchTitle) && mentionsGrandTheftAuto(foundTitle) && !gtaVersion(foundTitle));
}

function hasGrandTheftAutoOnlineMismatch(foundTitle: string, searchTitle: string): boolean {
  return (
    /\b(?:grand\s+theft\s+auto|gta)\s+online\b/i.test(foundTitle) &&
    !/\bonline\b/i.test(searchTitle)
  );
}

function isGtaVStoryModeMainProduct(foundTitle: string, searchTitle: string): boolean {
  const found = normalize(foundTitle);
  const search = normalize(searchTitle);
  return (
    found.includes('grandtheftautov') &&
    search.includes('grandtheftautov') &&
    /\b(hikaye\s+modu|story\s+mode)\b/i.test(foundTitle)
  );
}

/** Removes edition, platform and parenthesised suffixes so titles compare across stores. */
export function cleanTitleForCrossPlatform(title: string): string {
  if (!title) return title;
  return baseTitle(title);
}

/** GTA-specific DLC names the generic DLC check does not know. */
const GTA_DLC_WORDS = ['tony', 'damned', 'magus', 'dabber', 'harvest', 'story pack', 'hikaye modu', 'story mode'];

function hasProductDlcMarker(title: string): boolean {
  if (isDlcTitle(title)) return true;
  const lower = title.toLowerCase();
  return GTA_DLC_WORDS.some((word) => new RegExp(String.raw`\b${word}\b`, 'i').test(lower));
}

/** Optional edition tags — not required for cross-store title match. */
const OPTIONAL_EDITION_WORDS =
  /^(enhanced|legacy|remastered|definitive|premium|complete|ultimate|deluxe|standard|gold|goty|director|directors|cut)$/i;

function getCoreSignificantWords(title: string): string[] {
  const words = getSignificantWords(title);
  const core = words.filter((w) => !OPTIONAL_EDITION_WORDS.test(w));
  return core.length > 0 ? core : words;
}

/** Titles to try when store search fails on the full product name (e.g. "… Enhanced"). */
export function getPriceLookupTitles(title: string): string[] {
  const cross = cleanTitleForCrossPlatform(title);
  const withoutOptionalEdition = cross
    .replace(
      /\b(enhanced|legacy|remastered|definitive|premium|complete|ultimate|deluxe|gold|goty|director'?s\s*cut)\b/gi,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();

  const variants: string[] = [];
  if (cross) variants.push(cross);
  if (withoutOptionalEdition && withoutOptionalEdition !== cross) {
    variants.push(withoutOptionalEdition);
  }
  return [...new Set(variants)];
}

/** Longest numerals first, so "viii" is not read as "v". */
const ROMAN_NUMERALS = ['xvi', 'xv', 'xiv', 'xiii', 'xii', 'xi', 'x', 'ix', 'viii', 'vii', 'vi', 'v', 'iv', 'iii', 'ii', 'i'];
const DIGITS = String.raw`\d+`;
const WORD_GAP = String.raw`\s+`;
const VERSION_ALTERNATIVES = [...ROMAN_NUMERALS, DIGITS].join('|');
const VERSION_PATTERN = String.raw`(${VERSION_ALTERNATIVES})\b`;
const ROMAN_TO_NUMBER = new Map(ROMAN_NUMERALS.map((numeral, index) => [numeral, String(16 - index)]));

const PART_VERSION = new RegExp(String.raw`\b(?:part|bölüm)\s*${VERSION_PATTERN}`, 'i');

/** Series whose numbered entries are different games. */
const VERSIONED_FRANCHISES = [
  'final fantasy', 'street fighter', 'tekken', 'dark souls', 'witcher', 'resident evil',
  'god of war', 'monster hunter', 'kingdom hearts', 'diablo', 'fallout', 'far cry', 'doom',
  'persona', 'dragon quest', 'star ocean', 'ys', 'silent hill',
];
const FRANCHISE_VERSIONS = VERSIONED_FRANCHISES.map(
  (name) => new RegExp(String.raw`\b${name.replaceAll(' ', WORD_GAP)}\s*${VERSION_PATTERN}`, 'i'),
);

function versionNumber(version: string): string {
  return ROMAN_TO_NUMBER.get(version.toLowerCase()) ?? version;
}

/** Version of the leftmost numbered franchise title, e.g. "xvi" in "Final Fantasy XVI". */
function franchiseVersion(title: string): string | undefined {
  let leftmost: RegExpExecArray | null = null;
  for (const pattern of FRANCHISE_VERSIONS) {
    const match = pattern.exec(title);
    if (match && (!leftmost || match.index < leftmost.index)) leftmost = match;
  }
  return leftmost?.[1];
}

function hasVersionMismatch(a: string | undefined, b: string | undefined): boolean {
  return Boolean(a && b && versionNumber(a) !== versionNumber(b));
}

function hasNumberedSequelMismatch(found: string, search: string): boolean {
  return (
    hasVersionMismatch(PART_VERSION.exec(found)?.[1], PART_VERSION.exec(search)?.[1]) ||
    hasVersionMismatch(franchiseVersion(found), franchiseVersion(search))
  );
}

function shouldBlockProductTitleMatch(found: string, search: string): boolean {
  if (hasCounterStrikeProductMismatch(found, search)) return true;
  if (isCounterStrikeGoTitle(found) && isGenericCounterStrikeSearch(search)) return true;
  if (hasGrandTheftAutoVersionMismatch(found, search)) return true;
  if (hasGrandTheftAutoMissingVersionMismatch(found, search)) return true;
  if (hasGrandTheftAutoOnlineMismatch(found, search)) return true;
  if (hasNumberedSequelMismatch(found, search)) return true;

  const foundDlc = hasProductDlcMarker(found);
  const searchDlc = hasProductDlcMarker(search);
  return foundDlc && !searchDlc && !isGtaVStoryModeMainProduct(found, search);
}

function countWordOverlap(wordsFound: string[], wordsSearch: string[]): number {
  return wordsSearch.filter((w) =>
    wordsFound.some((fw) => fw === w || fw.includes(w) || w.includes(fw)),
  ).length;
}

function scoreEditionBonus(search: string, found: string): number {
  let bonus = 0;
  if (/\benhanced\b/i.test(search) && /\benhanced\b/i.test(found)) bonus += 18;
  if (/\blegacy\b/i.test(search) && /\blegacy\b/i.test(found)) bonus += 12;
  return bonus;
}

function scoreRemainderOverlap(score: number, nf: string, ns: string): number {
  const [longerNorm, shorterNorm] = nf.length >= ns.length ? [nf, ns] : [ns, nf];
  if (!longerNorm.includes(shorterNorm)) return score;

  const remainder = longerNorm.replace(shorterNorm, '');
  if (remainder.length === 0) return Math.max(score, 95);
  if (remainder.length <= 8) return Math.max(score, 85);
  if (remainder.length <= 14) return Math.max(score, 65);
  return Math.min(score, 35);
}

function scorePrimeUpgradeAdjustment(score: number, found: string, search: string): number {
  if (!isPrimeUpgradeTitle(search)) return score;
  if (isPrimeUpgradeTitle(found)) return score + 28;
  if (/\bcounter[\s-]?strike\b/i.test(found)) return score - 24;
  return score;
}

/**
 * Stricter than {@link isStrictMatch} for cross-store price lookup.
 * Scores 0–100; use with {@link pickBestTitleMatch}.
 */
export function scoreProductTitleMatch(
  foundTitle: string | null | undefined,
  searchTitle: string | null | undefined,
): number {
  if (!foundTitle || !searchTitle) return 0;

  const found = foundTitle.trim();
  const search = searchTitle.trim();
  if (shouldBlockProductTitleMatch(found, search)) return 0;

  const nf = normalize(found);
  const ns = normalize(search);
  if (nf === ns) return 100;

  const wordsFound = getCoreSignificantWords(found);
  const wordsSearch = getCoreSignificantWords(search);
  if (wordsSearch.length === 0 || wordsFound.length === 0) return 0;

  const coverage = countWordOverlap(wordsFound, wordsSearch) / wordsSearch.length;
  if (coverage < 0.85) return 0;

  let score = Math.round(coverage * 70);
  if (coverage >= 1) score += 6;
  score += scoreEditionBonus(search, found);
  score = scoreRemainderOverlap(score, nf, ns);

  const extraWords = wordsFound.length - wordsSearch.length;
  score -= extraWords * 8;
  if (wordsFound.length === wordsSearch.length) score += 12;
  if (isGtaVStoryModeMainProduct(found, search)) score = Math.max(score, 68);
  score = scorePrimeUpgradeAdjustment(score, found, search);

  return Math.max(0, Math.min(100, score));
}

export function pickBestTitleMatch<T>(
  items: T[],
  searchTitle: string,
  getTitle: (item: T) => string,
  minScore = 50,
): T | null {
  let best: T | null = null;
  let bestScore = 0;
  for (const item of items) {
    const score = scoreProductTitleMatch(getTitle(item), searchTitle);
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return bestScore >= minScore ? best : null;
}

export function isStrictMatch(foundTitle: string | null | undefined, searchTitle: string | null | undefined): boolean {
  if (!foundTitle || !searchTitle) return false;
  if (hasCounterStrikeProductMismatch(foundTitle, searchTitle)) return false;
  if (hasGrandTheftAutoVersionMismatch(foundTitle, searchTitle)) return false;
  if (hasGrandTheftAutoMissingVersionMismatch(foundTitle, searchTitle)) return false;
  if (hasGrandTheftAutoOnlineMismatch(foundTitle, searchTitle)) return false;
  if (hasNumberedSequelMismatch(foundTitle, searchTitle)) return false;

  const s1 = normalize(foundTitle);
  const s2 = normalize(searchTitle);
  const words1 = getSignificantWords(foundTitle);
  const words2 = getSignificantWords(searchTitle);
  if (words1.length === 0 || words2.length === 0) return false;

  const shorter = words1.length <= words2.length ? words1 : words2;
  const longer = words1.length <= words2.length ? words2 : words1;
  const matchCount = shorter.filter((w) => longer.some((lw) => lw.includes(w) || w.includes(lw))).length;
  if (matchCount < Math.ceil(shorter.length * 0.6)) return false;

  const [longerNorm, shorterNorm] = s1.length >= s2.length ? [s1, s2] : [s2, s1];
  if (longerNorm.includes(shorterNorm)) {
    const remainder = longerNorm.replace(shorterNorm, '');
    if (remainder.length > 0 && /^[a-z]$/i.test(remainder)) return false;
    return true;
  }

  return matchCount >= Math.ceil(shorter.length * 0.6);
}
