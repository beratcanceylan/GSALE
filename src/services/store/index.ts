import { throwIfAborted } from '@/services/store/fetch';
import { fetchGameDetailLive } from '@/services/store/detail';
import { rememberDetailPreviews } from '@/services/store/detail-preview';
import { liveGameToDetailResponse, liveGameToSummary } from '@/services/store/map';
import { prepareLiveGame } from '@/services/store/merge';
import { fetchEpicFreeGames } from '@/services/store/platforms/epic';
import { fetchSteamFreeGames } from '@/services/store/platforms/steam';
import { searchLiveGames } from '@/services/store/search';
import type { GameDetailResponse, GameSummary, StoreRequestOptions } from '@/services/store/types';

export { getHomeSections, type HomeSection } from '@/services/store/home';
export type { GameDetailResponse, GameSummary, Price, StoreRequestOptions } from '@/services/store/types';

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
  if (!game) {
    throw new Error('Oyun bulunamadı.');
  }
  return liveGameToDetailResponse(game, Date.now());
}

export async function getFreeGames(options?: StoreRequestOptions): Promise<GameSummary[]> {
  const [epic, steam] = await Promise.allSettled([
    fetchEpicFreeGames(options),
    fetchSteamFreeGames(options),
  ]);
  const games = [
    ...(epic.status === 'fulfilled' ? epic.value : []),
    ...(steam.status === 'fulfilled' ? steam.value : []),
  ];

  throwIfAborted(options?.signal);

  // Epic and Steam can both give away the same game; keep the first listing.
  const seen = new Set<string>();
  const unique = games
    .filter((game) => {
      const key = game.title.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(prepareLiveGame);
  rememberDetailPreviews(unique);
  return unique.map(liveGameToSummary);
}
