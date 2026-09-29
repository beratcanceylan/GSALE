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
  if (version === 'iv' || version === '4') return '4';
  return null;
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

export function cleanTitleForCrossPlatform(title: string): string {
  if (!title) return title;
  return title
    .replace(/[™®©]/g, '')
    .replace(
      /\s*-\s*(Deluxe|Ultimate|Definitive|Enhanced|GOTY|Game of the Year|Complete|Special|Remastered|Anniversary|Collector|Standard|Director'?s\s*Cut)\s*Edition/gi,
      '',
    )
    .replace(
      /\s*(Deluxe|Ultimate|Definitive|Enhanced|GOTY|Game of the Year|Complete|Special|Remastered|Anniversary|Collector|Standard|Director'?s\s*Cut)\s*Edition/gi,
      '',
    )
    .replace(/\s*[-–—]?\s*Director'?s\s*Cut\b/gi, '')
    .replace(/\s*[-–—]?\s*Y[öÖoO]netmen[iİıI]n\s*S[üÜuU]r[üÜuU]m[üÜuU]?(?=$|\s|[^\p{L}\p{N}])/giu, '')
    .replace(/\bConsole\s+Edition\b/gi, '')
    .replace(/\bEdition\b/gi, '')
    .replace(/\bPS[45]\b/gi, '')
    .replace(/\bXbox\b/gi, '')
    .replace(/\bPC\b/gi, '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const EDITION_IN_TITLE =
  /(ultimate edition|deluxe edition|definitive edition|gold edition|premium edition|complete edition|goty|game of the year|standard edition|director'?s cut)/;

export function extractEdition(title: string): string {
  const match = EDITION_IN_TITLE.exec(title.toLowerCase());
  if (!match?.[1]) return 'base';
  const edition = match[1];
  return edition.replace(/\s+edition$/, '').trim() || edition;
}

/** DLC / add-on markers — reject when the search title is the base game. */
const DLC_PHRASE_MARKERS = [
  'story pack',
  'hikaye modu',
  'story mode',
  'lost and',
  'great white',
  'criminal enterprise',
  'battle pass',
  'fortnite crew',
] as const;

const DLC_WORD_MARKERS = [
  'dlc',
  'pack',
  'paket',
  'paketi',
  'season',
  'cash',
  'shark',
  'kartı',
  'karti',
  'addon',
  'expansion',
  'starter',
  'tony',
  'damned',
  'magus',
  'dabber',
  'harvest',
  'skin',
  'coin',
  'credit',
  'points',
  'membership',
  'subscription',
] as const;

function hasProductDlcMarker(title: string): boolean {
  if (/\bonline:/i.test(title)) return true;
  if (/\bv[-\s]?(bucks|papel)\b/i.test(title)) return true;

  const lower = title.toLowerCase();
  if (DLC_PHRASE_MARKERS.some((phrase) => lower.includes(phrase))) return true;

  return DLC_WORD_MARKERS.some((word) => new RegExp(`\\b${word}\\b`, 'i').test(title));
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

function hasNumberedSequelMismatch(found: string, search: string): boolean {
  const toNum = (v: string): string => {
    const romanMap: Record<string, string> = {
      i: '1', ii: '2', iii: '3', iv: '4', v: '5',
      vi: '6', vii: '7', viii: '8', ix: '9', x: '10',
      xi: '11', xii: '12', xiii: '13', xiv: '14', xv: '15', xvi: '16',
    };
    return romanMap[v.toLowerCase()] ?? v;
  };

  const partRegex = /\b(?:part|bölüm)\s*(xvi|xv|xiv|xiii|xii|xi|x|ix|viii|vii|vi|v|iv|iii|ii|i|\d+)\b/i;
  const partA = partRegex.exec(found)?.[1];
  const partB = partRegex.exec(search)?.[1];
  if (partA && partB && toNum(partA) !== toNum(partB)) {
    return true;
  }

  const franchiseVerRegex =
    /\b(?:final\s+fantasy|street\s+fighter|tekken|dark\s+souls|witcher|resident\s+evil|god\s+of\s+war|monster\s+hunter|kingdom\s+hearts|diablo|fallout|far\s+cry|doom|persona|dragon\s+quest|star\s+ocean|ys|silent\s+hill)\s*(xvi|xv|xiv|xiii|xii|xi|x|ix|viii|vii|vi|v|iv|iii|ii|i|\d+)\b/i;
  const verA = franchiseVerRegex.exec(found)?.[1];
  const verB = franchiseVerRegex.exec(search)?.[1];
  if (verA && verB && toNum(verA) !== toNum(verB)) {
    return true;
  }

  return false;
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
