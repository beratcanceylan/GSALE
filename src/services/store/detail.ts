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

async function searchPlatformHits(
  platform: string,
  search: (typeof DETAIL_METADATA_SEARCHES)[number]['search'],
  title: string,
  options?: StoreRequestOptions,
): Promise<{ platform: string; hits: Awaited<ReturnType<typeof search>> }> {
  return { platform, hits: await search(title, options) };
}

async function fetchMetadataCandidates(
  title: string,
  excludePlatform: string,
  options?: StoreRequestOptions,
): Promise<LiveGame[]> {
  const searchResults = await Promise.allSettled(
    DETAIL_METADATA_SEARCHES.flatMap(({ platform, search }) =>
      platform === excludePlatform ? [] : [searchPlatformHits(platform, search, title, options)],
    ),
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

type DetailFetcher = (slug: string, options?: StoreRequestOptions) => Promise<LiveGame | null>;

const DETAIL_FETCHERS: Readonly<Record<string, DetailFetcher>> = {
  steam: fetchSteamDetails,
  epic: (slug, options) => fetchEpicDetails(slug, undefined, options),
  ps: fetchPlayStationDetails,
  xbox: fetchXboxDetails,
  gog: fetchGogDetails,
  nintendo: fetchNintendoDetails,
};

const SLUG_PREFIXES: readonly (readonly [string, string])[] = [
  ['epic-', 'epic'],
  ['ps-', 'ps'],
  ['xbox-', 'xbox'],
  ['gog-', 'gog'],
  ['nintendo-', 'nintendo'],
];

/** Route ids carry their store: a prefix, a numeric Steam app id, or an Epic "<namespace>_<offer>". */
function detectPlatform(slug: string, hint?: string): string {
  const prefixed = SLUG_PREFIXES.find(([prefix]) => slug.startsWith(prefix));
  if (prefixed) return prefixed[1];
  if (/^\d+$/.test(slug)) return 'steam';
  if (slug.includes('_')) return 'epic';
  return (hint && PLATFORM_HINT_MAP[hint]) || 'steam';
}

export async function fetchGameBySlug(
  slug: string,
  platformHint?: string,
  options?: StoreRequestOptions,
): Promise<LiveGame | null> {
  const fetchDetails = DETAIL_FETCHERS[detectPlatform(slug, platformHint)] ?? fetchSteamDetails;
  return fetchDetails(slug, options);
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
