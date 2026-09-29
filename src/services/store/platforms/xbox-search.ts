export function parseXboxSearchProductIds(html: string): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();

  const addIds = (chunk: string) => {
    const idRegex = /"productId":"([^"]+)"/g;
    let match: RegExpExecArray | null;
    while ((match = idRegex.exec(chunk)) !== null) {
      const id = match[1];
      if (!id || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
  };

  const gamesSearchIndex = html.indexOf('SEARCH_GAMES_SEARCHQUERY=');
  if (gamesSearchIndex >= 0) {
    addIds(html.slice(gamesSearchIndex, gamesSearchIndex + 50000));
  }

  addIds(html);
  return ids.slice(0, 80);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Parse Microsoft's lightweight catalog-family search response. */
export function parseXboxAutosuggestProductIds(value: unknown): string[] {
  if (!isRecord(value) || !Array.isArray(value['Results'])) return [];

  const ids: string[] = [];
  const seen = new Set<string>();
  for (const result of value['Results']) {
    if (!isRecord(result) || !Array.isArray(result['Products'])) continue;
    for (const product of result['Products']) {
      if (!isRecord(product)) continue;
      const rawId = product['ProductId'];
      const id = typeof rawId === 'string'
        ? rawId.trim()
        : '';
      if (!id || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
  }
  return ids.slice(0, 80);
}
