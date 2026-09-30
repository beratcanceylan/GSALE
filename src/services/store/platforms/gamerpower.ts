import { STORE_CONFIG } from '@/services/store/config';
import { fetchJson, withRetry } from '@/services/store/fetch';
import type { LiveGame, StoreRequestOptions } from '@/services/store/types';

/** GamerPower's giveaway API: free for commercial use with a visible link back to gamerpower.com. */
const GAMERPOWER_GIVEAWAYS_URL = 'https://www.gamerpower.com/api/giveaways?type=game&sort-by=popularity';

interface GamerPowerGiveaway {
  id?: number;
  title?: string;
  platforms?: string;
  image?: string;
  thumbnail?: string;
  open_giveaway_url?: string;
}

/** Store names as GamerPower writes them, mapped to the app's names. */
const STORE_NAMES: Readonly<Record<string, string>> = {
  steam: 'Steam',
  'epic games store': 'Epic Games',
  gog: 'GOG',
  'itch.io': 'itch.io',
  'ubisoft connect': 'Ubisoft Connect',
  'ea app': 'EA app',
  'battle.net': 'Battle.net',
};
const MOBILE_ONLY = new Set(['android', 'ios']);
const GIVEAWAY_SUFFIX = /\s+Giveaway$/i;
const STORE_IN_TITLE = /\s*\(([^()]+)\)$/;

function isHttps(url: string | undefined): url is string {
  if (!url) return false;
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

/** "Hades (Steam) Giveaway" → title "Hades", store "Steam"; the store falls back to the platforms list. */
function parseGiveaway(entry: GamerPowerGiveaway): { title: string; store: string } | null {
  let title = (entry.title ?? '').trim().replace(GIVEAWAY_SUFFIX, '');
  const platforms = (entry.platforms ?? '').split(',').flatMap((part) => {
    const platform = part.trim().toLowerCase();
    return platform ? [platform] : [];
  });
  if (platforms.length > 0 && platforms.every((platform) => MOBILE_ONLY.has(platform))) return null;
  let store = platforms.map((platform) => STORE_NAMES[platform]).find(Boolean) ?? '';
  const named = STORE_IN_TITLE.exec(title);
  if (named?.[1]) {
    store = STORE_NAMES[named[1].trim().toLowerCase()] ?? named[1].trim();
    title = title.slice(0, named.index).trim();
  }
  return title && store ? { title, store } : null;
}

/** Game giveaways from every store GamerPower tracks (Steam, GOG, itch.io, IndieGala…). */
export async function fetchGamerPowerGiveaways(options?: StoreRequestOptions): Promise<LiveGame[]> {
  const data = await withRetry(
    () => fetchJson<unknown>(GAMERPOWER_GIVEAWAYS_URL, { signal: options?.signal }, STORE_CONFIG.timeout.long),
    0,
    options?.signal,
  );
  const entries: GamerPowerGiveaway[] = Array.isArray(data) ? (data as GamerPowerGiveaway[]) : [];
  return entries.flatMap((entry) => {
    const parsed = parseGiveaway(entry);
    if (!parsed || entry.id === undefined || !isHttps(entry.open_giveaway_url)) return [];
    const image = [entry.image, entry.thumbnail].find(isHttps) ?? '';
    return [{
      id: `gamerpower-${entry.id}`,
      slug: `gamerpower-${entry.id}`,
      title: parsed.title,
      image_url: image,
      platform: parsed.store,
      source_platform: parsed.store,
      platforms: [parsed.store],
      price: 'Ücretsiz',
      discount: '',
      rating: null,
      external_url: entry.open_giveaway_url,
    }];
  });
}
