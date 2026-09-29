import { describe, expect, test } from 'bun:test';

import { firstResult } from '@/services/store/sequence';

describe('firstResult', () => {
  test('stops at the first non-null result', async () => {
    const tried: string[] = [];
    const result = await firstResult(['a', 'b', 'c'], async (candidate) => {
      tried.push(candidate);
      return candidate === 'b' ? 'found b' : null;
    });

    expect(result).toBe('found b');
    expect(tried).toEqual(['a', 'b']);
  });

  test('passes the candidate index', async () => {
    const indexes: number[] = [];
    await firstResult(['x', 'y'], async (_candidate, index) => {
      indexes.push(index);
      return null;
    });
    expect(indexes).toEqual([0, 1]);
  });

  test('returns null when no candidate matches or there are none', async () => {
    expect(await firstResult(['a'], async () => null)).toBeNull();
    expect(await firstResult([], async () => 'never')).toBeNull();
  });

  test('propagates a rejection and does not try later candidates', async () => {
    const tried: string[] = [];
    const run = firstResult(['a', 'b'], async (candidate) => {
      tried.push(candidate);
      throw new Error(`failed ${candidate}`);
    });
    await expect(run).rejects.toMatchObject({ message: 'failed a' });
    expect(tried).toEqual(['a']);
  });
});
