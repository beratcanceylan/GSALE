import { describe, expect, test } from 'bun:test';

import { acceptEditionCandidate, buildEditionTable, type EditionOffer } from '@/services/store/edition-table';

describe('acceptEditionCandidate', () => {
  test('keeps editions of the same game', () => {
    expect(acceptEditionCandidate('ELDEN RING Deluxe Edition', 'ELDEN RING')).toBe('deluxe');
    expect(acceptEditionCandidate('ELDEN RING', 'ELDEN RING Deluxe Edition')).toBe('base');
  });

  test('rejects DLC and other games', () => {
    expect(acceptEditionCandidate('ELDEN RING Shadow of the Erdtree Season Pass', 'ELDEN RING')).toBeNull();
    expect(acceptEditionCandidate('Final Fantasy XVI Deluxe Edition', 'Final Fantasy XV')).toBeNull();
    expect(acceptEditionCandidate('Hades', 'Hades II')).toBeNull();
  });
});

const offer = (platform: string, edition: EditionOffer['edition'], price: string, id = platform): EditionOffer => ({
  platform,
  edition,
  title: `${platform} ${edition}`,
  id,
  price: { platform, price, discount: '', store_url: `https://example.com/${id}` },
});

describe('buildEditionTable', () => {
  test('groups by edition, base first, one deal per store, cheapest first', () => {
    const table = buildEditionTable([
      offer('Steam', 'deluxe', '900,00 TL'),
      offer('Steam', 'base', '600,00 TL'),
      offer('Epic Games', 'base', '550,00 TL'),
      offer('Xbox', 'deluxe', '950,00 TL', 'a'),
      offer('Xbox', 'deluxe', '800,00 TL', 'b'),
    ]);
    expect(table.map((option) => option.key)).toEqual(['base', 'deluxe']);
    expect(table[0]?.deals.map((deal) => deal.platform)).toEqual(['Epic Games', 'Steam']);
    expect(table[1]?.deals.map((deal) => [deal.platform, deal.price])).toEqual([
      ['Xbox', '800,00 TL'],
      ['Steam', '900,00 TL'],
    ]);
  });

  test('drops unavailable prices and editions left empty', () => {
    const table = buildEditionTable([offer('Steam', 'gold', 'Bilinmiyor'), offer('GOG', 'base', '100,00 TL')]);
    expect(table.map((option) => option.key)).toEqual(['base']);
  });

  test('within one store a paid listing wins over a free one (free entries are usually demos)', () => {
    const table = buildEditionTable([offer('Steam', 'base', 'Ücretsiz', 'demo'), offer('Steam', 'base', '100,00 TL', 'game')]);
    expect(table[0]?.deals.map((deal) => deal.price)).toEqual(['100,00 TL']);
  });

  test('a free offer sorts before paid ones', () => {
    const table = buildEditionTable([offer('Steam', 'base', '100,00 TL'), offer('Epic Games', 'base', 'Ücretsiz')]);
    expect(table[0]?.deals.map((deal) => deal.platform)).toEqual(['Epic Games', 'Steam']);
  });
});

