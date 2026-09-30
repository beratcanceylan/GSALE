import { getDetailPreview } from '@/services/store/detail-preview';
import { buildEditionTable, type EditionOffer, type EditionOption } from '@/services/store/edition-table';
import { compareEditions, editionKey, type EditionKey } from '@/services/store/editions';
import { throwIfAborted } from '@/services/store/fetch';
import { fetchEpicDetails } from '@/services/store/platforms/epic';
import { fetchGogDetails } from '@/services/store/platforms/gog';
import { fetchNintendoDetails } from '@/services/store/platforms/nintendo';
import { fetchPlayStationDetails } from '@/services/store/platforms/ps';
import { fetchSteamDetails } from '@/services/store/platforms/steam';
import { fetchXboxDetails } from '@/services/store/platforms/xbox';
import { fetchEditionOffers } from '@/services/store/prices';
import type { LiveGame, StoreRequestOptions } from '@/services/store/types';

const PLATFORM_HINT_MAP: Record<string, string> = {
  Steam: 'steam',
  'Epic Games': 'epic',
  PlayStation: 'ps',
  Xbox: 'xbox',
  GOG: 'gog',
  Nintendo: 'nintendo',
};

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

export type LiveGameDetail = Readonly<{
  game: LiveGame & { edition: EditionKey };
  editions: EditionOption[];
}>;

/** The opened product's own price, used when no store search listed that edition. */
function sourceOffer(game: LiveGame, edition: EditionKey): EditionOffer | null {
  const deal = game.deals?.[0];
  if (!deal) return null;
  return { platform: deal.platform, edition, title: game.title, id: game.id, price: { ...deal } };
}

function hasOffer(offers: readonly EditionOffer[], platform: string, edition: EditionKey): boolean {
  return offers.some((offer) => offer.platform === platform && offer.edition === edition);
}

/** The opened product plus every edition of its game across the stores. */
export async function fetchGameDetailLive(
  slug: string,
  platformHint?: string,
  options?: StoreRequestOptions,
): Promise<LiveGameDetail | null> {
  const preview = getDetailPreview(slug, platformHint);
  let game: LiveGame | null;
  try {
    game = (await fetchGameBySlug(slug, platformHint, options)) ?? preview;
  } catch (error) {
    throwIfAborted(options?.signal);
    if (!preview) throw error;
    game = preview;
  }
  throwIfAborted(options?.signal);
  if (!game) return null;

  const edition = editionKey(game.title);
  const offers = await fetchEditionOffers(game.title, options);
  const source = sourceOffer(game, edition);
  const withSource = source && !hasOffer(offers, source.platform, edition) ? [...offers, source] : offers;
  const editions = buildEditionTable(withSource);
  // The opened product's edition keeps its tab even when no store prices it right now.
  if (!editions.some((option) => option.key === edition)) {
    editions.push({ key: edition, deals: [] });
    editions.sort((a, b) => compareEditions(a.key, b.key));
  }
  return { game: { ...game, edition }, editions };
}
