// Linear-time text helpers. Patterns passed here never start with optional
// whitespace: a leading `\s*` rescans long whitespace runs at every position.

type Fold = (text: string) => string;

const identity: Fold = (text) => text;

/**
 * Maps the Turkish "İ" and "ı" to "i" so case-insensitive patterns can use a plain
 * `i` for every Turkish i. Each character maps to one character, so match indices
 * in the folded text are valid in the original.
 */
export function foldTurkishI(text: string): string {
  return text.replaceAll('İ', 'i').replaceAll('ı', 'i');
}

function globalPattern(pattern: RegExp): RegExp {
  return pattern.global ? pattern : new RegExp(pattern.source, `${pattern.flags}g`);
}

/** `text.split(pattern)`, matching against `fold(text)` but slicing the original text. */
function splitMatches(text: string, pattern: RegExp, fold: Fold): string[] {
  const parts: string[] = [];
  let last = 0;
  for (const match of fold(text).matchAll(globalPattern(pattern))) {
    parts.push(text.slice(last, match.index));
    last = match.index + match[0].length;
  }
  parts.push(text.slice(last));
  return parts;
}

/** Removes every match of `pattern` together with the whitespace right before it. */
export function removeWithLeadingSpace(text: string, pattern: RegExp, fold: Fold = identity): string {
  const parts = splitMatches(text, pattern, fold);
  return parts.map((part, index) => (index < parts.length - 1 ? part.trimEnd() : part)).join('');
}

/** Replaces every match of `pattern`, and the whitespace around it, with one space. */
export function replaceWithSingleSpace(text: string, pattern: RegExp, fold: Fold = identity): string {
  const parts = splitMatches(text, pattern, fold);
  return parts
    .map((part, index) => {
      const withoutTrailing = index < parts.length - 1 ? part.trimEnd() : part;
      return index > 0 ? withoutTrailing.trimStart() : withoutTrailing;
    })
    .join(' ');
}

/** `text.replaceAll(pattern, replacement)`, matching against `fold(text)`. */
export function replaceFolded(text: string, pattern: RegExp, replacement: string, fold: Fold = identity): string {
  return splitMatches(text, pattern, fold).join(replacement);
}

/** Drops every trailing `char` ("https://x//" → "https://x") without a `/c+$/` regex scan. */
export function trimTrailingChar(text: string, char: string): string {
  let end = text.length;
  while (end > 0 && text.charAt(end - 1) === char) end -= 1;
  return text.slice(0, end);
}
