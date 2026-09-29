import { editionKey } from '@/services/store/editions';
import { canonicalMergeTitleKey, scoreProductTitleMatch } from '@/services/store/match';
import type { LiveGame, PlatformSearchHit } from '@/services/store/types';

function imageResolutionRank(imageUrl: string): number {
  let rank = 0;
  const matches = imageUrl.matchAll(/(\d{3,5})x(\d{3,5})/g);
  for (const match of matches) {
    const width = Number(match[1]);
    const height = Number(match[2]);
    if (!Number.isFinite(width) || !Number.isFinite(height)) continue;
    const pixels = width * height;
    if (pixels >= 2_000_000) rank += 30;
    else if (pixels >= 600_000) rank += 15;
    else if (pixels <= 180_000) rank -= 10;
  }
  return rank;
}

function searchResultRank(game: Pick<LiveGame, 'platform' | 'image_url' | 'title'>, query?: string): number {
  let score = 0;
  if (game.platform === 'Steam') score += 100;
  const image = game.image_url;
  score += imageResolutionRank(image);
  if (image.includes('steamstatic') || image.includes('steampowered')) score += 40;
  if (image.includes('playstation.net') || image.includes('playstation.com')) score -= 15;
  if (editionKey(game.title) === 'base') score += 60;
  if (query) {
    score += scoreProductTitleMatch(game.title, query);
  }
  return score;
}

export function hitToLiveGame(hit: PlatformSearchHit): LiveGame {
  return {
    id: hit.slug ?? hit.id,
    title: hit.title,
    image_url: hit.image_url,
    platform: hit.platform,
    source_platform: hit.platform,
    slug: hit.slug ?? hit.id,
    rating: null,
    platforms: [hit.platform],
    store_links: hit.store_url ? { [hit.platform]: hit.store_url } : {},
  };
}

function isRelevantSearchHit(hit: PlatformSearchHit, query?: string): boolean {
  const q = query?.trim();
  if (!q) return true;
  return scoreProductTitleMatch(hit.title, q) >= 50;
}

type GroupedGame = {
  bestGame: LiveGame;
  bestRank: number;
  platformBest: Map<string, { hit: PlatformSearchHit; rank: number }>;
};

function addHitToGroups(groups: Map<string, GroupedGame>, hit: PlatformSearchHit, query?: string): void {
  const game = hitToLiveGame(hit);
  const titleKey = canonicalMergeTitleKey(game.title);
  const rank = searchResultRank(game, query);
  const group = groups.get(titleKey);
  if (!group) {
    groups.set(titleKey, {
      bestGame: game,
      bestRank: rank,
      platformBest: new Map([[hit.platform, { hit, rank }]]),
    });
    return;
  }

  if (rank > group.bestRank) {
    group.bestGame = game;
    group.bestRank = rank;
  }
  const currentPlatformBest = group.platformBest.get(hit.platform);
  if (!currentPlatformBest || rank > currentPlatformBest.rank) {
    group.platformBest.set(hit.platform, { hit, rank });
  }
}

/** The best-ranked hit, listing every store that sells the title and each store's best link. */
function groupToGame(group: GroupedGame): LiveGame {
  const platforms = [...new Set([...(group.bestGame.platforms ?? []), ...group.platformBest.keys()])].filter(Boolean);
  const store_links: Record<string, string> = { ...group.bestGame.store_links };
  for (const [platform, entry] of group.platformBest.entries()) {
    if (entry.hit.store_url) store_links[platform] = entry.hit.store_url;
  }
  return { ...group.bestGame, platforms, store_links };
}

export function mergeSearchHits(hits: PlatformSearchHit[], query?: string): LiveGame[] {
  const groups = new Map<string, GroupedGame>();
  for (const hit of hits) {
    if (hit.image_url && isRelevantSearchHit(hit, query)) addHitToGroups(groups, hit, query);
  }
  return dedupeByRouteId([...groups.values()].map(groupToGame));
}

function dedupeByRouteId(games: LiveGame[]): LiveGame[] {
  const seen = new Set<string>();
  return games.filter((game) => {
    if (!game.id || seen.has(game.id)) return false;
    seen.add(game.id);
    return true;
  });
}

function getLiveRouteId(game: LiveGame): string {
  if (game.platform === 'Epic Games') return game.slug ?? game.id;
  if (game.platform === 'Steam') return (game.slug ?? game.id).replace(/^steam-/, '');
  return game.id || game.slug || game.title;
}

export function prepareLiveGame(game: LiveGame): LiveGame {
  const id = getLiveRouteId(game);
  return {
    ...game,
    id,
    source_platform: game.source_platform ?? game.platform,
    platforms: game.platforms ?? (game.platform ? [game.platform] : []),
    genres: game.genres ?? [],
    developers: game.developers ?? [],
    screenshots: game.screenshots ?? [],
    videos: game.videos ?? [],
    store_links: game.store_links ?? {},
    rating: game.rating ?? null,
  };
}
