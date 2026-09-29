import type { LiveGame } from '@/services/store/types';

function nonEmpty(value: string | undefined): string | undefined {
  const clean = value?.replace(/\s+/g, ' ').trim();
  return clean || undefined;
}

function cleanUnique(values: readonly (string | undefined)[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const value of values) {
    const clean = nonEmpty(value);
    if (!clean || seen.has(clean.toLowerCase())) continue;
    seen.add(clean.toLowerCase());
    merged.push(clean);
  }
  return merged;
}

function firstNonEmptyStrings(
  games: readonly LiveGame[],
  field: 'developers' | 'genres',
): string[] | undefined {
  for (const game of games) {
    const values = cleanUnique(game[field] ?? []);
    if (values.length > 0) return values;
  }
  return undefined;
}

function firstText(games: readonly LiveGame[], field: 'description' | 'release_date'): string | undefined {
  for (const game of games) {
    const value = nonEmpty(game[field]);
    if (value) return value;
  }
  return undefined;
}

function firstScreenshots(games: readonly LiveGame[]): string[] | undefined {
  for (const game of games) {
    const values = game.screenshots;
    if (values && values.length > 0) return values;
  }
  return undefined;
}

function firstVideos(games: readonly LiveGame[]): NonNullable<LiveGame['videos']> | undefined {
  for (const game of games) {
    const values = game.videos;
    if (values && values.length > 0) return values;
  }
  return undefined;
}

export function needsDetailMetadata(game: LiveGame): boolean {
  return (
    !nonEmpty(game.description) ||
    !nonEmpty(game.release_date) ||
    !game.developers?.some((value) => nonEmpty(value)) ||
    !game.genres?.some((value) => nonEmpty(value))
  );
}

export function mergeDetailMetadata(
  game: LiveGame,
  candidates: readonly LiveGame[],
): LiveGame {
  if (candidates.length === 0) return game;

  const sources = [game, ...candidates];
  const developers = firstNonEmptyStrings(sources, 'developers');
  const genres = firstNonEmptyStrings(sources, 'genres');
  const screenshots = firstScreenshots(sources);
  const videos = firstVideos(sources);
  const storeLinks = Object.fromEntries(
    sources.flatMap((source) => Object.entries(source.store_links ?? {})),
  );
  const platforms = cleanUnique(sources.flatMap((source) => source.platforms ?? []));

  const result: LiveGame = { ...game };
  const description = firstText(sources, 'description');
  const releaseDate = firstText(sources, 'release_date');
  if (description) result.description = description;
  if (releaseDate) result.release_date = releaseDate;
  if (developers) result.developers = developers;
  if (genres) result.genres = genres;
  if (screenshots) result.screenshots = screenshots;
  if (videos) result.videos = videos;
  if (Object.keys(storeLinks).length > 0) result.store_links = storeLinks;
  if (platforms.length > 0) result.platforms = platforms;

  return result;
}
