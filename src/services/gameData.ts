/**
 * Game data for the screens: store API results mapped to the UI `Game` shape.
 */

import {
  searchGames,
  getGameDetail,
  getHomeSections,
  getFreeGames,
  type GameSummary,
  type EditionKey,
  type GameDetailResponse,
  type StoreRequestOptions,
} from './api';
import { resolveCardPrice } from '@/utils/gameDisplay';

export interface Deal {
  platform: string;
  price: string;
  originalPrice?: string | undefined;
  discount: string;
  url: string;
  subscriptionNote?: string | undefined;
}

export interface EditionOptionView {
  key: EditionKey;
  deals: Deal[];
}

export interface Game {
  id: string;
  title: string;
  platform: string;
  source_platform?: string | undefined;
  platforms?: string[] | undefined;
  discount: string;
  price: string;
  originalPrice?: string | undefined;
  imageUrl: string;
  url: string;
  deals: Deal[];
  /** Edition of the opened product (detail only). */
  edition?: EditionKey | undefined;
  /** Every edition across the stores, base first (detail only). */
  editions?: EditionOptionView[] | undefined;
  rating?: number | null | undefined;
  store_links?: Record<string, string> | undefined;
  upcoming?: boolean | undefined;
  upcoming_date_str?: string | undefined;
}

// GameSummary → Game dönüşümü (UI bileşenleri ile uyumluluk)
function mapSummaryToGame(summary: GameSummary): Game {
  const deals: Deal[] = (summary.deals || []).map(mapDeal);

  const game: Game = {
    id: summary.id,
    title: summary.title,
    platform: summary.platform || summary.platforms?.[0] || '',
    source_platform: summary.source_platform || summary.platform || summary.platforms?.[0] || '',
    discount: summary.discount || '',
    price: summary.price || '',
    imageUrl: summary.image_url,
    url: '',
    deals,
    rating: summary.rating,
  };
  if (summary.platforms) game.platforms = summary.platforms;
  if (summary.original_price !== undefined) game.originalPrice = summary.original_price;
  if (summary.store_links) game.store_links = summary.store_links;
  if (summary.upcoming !== undefined) game.upcoming = summary.upcoming;
  if (summary.upcoming_date_str) game.upcoming_date_str = summary.upcoming_date_str;
  return applyResolvedSummaryPrice(game);
}

function applyResolvedSummaryPrice(game: Game): Game {
  const card = resolveCardPrice(game);
  if (!card.purchasable) return game;
  return {
    ...game,
    price: card.price,
    originalPrice: card.originalPrice ?? game.originalPrice,
    discount: card.discount,
  };
}

function mapDeal(deal: NonNullable<GameSummary['deals']>[number]): Deal {
  return {
    platform: deal.platform,
    price: deal.price,
    originalPrice: deal.original_price,
    discount: deal.discount,
    url: deal.store_url || '',
    subscriptionNote: deal.subscription_note,
  };
}

/** The opened product with every edition; `deals` are the opened edition's (or the first edition's). */
function mapDetailToGame(detail: GameDetailResponse): Game {
  const editions: EditionOptionView[] = detail.editions.map((option) => ({
    key: option.key,
    deals: option.deals.map(mapDeal),
  }));
  const selected = editions.find((option) => option.key === detail.game.edition) ?? editions[0];
  const deals = selected?.deals ?? [];
  const firstDeal = deals[0];

  const game: Game = {
    id: detail.game.id,
    title: detail.game.title,
    platform: firstDeal?.platform || detail.game.platforms?.[0] || '',
    source_platform: detail.game.source_platform || detail.game.platform || detail.game.platforms?.[0] || '',
    discount: firstDeal?.discount || '',
    price: firstDeal?.price || '',
    imageUrl: detail.game.image_url,
    url: firstDeal?.url || '',
    deals,
    rating: detail.game.rating,
    edition: detail.game.edition,
    editions,
  };
  if (detail.game.platforms) game.platforms = detail.game.platforms;
  if (firstDeal?.originalPrice !== undefined) game.originalPrice = firstDeal.originalPrice;
  if (detail.game.store_links) game.store_links = detail.game.store_links;
  return applyResolvedSummaryPrice(game);
}

// --- Public API ---

export interface HomeSection {
  platform: string;
  games: Game[];
}

export async function fetchHomeSections(options?: StoreRequestOptions): Promise<HomeSection[]> {
  const sections = await getHomeSections(options);
  return sections.map((section) => ({
    platform: section.platform,
    games: section.games.map(mapSummaryToGame),
  }));
}

export async function fetchSearchResults(
  query: string,
  options?: StoreRequestOptions,
): Promise<Game[]> {
  const summaries = await searchGames(query, options);
  return summaries.map(mapSummaryToGame);
}

export async function fetchGameDetail(
  slug: string,
  platformHint?: string,
  options?: StoreRequestOptions,
): Promise<Game> {
  const detail = await getGameDetail(slug, platformHint, options);
  return mapDetailToGame(detail);
}

export async function fetchFreeGames(options?: StoreRequestOptions): Promise<Game[]> {
  const summaries = await getFreeGames(options);
  return summaries.map(mapSummaryToGame);
}
