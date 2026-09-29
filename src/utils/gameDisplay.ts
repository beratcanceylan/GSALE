import type { ImageSource } from 'expo-image';

import type { Game } from '@/services/gameData';
import { normalizeProtocolRelativeUri } from '@/services/store/image-uri';
import {
  extractNumericPrice,
  isExplicitlyFreePrice,
  isUnavailablePrice,
} from '@/services/store/price-parse';

export { isUnavailablePrice } from '@/services/store/price-parse';

export function getTitleInitial(title: string): string {
  const match = /[A-Za-zÇĞİÖŞÜçğıöşü]/.exec(title);
  return match ? match[0].toUpperCase() : '?';
}

/** Ensure https scheme and Xbox protocol-relative URIs work in expo-image. */
function normalizeImageUri(uri: string): string {
  const trimmed = uri.trim();
  if (!trimmed) return '';
  return normalizeProtocolRelativeUri(trimmed);
}

/** Store and media links are opened outside the app; keep the handoff HTTPS-only. */
export function isSafeExternalUrl(value: string | undefined | null): boolean {
  if (!value) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export function imageSourceFromUri(uri: string): ImageSource | null {
  const normalized = normalizeImageUri(uri);
  if (!normalized) return null;
  const headers = headersForImageUrl(normalized);
  return headers ? { uri: normalized, headers } : { uri: normalized };
}

function headersForImageUrl(uri: string): Record<string, string> | undefined {
  const ua =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  if (uri.includes('playstation.net') || uri.includes('playstation.com')) {
    return { Referer: 'https://store.playstation.com/', 'User-Agent': ua };
  }
  if (uri.includes('s-microsoft.com') || uri.includes('xbox.com')) {
    return { Referer: 'https://www.xbox.com/', 'User-Agent': ua };
  }
  if (uri.includes('epicgames.com')) {
    return { Referer: 'https://store.epicgames.com/', 'User-Agent': ua };
  }
  return { 'User-Agent': ua };
}

function collectSteamAppIds(
  game: Pick<Game, 'id' | 'deals' | 'source_platform' | 'platform'>,
  includeDealIds: boolean,
): string[] {
  const ids = new Set<string>();

  if (/^\d+$/.test(game.id)) ids.add(game.id);
  const steamPrefix = /^steam-(\d+)$/i.exec(game.id);
  if (steamPrefix?.[1]) ids.add(steamPrefix[1]);

  if (includeDealIds) {
    for (const deal of game.deals) {
      const fromUrl = /store\.steampowered\.com\/app\/(\d+)/i.exec(deal.url || '');
      if (fromUrl?.[1]) ids.add(fromUrl[1]);
    }
  }

  return [...ids];
}

export function getGameImageSources(
  game: Pick<Game, 'id' | 'imageUrl' | 'deals' | 'source_platform' | 'platform'>,
): ImageSource[] {
  const entries: ImageSource[] = [];
  const seen = new Set<string>();
  const sourcePlatform = game.source_platform || game.platform || '';
  const isSteamSource = sourcePlatform === 'Steam';

  const addUri = (uri: string) => {
    const normalized = normalizeImageUri(uri);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    const headers = headersForImageUrl(normalized);
    entries.push(headers ? { uri: normalized, headers } : { uri: normalized });
  };

  if (game.imageUrl.trim()) addUri(game.imageUrl.trim());

  if (isSteamSource || !game.imageUrl.trim()) {
    for (const steamId of collectSteamAppIds(game, isSteamSource)) {
      addUri(`https://cdn.akamai.steamstatic.com/steam/apps/${steamId}/header.jpg`);
      addUri(`https://cdn.cloudflare.steamstatic.com/steam/apps/${steamId}/header.jpg`);
    }
  }

  return entries;
}

export function parseComparablePrice(price: string): number {
  if (isUnavailablePrice(price)) return Number.POSITIVE_INFINITY;
  const numeric = extractNumericPrice(price);
  if (numeric !== null && numeric > 0) return numeric;
  if (isExplicitlyFreePrice(price)) return 0;
  if (numeric === 0) return 0;
  return Number.POSITIVE_INFINITY;
}

export function pickBestDealForDisplay(
  deals: Game['deals'],
): Game['deals'][number] | null {
  const available = deals.filter((deal) => !isUnavailablePrice(deal.price));
  const paid = available.filter((deal) => !isExplicitlyFreePrice(deal.price));
  const pool = paid.length > 0 ? paid : available;
  const first = pool[0];
  if (!first) return null;

  return pool.reduce((best, deal) => {
    return parseComparablePrice(deal.price) < parseComparablePrice(best.price) ? deal : best;
  }, first);
}

export type CardPriceInfo = {
  purchasable: boolean;
  price: string;
  originalPrice?: string;
  discount: string;
};

export function resolveCardPrice(game: Game): CardPriceInfo {
  const bestDeal = pickBestDealForDisplay(game.deals);
  if (bestDeal) {
    const info: CardPriceInfo = {
      purchasable: true,
      price: bestDeal.price,
      discount: bestDeal.discount || game.discount || '',
    };
    if (bestDeal.originalPrice && !isUnavailablePrice(bestDeal.originalPrice)) {
      info.originalPrice = bestDeal.originalPrice;
    } else if (game.originalPrice && !isUnavailablePrice(game.originalPrice)) {
      info.originalPrice = game.originalPrice;
    }
    return info;
  }

  if (!isUnavailablePrice(game.price)) {
    const info: CardPriceInfo = {
      purchasable: true,
      price: game.price,
      discount: game.discount || '',
    };
    if (game.originalPrice && !isUnavailablePrice(game.originalPrice)) {
      info.originalPrice = game.originalPrice;
    }
    return info;
  }

  return { purchasable: false, price: '', discount: '' };
}

export function getDealPlatforms(
  game: Pick<Game, 'deals' | 'platforms' | 'store_links' | 'platform' | 'source_platform'>,
): string[] {
  const seen = new Set<string>();
  const canonicalPlatform = (platform: string): string => {
    const normalized = platform.toLowerCase().trim();
    if (
      normalized === 'ps' ||
      normalized === 'ps4' ||
      normalized === 'ps5' ||
      normalized.startsWith('playstation')
    ) {
      return 'PlayStation';
    }
    if (normalized === 'switch' || normalized.startsWith('nintendo switch') || normalized === 'nintendo') {
      return 'Nintendo';
    }
    if (normalized === 'epic') return 'Epic Games';
    return platform.trim();
  };
  const addPlatform = (platform: string): void => {
    const canonical = canonicalPlatform(platform);
    if (canonical.length > 0) seen.add(canonical);
  };

  for (const deal of game.deals) {
    addPlatform(deal.platform);
  }
  for (const platform of game.platforms ?? []) {
    addPlatform(platform);
  }
  for (const platform of Object.keys(game.store_links ?? {})) {
    addPlatform(platform);
  }
  const fromDeals = [...seen];
  if (fromDeals.length > 0) return fromDeals;
  if (game.platform) return [game.platform];
  if (game.source_platform) return [game.source_platform];
  return [];
}
