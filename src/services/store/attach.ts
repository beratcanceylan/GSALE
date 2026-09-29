import { applyDealsToGame, platformPriceToGameDeal } from '@/services/store/deals';
import { mapWithConcurrencyLimit } from '@/services/store/concurrency';
import { throwIfAborted } from '@/services/store/fetch';
import { extractEdition } from '@/services/store/match';
import { fetchPlatformDeal } from '@/services/store/prices';
import { fetchNintendoPrices } from '@/services/store/platforms/nintendo';
import { isUnavailablePrice } from '@/services/store/price-parse';
import type { GameDeal, LiveGame, StoreRequestOptions } from '@/services/store/types';

const DEFAULT_CONCURRENCY = 4;

type AttachOptions = StoreRequestOptions & {
  concurrency?: number;
  skipIfHasDeals?: boolean;
};

type WorkItem = Readonly<{
  game: LiveGame;
  index: number;
  edition: string;
}>;

const PRICE_PLATFORMS = ['Steam', 'Epic Games', 'GOG', 'Xbox', 'PlayStation', 'Nintendo'] as const;

function hasUsableDeal(game: LiveGame, platform: string): boolean {
  return Boolean(
    game.deals?.some(
      (deal) => deal.platform === platform && deal.price.trim() && !isUnavailablePrice(deal.price),
    ),
  );
}

export async function attachDealsToGames(
  games: LiveGame[],
  options?: AttachOptions,
): Promise<LiveGame[]> {
  throwIfAborted(options?.signal);
  if (games.length === 0) return [];

  const concurrency = options?.concurrency ?? DEFAULT_CONCURRENCY;
  const skipIfHasDeals = options?.skipIfHasDeals ?? false;
  const resultDeals: GameDeal[][] = games.map((game) => [...(game.deals ?? [])]);
  const skipped = games.map(
    (game) => skipIfHasDeals && Boolean(game.deals && game.deals.length > 0),
  );
  const workItems: WorkItem[] = games.flatMap((game, index) => {
    if (skipped[index]) return [];
    return [{
      game,
      index,
      edition: game.edition ?? extractEdition(game.title),
    }];
  });

  // Keep the existing per-provider concurrency while preventing a slow store
  // from occupying the only slot that could start work for other stores.
  const providerResults = await Promise.all(
    PRICE_PLATFORMS.map(async (platform) => {
      const providerWork = workItems.filter((item) => !hasUsableDeal(item.game, platform));
      if (platform === 'Nintendo') {
        let bulkPrices: Awaited<ReturnType<typeof fetchNintendoPrices>>;
        try {
          bulkPrices = await fetchNintendoPrices(
            providerWork.map((item) => item.game.title),
            options,
          );
        } catch (error) {
          if (options?.signal?.aborted) throw error;
          return providerWork.map((item) => ({ item, deal: null }));
        }
        const bulkPricesByTitle = Object.fromEntries(bulkPrices);
        return providerWork.map((item) => {
          const price = bulkPricesByTitle[item.game.title];
          return { item, deal: price ? platformPriceToGameDeal(price) : null };
        });
      }
      const deals = await mapWithConcurrencyLimit(providerWork, concurrency, async (item) => {
        try {
          const deal = await fetchPlatformDeal(platform, item.game.title, {
            edition: item.edition,
            signal: options?.signal,
          });
          return { item, deal };
        } catch (error) {
          // A failed provider should not discard the other store prices. Keep
          // explicit caller cancellation observable so screen generations can
          // suppress the obsolete result immediately.
          if (options?.signal?.aborted) throw error;
          return { item, deal: null };
        }
      });
      return deals;
    }),
  );

  // Promise.all preserves PRICE_PLATFORMS order, even when a slower provider
  // finishes after the others.
  for (const deals of providerResults) {
    for (const { item, deal } of deals) {
      const currentDeals = resultDeals[item.index];
      if (deal && currentDeals) currentDeals.push(deal);
    }
  }

  throwIfAborted(options?.signal);

  return games.map((game, index) =>
    skipped[index] ? game : applyDealsToGame(game, resultDeals[index] ?? []),
  );
}
