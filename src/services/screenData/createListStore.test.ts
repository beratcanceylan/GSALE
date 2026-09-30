import { describe, expect, test } from 'bun:test';

import { createListStore } from '@/services/screenData/createListStore';

describe('createListStore refresh coordination', () => {
  test('loads on subscription, notifies listeners, refreshes and recovers from failure', async () => {
    let calls = 0;
    let notifications = 0;
    const store = createListStore(async () => {
      calls += 1;
      if (calls === 2) throw new Error('offline');
      return ['loaded'];
    });
    const unsubscribe = store.subscribe(() => { notifications += 1; });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(store.getSnapshot()).toEqual({ data: ['loaded'], refreshing: false });
    store.load(true);
    expect(store.getSnapshot().refreshing).toBeTrue();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(store.getSnapshot()).toEqual({ data: [], refreshing: false });
    unsubscribe();
    store.load();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(store.getSnapshot().data).toEqual(['loaded']);
    expect(notifications).toBe(3);
  });
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

  test('invalidate drops a pending load and loads again', async () => {
    const resolvers: ((value: string[]) => void)[] = [];
    const store = createListStore(() => new Promise<string[]>((resolve) => { resolvers.push(resolve); }));
    const unsubscribe = store.subscribe(() => undefined);
    store.invalidate();
    expect(resolvers).toHaveLength(2);
    resolvers[0]?.(['old language']);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(store.getSnapshot().data).toBeNull();
    resolvers[1]?.(['new language']);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(store.getSnapshot().data).toEqual(['new language']);
    unsubscribe();
  });

  test('invalidate before anything loaded waits for the first subscriber', () => {
    let calls = 0;
    const store = createListStore(async () => { calls += 1; return []; });
    store.invalidate();
    expect(calls).toBe(0);
  });

  test('invalidate cancels the superseded request', async () => {
    const signals: AbortSignal[] = [];
    const store = createListStore((signal) => {
      signals.push(signal);
      return new Promise<string[]>(() => undefined);
    });
    const unsubscribe = store.subscribe(() => undefined);
    store.invalidate();
    expect(signals).toHaveLength(2);
    expect(signals[0]?.aborted).toBeTrue();
    expect(signals[1]?.aborted).toBeFalse();
    unsubscribe();
  });
});
