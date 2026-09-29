import { extractEdition, scoreProductTitleMatch } from '@/services/store/match';
import { getDetailPreview } from '@/services/store/detail-preview';
import { mergeDetailMetadata, needsDetailMetadata } from '@/services/store/detail-metadata';
import { throwIfAborted } from '@/services/store/fetch';
import { fetchEpicDetails, searchEpic } from '@/services/store/platforms/epic';
import { fetchGogDetails, searchGog } from '@/services/store/platforms/gog';
import { fetchNintendoDetails, searchNintendo } from '@/services/store/platforms/nintendo';
import { fetchPlayStationDetails, searchPlayStation } from '@/services/store/platforms/ps';
import { fetchSteamDetails, searchSteam } from '@/services/store/platforms/steam';
import { fetchXboxDetails, searchXbox } from '@/services/store/platforms/xbox';
import { fetchAllPrices } from '@/services/store/prices';
import type { LiveGame, PlatformSearchHit, StoreRequestOptions } from '@/services/store/types';

const PLATFORM_HINT_MAP: Record<string, string> = {
  Steam: 'steam',
  'Epic Games': 'epic',
  PlayStation: 'ps',
  Xbox: 'xbox',
  GOG: 'gog',
  Nintendo: 'nintendo',
};

type PlatformSearch = (query: string, options?: StoreRequestOptions) => Promise<PlatformSearchHit[]>;

const DETAIL_METADATA_SEARCHES: readonly { platform: string; search: PlatformSearch }[] = [
  { platform: 'Steam', search: searchSteam },
  { platform: 'Epic Games', search: searchEpic },
  { platform: 'GOG', search: searchGog },
  { platform: 'Xbox', search: searchXbox },
  { platform: 'PlayStation', search: searchPlayStation },
  { platform: 'Nintendo', search: searchNintendo },
];

function bestMetadataHit(
  hits: readonly PlatformSearchHit[],
  title: string,
): PlatformSearchHit | null {
  let best: PlatformSearchHit | null = null;
  let bestScore = 0;
  for (const hit of hits) {
    const score = scoreProductTitleMatch(hit.title, title);
    if (score > bestScore) {
      best = hit;
      bestScore = score;
    }
  }
  return bestScore >= 50 ? best : null;
}

async function fetchMetadataCandidates(
  title: string,
  excludePlatform: string,
  options?: StoreRequestOptions,
): Promise<LiveGame[]> {
  const searchResults = await Promise.allSettled(
    DETAIL_METADATA_SEARCHES
      .filter(({ platform }) => platform !== excludePlatform)
      .map(async ({ platform, search }) => ({
        platform,
        hits: await search(title, options),
      })),
  );
  throwIfAborted(options?.signal);

  const hits = searchResults.flatMap((result) =>
    result.status === 'fulfilled'
      ? [
          {
            platform: result.value.platform,
            hit: bestMetadataHit(result.value.hits, title),
          },
        ]
      : [],
  );
  const detailResults = await Promise.allSettled(
    hits.flatMap(({ platform, hit }) => {
      if (!hit) return [];
      const slug = hit.slug ?? hit.id;
      return [fetchGameBySlug(slug, platform, options)];
    }),
  );
  throwIfAborted(options?.signal);
  return detailResults.flatMap((result) =>
    result.status === 'fulfilled' && result.value ? [result.value] : [],
  );
}

function detectPlatform(slug: string, hint?: string): string {
  if (slug.startsWith('epic-')) return 'epic';
  if (slug.startsWith('ps-')) return 'ps';
  if (slug.startsWith('xbox-')) return 'xbox';
  if (slug.startsWith('gog-')) return 'gog';
  if (slug.startsWith('nintendo-')) return 'nintendo';
  if (/^\d+$/.test(slug)) return 'steam';
  if (slug.includes('_') && !slug.startsWith('gog-')) return 'epic';

  if (hint) {
    const mapped = PLATFORM_HINT_MAP[hint];
    if (mapped) return mapped;
  }
  return 'steam';
}

export async function fetchGameBySlug(
  slug: string,
  platformHint?: string,
  options?: StoreRequestOptions,
): Promise<LiveGame | null> {
  const platform = detectPlatform(slug, platformHint);

  switch (platform) {
    case 'steam':
      return fetchSteamDetails(slug, options);
    case 'epic':
      return fetchEpicDetails(slug, undefined, options);
    case 'ps':
      return fetchPlayStationDetails(slug, options);
    case 'xbox':
      return fetchXboxDetails(slug, options);
    case 'gog':
      return fetchGogDetails(slug, options);
    case 'nintendo':
      return fetchNintendoDetails(slug, options);
    default:
      return fetchSteamDetails(slug, options);
  }
}

export async function fetchGameDetailLive(
  slug: string,
  platformHint?: string,
  options?: StoreRequestOptions,
): Promise<LiveGame | null> {
  const preview = getDetailPreview(slug, platformHint);
  let game: LiveGame | null;
  try {
    game = await fetchGameBySlug(slug, platformHint, options) ?? preview;
  } catch (error) {
    throwIfAborted(options?.signal);
    if (!preview) throw error;
    game = preview;
  }
  throwIfAborted(options?.signal);
  if (!game) return null;

  if (needsDetailMetadata(game)) {
    const candidates = await fetchMetadataCandidates(game.title, game.source_platform ?? game.platform, options);
    game = mergeDetailMetadata(game, candidates);
  }

  const edition = game.edition ?? extractEdition(game.title);
  const priceOptions = {
    edition,
    signal: options?.signal,
    ...(game.deals ? { knownDeals: game.deals } : {}),
  };
  const deals = await fetchAllPrices(game.title, priceOptions);
  return { ...game, deals, edition };
}