describe('acceptEditionCandidate rejects expansions, spin-offs and sequels (review regression)', () => {
  test.each([
    ['Cyberpunk 2077: Phantom Liberty', 'Cyberpunk 2077'],
    ['The Witcher 3: Wild Hunt - Hearts of Stone', 'The Witcher 3: Wild Hunt'],
    ['The Witcher 3: Wild Hunt - Blood and Wine', 'The Witcher 3: Wild Hunt'],
    ['Resident Evil 4 Separate Ways', 'Resident Evil 4'],
    ['Diablo IV: Vessel of Hatred', 'Diablo IV'],
    ['Starfield Shattered Space', 'Starfield'],
    ["Metro Exodus - Sam's Story", 'Metro Exodus'],
    ['Assassin’s Creed Valhalla: Dawn of Ragnarök', "Assassin's Creed Valhalla"],
    ['Hollow Knight: Silksong', 'Hollow Knight'],
    ['Half-Life: Alyx', 'Half-Life'],
    ["Marvel's Spider-Man: Miles Morales", "Marvel's Spider-Man Remastered"],
    ['The Jackbox Party Pack 7 - Soundtrack', 'The Jackbox Party Pack 7'],
    ['Starfield Premium Edition Upgrade', 'Starfield'],
  ] as const)('%s is not an edition of %s', (candidate, title) => {
    expect(acceptEditionCandidate(candidate, title)).toBeNull();
  });

  test.each([
    ['The Witcher® 3: Wild Hunt – Game of the Year Edition', 'The Witcher 3: Wild Hunt', 'goty'],
    ['Marvel’s Spider-Man Remastered', "Marvel's Spider-Man Remastered", 'base'],
    ['ELDEN RING', 'Elden Ring', 'base'],
    ['Hogwarts Legacy Xbox Series X|S', 'Hogwarts Legacy', 'base'],
    ['Diablo IV - Xbox Series X|S', 'Diablo IV', 'base'],
    ['Grand Theft Auto V Xbox One', 'Grand Theft Auto V', 'base'],
    ['Hades Nintendo Switch', 'Hades', 'base'],
    ['Hogwarts Legacy Edycja Deluxe', 'Hogwarts Legacy', 'deluxe'],
    ['Hogwarts Legacy Цифрове видання Deluxe', 'Hogwarts Legacy', 'deluxe'],
    ['ホグワーツ・レガシー デラックス・エディション', 'ホグワーツ・レガシー', 'deluxe'],
    ['ホグワーツ・レガシー デラックス版', 'ホグワーツ・レガシー', 'deluxe'],
    ['호그와트 레거시 디럭스 에디션', '호그와트 레거시', 'deluxe'],
  ] as const)('%s is edition %s of %s', (candidate, title, edition) => {
    expect(acceptEditionCandidate(candidate, title)).toBe(edition);
  });
});

describe('hardware variants', () => {
  test('keeps Switch and Switch 2 prices and links apart', () => {
    const switchOffer = { ...offer('Nintendo', 'base', '100,00 TL', 'switch'), title: 'Game Nintendo Switch' };
    const switch2Offer = { ...offer('Nintendo', 'base', '200,00 TL', 'switch2'), title: 'Game Nintendo Switch 2' };
    const deals = buildEditionTable([switchOffer, switch2Offer])[0]?.deals;
    expect(deals?.map((deal) => [deal.devices, deal.price, deal.store_url])).toEqual([
      [['Nintendo Switch'], '100,00 TL', 'https://example.com/switch'],
      [['Nintendo Switch 2'], '200,00 TL', 'https://example.com/switch2'],
    ]);
  });

  test('free Xbox package components do not become free prices beside a paid cross-generation bundle', () => {
    const table = buildEditionTable([
      { ...offer('Xbox', 'base', 'Ücretsiz', 'series'), title: 'Game Xbox Series X|S' },
      { ...offer('Xbox', 'base', 'Ücretsiz', 'one'), title: 'Game Xbox One' },
      { ...offer('Xbox', 'base', '300,00 TL', 'bundle'), title: 'Game Standard Edition Xbox One ve Xbox Series X|S' },
    ]);
    expect(table[0]?.deals).toHaveLength(1);
    expect(table[0]?.deals[0]).toMatchObject({ price: '300,00 TL', devices: ['Xbox One', 'Xbox Series X|S'] });
  });

  test('PS4 in the bundle title is preserved when metadata only lists PS5', () => {
    const psOffer = { ...offer('PlayStation', 'base', '300,00 TL'), title: 'Game Standard Edition PS4 & PS5' };
    const table = buildEditionTable([{ ...psOffer, price: { ...psOffer.price, devices: ['PlayStation 5'] } }]);
    expect(table[0]?.deals[0]?.devices).toEqual(['PlayStation 5', 'PlayStation 4']);
  });
});
