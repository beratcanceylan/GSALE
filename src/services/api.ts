/**
 * Public API surface — implemented in-app via store adapters (no remote GSale server).
 */
export {
  getFreeGames,
  getGameDetail,
  getHomeSections,
  searchGames,
  type EditionKey,
  type EditionOption,
  type GameDetailResponse,
  type GameSummary,
  type HomeSection,
  type StoreRequestOptions,
} from '@/services/store';
