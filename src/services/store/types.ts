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
  edition?: string;
  description?: string;
  genres?: string[];
  developers?: string[];
  release_date?: string;
  screenshots?: string[];
  videos?: { platform: string; id: string; url?: string; thumbnail?: string }[];
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
  description?: string;
  genres?: string[];
  developers?: string[];
  release_date?: string;
  screenshots?: string[];
  videos?: { platform: string; id: string; url?: string; thumbnail?: string }[];
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

export interface Price {
  id: number;
  game_id: string;
  platform: string;
  price: string | null;
  original_price: string | null;
  discount: string | null;
  store_url: string | null;
  subscription_note: string | null;
  fetched_at: number;
}

export interface GameDetailResponse {
  game: GameSummary;
  prices: Price[];
  meta: {
    prices_fetched_at: number | null;
  };
}
