import { fetchFreeGames } from '@/services/gameData';

import { createListStore } from './createListStore';

export const freeGamesStore = createListStore(() => fetchFreeGames());
