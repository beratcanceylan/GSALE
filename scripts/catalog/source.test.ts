import { describe, expect, test } from 'bun:test';

import { sourceRecordToRow } from './source';

describe('catalog source records', () => {
  test('maps a Steam game and derives its search key', () => {
    expect(
      sourceRecordToRow('steam', {
        name: 'Hades II™',
        type: 'game',
        price: '$29.99',
        uuid: '1145350',
        image: 'https://shared.akamai.steamstatic.com/x.jpg',
      }),
    ).toEqual({
      store: 'steam',
      id: '1145350',
      title: 'Hades II™',
      search_key: 'hades ii',
      image: null,
    });
  });

  test('keeps the image for Xbox only', () => {
    const row = sourceRecordToRow('xbox', { name: 'Halo Infinite', uuid: '9PP5G1F0C2B6', image: 'https://img/halo' });
    expect(row?.image).toBe('https://img/halo');
  });

  test('drops delisted, non-game, non-Latin-only and malformed records', () => {
    expect(sourceRecordToRow('steam', { name: 'Gone', uuid: '1', price: 'Unavailable' })).toBe(null);
    expect(sourceRecordToRow('steam', { name: 'Soundtrack', uuid: '2', type: 'dlc' })).toBe(null);
    expect(sourceRecordToRow('steam', { name: '我的朋友', uuid: '3' })).toBe(null);
    expect(sourceRecordToRow('steam', { name: 'No id' })).toBe(null);
    expect(sourceRecordToRow('steam', 'nope')).toBe(null);
  });
});
