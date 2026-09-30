import { getLanguage } from '@/i18n/languageStore';
import { getStoreCountry } from '@/services/store/config';
import type { EditionOffer } from '@/services/store/edition-table';
import { gameKey } from '@/services/store/editions';
import { fetchPlayStationPlusNames } from '@/services/store/platforms/ps';
import { fetchGamePassProductIds } from '@/services/store/platforms/xbox';
import type { StoreRequestOptions } from '@/services/store/types';

export const GAME_PASS_NOTE = 'Game Pass';
export const PS_PLUS_NOTE = 'PS Plus';

type Catalogs = Readonly<{ gamePass: ReadonlySet<string>; psPlus: ReadonlySet<string> }>;

/** The catalogs change weekly; read them once per country and language for the session. */
const catalogCache = new Map<string, Promise<Catalogs>>();

async function settledSet(request: Promise<Iterable<string>>): Promise<ReadonlySet<string>> {
  try {
    return new Set(await request);
  } catch {
    return new Set();
  }
}

async function loadCatalogs(options?: StoreRequestOptions): Promise<Catalogs> {
  const [gamePass, psPlusNames] = await Promise.all([
    settledSet(fetchGamePassProductIds(options)),
    settledSet(fetchPlayStationPlusNames(options)),
  ]);
  return { gamePass, psPlus: new Set([...psPlusNames].map(gameKey)) };
}

function catalogsFor(options?: StoreRequestOptions): Promise<Catalogs> {
  const key = `${getStoreCountry()}|${getLanguage()}`;
  let catalogs = catalogCache.get(key);
  if (!catalogs) {
    catalogs = loadCatalogs(options);
    catalogCache.set(key, catalogs);
    // A cancelled or failed read is retried next time instead of being remembered.
    catalogs.then(
      (loaded) => {
        if (loaded.gamePass.size === 0 && loaded.psPlus.size === 0) catalogCache.delete(key);
      },
      () => catalogCache.delete(key),
    );
  }
  return catalogs;
}

function subscriptionNote(offer: EditionOffer, catalogs: Catalogs): string | undefined {
  if (offer.platform === 'Xbox' && catalogs.gamePass.has(offer.id.replace(/^xbox-/, '').toUpperCase())) return GAME_PASS_NOTE;
  if (offer.platform === 'PlayStation' && catalogs.psPlus.has(gameKey(offer.title))) return PS_PLUS_NOTE;
  return undefined;
}

/** Marks Xbox offers in Game Pass and PlayStation games in the PS Plus catalog; prices stay as they are. */
export async function markSubscriptions(offers: readonly EditionOffer[], options?: StoreRequestOptions): Promise<EditionOffer[]> {
  if (!offers.some((offer) => offer.platform === 'Xbox' || offer.platform === 'PlayStation')) return [...offers];
  const catalogs = await catalogsFor(options);
  return offers.map((offer) => {
    const note = subscriptionNote(offer, catalogs);
    return note ? { ...offer, price: { ...offer.price, subscription_note: note } } : offer;
  });
}

/** Tests only. */
export function resetSubscriptionCacheForTests(): void {
  catalogCache.clear();
}
