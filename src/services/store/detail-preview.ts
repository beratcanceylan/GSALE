import type { LiveGame } from '@/services/store/types';

// Navigation fallback only: never retain prices or deals here.
const MAX_PREVIEWS = 120;
const previews = new Map<string, LiveGame>();

export function rememberDetailPreviews(games: readonly LiveGame[]): void {
  for (const game of games) {
    const preview: LiveGame = {
      id: game.id,
      slug: game.slug ?? game.id,
      title: game.title,
      image_url: game.image_url,
      platform: game.source_platform ?? game.platform,
      source_platform: game.source_platform ?? game.platform,
      rating: game.rating,
      ...(game.platforms ? { platforms: [...game.platforms] } : {}),
      ...(game.store_links ? { store_links: { ...game.store_links } } : {}),
    };
    previews.delete(game.id);
    previews.set(game.id, preview);
    if (previews.size > MAX_PREVIEWS) {
      const oldest = previews.keys().next().value;
      if (oldest !== undefined) previews.delete(oldest);
    }
  }
}

export function getDetailPreview(slug: string, platformHint?: string): LiveGame | null {
  const preview = previews.get(slug);
  if (!preview || (platformHint && preview.source_platform !== platformHint)) return null;
  return preview;
}
