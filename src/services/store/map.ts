import { applyDealsToGame } from '@/services/store/deals';
import type { GameDetailResponse, GameSummary, LiveGame, Price } from '@/services/store/types';

export function liveGameToSummary(game: LiveGame): GameSummary {
  const withDeals = game.deals?.length ? applyDealsToGame(game, game.deals) : game;

  const summary: GameSummary = {
    id: withDeals.id,
    title: withDeals.title,
    image_url: withDeals.image_url,
    platform: withDeals.platform,
    source_platform: withDeals.source_platform ?? withDeals.platform,
    rating: withDeals.rating ?? null,
  };

  if (withDeals.description) summary.description = withDeals.description;
  if (withDeals.genres) summary.genres = withDeals.genres;
  if (withDeals.developers) summary.developers = withDeals.developers;
  if (withDeals.release_date) summary.release_date = withDeals.release_date;
  if (withDeals.screenshots) summary.screenshots = withDeals.screenshots;
  if (withDeals.videos) summary.videos = withDeals.videos;
  if (withDeals.store_links) summary.store_links = withDeals.store_links;
  if (withDeals.platforms) summary.platforms = withDeals.platforms;
  if (withDeals.price) summary.price = withDeals.price;
  if (withDeals.discount) summary.discount = withDeals.discount;
  if (withDeals.original_price) summary.original_price = withDeals.original_price;
  if (withDeals.deals) summary.deals = withDeals.deals;
  if (withDeals.upcoming !== undefined) summary.upcoming = withDeals.upcoming;
  if (withDeals.upcoming_date_str) summary.upcoming_date_str = withDeals.upcoming_date_str;

  return summary;
}

export function liveGameToDetailResponse(game: LiveGame, fetchedAt: number): GameDetailResponse {
  const summary = liveGameToSummary(game);
  const prices: Price[] = (game.deals ?? []).map((deal, index) => ({
    id: index + 1,
    game_id: game.id,
    platform: deal.platform,
    price: deal.price,
    original_price: deal.original_price ?? null,
    discount: deal.discount || null,
    store_url: deal.store_url ?? null,
    subscription_note: deal.subscription_note ?? null,
    fetched_at: fetchedAt,
  }));

  return {
    game: summary,
    prices,
    meta: {
      prices_fetched_at: prices.length > 0 ? fetchedAt : null,
    },
  };
}
