/** Store constants with no React Native / Expo imports (safe for bun unit tests). */

export const STORE_TIMEOUT = {
  short: 5000,
  long: 10000,
} as const;

export const STORE_RETRY = {
  attempts: 2,
  delayMs: 300,
} as const;

export const STORE_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
