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
      game_key: 'hadesii',
      image: null,
    });
  });

  test('the game key ignores editions and platform suffixes', () => {
    expect(sourceRecordToRow('ps', { name: 'ELDEN RING Deluxe Edition PS4 & PS5', uuid: '9' })?.game_key).toBe('eldenring');
    expect(sourceRecordToRow('xbox', { name: 'DOOM Eternal Standard Edition (PC)', uuid: '8' })?.game_key).toBe('doometernal');
  });

  test('keeps the image for Xbox only', () => {
    const row = sourceRecordToRow('xbox', { name: 'Halo Infinite', uuid: '9PP5G1F0C2B6', image: 'https://img/halo' });
    expect(row?.image).toBe('https://img/halo');
  });

  test('drops delisted, non-game, non-Latin-only and malformed records', () => {
    expect(sourceRecordToRow('steam', { name: 'Gone', uuid: '1', price: 'Unavailable' })).toBeNull();
    expect(sourceRecordToRow('steam', { name: 'Soundtrack', uuid: '2', type: 'dlc' })).toBeNull();
    expect(sourceRecordToRow('steam', { name: '我的朋友', uuid: '3' })).toBeNull();
    expect(sourceRecordToRow('steam', { name: 'No id' })).toBeNull();
    expect(sourceRecordToRow('steam', 'nope')).toBeNull();
  });
});
