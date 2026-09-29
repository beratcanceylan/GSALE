const PLATFORM_SHORT_NAMES: Record<string, string> = {
  steam: 'Steam',
  'epic games': 'Epic',
  epic: 'Epic',
  xbox: 'Xbox',
  playstation: 'PS',
  ps: 'PS',
  gog: 'GOG',
  nintendo: 'Nintendo',
};

export function getPlatformShortName(platform: string): string {
  return PLATFORM_SHORT_NAMES[platform.toLowerCase().trim()] ?? platform.trim();
}

const PLATFORM_ASPECT_RATIOS: Record<string, number> = {
  Steam: 460 / 215,
  'Epic Games': 460 / 215,
  Xbox: 16 / 9,
  PlayStation: 1,
  GOG: 16 / 9,
  Nintendo: 1,
};

export function getPlatformAspectRatio(sourcePlatform?: string): number {
  if (sourcePlatform && PLATFORM_ASPECT_RATIOS[sourcePlatform] !== undefined) {
    return PLATFORM_ASPECT_RATIOS[sourcePlatform];
  }
  return 460 / 215;
}
