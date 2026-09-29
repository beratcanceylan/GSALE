/**
 * Game Data Service
 * Backend API üzerinden oyun verilerini çeker.
 * Eski statik JSON import'u kaldırıldı.
 */

import {
  searchGames,
  getGameDetail,
  getHomeSections,
  getFreeGames,
  type GameSummary,
  type GameDetailResponse,
  type Price,
  type StoreRequestOptions,
} from './api';
import { resolveCardPrice } from '@/utils/gameDisplay';

// Uyumluluk için eski tipleri koruyalım ama yeni yapıya map'leyelim
interface Deal {
  platform: string;
  price: string;
  originalPrice?: string | undefined;
  discount: string;
  url: string;
  subscriptionNote?: string | undefined;
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
  description?: string | undefined;
  genres?: string[] | undefined;
  screenshots?: string[] | undefined;
  developers?: string[] | undefined;
  release_date?: string | undefined;
  videos?: { platform: string; id: string; url?: string; thumbnail?: string }[] | undefined;
  deals: Deal[];
  rating?: number | null | undefined;
  store_links?: Record<string, string> | undefined;
  upcoming?: boolean | undefined;
  upcoming_date_str?: string | undefined;
}

// GameSummary → Game dönüşümü (UI bileşenleri ile uyumluluk)
function mapSummaryToGame(summary: GameSummary): Game {
  const deals: Deal[] = (summary.deals || []).map(d => ({
    platform: d.platform,
    price: d.price,
    originalPrice: d.original_price,
    discount: d.discount,
    url: d.store_url || '',
    subscriptionNote: d.subscription_note,
  }));

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
  if (summary.description) game.description = summary.description;
  if (summary.genres) game.genres = summary.genres;
  if (summary.screenshots) game.screenshots = summary.screenshots;
  if (summary.developers) game.developers = summary.developers;
  if (summary.release_date) game.release_date = summary.release_date;
  if (summary.videos) game.videos = summary.videos;
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

// GameDetailResponse → Game dönüşümü (fiyatlar dahil)
function mapDetailToGame(detail: GameDetailResponse): Game {
  const deals: Deal[] = detail.prices.map((p: Price) => ({
    platform: p.platform,
    price: p.price || 'Bilinmiyor',
    originalPrice: p.original_price || undefined,
    discount: p.discount || '',
    url: p.store_url || '',
    subscriptionNote: p.subscription_note || undefined,
  }));

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
  };
  if (detail.game.platforms) game.platforms = detail.game.platforms;
  if (firstDeal?.originalPrice !== undefined) game.originalPrice = firstDeal.originalPrice;
  if (detail.game.description) game.description = detail.game.description;
  if (detail.game.genres) game.genres = detail.game.genres;
  if (detail.game.screenshots) game.screenshots = detail.game.screenshots;
  if (detail.game.developers) game.developers = detail.game.developers;
  if (detail.game.release_date) game.release_date = detail.game.release_date;
  if (detail.game.videos) game.videos = detail.game.videos;
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
