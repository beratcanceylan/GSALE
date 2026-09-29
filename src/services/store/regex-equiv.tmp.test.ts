import { Database } from 'bun:sqlite';
import { expect, test } from 'bun:test';

import * as newMatch from '@/services/store/match';
import * as newMeta from '@/services/store/metadata';
import * as newPs from '@/services/store/platforms/ps-parse';
import * as oldMatch from '/tmp/claude-1000/-home-b3t4-projects-GSALE/aeb3d280-862b-4e39-a6b7-8b8cba428e5d/scratchpad/old/match';
import * as oldMeta from '/tmp/claude-1000/-home-b3t4-projects-GSALE/aeb3d280-862b-4e39-a6b7-8b8cba428e5d/scratchpad/old/metadata';
import * as oldPs from '/tmp/claude-1000/-home-b3t4-projects-GSALE/aeb3d280-862b-4e39-a6b7-8b8cba428e5d/scratchpad/old/ps-parse';

const SUFFIXES = ['', ' - Dijital Deluxe Sürümü', ' Yönetmenin Sürümü', ' YÖNETMENİN SÜRÜMÜ', ' Nİhaİ Sürüm', ' NIHAI SÜRÜM', ' Özel Sürüm', ' ÖZEL', ' Yılın Oyunu', ' YILIN OYUNU', ' Altın Sürüm', ' Koleksiyoncu Sürümü', ' Seçkin', ' SEÇKİN', ' Yıldönümü Sürümü', ' Lüks', ' LÜKS', ' Tam Sürüm', ' Kasa Sürümü', ' Standart Sürüm', ' — Deluxe Edition', ' – Cross-Gen Paketi', ' Çapraz Nesil Bundle', " Director's Cut", ' (PS4 & PS5)', ' PS4 ve PS5', ' PlayStation 5', '   -   Ultimate Edition  ', ' Gİrİş Gİşİ', ' Genişletilmiş Sürüm', ' DİJİTAL', ' dıjıtal lüks'];
const HTML = ['<p>Hi<br/>there</p>', '<<<<<<', 'a < b > c', '![img](x) [link](y)', '<b>x</b>&nbsp;y'];

test('regex rewrites keep behaviour', () => {
  const db = new Database('/tmp/claude-1000/-home-b3t4-projects-GSALE/aeb3d280-862b-4e39-a6b7-8b8cba428e5d/scratchpad/catalog-out/catalog.db', { readonly: true });
  const titles = db.query<{ title: string }>('SELECT title FROM games').all().map((row) => row.title);
  const samples = titles.flatMap((title, index) => [title, title + (SUFFIXES[index % SUFFIXES.length] ?? '')]);
  const fns: [string, (s: string) => unknown, (s: string) => unknown][] = [
    ['cleanTitleForCrossPlatform', oldMatch.cleanTitleForCrossPlatform, newMatch.cleanTitleForCrossPlatform],
    ['canonicalMergeTitleKey', oldMatch.canonicalMergeTitleKey, newMatch.canonicalMergeTitleKey],
    ['extractEdition', oldMatch.extractEdition, newMatch.extractEdition],
    ['getPriceLookupTitles', oldMatch.getPriceLookupTitles, newMatch.getPriceLookupTitles],
    ['cleanPsProductTitle', oldPs.cleanPsProductTitle, newPs.cleanPsProductTitle],
    ['extractPsEdition', oldPs.extractPsEdition, newPs.extractPsEdition],
    ['getPsSearchQueryCandidates', oldPs.getPsSearchQueryCandidates, newPs.getPsSearchQueryCandidates],
  ];
  let mismatches = 0;
  for (const [name, before, after] of fns) {
    for (const sample of samples) {
      const a = JSON.stringify(before(sample));
      const b = JSON.stringify(after(sample));
      if (a !== b && mismatches++ < 25) console.log('DIFF', name, JSON.stringify(sample), a, '=>', b);
    }
  }
  for (const sample of [...samples.slice(0, 2000), ...HTML]) {
    const a = JSON.stringify(oldMeta.cleanStoreText(sample));
    const b = JSON.stringify(newMeta.cleanStoreText(sample));
    if (a !== b && mismatches++ < 50) console.log('DIFF cleanStoreText', JSON.stringify(sample), a, '=>', b);
  }
  const pairs = titles.slice(0, 20000);
  for (let i = 0; i + 1 < pairs.length; i += 2) {
    const [x = '', y = ''] = [pairs[i], pairs[i + 1]];
    for (const [p, q] of [[x, y], [x, x + ' Deluxe Edition'], [x + ' 2', x + ' 3']] as const) {
      const a = JSON.stringify([oldMatch.scoreProductTitleMatch(p, q), oldMatch.isStrictMatch(p, q)]);
      const b = JSON.stringify([newMatch.scoreProductTitleMatch(p, q), newMatch.isStrictMatch(p, q)]);
      if (a !== b && mismatches++ < 75) console.log('DIFF score', JSON.stringify([p, q]), a, '=>', b);
    }
  }
  console.log('samples', samples.length, 'mismatches', mismatches);
  expect(mismatches).toBe(0);
}, 600000);
