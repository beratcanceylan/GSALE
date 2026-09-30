import { describe, expect, mock, test } from 'bun:test';

let detailRequests = 0;

mock.module('@/services/gameData', () => ({
  fetchGameDetail: async () => {
    detailRequests += 1;
    return {
      id: 'edition-game',
      title: 'Edition Game Deluxe Edition',
      edition: 'deluxe',
      editions: [
        { key: 'base', deals: [] },
        { key: 'deluxe', deals: [] },
      ],
      deals: [],
    };
  },
}));

const { gameDetailStore } = await import('@/services/screenData/gameDetailStore');

async function flush(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

describe('gameDetailStore editions', () => {
  test('starts on the opened edition and switches edition without a request', async () => {
    let notifications = 0;
    const unsubscribe = gameDetailStore.subscribe('edition-slug', 'Steam', () => { notifications += 1; });
    await flush();
    expect(gameDetailStore.getSnapshot('edition-slug', 'Steam').selectedEdition).toBe('deluxe');

    const requests = detailRequests;
    const before = notifications;
    gameDetailStore.selectEdition('edition-slug', 'Steam', 'base');
    expect(gameDetailStore.getSnapshot('edition-slug', 'Steam').selectedEdition).toBe('base');
    expect(notifications).toBe(before + 1);
    expect(detailRequests).toBe(requests);
    unsubscribe();
  });

  test('ignores an edition the game does not have', async () => {
    const unsubscribe = gameDetailStore.subscribe('edition-slug-2', 'Steam', () => undefined);
    await flush();
    gameDetailStore.selectEdition('edition-slug-2', 'Steam', 'gold');
    expect(gameDetailStore.getSnapshot('edition-slug-2', 'Steam').selectedEdition).toBe('deluxe');
    unsubscribe();
  });

  test('a reload keeps the edition the user chose', async () => {
    const unsubscribe = gameDetailStore.subscribe('edition-slug-3', 'Steam', () => undefined);
    await flush();
    gameDetailStore.selectEdition('edition-slug-3', 'Steam', 'base');
    gameDetailStore.reload('edition-slug-3', 'Steam');
    await flush();
    expect(gameDetailStore.getSnapshot('edition-slug-3', 'Steam').selectedEdition).toBe('base');
    unsubscribe();
  });
});
