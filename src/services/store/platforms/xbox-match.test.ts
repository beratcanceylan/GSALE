import { describe, expect, test } from 'bun:test';

import { isExactXboxTitleMatch, rankXboxPriceHits } from '@/services/store/platforms/xbox-match';

describe('Xbox price title ranking', () => {
  test('prefers Series X|S GTA V product for Enhanced lookup over Premium Edition', () => {
    const ranked = rankXboxPriceHits(
      [
        { title: 'Grand Theft Auto V: Premium Edition' },
        { title: 'Grand Theft Auto V: Hikaye Modu (Xbox Series X|S)' },
        { title: 'Grand Theft Auto V (Xbox Series X|S)' },
        { title: 'Grand Theft Auto VI' },
        { title: 'Grand Theft Auto Online' },
      ],
      'Grand Theft Auto V Enhanced',
    );

    const titles = ranked.map((entry) => entry.hit.title);
    expect(titles[0]).toBe('Grand Theft Auto V (Xbox Series X|S)');
    expect(titles).not.toContain('Grand Theft Auto VI');
    expect(titles).not.toContain('Grand Theft Auto Online');
  });

  test('keeps exact free-to-play base game ahead of paid currency bundles', () => {
    const ranked = rankXboxPriceHits(
      [
        { title: 'Fortnite - 13.500 V-Papel' },
        { title: 'Fortnite' },
        { title: 'Fortnite Crew' },
      ],
      'Fortnite',
    );

    expect(ranked[0]?.hit.title).toBe('Fortnite');
    expect(ranked[0]?.exact).toBe(true);
  });

  test('normalizes platform parentheticals for exact Xbox title checks', () => {
    expect(isExactXboxTitleMatch('Grand Theft Auto V (Xbox Series X|S)', 'Grand Theft Auto V')).toBe(true);
  });
});
