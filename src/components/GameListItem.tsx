import type { Game } from '@/services/gameData';
import { GameCard } from '@/components/GameCard';

type GameListItemProps = Readonly<{
  game: Game;
  aspectRatio?: number;
  hidePrice?: boolean;
}>;

/** List row for search, favorites and free games; `GameCard` does the memoisation. */
export function GameListItem({ game, aspectRatio, hidePrice }: GameListItemProps) {
  return (
    <GameCard
      game={game}
      {...(aspectRatio !== undefined ? { aspectRatio } : {})}
      {...(hidePrice !== undefined ? { hidePrice } : {})}
    />
  );
}
