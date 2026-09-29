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

  test('a free offer sorts before paid ones', () => {
    const table = buildEditionTable([offer('Steam', 'base', '100,00 TL'), offer('Epic Games', 'base', 'Ücretsiz')]);
    expect(table[0]?.deals.map((deal) => deal.platform)).toEqual(['Epic Games', 'Steam']);
  });
});
