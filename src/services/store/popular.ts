import { catalogPlatforms } from '@/services/catalog/state';
import { rememberDetailPreviews } from '@/services/store/detail-preview';
import { gameKey, isDlcTitle } from '@/services/store/editions';
import { throwIfAborted } from '@/services/store/fetch';
import { liveGameToSummary } from '@/services/store/map';
import { prepareLiveGame } from '@/services/store/merge';
import { fetchEpicTopSellers } from '@/services/store/platforms/epic';
import { fetchSteamTopSellers } from '@/services/store/platforms/steam';
import { fetchXboxTopPaid } from '@/services/store/platforms/xbox';
import type { GameSummary, LiveGame, StoreRequestOptions } from '@/services/store/types';

/** The app-wide 30-game limit. */
const POPULAR_LIMIT = 30;
const PER_STORE = POPULAR_LIMIT;

type TopFetcher = (limit: number, options?: StoreRequestOptions) => Promise<LiveGame[]>;

/** Stores whose best-seller lists are current in every supported country. */
const POPULAR_SOURCES: readonly TopFetcher[] = [fetchSteamTopSellers, fetchEpicTopSellers, fetchXboxTopPaid];

/** Takes one game from each list in turn, so no single store dominates the top. */
function interleave(lists: readonly (readonly LiveGame[])[]): LiveGame[] {
  const mixed: LiveGame[] = [];
  const longest = Math.max(0, ...lists.map((list) => list.length));
  for (let index = 0; index < longest; index += 1) {
    for (const list of lists) {
      const game = list[index];
      if (game) mixed.push(game);
    }
  }
  return mixed;
}

/** One entry per game; a game several stores list keeps its first position and gains their stores. */
function dedupe(games: readonly LiveGame[]): LiveGame[] {
  const byKey = new Map<string, LiveGame>();
  for (const game of games) {
    if (isDlcTitle(game.title)) continue;
    const key = gameKey(game.title);
    if (!key) continue;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...game, platforms: [game.platform] });
      continue;
    }
    byKey.set(key, { ...existing, platforms: [...new Set([...(existing.platforms ?? []), game.platform])] });
  }
  return [...byKey.values()];
}

/** Adds every store the downloaded catalog lists for the game; no network request. */
async function withCatalogStores(game: LiveGame): Promise<LiveGame> {
  const stores = await catalogPlatforms(game.title);
  if (!stores || stores.size === 0) return game;
  return { ...game, platforms: [...new Set([...(game.platforms ?? []), ...stores])] };
}

/** Best sellers of several stores mixed into one list; one store failing only drops its games. */
export async function getPopularGames(options?: StoreRequestOptions): Promise<GameSummary[]> {
  const results = await Promise.allSettled(POPULAR_SOURCES.map((fetchTop) => fetchTop(PER_STORE, options)));
  throwIfAborted(options?.signal);
  const lists = results.map((result) => (result.status === 'fulfilled' ? result.value : []));
  const games = dedupe(interleave(lists)).slice(0, POPULAR_LIMIT);
  const enriched = (await Promise.all(games.map(withCatalogStores))).map(prepareLiveGame);
  throwIfAborted(options?.signal);
  rememberDetailPreviews(enriched);
  return enriched.map(liveGameToSummary);
}
