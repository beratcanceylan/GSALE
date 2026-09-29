import { cleanTitleForCrossPlatform, scoreProductTitleMatch } from '@/services/store/match';

export type XboxTitleHit = Readonly<{
  title: string;
}>;

export type RankedXboxTitleHit<T extends XboxTitleHit> = Readonly<{
  hit: T;
  score: number;
  exact: boolean;
}>;

function normalizedTitle(title: string): string {
  return cleanTitleForCrossPlatform(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function hasPremiumEdition(title: string): boolean {
  return /\bpremium\s+edition\b/i.test(title);
}

function wantsEnhancedSeriesVersion(title: string): boolean {
  return /\benhanced\b/i.test(title);
}

function isSeriesVersion(title: string): boolean {
  return /\bxbox\s+series\s+x\s*\|\s*s\b/i.test(title);
}

function isStoryModeTitle(title: string): boolean {
  return /\b(hikaye\s+modu|story\s+mode)\b/i.test(title);
}

function isPcOnlyTitle(title: string): boolean {
  return /\(\s*PC\s*\)/i.test(title);
}

export function isExactXboxTitleMatch(foundTitle: string, searchTitle: string): boolean {
  const found = normalizedTitle(foundTitle);
  const search = normalizedTitle(searchTitle);
  return found.length > 0 && found === search;
}

function xboxTitleScore(foundTitle: string, searchTitle: string): number {
  let score = scoreProductTitleMatch(foundTitle, searchTitle);
  if (score <= 0) return 0;

  if (isExactXboxTitleMatch(foundTitle, searchTitle)) {
    score = Math.max(score, 110);
  }

  if (wantsEnhancedSeriesVersion(searchTitle) && isSeriesVersion(foundTitle)) {
    score += 24;
  }

  if (!isStoryModeTitle(searchTitle) && isStoryModeTitle(foundTitle)) {
    score -= 32;
  }

  if (!hasPremiumEdition(searchTitle) && hasPremiumEdition(foundTitle)) {
    score -= 22;
  }

  return Math.max(0, score);
}

export function rankXboxPriceHits<T extends XboxTitleHit>(
  hits: readonly T[],
  searchTitle: string,
  minScore = 50,
): RankedXboxTitleHit<T>[] {
  const consoleHits = hits.filter((hit) => !isPcOnlyTitle(hit.title));
  const candidates = consoleHits.length > 0 ? consoleHits : hits;
  const ranked: RankedXboxTitleHit<T>[] = [];

  for (const hit of candidates) {
    const score = xboxTitleScore(hit.title, searchTitle);
    if (score < minScore) continue;
    ranked.push({
      hit,
      score,
      exact: isExactXboxTitleMatch(hit.title, searchTitle),
    });
  }

  return ranked.sort((a, b) => b.score - a.score);
}
