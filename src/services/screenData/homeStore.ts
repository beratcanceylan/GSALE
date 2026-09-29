import { fetchHomeSections } from '@/services/gameData';

import { createListStore } from './createListStore';

export const homeStore = createListStore(() => fetchHomeSections());
