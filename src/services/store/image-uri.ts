/** Normalize image URIs for expo-image (no React Native imports). */

export function normalizeProtocolRelativeUri(uri: string): string {
  const trimmed = uri.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  return trimmed;
}
