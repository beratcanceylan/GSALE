import { applyDealsToGame } from '@/services/store/deals';
import type { LiveGameDetail } from '@/services/store/detail';
import type { GameDetailResponse, GameSummary, LiveGame } from '@/services/store/types';

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

  if (withDeals.store_links) summary.store_links = withDeals.store_links;
  if (withDeals.external_url) summary.external_url = withDeals.external_url;
  if (withDeals.platforms) summary.platforms = withDeals.platforms;
  if (withDeals.price) summary.price = withDeals.price;
  if (withDeals.discount) summary.discount = withDeals.discount;
  if (withDeals.original_price) summary.original_price = withDeals.original_price;
  if (withDeals.deals) summary.deals = withDeals.deals;
  if (withDeals.upcoming !== undefined) summary.upcoming = withDeals.upcoming;
  if (withDeals.upcoming_date_str) summary.upcoming_date_str = withDeals.upcoming_date_str;

  return summary;
}

export function liveGameToDetailResponse(detail: LiveGameDetail): GameDetailResponse {
  return {
    game: { ...liveGameToSummary(detail.game), edition: detail.game.edition },
    editions: detail.editions,
  };
}
