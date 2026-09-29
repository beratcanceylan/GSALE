import { describe, expect, test } from 'bun:test';

import { mapWithConcurrencyLimit } from '@/services/store/concurrency';

async function flushQueue(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('store concurrency', () => {
  test('limits concurrent workers and preserves result order', async () => {
    const releases: Array<() => void> = [];
    const started: number[] = [];
    let active = 0;
    let maxActive = 0;

    const resultPromise = mapWithConcurrencyLimit([1, 2, 3, 4, 5], 2, async (value) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      started.push(value);

      await new Promise<void>((resolve) => {
        releases.push(resolve);
      });

      active -= 1;
      return `item-${value}`;
    });

    await flushQueue();
    expect(started).toEqual([1, 2]);
    expect(maxActive).toBe(2);

    releases.shift()?.();
    await flushQueue();
    expect(started).toEqual([1, 2, 3]);

    releases.shift()?.();
    await flushQueue();
    expect(started).toEqual([1, 2, 3, 4]);

    while (releases.length > 0) {
      releases.shift()?.();
      await flushQueue();
    }

    await expect(resultPromise).resolves.toEqual(['item-1', 'item-2', 'item-3', 'item-4', 'item-5']);
    expect(maxActive).toBe(2);
  });
});
