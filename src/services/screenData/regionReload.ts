import { languageStore } from '@/i18n/languageStore';
import { countryStore } from '@/services/country';

import { freeGamesStore } from './freeGamesStore';
import { gameDetailStore } from './gameDetailStore';
import { homeStore } from './homeStore';
import { searchStore } from './searchStore';

/** Store content depends on the language and country: drop stale results and reload what is on screen. */
function reloadForRegion(): void {
  homeStore.invalidate();
  freeGamesStore.invalidate();
  if (searchStore.getSnapshot().hasSearched) searchStore.reload();
  gameDetailStore.reloadActive();
}

/** Starts reloading screens on language or country changes; returns a stop function. */
export function watchRegionChanges(): () => void {
  const stopLanguage = languageStore.subscribe(reloadForRegion);
  const stopCountry = countryStore.subscribe(reloadForRegion);
  return () => {
    stopLanguage();
    stopCountry();
  };
}
