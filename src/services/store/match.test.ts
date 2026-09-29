import { describe, expect, test } from 'bun:test';

import {
  cleanTitleForCrossPlatform,
  getPriceLookupTitles,
  isStrictMatch,
  pickBestTitleMatch,
  scoreProductTitleMatch,
} from '@/services/store/match';

describe('store match', () => {
  test('cleanTitle strips edition suffix', () => {
    expect(cleanTitleForCrossPlatform('Grand Theft Auto V Premium Edition')).toContain('Grand Theft Auto V');
  });

  test('cs2 vs csgo mismatch', () => {
    expect(isStrictMatch('Counter-Strike 2', 'Counter-Strike: Global Offensive')).toBe(false);
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
    expect(isStrictMatch('Elden Ring', 'ELDEN RING')).toBe(true);
  });

  test('rejects GTA V cross-match to Ballad of Gay Tony', () => {
    const search = cleanTitleForCrossPlatform('Grand Theft Auto V');
    expect(isStrictMatch('Grand Theft Auto: The Ballad of Gay Tony', search)).toBe(false);
    expect(scoreProductTitleMatch('Grand Theft Auto: The Ballad of Gay Tony', search)).toBe(0);
  });

  test('matches Enhanced search to base Xbox listing', () => {
    const search = cleanTitleForCrossPlatform('Grand Theft Auto V Enhanced');
    expect(scoreProductTitleMatch('Grand Theft Auto V (Xbox One)', search)).toBeGreaterThanOrEqual(55);
    expect(scoreProductTitleMatch('Grand Theft Auto V Enhanced (PC)', search)).toBeGreaterThanOrEqual(75);
  });

  test('rejects GTA V cross-match to GTA VI', () => {
    const search = cleanTitleForCrossPlatform('Grand Theft Auto V Enhanced');
    expect(scoreProductTitleMatch('Grand Theft Auto VI', search)).toBe(0);
  });

  test('rejects GTA V cross-match to GTA Online', () => {
    const search = cleanTitleForCrossPlatform('Grand Theft Auto V Enhanced');
    expect(scoreProductTitleMatch('Grand Theft Auto Online', search)).toBe(0);
  });

  test('rejects GTA V cross-match to other GTA subtitles without V version', () => {
    const search = cleanTitleForCrossPlatform('Grand Theft Auto V Enhanced');
    expect(scoreProductTitleMatch('Grand Theft Auto: San Andreas', search)).toBe(0);
  });

  test('matches GTA V Enhanced to Xbox story mode listing', () => {
    const search = cleanTitleForCrossPlatform('Grand Theft Auto V Enhanced');
    expect(scoreProductTitleMatch('Grand Theft Auto V: Hikaye Modu (Xbox Series X|S)', search)).toBeGreaterThanOrEqual(55);
  });

  test('getPriceLookupTitles includes base name without Enhanced', () => {
    const titles = getPriceLookupTitles('Grand Theft Auto V Enhanced');
    expect(titles[0]).toBe('Grand Theft Auto V Enhanced');
    expect(titles).toContain('Grand Theft Auto V');
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
});
