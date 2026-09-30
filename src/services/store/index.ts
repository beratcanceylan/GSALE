import { throwIfAborted } from '@/services/store/fetch';
import { fetchGameDetailLive } from '@/services/store/detail';
import { rememberDetailPreviews } from '@/services/store/detail-preview';
import { liveGameToDetailResponse, liveGameToSummary } from '@/services/store/map';
import { prepareLiveGame } from '@/services/store/merge';
import { gameKey } from '@/services/store/editions';
import { fetchEpicFreeGames } from '@/services/store/platforms/epic';
import { fetchGamerPowerGiveaways } from '@/services/store/platforms/gamerpower';
import { fetchSteamFreeGames } from '@/services/store/platforms/steam';
import { searchLiveGames } from '@/services/store/search';
import type { GameDetailResponse, GameSummary, LiveGame, StoreRequestOptions } from '@/services/store/types';

export { getPopularGames } from '@/services/store/popular';
export type { EditionOption } from '@/services/store/edition-table';
export type { EditionKey } from '@/services/store/editions';
export type { GameDetailResponse, GameSummary, StoreRequestOptions } from '@/services/store/types';

export async function searchGames(
  query: string,
  options?: StoreRequestOptions,
): Promise<GameSummary[]> {
  const games = await searchLiveGames(query, options);
  rememberDetailPreviews(games);
  return games.map(liveGameToSummary);
}

export async function getGameDetail(
  slug: string,
  platformHint?: string,
  options?: StoreRequestOptions,
): Promise<GameDetailResponse> {
  const game = await fetchGameDetailLive(slug, platformHint, options);
  if (!game) throw new Error('not-found');
  return liveGameToDetailResponse(game);
}

export async function getFreeGames(options?: StoreRequestOptions): Promise<GameSummary[]> {
  const results = await Promise.allSettled([
    fetchEpicFreeGames(options),
    fetchSteamFreeGames(options),
    fetchGamerPowerGiveaways(options),
  ]);
  const games = results.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));

  throwIfAborted(options?.signal);

  // Stores and GamerPower can list the same giveaway; the store's own listing comes first and wins.
  const seen = new Set<string>();
  const unique: LiveGame[] = [];
  for (const game of games) {
    const key = gameKey(game.title) || game.title.toLowerCase().trim();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(prepareLiveGame(game));
  }
  rememberDetailPreviews(unique);
  return unique.map(liveGameToSummary);
}
