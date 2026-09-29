import React from 'react';

import type { Game } from '@/services/gameData';
import { GameCard } from '@/components/GameCard';

type GameListItemProps = Readonly<{
  game: Game;
  aspectRatio?: number;
  hidePrice?: boolean;
}>;

function GameListItemComponent({ game, aspectRatio, hidePrice }: GameListItemProps) {
  return (
    <GameCard
      game={game}
      {...(aspectRatio !== undefined ? { aspectRatio } : {})}
      {...(hidePrice !== undefined ? { hidePrice } : {})}
    />
  );
}

function propsAreEqual(prev: GameListItemProps, next: GameListItemProps): boolean {
  return (
    prev.game.id === next.game.id &&
    prev.game.title === next.game.title &&
    prev.game.price === next.game.price &&
    prev.game.originalPrice === next.game.originalPrice &&
    prev.game.discount === next.game.discount &&
    prev.game.imageUrl === next.game.imageUrl &&
    prev.game.platforms?.length === next.game.platforms?.length &&
    !prev.game.platforms?.some((platform, index) => platform !== next.game.platforms?.[index]) &&
    prev.game.deals.length === next.game.deals.length &&
    prev.hidePrice === next.hidePrice &&
    prev.aspectRatio === next.aspectRatio &&
    prev.game.deals.every((deal, index) => {
      const nextDeal = next.game.deals[index];
      return Boolean(
        nextDeal &&
          deal.platform === nextDeal.platform &&
          deal.price === nextDeal.price &&
          deal.originalPrice === nextDeal.originalPrice &&
          deal.discount === nextDeal.discount &&
          deal.url === nextDeal.url &&
          deal.subscriptionNote === nextDeal.subscriptionNote,
      );
    })
  );
}

export const GameListItem = React.memo(GameListItemComponent, propsAreEqual);
