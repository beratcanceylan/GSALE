import { searchCatalog } from '@/services/catalog/state';
import { throwIfAborted } from '@/services/store/fetch';
import { mergeSearchHits, prepareLiveGame } from '@/services/store/merge';
import { searchEpic } from '@/services/store/platforms/epic';
import { searchGog } from '@/services/store/platforms/gog';
import { searchNintendo } from '@/services/store/platforms/nintendo';
import { searchPlayStation } from '@/services/store/platforms/ps';
import { searchSteam } from '@/services/store/platforms/steam';
import { searchXbox } from '@/services/store/platforms/xbox';
import type { LiveGame, PlatformSearchHit, StoreRequestOptions } from '@/services/store/types';

async function runMultiPlatformSearch(
  query: string,
  options?: StoreRequestOptions,
): Promise<PlatformSearchHit[]> {
  const [ps, steam, epic, xbox, gog, nintendo, catalog] = await Promise.allSettled([
    searchPlayStation(query, options),
    searchSteam(query, options),
    searchEpic(query, options),
    searchXbox(query, options),
    searchGog(query, options),
    searchNintendo(query, options),
    searchCatalog(query),
  ]);

  throwIfAborted(options?.signal);

  const hits: PlatformSearchHit[] = [];
  const append = (result: PromiseSettledResult<PlatformSearchHit[]>) => {
    if (result.status === 'fulfilled') hits.push(...result.value);
  };

  append(ps);
  append(steam);
  append(epic);
  append(xbox);
  append(gog);
  append(nintendo);
  // Catalog hits come last so live results (current prices, new releases) win the merge.
  append(catalog);

  return hits;
}

/** Search hits from every store merged into one list; prices are looked up on the detail screen. */
export async function searchLiveGames(
  query: string,
  options?: StoreRequestOptions,
): Promise<LiveGame[]> {
  const hits = await runMultiPlatformSearch(query, options);
  return mergeSearchHits(hits, query).map(prepareLiveGame);
}
