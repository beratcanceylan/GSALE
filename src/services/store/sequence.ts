/**
 * Tries `attempt` on each candidate in order and resolves with the first non-null
 * result. Later candidates are never requested, which keeps fallback lookups
 * (query variants, alternate endpoints) to as few store requests as possible.
 */
export async function firstResult<T, R>(
  candidates: readonly T[],
  attempt: (candidate: T, index: number) => Promise<R | null>,
  index = 0,
): Promise<R | null> {
  if (index >= candidates.length) return null;
  const result = await attempt(candidates[index] as T, index);
  return result ?? firstResult(candidates, attempt, index + 1);
}
