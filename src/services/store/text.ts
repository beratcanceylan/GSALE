// Small text helpers shared by the store adapters.

/**
 * Maps the Turkish "İ" and "ı" to "i" so case-insensitive patterns can use a plain
 * `i` for every Turkish i. Each character maps to one character, so match indices
 * in the folded text are valid in the original.
 */
export function foldTurkishI(text: string): string {
  return text.replaceAll('İ', 'i').replaceAll('ı', 'i');
}

/** Drops every trailing `char` ("https://x//" → "https://x") without a `/c+$/` regex scan. */
export function trimTrailingChar(text: string, char: string): string {
  let end = text.length;
  while (end > 0 && text.charAt(end - 1) === char) end -= 1;
  return text.slice(0, end);
}
