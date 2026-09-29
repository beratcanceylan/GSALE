import { describe, expect, test } from 'bun:test';

import {
  cleanTitleForCrossPlatform,
  isStrictMatch,
  pickBestTitleMatch,
  scoreProductTitleMatch,
} from '@/services/store/match';

describe('store match', () => {
  test('cleanTitle strips edition suffix', () => {
    expect(cleanTitleForCrossPlatform('Grand Theft Auto V Premium Edition')).toContain('Grand Theft Auto V');
  });

  test('cs2 vs csgo mismatch', () => {
    expect(isStrictMatch('Counter-Strike 2', 'Counter-Strike: Global Offensive')).toBeFalse();
    expect(scoreProductTitleMatch('Counter-Strike: Global Offensive', 'Counter-Strike 2')).toBe(0);
    expect(scoreProductTitleMatch('Counter-Strike: Global Offensive', 'counter strike')).toBe(0);
  });

  test('prefers Prime Status Upgrade over base Counter-Strike 2 in title match', () => {
    const hits = [
      { title: 'Counter-Strike 2' },
      { title: 'Counter-Strike 2 Prime Status Upgrade' },
      { title: 'Counter-Strike 2 Seçkin Durumu Yükseltmesi' },
    ];
    const english = pickBestTitleMatch(hits, 'Counter-Strike 2 Prime Status Upgrade', (h) => h.title);
    const turkish = pickBestTitleMatch(hits, 'Counter-Strike 2 Seçkin Durumu Yükseltmesi', (h) => h.title);

    expect(english?.title).toBe('Counter-Strike 2 Prime Status Upgrade');
    expect(turkish?.title).toBe('Counter-Strike 2 Seçkin Durumu Yükseltmesi');
  });

  test('similar titles match', () => {
    expect(isStrictMatch('Elden Ring', 'ELDEN RING')).toBeTrue();
  });

  test('rejects GTA V cross-match to Ballad of Gay Tony', () => {
    const search = cleanTitleForCrossPlatform('Grand Theft Auto V');
    expect(isStrictMatch('Grand Theft Auto: The Ballad of Gay Tony', search)).toBeFalse();
    expect(scoreProductTitleMatch('Grand Theft Auto: The Ballad of Gay Tony', search)).toBe(0);
  });

  test('matches Enhanced search to base Xbox listing', () => {
    const search = cleanTitleForCrossPlatform('Grand Theft Auto V Enhanced');
    expect(scoreProductTitleMatch('Grand Theft Auto V (Xbox One)', search)).toBeGreaterThanOrEqual(55);
    // Which edition wins is decided by editionKey, not by the title score.
    expect(scoreProductTitleMatch('Grand Theft Auto V Enhanced (PC)', search)).toBeGreaterThanOrEqual(50);
  });

  test.each([
    ['GTA VI', 'Grand Theft Auto VI'],
    ['GTA Online', 'Grand Theft Auto Online'],
    ['other GTA subtitles without a V version', 'Grand Theft Auto: San Andreas'],
  ] as const)('rejects GTA V cross-match to %s', (_label, found) => {
    const search = cleanTitleForCrossPlatform('Grand Theft Auto V Enhanced');
    expect(scoreProductTitleMatch(found, search)).toBe(0);
  });

  test('matches GTA V Enhanced to Xbox story mode listing', () => {
    const search = cleanTitleForCrossPlatform('Grand Theft Auto V Enhanced');
    expect(scoreProductTitleMatch('Grand Theft Auto V: Hikaye Modu (Xbox Series X|S)', search)).toBeGreaterThanOrEqual(55);
  });

  test('prefers base GTA V over DLC in pickBestTitleMatch', () => {
    const search = cleanTitleForCrossPlatform('Grand Theft Auto V');
    const hits = [
      { title: 'Grand Theft Auto: The Ballad of Gay Tony' },
      { title: 'Grand Theft Auto V (Xbox One)' },
      { title: 'GTA Online: Criminal Enterprise Başlangıç Paketi' },
    ];
    const best = pickBestTitleMatch(hits, search, (h) => h.title);
    expect(best?.title).toBe('Grand Theft Auto V (Xbox One)');
  });

  test('cleanTitle cleans Director Cut and Turkish Yönetmenin Sürümü', () => {
    expect(cleanTitleForCrossPlatform("Ghost of Tsushima Director's Cut")).toBe('Ghost of Tsushima');
    expect(cleanTitleForCrossPlatform('Ghost of Tsushima YÖNETMENİN SÜRÜMÜ')).toBe('Ghost of Tsushima');
  });

  test('rejects sequel mismatches for Roman numeral parts', () => {
    expect(scoreProductTitleMatch('The Last of Us Part I', 'The Last of Us Part II')).toBe(0);
    expect(scoreProductTitleMatch('Final Fantasy VII', 'Final Fantasy VIII')).toBe(0);
    expect(scoreProductTitleMatch('Tekken 7', 'Tekken 8')).toBe(0);
  });

  test('distinguishes GTA IV from other numbered releases', () => {
    expect(isStrictMatch('Grand Theft Auto IV', 'Grand Theft Auto V')).toBeFalse();
    expect(scoreProductTitleMatch('GTA IV', 'GTA VI')).toBe(0);
  });

  test('recognizes overlapping titles without a substring', () => {
    expect(isStrictMatch('Hades Battle Action', 'Hades Action Extra')).toBeTrue();
  });

  test('adjusts Prime upgrade scores when both titles describe the upgrade', () => {
    expect(scoreProductTitleMatch(
      'Counter-Strike 2 Prime Status Upgrade Edition',
      'Counter-Strike 2 Prime Status Upgrade',
    )).toBeGreaterThan(0);
    expect(scoreProductTitleMatch('Counter-Strike 2', 'Counter-Strike 2 Prime Status Upgrade'))
      .toBe(0);
    expect(scoreProductTitleMatch(
      'Counter-Strike 2 Primetime Status Upgrader',
      'Counter-Strike 2 Prime Status Upgrade',
    )).toBeGreaterThan(0);
  });
});
