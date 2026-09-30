import { fetchPopularGames } from '@/services/gameData';

import { createListStore } from './createListStore';

export const homeStore = createListStore((signal) => fetchPopularGames({ signal }));
