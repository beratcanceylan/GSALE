/**
 * Public API surface — implemented in-app via store adapters (no remote GSale server).
 */
export {
  getFreeGames,
  getGameDetail,
  getHomeSections,
  searchGames,
  type GameDetailResponse,
  type GameSummary,
  type HomeSection,
  type Price,
  type StoreRequestOptions,
} from '@/services/store';
