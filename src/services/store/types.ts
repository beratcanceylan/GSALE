import type { EditionOption } from '@/services/store/edition-table';
import type { EditionKey } from '@/services/store/editions';

/** Store layer types aligned with src/services/api.ts */

export interface GameDeal {
  platform: string;
  price: string;
  original_price?: string;
  discount: string;
  store_url?: string;
  subscription_note?: string;
  tier?: 'pc' | 'console' | 'mobile';
}

/** Optional controls shared by the public in-app store APIs. */
export interface StoreRequestOptions {
  signal?: AbortSignal | undefined;
}

export interface LiveGame {
  id: string;
  title: string;
  image_url: string;
  platform: string;
  source_platform?: string;
  slug?: string;
  edition?: EditionKey;
  store_links?: Record<string, string>;
  platforms?: string[];
  price?: string;
  original_price?: string;
  discount?: string;
  deals?: GameDeal[];
  rating: number | null;
  upcoming?: boolean;
  upcoming_date_str?: string;
}

export interface PlatformPriceResult {
  platform: string;
  price: string;
  original_price?: string | null;
  discount?: string | null;
  store_url?: string;
  subscription_note?: string;
  tier?: GameDeal['tier'];
}

export interface PlatformSearchHit {
  id: string;
  title: string;
  image_url: string;
  platform: string;
  slug?: string;
  store_url?: string;
}

export interface GameSummary {
  id: string;
  title: string;
  image_url: string;
  store_links?: Record<string, string>;
  platforms?: string[];
  platform?: string;
  source_platform?: string;
  price?: string;
  discount?: string;
  original_price?: string;
  deals?: GameDeal[];
  rating: number | null;
  upcoming?: boolean;
  upcoming_date_str?: string;
}

export interface GameDetailResponse {
  game: GameSummary & { edition: EditionKey };
  /** Every edition found across the stores, base first; each lists one deal per store. */
  editions: EditionOption[];
}
