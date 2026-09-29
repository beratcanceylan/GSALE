import type { Game } from '@/services/gameData';

import { GameCard } from '@/components/GameCard';

export function FeaturedDeal({ game }: Readonly<{ game: Game }>) {
  return <GameCard game={game} featuredLabel />;
}
