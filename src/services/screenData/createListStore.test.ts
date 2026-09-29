import { describe, expect, test } from 'bun:test';

import { createListStore } from '@/services/screenData/createListStore';

describe('createListStore refresh coordination', () => {
  test('coalesces refresh calls while a load is pending', async () => {
    let calls = 0;
    let resolveLoad!: (value: string[]) => void;
    const store = createListStore(
      () =>
        new Promise<string[]>((resolve) => {
          calls += 1;
          resolveLoad = (value) => resolve(value);
        }),
    );

    store.load();
    store.load(true);
    store.load(true);
    expect(calls).toBe(1);

    resolveLoad(['loaded']);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(calls).toBe(1);
    expect(store.getSnapshot()).toEqual({ data: ['loaded'], refreshing: false });
  });
});
