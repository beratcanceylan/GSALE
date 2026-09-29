import { throwIfAborted } from '@/services/store/fetch';
import { rememberDetailPreviews } from '@/services/store/detail-preview';
import { liveGameToSummary } from '@/services/store/map';
import { prepareLiveGame } from '@/services/store/merge';
import { fetchEpicDeals } from '@/services/store/platforms/epic';
import { fetchGogDeals } from '@/services/store/platforms/gog';
import { fetchNintendoDeals } from '@/services/store/platforms/nintendo';
import { fetchPlayStationDeals } from '@/services/store/platforms/ps';
import { fetchSteamDeals } from '@/services/store/platforms/steam';
import { fetchXboxDeals } from '@/services/store/platforms/xbox';
import type { GameSummary, LiveGame, StoreRequestOptions } from '@/services/store/types';

const DEALS_PER_PLATFORM = 12;

export type HomeSection = Readonly<{
  platform: string;
  games: GameSummary[];
}>;

type DealsFetcher = (limit: number, options?: StoreRequestOptions) => Promise<LiveGame[]>;

const HOME_PROVIDERS: readonly Readonly<{ platform: string; fetch: DealsFetcher }>[] = [
  { platform: 'Steam', fetch: fetchSteamDeals },
  { platform: 'PlayStation', fetch: fetchPlayStationDeals },
  { platform: 'Xbox', fetch: fetchXboxDeals },
  { platform: 'Epic Games', fetch: fetchEpicDeals },
  { platform: 'GOG', fetch: fetchGogDeals },
  { platform: 'Nintendo', fetch: fetchNintendoDeals },
];

/** One discounted-games strip per store; a failing store only drops its own strip. */
export async function getHomeSections(options?: StoreRequestOptions): Promise<HomeSection[]> {
  const results = await Promise.allSettled(
    HOME_PROVIDERS.map((provider) => provider.fetch(DEALS_PER_PLATFORM, options)),
  );
  throwIfAborted(options?.signal);

  const sections = HOME_PROVIDERS.flatMap((provider, index) => {
    const result = results[index];
    if (result?.status !== 'fulfilled' || result.value.length === 0) return [];
    return [{ platform: provider.platform, games: result.value.map(prepareLiveGame) }];
  });

  rememberDetailPreviews(sections.flatMap((section) => section.games));
  return sections.map((section) => ({
    platform: section.platform,
    games: section.games.map(liveGameToSummary),
  }));
}
