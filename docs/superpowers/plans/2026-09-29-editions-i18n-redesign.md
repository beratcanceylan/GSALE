# Sürümler, i18n ve Yeniden Tasarım — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sürüm (edition) doğru ve tutarlı fiyat karşılaştırması, 30 dilli arayüz + ayrı dil/ülke ayarı ve kapak odaklı yeni arayüz.

**Architecture:** Tek bir sürüm normalleştirici (`store/editions.ts`) bütün adapter'ların eşleşmesini yönetir; her adapter tek arama ile `EditionOffer[]` döner, `prices.ts` bunları sürüm × mağaza tablosuna çevirir. Fiyatlar sayısal taşınır, metin UI'da `Intl` + mesaj kataloğu ile üretilir. Arayüz yeni token seti ve küçük bileşen kümesiyle baştan yazılır.

**Tech Stack:** Expo SDK 57, Expo Router, React 19, RN 0.86, TypeScript 6, Bun test + react-test-renderer, react-native-svg, expo-image, lucide-react-native.

**Spec:** `docs/superpowers/specs/2026-09-29-editions-i18n-redesign-design.md`

## Global Constraints

- Yalnız Bun (`bun`, `bunx --bun`); `package-lock.json` yok.
- `app/` ve `src/` içinde `useEffect`/React effect yok (ESLint `no-react-effects`); store'lar `useSyncExternalStore` ile okunur.
- Ham renk/boyut yok; her şey `src/constants/DesignSystem.ts` tokenlarından (`enforce-design-tokens`). Görsel `expo-image` (`prefer-expo-image`). `no-console` hata.
- Hermes'te `toSorted` yok: sıralamadan önce kopyala (`slice().sort()`).
- 30 oyun limiti, timeout/retry değerleri (`store/constants.ts`), 60 sn fiyat önbelleği korunur; `store/constants.ts` RN/Expo import etmez.
- Backend, kalıcı fiyat deposu, React Query/SWR yok. İstekler sabit HTTPS origin'lere; route/query girdileri encode edilir; dış bağlantı yalnız HTTPS doğrulamasından sonra açılır.
- Adapter'lar ülkeyi `getStoreCountry()`/`getStoreCountryConfig()` ile, dili Task 10'dan sonra `storeLanguage()` ile alır; ülke/dil/`xx-yy` hard-code edilmez. Nintendo her zaman US eShop; `playStationCurrency === null` ise PS atlanır.
- Fiyatlar TL'ye çevrilir (`currency.ts`); önbellek anahtarı ülkeyi (Task 10'dan sonra dili de) içerir.
- Diller: `tr, en, de, fr, es, es-419, pt, pt-BR, it, nl, pl, ru, uk, cs, hu, ro, bg, el, da, sv, no, fi, ja, ko, zh-Hans, zh-Hant, th, vi, id, ar`.
- Her `StoreRequestOptions` alan servis `throwIfAborted(options?.signal)` çağrısını await'lerden sonra yapar.
- Commit mesajları kısa, küçük harf, `feat(store): ...` biçiminde; sonuna `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` satırı.
- Her task sonunda: `bun run typecheck`, `bun run lint`, ilgili testler. Aşama sonlarında tam doğrulama (Task 7, 11, 21).

## Review Focus

1. **Base'i olmayan sürüm girişi** (yalnız "X Deluxe Edition" satan Steam kartından giriş): detay Deluxe seçili açılmalı, base sekmesi yoksa gösterilmemeli, hiçbir mağaza satırı base fiyatı göstermemeli. → Task 5 testi.
2. **Aynı mağazada aynı sürüm için iki ürün** (Xbox'ta "X Deluxe Edition" ve "X Deluxe Edition (PC)"; PS'te PS4 + PS5): tabloda mağaza başına tek satır, en ucuz/konsol öncelikli olan. → Task 4 testi.
3. **Numaralı devam oyunu ve DLC karışması** ("Final Fantasy XV" araması "Final Fantasy XVI Deluxe" ya da "X – Season Pass" getiriyor): sürüm olarak listelenmemeli. → Task 3 testi (Steam) + Task 1 testi.
4. **Dil değişimi sırasında açık detay ekranı**: eski dildeki istek iptal edilmeli, yeni dilde tekrar yüklenmeli, eski sonuç ekrana yazılmamalı. → Task 10 testi.
5. **Arapça ↔ Latin geçişi ve eksik çeviri anahtarı**: RTL bayrağı ayarlanmalı + yeniden başlatma uyarısı; eksik anahtar derlemede yakalanmalı, çalışma zamanında `en` metnine düşmeli. → Task 8 ve Task 19 testleri.

---

## File Structure

**Aşama 1 (sürümler):**
- Create `src/services/store/editions.ts` — `EditionKey`, `editionKey()`, `baseTitle()`, `EDITION_ORDER`, `compareEditions()`, `isDlcTitle()`.
- Create `src/services/store/edition-table.ts` — `EditionOffer`, `EditionOption`, `buildEditionTable()` (saf fonksiyon, gruplama/sıralama/tekilleştirme).
- Modify `src/services/store/match.ts` — `cleanTitleForCrossPlatform`/`extractEdition` editions.ts'e delege; DLC listesi editions.ts'e taşınır.
- Modify `platforms/{steam,epic,gog,xbox,ps,nintendo}.ts` — her birine `fetch<Store>EditionOffers(title, options)`; eski `fetch<Store>Price` silinir; metadata alanları kaldırılır.
- Modify `platforms/ps-parse.ts`, `platforms/xbox-match.ts` — yerel sürüm kodu silinir.
- Rewrite `src/services/store/prices.ts` — `fetchEditionTable(title, options)`.
- Modify `src/services/store/detail.ts`, `map.ts`, `types.ts`, `detail-preview.ts`, `index.ts`, `src/services/gameData.ts`, `src/services/api.ts`.
- Delete `src/services/store/detail-metadata.ts`, `detail-metadata.test.ts`, `platforms/xbox-metadata.ts`.
- Modify `src/services/screenData/gameDetailStore.ts` — `selectedEdition`, `selectEdition()`.

**Aşama 2 (i18n):**
- Create `src/i18n/languages.ts` (dil listesi, script/RTL bilgisi), `src/i18n/messages/en.ts`, `src/i18n/messages/tr.ts`, `src/i18n/messages/<lang>.ts` ×28, `src/i18n/messages/index.ts`, `src/i18n/index.ts` (`t`, `useT`, `languageStore`, `formatMoney`, `formatPercent`).
- Replace `src/services/locale.ts` with `src/i18n/languageStore.ts` (kalıcılık + cihaz dili + RTL).
- Create `src/services/store/languages.ts` — `storeLanguage()`.
- Modify `src/services/country.ts` — ülke adları katalogdan; cihaz bölgesi varsayılanı.
- Modify `src/services/store/{price-parse,currency,deals}.ts` + adapter'lar — sayısal fiyat alanları.
- Modify `src/services/screenData/*` — dil/ülke değişiminde yeniden yükleme.

**Aşama 3 (tasarım):**
- Rewrite `src/constants/DesignSystem.ts`.
- Create `src/components/{StoreLogo,CoverImage,CoverCard,CoverGrid,StoreStrip,SearchField,PriceTable,EditionPicker,SettingsRow,OptionPicker,IconButton}.tsx`; rewrite `ScreenHeader`, `EmptyState`, `ScreenLoading`.
- Delete `src/components/{AppBackground,CardFooter,CardImage,FeaturedDeal,GameCard,GameListItem,GameSearchBar,HomeTopBar,PlatformBadge,PlatformBadgeList}.tsx` (kullanılmayan hâle geldikçe).
- Rewrite `app/(tabs)/{_layout,index,search,free,favorites,settings}.tsx`, `app/game/[id].tsx`, `app/notifications.tsx`, `app/_layout.tsx`.
- Modify `AGENTS.md`, `CLAUDE.md`.

---

# AŞAMA 1 — Sürümler ve detay sadeleştirme

### Task 1: Sürüm normalleştirici

**Files:**
- Create: `src/services/store/editions.ts`
- Test: `src/services/store/editions.test.ts`

**Interfaces:**
- Produces:
  - `type EditionKey = 'base' | 'deluxe' | 'ultimate' | 'gold' | 'goty' | 'complete' | 'definitive' | 'premium' | 'collector' | 'special' | 'anniversary' | 'directors-cut' | 'enhanced' | 'legendary' | 'champion' | 'vault' | 'cross-gen'`
  - `EDITION_ORDER: readonly EditionKey[]`
  - `editionKey(title: string): EditionKey`
  - `baseTitle(title: string): string`
  - `compareEditions(a: EditionKey, b: EditionKey): number`
  - `isDlcTitle(title: string): boolean`

- [ ] **Step 1: Write the failing test**

```ts
// src/services/store/editions.test.ts
import { describe, expect, test } from 'bun:test';
import { baseTitle, compareEditions, editionKey, isDlcTitle } from '@/services/store/editions';

describe('editionKey', () => {
  test.each([
    ['ELDEN RING', 'base'],
    ['ELDEN RING Deluxe Edition', 'deluxe'],
    ['Hogwarts Legacy: Digital Deluxe Edition', 'deluxe'],
    ['Cyberpunk 2077: Ultimate Edition', 'ultimate'],
    ['Red Dead Redemption 2: Ultimate Edition', 'ultimate'],
    ['The Witcher 3: Wild Hunt – Game of the Year Edition', 'goty'],
    ['Fallout 4: GOTY', 'goty'],
    ['Death Stranding Director\'s Cut', 'directors-cut'],
    ['Ghost of Tsushima Yönetmenin Sürümü', 'directors-cut'],
    ['Assassin\'s Creed Mirage Deluxe Sürümü', 'deluxe'],
    ['EA SPORTS FC 25 Ultimate Sürüm', 'ultimate'],
    ['Call of Duty Vault Edition', 'vault'],
    ['Diablo IV Kasa Sürümü', 'vault'],
    ['Far Cry 6 Altın Sürüm', 'gold'],
    ['Far Cry 6 Gold Edition', 'gold'],
    ['Far Cry 6 Édition Gold', 'gold'],
    ['Far Cry 6 Edición Oro', 'gold'],
    ['Far Cry 6 Gold-Edition', 'gold'],
    ['Mass Effect Legendary Edition', 'legendary'],
    ['Starfield Premium Edition', 'premium'],
    ['Resident Evil Village Standard Edition', 'base'],
    ['Resident Evil Village Standart Sürüm', 'base'],
    ['Horizon Zero Dawn Complete Edition', 'complete'],
    ['Édition Définitive de Sleeping Dogs', 'definitive'],
    ['Sleeping Dogs: Definitive Edition', 'definitive'],
    ['Grand Theft Auto V Enhanced', 'enhanced'],
    ['Madden NFL 25 Deluxe-Edition', 'deluxe'],
    ['Hades II Edição Deluxe', 'deluxe'],
    ['Hades II Edizione Deluxe', 'deluxe'],
    ['Hades II Wydanie Deluxe', 'deluxe'],
    ['Hades II Издание Deluxe', 'deluxe'],
    ['Horizon Forbidden West Cross-Gen Bundle', 'cross-gen'],
    ['Mortal Kombat 1 Collector\'s Edition', 'collector'],
    ['Assassin\'s Creed Shadows Anniversary Edition', 'anniversary'],
  ])('%s → %s', (title, key) => {
    expect(editionKey(title)).toBe(key);
  });
});

describe('baseTitle', () => {
  test.each([
    ['ELDEN RING Deluxe Edition', 'ELDEN RING'],
    ['Hogwarts Legacy: Digital Deluxe Edition', 'Hogwarts Legacy'],
    ['Far Cry 6 Altın Sürüm', 'Far Cry 6'],
    ['Far Cry 6 Édition Gold', 'Far Cry 6'],
    ['The Witcher 3: Wild Hunt – Game of the Year Edition', 'The Witcher 3: Wild Hunt'],
    ['Forza Horizon 5 (PC)', 'Forza Horizon 5'],
    ['Resident Evil 4 PS4 & PS5', 'Resident Evil 4'],
    ['Cyberpunk 2077™', 'Cyberpunk 2077'],
    ['Final Fantasy XVI', 'Final Fantasy XVI'],
  ])('%s → %s', (title, base) => {
    expect(baseTitle(title)).toBe(base);
  });
});

describe('isDlcTitle', () => {
  test('season pass, packs, currency are DLC', () => {
    expect(isDlcTitle('Elden Ring Shadow of the Erdtree Season Pass')).toBe(true);
    expect(isDlcTitle('Fortnite - 1000 V-Bucks')).toBe(true);
    expect(isDlcTitle('Cyberpunk 2077: Phantom Liberty Expansion')).toBe(true);
    expect(isDlcTitle('GTA Online: Criminal Enterprise Starter Pack')).toBe(true);
  });
  test('editions are not DLC', () => {
    expect(isDlcTitle('ELDEN RING Deluxe Edition')).toBe(false);
    expect(isDlcTitle('Grand Theft Auto V Story Mode')).toBe(false);
  });
});

describe('compareEditions', () => {
  test('base first, then the fixed order', () => {
    const keys = ['ultimate', 'base', 'deluxe', 'goty'] as const;
    expect(keys.slice().sort(compareEditions)).toEqual(['base', 'deluxe', 'ultimate', 'goty']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/services/store/editions.test.ts`
Expected: FAIL — `Cannot find module '@/services/store/editions'`.

- [ ] **Step 3: Implement**

```ts
// src/services/store/editions.ts
import { foldTurkishI } from '@/services/store/text';

export type EditionKey =
  | 'base' | 'deluxe' | 'ultimate' | 'gold' | 'goty' | 'complete' | 'definitive' | 'premium'
  | 'collector' | 'special' | 'anniversary' | 'directors-cut' | 'enhanced' | 'legendary'
  | 'champion' | 'vault' | 'cross-gen';

export const EDITION_ORDER: readonly EditionKey[] = [
  'base', 'enhanced', 'deluxe', 'gold', 'premium', 'ultimate', 'champion', 'vault', 'legendary',
  'complete', 'definitive', 'goty', 'directors-cut', 'anniversary', 'special', 'collector', 'cross-gen',
];

/** "Edition" in the store languages we support, including Turkish "Sürüm". */
const EDITION_WORD = String.raw`(?:edition|edici[oó]n|[eé]dition|edi[çc][ãa]o|edizione|wydanie|издание|editie|editio|utgåva|udgave|utgave|painos|kiadás|ediţie|ediție|έκδοση|版|에디션|s[üu]r[üu]m[üu]?|bundle|paketi?)`;
const SEP = String.raw`[\s:–—-]*`;

type EditionPattern = readonly [EditionKey, RegExp];

/** Edition names per key in every supported store language. Order matters: first match wins. */
const EDITION_NAMES: readonly (readonly [EditionKey, string])[] = [
  ['directors-cut', String.raw`director'?s\s*cut|y[öo]netmenin|director's|du r[ée]alisateur|del director|des regisseurs`],
  ['goty', String.raw`game\s+of\s+the\s+year|goty|jeu de l'ann[ée]e|juego del a[ñn]o|yılın oyunu|yilin oyunu`],
  ['cross-gen', String.raw`cross[\s-]?gen`],
  ['ultimate', String.raw`ultimate|ultime|definitiva?\s+ultimate|nihai`],
  ['deluxe', String.raw`digital\s+deluxe|deluxe|lüks|luks`],
  ['gold', String.raw`gold|altın|altin|oro|or|ouro`],
  ['premium', String.raw`premium|seçkin|seckin`],
  ['complete', String.raw`complete|compl[eè]te|completa|tam|komplett`],
  ['definitive', String.raw`definitive|d[ée]finitive|definitiva|kesin`],
  ['legendary', String.raw`legendary|l[ée]gendaire|legendaria|efsanevi`],
  ['champion', String.raw`champions?|şampiyon|sampiyon`],
  ['vault', String.raw`vault|kasa`],
  ['collector', String.raw`collector'?s?|koleksiyon(?:cu)?|collector`],
  ['anniversary', String.raw`anniversary|anniversaire|aniversario|yıldönümü|yildonumu`],
  ['special', String.raw`special|sp[ée]ciale|especial|özel|ozel`],
  ['enhanced', String.raw`enhanced`],
];

const EDITION_PATTERNS: readonly EditionPattern[] = EDITION_NAMES.map(([key, names]) => [
  key,
  // "<name> Edition", "Edition <name>", "<name>-Edition", or a bare trailing name for GOTY/Director's Cut/Enhanced/Cross-Gen.
  new RegExp(
    String.raw`(?:^|[\s:–—(-])(?:(?:${names})${SEP}${EDITION_WORD}|${EDITION_WORD}${SEP}(?:${names})|(?:${names}))(?=$|[\s)™®:,.!-])`,
    'iu',
  ),
]);

/** Bare words that only count as an edition when paired with an edition word ("Gold Edition", not "Gold Rush"). */
const NEEDS_EDITION_WORD = new Set<EditionKey>(['gold', 'special', 'complete', 'champion', 'premium', 'legendary', 'definitive', 'collector', 'anniversary', 'vault']);

const STANDARD = new RegExp(String.raw`(?:standard|standart|est[áa]ndar)${SEP}${EDITION_WORD}?`, 'iu');

function matchesWithEditionWord(key: EditionKey, names: string, title: string): boolean {
  const paired = new RegExp(
    String.raw`(?:(?:${names})${SEP}${EDITION_WORD}|${EDITION_WORD}${SEP}(?:${names}))`,
    'iu',
  );
  return NEEDS_EDITION_WORD.has(key) ? paired.test(title) : true;
}

export function editionKey(title: string): EditionKey {
  const folded = foldTurkishI(title.replaceAll(/[™®©]/g, ''));
  for (const [index, [key, pattern]] of EDITION_PATTERNS.entries()) {
    const names = EDITION_NAMES[index]?.[1] ?? '';
    if (pattern.test(folded) && matchesWithEditionWord(key, names, folded)) return key;
  }
  if (STANDARD.test(folded)) return 'base';
  return 'base';
}

const EDITION_SUFFIX = new RegExp(
  String.raw`[\s:–—-]*(?:${[...EDITION_NAMES.map(([, names]) => names), 'standard|standart|est[áa]ndar'].map((n) => `(?:${n})`).join('|')})?${SEP}${EDITION_WORD}(?:${SEP}(?:${EDITION_NAMES.map(([, n]) => n).join('|')}))?\s*$`,
  'iu',
);
const BARE_SUFFIX = /[\s:–—-]*(?:game\s+of\s+the\s+year|goty|director'?s\s*cut|y[öo]netmenin\s+s[üu]r[üu]m[üu]?|enhanced|cross[\s-]?gen(?:\s+bundle)?)\s*$/iu;
const LEADING_EDITION = new RegExp(String.raw`^${EDITION_WORD}\s+\S+\s+(?:de|of|di|von)\s+`, 'iu');
const PLATFORM_SUFFIX = /\s*(?:\((?:PC|PS[45]|Xbox[^)]*|Windows)\)|PS4\s*(?:&|and|ve|\/)\s*PS5|PS[45]|for\s+Windows)\s*$/iu;
const PARENTHESISED = /\s*\([^()]*\)\s*$/u;

/** Title without edition, platform and parenthesised suffixes, used to group every edition of one game. */
export function baseTitle(title: string): string {
  let current = title.replaceAll(/[™®©]/g, '').trim();
  current = current.replace(LEADING_EDITION, '');
  for (let pass = 0; pass < 3; pass += 1) {
    const next = current
      .replace(PLATFORM_SUFFIX, '')
      .replace(EDITION_SUFFIX, '')
      .replace(BARE_SUFFIX, '')
      .replace(PARENTHESISED, '')
      .replace(/[\s:–—-]+$/u, '')
      .trim();
    if (next === current) break;
    current = next;
  }
  return current.replaceAll(/\s+/g, ' ');
}

export function compareEditions(a: EditionKey, b: EditionKey): number {
  return EDITION_ORDER.indexOf(a) - EDITION_ORDER.indexOf(b);
}

const DLC_PHRASES = ['story pack', 'lost and', 'great white', 'criminal enterprise', 'battle pass', 'fortnite crew', 'season pass', 'sezon bileti'];
const DLC_WORDS = [
  'dlc', 'pack', 'paket', 'paketi', 'season', 'cash', 'shark', 'kartı', 'karti', 'addon', 'add-on', 'expansion',
  'starter', 'soundtrack', 'artbook', 'skin', 'coin', 'coins', 'credit', 'credits', 'points', 'membership',
  'subscription', 'upgrade', 'yükseltme', 'genişleme', 'genisleme',
];

export function isDlcTitle(title: string): boolean {
  if (/\bonline:/i.test(title)) return true;
  if (/\bv[-\s]?(bucks|papel)\b/i.test(title)) return true;
  const lower = title.toLowerCase();
  if (DLC_PHRASES.some((phrase) => lower.includes(phrase))) return true;
  if (/\bbundle\b/i.test(title) && editionKey(title) === 'base') return true;
  return DLC_WORDS.some((word) => new RegExp(String.raw`(?:^|[^\p{L}])${word}(?:$|[^\p{L}])`, 'iu').test(title));
}
```

Not: `'paket'`/`'bundle'` hem `EDITION_WORD` hem DLC listesinde; `isDlcTitle` sürüm adı taşıyan paketleri ("Cross-Gen Bundle", "Deluxe Paketi") DLC saymaz — bunun için `isDlcTitle` başına ekle:

```ts
  if (editionKey(title) !== 'base') return /\b(season pass|expansion|dlc)\b/i.test(title);
```

- [ ] **Step 4: Run tests until they pass**

Run: `bun test src/services/store/editions.test.ts`
Expected: PASS. Bir örnek başarısızsa ilgili dil adını `EDITION_NAMES`'e ekle; testi değiştirme.

- [ ] **Step 5: Commit**

```bash
git add src/services/store/editions.ts src/services/store/editions.test.ts
git commit -m "feat(store): multilingual edition normalizer"
```

---

### Task 2: Eski sürüm kodunu editions.ts'e bağla

**Files:**
- Modify: `src/services/store/match.ts` (EDITION_SUFFIX…`extractEdition`, `hasProductDlcMarker`, `getPriceLookupTitles`)
- Modify: `src/services/store/platforms/ps-parse.ts:521-630` (PS_*_EDITION*, `extractPsEdition`, `PsEditionType`)
- Modify: `src/services/store/platforms/xbox-match.ts` (`hasPremiumEdition`)
- Test: `src/services/store/match.test.ts`, `platforms/ps.test.ts`, `platforms/xbox-match.test.ts`

**Interfaces:**
- Consumes: Task 1 exports.
- Produces: `cleanTitleForCrossPlatform(title) === baseTitle(title)` (aynı imza, kaldırılmaz — merge ve katalog kullanıyor); `extractEdition` silinir, çağıranlar `editionKey` kullanır; `extractPsEdition` silinir.

- [ ] **Step 1:** `grep -rn "extractEdition\|extractPsEdition\|PsEditionType\|hasPremiumEdition\|getPriceLookupTitles" src scripts` ile bütün çağrıları listele.
- [ ] **Step 2:** `match.ts` içinde `cleanTitleForCrossPlatform` gövdesini `return baseTitle(title);` yap; `EDITION_SUFFIX`, `DIRECTORS_CUT_*`, `PARENTHESISED`, `EDITION_IN_TITLE`, `extractEdition`, `DLC_*`, `hasProductDlcMarker` silinip `shouldBlockProductTitleMatch` içinde `isDlcTitle` kullanılır:

```ts
  const foundDlc = isDlcTitle(found);
  const searchDlc = isDlcTitle(search);
  return foundDlc && !searchDlc && !isGtaVStoryModeMainProduct(found, search);
```

`getPriceLookupTitles` Task 4'te silinecek; şimdilik `cleanTitleForCrossPlatform` üzerinden çalışmaya devam eder.
- [ ] **Step 3:** `ps-parse.ts`: `extractPsEdition(title)` çağıranlarını `editionKey(title)` ile değiştir (`PsEditionType` → `EditionKey`), PS'e özgü sürüm regex'lerini ve `PS_EDITION_PATTERNS`'ı sil; PS başlık temizleyici (`cleanPsTitle` benzeri, 545–575) `baseTitle` çağırır.
- [ ] **Step 4:** `xbox-match.ts`: `hasPremiumEdition(title)` → `editionKey(title) !== 'base'`; ceza kuralı "arama base iken bulunan sürüm base değilse -22" olarak kalır.
- [ ] **Step 5:** `bun test src/services/store` çalıştır. Eski `extractEdition`/`extractPsEdition` testlerini `editions.test.ts`'deki eşdeğerlerine taşı (yeni örnek varsa Task 1 tablosuna ekle), silinen fonksiyonların testlerini sil. Expected: PASS.
- [ ] **Step 6:** `bun run typecheck && bun run lint` → temiz.
- [ ] **Step 7: Commit** — `git commit -am "refactor(store): route edition parsing through editions.ts"`

---

### Task 3: Adapter başına `EditionOffer` üretimi

**Files:**
- Create: `src/services/store/edition-table.ts`
- Modify: `platforms/steam.ts`, `platforms/epic.ts`, `platforms/gog.ts`, `platforms/xbox.ts`, `platforms/ps.ts`, `platforms/nintendo.ts`
- Test: `src/services/store/edition-table.test.ts`, her adapter için mevcut `*-flows.test.ts` dosyasına yeni `describe('edition offers')`

**Interfaces:**
- Consumes: `editionKey`, `baseTitle`, `isDlcTitle`, `scoreProductTitleMatch`.
- Produces:

```ts
// src/services/store/edition-table.ts
import type { EditionKey } from '@/services/store/editions';
import type { GameDeal, PlatformPriceResult } from '@/services/store/types';

export type EditionOffer = Readonly<{
  platform: string;
  edition: EditionKey;
  /** Store product title, kept for tests and debugging. */
  title: string;
  /** Route id of the store product (same format as search hit ids). */
  id: string;
  price: PlatformPriceResult;
}>;

export type EditionOption = Readonly<{
  key: EditionKey;
  /** One deal per store, cheapest first; stores without this edition are absent. */
  deals: readonly GameDeal[];
}>;

export type EditionOffersFetcher = (title: string, options?: StoreRequestOptions) => Promise<EditionOffer[]>;
```

  - `fetchSteamEditionOffers`, `fetchEpicEditionOffers`, `fetchGogEditionOffers`, `fetchXboxEditionOffers`, `fetchPlayStationEditionOffers`, `fetchNintendoEditionOffers` — hepsi `EditionOffersFetcher`.
  - `acceptEditionCandidate(candidateTitle: string, title: string): EditionKey | null` (edition-table.ts): `isDlcTitle(candidateTitle)` ise ya da `scoreProductTitleMatch(baseTitle(candidateTitle), baseTitle(title)) < 50` ise `null`; değilse `editionKey(candidateTitle)`.

- [ ] **Step 1: Write the failing test for `acceptEditionCandidate`**

```ts
// src/services/store/edition-table.test.ts
import { describe, expect, test } from 'bun:test';
import { acceptEditionCandidate } from '@/services/store/edition-table';

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
```

- [ ] **Step 2:** `bun test src/services/store/edition-table.test.ts` → FAIL (modül yok).
- [ ] **Step 3: Implement `acceptEditionCandidate`** (edition-table.ts'e, yukarıdaki tiplerle birlikte):

```ts
import { baseTitle, editionKey, isDlcTitle } from '@/services/store/editions';
import { scoreProductTitleMatch } from '@/services/store/match';

export function acceptEditionCandidate(candidateTitle: string, title: string): EditionKey | null {
  if (isDlcTitle(candidateTitle) && !isDlcTitle(title)) return null;
  if (scoreProductTitleMatch(baseTitle(candidateTitle), baseTitle(title)) < 50) return null;
  return editionKey(candidateTitle);
}
```

- [ ] **Step 4:** Test PASS.
- [ ] **Step 5: Adapter'lar.** Her adapter mevcut arama yardımcısıyla **bir** arama yapar (`baseTitle(title)` ile), adayları `acceptEditionCandidate` ile süzer, en fazla 8 aday için fiyat üretir. Fiyat üretimi mevcut yardımcıları yeniden kullanır:

| Adapter | Arama | Fiyat |
|---|---|---|
| Steam | `searchSteamProducts(q)` | `steamPriceFromOverview(hit.id, product.price, signal)`; `price` yoksa atla. Ek olarak en yüksek skorlu `base` adayının `fetchSteamAppData(id)` sonucundaki `package_groups[].subs[]` (başlık `option_text`, fiyat `price_in_cents_with_discount`) → her alt paket için `editionKey(option_text)`; `SteamAppData` tipine `package_groups?: { subs?: { packageid: number; option_text?: string; percent_savings?: number; price_in_cents_with_discount?: number }[] }[]` ekle. Alt paket `id` = `${appId}`, `store_url` = `https://store.steampowered.com/sub/${packageid}/`. |
| Epic | `runEpicSearchVariants(q, 12, options)` → `elements` | `epicPriceFromMinorUnits(el.price.price, signal)` + `epicOfferToSearchHit(el)` |
| GOG | `fetchGogCatalog(q, 12, options)` | `gogPriceFromProduct(product, signal)`, `gogStoreUrl(product)` |
| Xbox | `searchXboxProducts(q, options)` | `getXboxListPrice(product)` → `xboxPriceFromSelected(...)`; `(PC)` başlıklar konsol eşi varsa atlanır (mevcut `rankXboxPriceHits` kuralı) |
| PlayStation | `fetchPsSearchProducts(q, options)` (`getPsCurrency()` null ise `[]`) | ürün fiyatı `isUnavailablePrice` ise `withKnownPrice(product, options)`; ardından `localizePsProduct` |
| Nintendo | `searchNintendoProducts(q, options)`; `is_add_on` atla | `productToPriceResult(product, signal)` |

Her fonksiyon aynı iskeleti izler (Steam örneği; diğerleri tablodaki çağrılarla aynı yapı):

```ts
export async function fetchSteamEditionOffers(
  title: string,
  options?: StoreRequestOptions,
): Promise<EditionOffer[]> {
  const products = await searchSteamProducts(baseTitle(title), options);
  throwIfAborted(options?.signal);
  const accepted = products.flatMap((product) => {
    const edition = acceptEditionCandidate(product.hit.title, title);
    return edition && product.price ? [{ product, edition }] : [];
  }).slice(0, 8);
  const offers = await Promise.all(accepted.map(async ({ product, edition }) => {
    const price = await steamPriceFromOverview(product.hit.id, product.price ?? {}, options?.signal);
    return price ? { platform: 'Steam', edition, title: product.hit.title, id: product.hit.id, price } : null;
  }));
  throwIfAborted(options?.signal);
  const baseApp = accepted.find(({ edition }) => edition === 'base')?.product.hit.id;
  const packages = baseApp ? await steamPackageOffers(baseApp, title, options) : [];
  return [...offers.flatMap((offer) => (offer ? [offer] : [])), ...packages];
}
```

`steamPackageOffers(appId, title, options)`: `fetchSteamAppData` → `package_groups` → her `sub` için `acceptEditionCandidate(sub.option_text ?? '', title)`; fiyat `completeSteamPrice({ final: sub.price_in_cents_with_discount, initial: Math.round(final / (1 - percent_savings / 100)), discount_percent: percent_savings, currency: data.price_overview?.currency })` → `steamPriceFromOverview`. `option_text` "Buy ELDEN RING Deluxe Edition - ₺1.999" biçiminde gelir: `' - '` sonrası ve baştaki "Buy"/"Satın al" atılır (`/^(?:buy|satın al|acheter|kaufen|comprar)\s+/iu`).

Eski `fetchSteamPrice`, `pickSteamPriceMatch`, `fetchEpicPrice`, `fetchGogPrice`, `fetchXboxPrice`, `fetchPlayStationPrice`, `findPlayStationMatch`, `fetchNintendoPrice`, `pickBestNintendoProduct` (yalnız fiyat için kullanılıyorsa) silinir.

- [ ] **Step 6: Adapter testleri.** Her `platforms/<store>-flows.test.ts` dosyasına, dosyadaki mevcut fetch mock yardımcısını kullanarak (dosyanın başındaki `mockFetch`/`installFetch` deseni) şu testleri ekle:
  - "returns one offer per edition": arama yanıtında `X`, `X Deluxe Edition`, `X Season Pass`, `X 2` → dönen `edition` değerleri `['base', 'deluxe']`.
  - "search is issued once with the base title": `X Deluxe Edition` başlığıyla çağrıldığında arama URL'sinde `encodeURIComponent('X')` var, arama isteği sayısı 1.
  - Steam ek: appdetails `package_groups` iki alt paket (`Buy X`, `Buy X Deluxe Edition`) → `deluxe` teklifinin `store_url`'ü `/sub/<id>/`.
  - Xbox ek: `X Deluxe Edition` ve `X Deluxe Edition (PC)` → tek `deluxe` teklifi, konsol olan.
  - PS ek: `getPsCurrency()` null olan ülkede (KZ) istek atılmaz, `[]` döner.
- [ ] **Step 7:** `bun test src/services/store/platforms` → PASS; eski `fetch*Price` testleri silinir ya da yeni fonksiyona taşınır.
- [ ] **Step 8: Commit** — `git commit -am "feat(store): per-store edition offers from a single search"` (yeni dosyaları `git add` ile ekle).

---

### Task 4: Sürüm tablosu (`prices.ts`)

**Files:**
- Modify: `src/services/store/edition-table.ts` (+`buildEditionTable`)
- Rewrite: `src/services/store/prices.ts`
- Test: `src/services/store/edition-table.test.ts`, `src/services/store/prices.test.ts` (yeni; eski fiyat testlerini taşı)

**Interfaces:**
- Produces:
  - `buildEditionTable(offers: readonly EditionOffer[]): EditionOption[]`
  - `fetchEditionTable(title: string, options?: StoreRequestOptions): Promise<EditionOption[]>`
  - `EDITION_PROVIDERS: readonly { platform: string; fetch: EditionOffersFetcher }[]`

- [ ] **Step 1: Failing tests for `buildEditionTable`**

```ts
import { buildEditionTable, type EditionOffer } from '@/services/store/edition-table';

const offer = (platform: string, edition: EditionOffer['edition'], price: string, id = platform): EditionOffer => ({
  platform, edition, title: `${platform} ${edition}`, id,
  price: { platform, price, discount: '', store_url: `https://example.com/${id}` },
});

describe('buildEditionTable', () => {
  test('groups by edition, base first, one deal per store, cheapest first', () => {
    const table = buildEditionTable([
      offer('Steam', 'deluxe', '₺900,00'),
      offer('Steam', 'base', '₺600,00'),
      offer('Epic Games', 'base', '₺550,00'),
      offer('Xbox', 'deluxe', '₺950,00', 'a'),
      offer('Xbox', 'deluxe', '₺800,00', 'b'),
    ]);
    expect(table.map((option) => option.key)).toEqual(['base', 'deluxe']);
    expect(table[0]?.deals.map((deal) => deal.platform)).toEqual(['Epic Games', 'Steam']);
    expect(table[1]?.deals.map((deal) => [deal.platform, deal.price])).toEqual([
      ['Xbox', '₺800,00'],
      ['Steam', '₺900,00'],
    ]);
  });
  test('drops unavailable prices and editions left empty', () => {
    const table = buildEditionTable([offer('Steam', 'gold', 'Bilinmiyor'), offer('GOG', 'base', '₺100,00')]);
    expect(table.map((option) => option.key)).toEqual(['base']);
  });
});
```

(Task 9 fiyatları sayıya çevirdiğinde bu testlerdeki fiyat alanları `amount` olarak güncellenir.)

- [ ] **Step 2:** FAIL doğrula.
- [ ] **Step 3: Implement** (`parseComparablePrice` yerine `price-parse.ts`'teki `parseLocalizedAmount`; ücretsiz = 0):

```ts
export function buildEditionTable(offers: readonly EditionOffer[]): EditionOption[] {
  const byEdition = new Map<EditionKey, Map<string, GameDeal>>();
  for (const offer of offers) {
    if (isUnavailablePrice(offer.price.price)) continue;
    const deal = platformPriceToGameDeal(offer.price);
    const stores = byEdition.get(offer.edition) ?? new Map<string, GameDeal>();
    const current = stores.get(offer.platform);
    if (!current || comparableAmount(deal) < comparableAmount(current)) stores.set(offer.platform, deal);
    byEdition.set(offer.edition, stores);
  }
  const keys = [...byEdition.keys()].sort(compareEditions);
  return keys.flatMap((key) => {
    const deals = [...(byEdition.get(key)?.values() ?? [])].sort((a, b) => comparableAmount(a) - comparableAmount(b));
    return deals.length > 0 ? [{ key, deals }] : [];
  });
}

function comparableAmount(deal: GameDeal): number {
  if (isExplicitlyFreePrice(deal.price)) return 0;
  return parseLocalizedAmount(deal.price) ?? Number.POSITIVE_INFINITY;
}
```

- [ ] **Step 4: `prices.ts` yeniden yazımı.** Korunacaklar: 60 sn TTL önbellek + inflight birleştirme (aynı sinyal kuralı), katalog atlama (`catalogPlatforms`, `isListedOn`). Önbellek değeri artık `EditionOffer[]`, anahtar `${getStoreCountry()}|${platform}|${baseTitle(title).toLowerCase()}`.

```ts
export const EDITION_PROVIDERS = [
  { platform: 'Steam', fetch: fetchSteamEditionOffers },
  { platform: 'Epic Games', fetch: fetchEpicEditionOffers },
  { platform: 'GOG', fetch: fetchGogEditionOffers },
  { platform: 'Xbox', fetch: fetchXboxEditionOffers },
  { platform: 'PlayStation', fetch: fetchPlayStationEditionOffers },
  { platform: 'Nintendo', fetch: fetchNintendoEditionOffers },
] as const satisfies readonly { platform: string; fetch: EditionOffersFetcher }[];

export async function fetchEditionTable(title: string, options?: StoreRequestOptions): Promise<EditionOption[]> {
  const available = await catalogPlatforms(title);
  const results = await Promise.allSettled(
    EDITION_PROVIDERS.map((provider) =>
      isListedOn(provider.platform, available)
        ? fetchCachedOffers(provider.platform, title, provider.fetch, options)
        : Promise.resolve([]),
    ),
  );
  throwIfAborted(options?.signal);
  return buildEditionTable(results.flatMap((result) => (result.status === 'fulfilled' ? result.value : [])));
}
```

`fetchCachedOffers` mevcut `fetchCachedPlatformPrice`'ın aynısıdır, yalnız tip `EditionOffer[]` ve anahtar yukarıdaki gibi. `fetchAllPrices`, `fetchPlatformDeal`, `PriceFetchOptions`, `knownDealForPlatform`, `fetchFirstAvailablePrice`, `getPriceLookupTitles` (match.ts) silinir.

- [ ] **Step 5: `prices.test.ts`**: (a) bir sağlayıcı hata fırlatınca diğerlerinin teklifleri tabloda kalır; (b) 60 sn içinde ikinci çağrı adapter'ı tekrar çağırmaz, ülke değişince çağırır; (c) katalog bir mağazada başlığı bilmiyorsa o sağlayıcı çağrılmaz; (d) sinyal iptal edilince `AbortError` fırlatır. Adapter'ları `mock.module('@/services/store/platforms/steam', ...)` ile değil, mevcut `request-efficiency.test.ts`'teki fetch-mock deseniyle taklit et.
- [ ] **Step 6:** `bun test src/services/store` → PASS.
- [ ] **Step 7: Commit** — `git commit -am "feat(store): edition × store price table"`

---

### Task 5: Detay servisi ve tiplerin sadeleşmesi

**Files:**
- Modify: `src/services/store/types.ts`, `detail.ts`, `map.ts`, `merge.ts` (`prepareLiveGame`), `detail-preview.ts`, `index.ts`, `src/services/api.ts`, `src/services/gameData.ts`, `src/utils/gameDisplay.ts`
- Modify: adapter detay fonksiyonları (`fetch*Details`) — metadata alanlarını üretmeyi bırakır
- Delete: `src/services/store/detail-metadata.ts`, `detail-metadata.test.ts`, `platforms/xbox-metadata.ts`, `epicMetadataFromOffer`/`epicMediaToGameMedia`/`fetchEpicMedia`, `gogMetadataFromProduct`, PS/Nintendo parse içindeki description/genre/developer/screenshot/video çıkarımı
- Test: `src/services/store/detail.test.ts`

**Interfaces:**
- Consumes: `fetchEditionTable`, `editionKey`.
- Produces:
  - `LiveGame` / `GameSummary`: `description`, `genres`, `developers`, `release_date`, `screenshots`, `videos` alanları **yok**.
  - `LiveGame.edition?: EditionKey`; `GameDetailResponse` = `{ game: GameSummary & { edition: EditionKey }; editions: EditionOption[] }` (`prices`/`meta` kalkar).
  - `Game` (gameData.ts): metadata alanları yok; `edition?: EditionKey`; `editions?: EditionOptionView[]` where `type EditionOptionView = { key: EditionKey; deals: Deal[] }` (Deal = gameData'daki mevcut UI deal tipi, `export` edilir).
  - `fetchGameDetailLive(slug, platformHint?, options?) => Promise<{ game: LiveGame & { edition: EditionKey }; editions: EditionOption[] } | null>`

- [ ] **Step 1: Failing tests** (`detail.test.ts`, mevcut fetch-mock desenini kullanarak):

```ts
test('a Deluxe route opens Deluxe and never shows the base price for it', async () => {
  // Steam appdetails for 1001 = "X Deluxe Edition"; storesearch "X" returns 1000 (X, ₺500) and 1001 (X Deluxe Edition, ₺800);
  // Epic search returns only "X" (₺450).
  const detail = await getGameDetail('1001', 'Steam');
  expect(detail.game.edition).toBe('deluxe');
  const deluxe = detail.editions.find((option) => option.key === 'deluxe');
  expect(deluxe?.deals.map((deal) => deal.platform)).toEqual(['Steam']);
  expect(detail.editions.find((option) => option.key === 'base')?.deals.map((d) => d.platform)).toEqual(['Epic Games', 'Steam']);
});

test('a route whose edition no store lists still returns that edition from the source store', async () => {
  // Steam appdetails 2001 = "Y Gold Edition" with price_overview; storesearch "Y" returns nothing.
  const detail = await getGameDetail('2001', 'Steam');
  expect(detail.game.edition).toBe('gold');
  expect(detail.editions.map((option) => option.key)).toEqual(['gold']);
});

test('detail issues no metadata searches', async () => {
  // count requests: 1 detail request + 1 search per store (+1 Steam appdetails for packages)
});
```

İkinci test için: kaynak ürünün kendi fiyatı (`game.deals[0]`) sürüm tablosunda o mağaza/sürüm satırı yoksa `EditionOffer` olarak eklenir (`sourceOffer(game)`).

- [ ] **Step 2:** FAIL doğrula.
- [ ] **Step 3: Implement `detail.ts`:**

```ts
export async function fetchGameDetailLive(slug: string, platformHint?: string, options?: StoreRequestOptions) {
  const preview = getDetailPreview(slug, platformHint);
  let game: LiveGame | null;
  try {
    game = (await fetchGameBySlug(slug, platformHint, options)) ?? preview;
  } catch (error) {
    throwIfAborted(options?.signal);
    if (!preview) throw error;
    game = preview;
  }
  throwIfAborted(options?.signal);
  if (!game) return null;

  const edition = editionKey(game.title);
  const table = await fetchEditionTable(game.title, options);
  return { game: { ...game, edition }, editions: withSourceOffer(table, game, edition) };
}
```

`withSourceOffer`: `game.deals?.[0]` varsa ve `table` içinde `edition` anahtarlı seçenekte `game.source_platform` satırı yoksa, `buildEditionTable([...tablodaki teklifler, kaynak teklif])` ile yeniden kur — bunun için `buildEditionTable` girişini korumak adına `fetchEditionTable` yerine iç fonksiyon `fetchEditionOffers(title, options): Promise<EditionOffer[]>` export et ve `fetchEditionTable = buildEditionTable(await fetchEditionOffers(...))` olsun; detay `fetchEditionOffers` kullanır.

- [ ] **Step 4:** `map.ts` → `liveGameToSummary` metadata satırlarını sil; `liveGameToDetailResponse(detail)` yeni şekli döner. `gameData.ts` → `mapDetailToGame` `editions`'ı `Deal` dizilerine map'ler, `game.deals` = seçili sürümün deal'leri. `api.ts`'teki tip re-export'larını güncelle. `gameDisplay.ts`'te kullanılmayan (`getGameImageSources` screenshot kısmı vb.) kodu temizle.
- [ ] **Step 5:** `bun test src` → PASS (metadata testleri silinir; `detail-preview`, `map.test.ts`, `gameData.test.ts` yeni şekle güncellenir).
- [ ] **Step 6: Commit** — `git commit -am "feat(detail): edition table replaces metadata and single-edition prices"`

---

### Task 6: Detay store'u ve ekranın geçici sadeleştirilmesi

**Files:**
- Modify: `src/services/screenData/gameDetailStore.ts`
- Modify: `app/game/[id].tsx` (geçici; Task 17'de yeniden yazılır)
- Modify: `package.json`, `app.json` (`expo-video` kaldır)
- Test: `src/services/screenData/gameDetailStore.test.ts` (yeni), `src/z-detail-screen.test.tsx`

**Interfaces:**
- Produces:
  - `GameDetailFetchSnapshot` + `selectedEdition: EditionKey | null`
  - `gameDetailStore.selectEdition(slug: string, platformHint: string | undefined, key: EditionKey): void` — snapshot'ı yeni nesneyle değiştirir, dinleyicileri bilgilendirir, istek atmaz.
  - İlk yüklemede `selectedEdition = game.edition` (tabloda yoksa ilk seçenek).

- [ ] **Step 1: Failing test**

```ts
test('selectEdition switches without a request', async () => {
  // mock fetchGameDetail via test-support/screen-store-mocks to resolve a game with editions base+deluxe, edition 'deluxe'
  const unsubscribe = gameDetailStore.subscribe('1', 'Steam', () => {});
  await waitFor(() => gameDetailStore.getSnapshot('1', 'Steam').game !== null);
  expect(gameDetailStore.getSnapshot('1', 'Steam').selectedEdition).toBe('deluxe');
  const calls = fetchCount();
  gameDetailStore.selectEdition('1', 'Steam', 'base');
  expect(gameDetailStore.getSnapshot('1', 'Steam').selectedEdition).toBe('base');
  expect(fetchCount()).toBe(calls);
  unsubscribe();
});
```

- [ ] **Step 2:** FAIL doğrula → implement → PASS.
- [ ] **Step 3: Geçici ekran:** `[id].tsx` içinden `Calendar/Building2` meta satırı, tür etiketleri, `TabBar`, `OverviewTab`, `MediaListItem`, `ScreenshotModal`, `VideoModal`, `formatDate`, `getGenreColor` kullanımı, `useReducer` UI durumu silinir. `BestPriceCard` altında seçili sürümün `PricesTab`'i doğrudan gösterilir; üstte sürüm sayısı > 1 ise basit `Pressable` çip satırı (`selectEdition` çağırır, etiket şimdilik `key`). Bu hâl Task 17'de değişecek; amaç aşama 1'in kendi başına çalışması.
- [ ] **Step 4:** `bun remove expo-video`; `app.json` `plugins` dizisinden `"expo-video"` satırını sil; `grep -rn "expo-video" app src test-support` boş olmalı (native-mocks'taki mock da silinir).
- [ ] **Step 5:** `src/z-detail-screen.test.tsx` güncelle: "Genel Bakış" ve medya testlerini sil; "sürüm çipine basınca fiyat satırları değişir" testi ekle (`fire(byLabel(tree, 'deluxe'), 'onPress')`).
- [ ] **Step 6:** `bun test src app` → PASS; `bun run typecheck && bun run lint`.
- [ ] **Step 7: Commit** — `git commit -am "feat(detail): edition picker state, drop overview, metadata and media"`

---

### Task 7: Aşama 1 doğrulaması (istek sayıları, iptal, araçlar)

**Files:**
- Modify: `src/services/store/platforms/request-efficiency.test.ts`, `src/services/screenData/request-cancellation.test.ts`, `src/services/store/catalog-integration.test.ts`, `src/services/store/country-routing.test.ts`

- [ ] **Step 1:** `bun run test:coverage` çalıştır; başarısız testleri tek tek incele. İstek sayısı beklentileri yeni akışa göre: detay = 1 kaynak detay isteği + mağaza başına 1 arama (+ Steam base için 1 `appdetails`, kaynak Steam ve aynı app ise önbellekten değil yine 1) + FX isteği (önbellekte değilse). Sayıyı testte sabitle, gerekçeyi yorum olarak yaz.
- [ ] **Step 2:** `request-cancellation.test.ts`'e: detay yüklenirken `reload` çağrılınca eski sinyal iptal edilir ve eski sonuç snapshot'a yazılmaz.
- [ ] **Step 3:** `bun run typecheck && bun run lint && bun run test:coverage && bunx --bun expo-doctor && bun run doctor` — hepsi temiz; react-doctor uyarısı artmamalı.
- [ ] **Step 4: Commit** — `git commit -am "test(store): request counts and cancellation for edition table"`

---

# AŞAMA 2 — Dil/ülke ayrımı ve i18n

### Task 8: i18n çekirdeği (dil store'u, katalog, `t`, RTL)

**Files:**
- Create: `src/i18n/languages.ts`, `src/i18n/languageStore.ts`, `src/i18n/messages/en.ts`, `src/i18n/messages/tr.ts`, `src/i18n/messages/index.ts`, `src/i18n/index.ts`
- Delete: `src/services/locale.ts`, `src/services/locale.test.ts` (testler `src/i18n/i18n.test.ts`'e taşınır)
- Modify: `index.ts` (bootstrap: `loadAppLocale` → `loadLanguage`), `index.test.ts`, `src/services/store/config.ts` (geçici: `getAppLocale` → `getLanguage`)
- Test: `src/i18n/i18n.test.ts`

**Interfaces:**
- Produces:

```ts
// src/i18n/languages.ts
export const LANGUAGES = [
  { code: 'tr', nativeName: 'Türkçe', font: 'plex' },
  { code: 'en', nativeName: 'English', font: 'plex' },
  { code: 'de', nativeName: 'Deutsch', font: 'plex' },
  { code: 'fr', nativeName: 'Français', font: 'plex' },
  { code: 'es', nativeName: 'Español (España)', font: 'plex' },
  { code: 'es-419', nativeName: 'Español (Latinoamérica)', font: 'plex' },
  { code: 'pt', nativeName: 'Português (Portugal)', font: 'plex' },
  { code: 'pt-BR', nativeName: 'Português (Brasil)', font: 'plex' },
  { code: 'it', nativeName: 'Italiano', font: 'plex' },
  { code: 'nl', nativeName: 'Nederlands', font: 'plex' },
  { code: 'pl', nativeName: 'Polski', font: 'plex' },
  { code: 'ru', nativeName: 'Русский', font: 'plex' },
  { code: 'uk', nativeName: 'Українська', font: 'plex' },
  { code: 'cs', nativeName: 'Čeština', font: 'plex' },
  { code: 'hu', nativeName: 'Magyar', font: 'plex' },
  { code: 'ro', nativeName: 'Română', font: 'plex' },
  { code: 'bg', nativeName: 'Български', font: 'plex' },
  { code: 'el', nativeName: 'Ελληνικά', font: 'plex' },
  { code: 'da', nativeName: 'Dansk', font: 'plex' },
  { code: 'sv', nativeName: 'Svenska', font: 'plex' },
  { code: 'no', nativeName: 'Norsk', font: 'plex' },
  { code: 'fi', nativeName: 'Suomi', font: 'plex' },
  { code: 'vi', nativeName: 'Tiếng Việt', font: 'plex' },
  { code: 'id', nativeName: 'Bahasa Indonesia', font: 'plex' },
  { code: 'ja', nativeName: '日本語', font: 'system' },
  { code: 'ko', nativeName: '한국어', font: 'system' },
  { code: 'zh-Hans', nativeName: '简体中文', font: 'system' },
  { code: 'zh-Hant', nativeName: '繁體中文', font: 'system' },
  { code: 'th', nativeName: 'ไทย', font: 'system' },
  { code: 'ar', nativeName: 'العربية', font: 'system', rtl: true },
] as const;
// `font: 'plex'` = IBM Plex Sans covers it (Latin, Cyrillic, Greek, Vietnamese); 'system' = platform font.
export type LanguageCode = (typeof LANGUAGES)[number]['code'];
export function isRtl(code: LanguageCode): boolean;
export function usesSystemFont(code: LanguageCode): boolean;
/** Best supported language for a BCP-47 tag: exact, then region rules (es-MX→es-419, pt-BR, zh-TW/HK→zh-Hant, zh→zh-Hans, nb/nn→no), then primary subtag. */
export function matchLanguage(tag: string | null | undefined): LanguageCode | null;
```

```ts
// src/i18n/languageStore.ts
export const languageStore: {
  getSnapshot(): LanguageCode;
  subscribe(listener: () => void): () => void;
};
export function getLanguage(): LanguageCode;
/** Reads `gsale_locale`; falls back to the device language, then 'en'. Also applies the RTL flag. */
export async function loadLanguage(): Promise<LanguageCode>;
/** Persists, notifies subscribers, returns true when the layout direction changes (restart needed). */
export async function setLanguage(code: LanguageCode): Promise<boolean>;
export function deviceLocaleTag(): string; // Intl.DateTimeFormat().resolvedOptions().locale
```

```ts
// src/i18n/index.ts
export type MessageKey = keyof Messages; // flat dotted keys: 'tabs.home', 'price.free' …
export function t(key: MessageKey, params?: Record<string, string | number>): string;
export function useT(): typeof t; // reads languageStore via useSyncExternalStore so screens re-render
export function formatMoney(amountTry: number, language?: LanguageCode): string; // Intl currency TRY
export function formatPercent(percent: number, language?: LanguageCode): string; // "-40 %" etc. via Intl percent
export function plural(key: MessageKey, count: number): string; // `${key}.${Intl.PluralRules(lang).select(count)}` → falls back to `.other`
```

- [ ] **Step 1: Failing tests** (`src/i18n/i18n.test.ts`):

```ts
import { describe, expect, test, beforeEach } from 'bun:test';
import '../../test-support/native-mocks';

describe('matchLanguage', () => {
  test.each([
    ['tr-TR', 'tr'], ['en-GB', 'en'], ['es-MX', 'es-419'], ['es-ES', 'es'], ['pt-BR', 'pt-BR'], ['pt-PT', 'pt'],
    ['zh-TW', 'zh-Hant'], ['zh-CN', 'zh-Hans'], ['zh-Hant-HK', 'zh-Hant'], ['nb-NO', 'no'], ['ar-EG', 'ar'], ['xx', null],
  ])('%s → %s', async (tag, code) => {
    const { matchLanguage } = await import('@/i18n/languages');
    expect(matchLanguage(tag)).toBe(code);
  });
});

describe('t', () => {
  test('interpolates and falls back to English for a missing key at runtime', async () => {
    const { t } = await import('@/i18n');
    const { setLanguage } = await import('@/i18n/languageStore');
    await setLanguage('tr');
    expect(t('detail.notSoldHere')).toBe('Bu sürüm yok');
    expect(t('search.resultCount', { count: 3 })).toContain('3');
  });
});

describe('setLanguage', () => {
  test('reports a direction change for Arabic and back', async () => {
    const { setLanguage } = await import('@/i18n/languageStore');
    await setLanguage('en');
    expect(await setLanguage('ar')).toBe(true);
    expect(await setLanguage('ar')).toBe(false);
    expect(await setLanguage('de')).toBe(true);
  });
  test('persists under gsale_locale', async () => {
    // secure-store mock from native-mocks: read back 'gsale_locale'
  });
});

describe('formatMoney', () => {
  test('uses the app language for grouping and symbol placement', async () => {
    const { formatMoney } = await import('@/i18n');
    expect(formatMoney(1999.5, 'tr')).toBe(new Intl.NumberFormat('tr', { style: 'currency', currency: 'TRY' }).format(1999.5));
    expect(formatMoney(1999.5, 'en')).toBe(new Intl.NumberFormat('en', { style: 'currency', currency: 'TRY' }).format(1999.5));
  });
});
```

`native-mocks.tsx`'e `I18nManager` mock'u ekle (`isRTL`, `allowRTL`, `forceRTL` kaydeden).

- [ ] **Step 2:** FAIL doğrula.
- [ ] **Step 3: Implement.** Katalog düz anahtarlı: `en.ts` → `export const en = { 'tabs.home': 'Home', … } as const; export type Messages = { readonly [K in keyof typeof en]: string };` — `tr.ts` → `export const tr = { … } satisfies Messages;`. `messages/index.ts` dil kodu → katalog haritası (`Record<LanguageCode, Messages>`; Task 19'a kadar eksik diller `en`'e işaret eder ve bu `TODO` değil, Task 19'un girdisidir). `t` önce aktif katalog, sonra `en`. `{name}` biçimli yer tutucular.

İlk anahtar kümesi (Task 12–18 ekranları bunları kullanır; yeni anahtar gerektiğinde önce `en.ts` + `tr.ts`'e eklenir):

```ts
export const en = {
  'tabs.home': 'Home', 'tabs.search': 'Search', 'tabs.favorites': 'Favorites', 'tabs.free': 'Free', 'tabs.settings': 'Settings',
  'common.back': 'Back', 'common.retry': 'Try again', 'common.close': 'Close', 'common.loading': 'Loading…',
  'home.onSale': 'On sale', 'home.biggestDiscount': 'Biggest discount right now', 'home.empty': 'No deals to show right now.', 'home.loading': 'Loading deals…',
  'search.placeholder': 'Search games', 'search.hint': 'Type at least 2 letters.', 'search.empty': 'No games found for “{query}”.',
  'search.resultCount.one': '{count} game', 'search.resultCount.other': '{count} games', 'search.loading': 'Searching every store…',
  'free.title': 'Free right now', 'free.empty': 'No free games right now.', 'free.loading': 'Loading free games…',
  'favorites.title': 'Favorites', 'favorites.empty': 'Games you favorite appear here.',
  'favorites.add': 'Add to favorites', 'favorites.remove': 'Remove from favorites',
  'detail.loading': 'Checking prices…', 'detail.error': 'Could not load this game.', 'detail.notFound': 'Game not found.',
  'detail.editions': 'Editions', 'detail.prices': 'Prices', 'detail.lowest': 'Lowest', 'detail.notSoldHere': 'Not sold in this edition',
  'detail.noPrices': 'No store sells this edition right now.', 'detail.openStore': 'Open {store}', 'detail.cover': '{title} cover',
  'edition.base': 'Standard', 'edition.deluxe': 'Deluxe', 'edition.ultimate': 'Ultimate', 'edition.gold': 'Gold',
  'edition.goty': 'Game of the Year', 'edition.complete': 'Complete', 'edition.definitive': 'Definitive', 'edition.premium': 'Premium',
  'edition.collector': "Collector's", 'edition.special': 'Special', 'edition.anniversary': 'Anniversary',
  'edition.directors-cut': "Director's Cut", 'edition.enhanced': 'Enhanced', 'edition.legendary': 'Legendary',
  'edition.champion': 'Champion', 'edition.vault': 'Vault', 'edition.cross-gen': 'Cross-Gen',
  'price.free': 'Free', 'price.unknown': 'Price unavailable', 'price.gamePass': 'Game Pass', 'price.was': 'was {price}',
  'settings.title': 'Settings', 'settings.language': 'Language', 'settings.country': 'Country',
  'settings.countryHint': 'Prices come from this country’s stores.', 'settings.about': 'About',
  'settings.version': 'Version {version}', 'settings.disclaimer': 'Prices are read from the stores and converted to Turkish lira. Always check the store before buying.',
  'settings.restartTitle': 'Restart required', 'settings.restartBody': 'Close and reopen GSale to switch the layout direction.',
  'settings.searchLanguages': 'Search languages', 'settings.searchCountries': 'Search countries',
  'notifications.title': 'Notifications', 'notifications.empty': 'No notifications yet.',
  'country.TR': 'Türkiye', 'country.US': 'United States', 'country.GB': 'United Kingdom', 'country.DE': 'Germany',
  'country.FR': 'France', 'country.NL': 'Netherlands', 'country.PL': 'Poland', 'country.UA': 'Ukraine',
  'country.KZ': 'Kazakhstan', 'country.AR': 'Argentina', 'country.BR': 'Brazil', 'country.CA': 'Canada',
  'country.AU': 'Australia', 'country.JP': 'Japan', 'country.IN': 'India',
} as const;
```

`tr.ts` aynı anahtarlarla Türkçe (mevcut uygulama metinlerinden: "Anasayfa", "Favoriler", "Bedava", "Ayarlar", "Fiyatlar kontrol ediliyor…", "Oyun bulunamadı.", "Bu sürüm yok", "En düşük", "Mağaza ülkesi" …).

RTL: `loadLanguage` ve `setLanguage` `I18nManager.allowRTL(isRtl(code)); I18nManager.forceRTL(isRtl(code));` çağırır; `setLanguage` dönüş değeri `I18nManager.isRTL !== isRtl(code)`.

- [ ] **Step 4:** Testler PASS; `bun run typecheck`.
- [ ] **Step 5: Commit** — `git commit -am "feat(i18n): language store, message catalog and formatting"` (yeni dosyaları ekle).

---

### Task 9: Dilden bağımsız fiyatlar

**Files:**
- Modify: `src/services/store/types.ts`, `deals.ts`, `price-parse.ts`, `currency.ts`, `edition-table.ts`, bütün adapter'lar (fiyat üreten yerler), `src/services/gameData.ts`, `src/utils/gameDisplay.ts`, `src/services/favorites.ts`
- Test: `currency.test.ts`, `price-parse.test.ts`, `edition-table.test.ts`, adapter testleri, `favorites.test.ts`

**Interfaces:**
- Produces:
  - `PlatformPriceResult` / `GameDeal`: `amount: number | null` (TL; `null` = bilinmiyor), `original_amount?: number | null`, `discount_percent: number` (0 = indirim yok), `is_free: boolean`, `subscription?: 'game-pass'`. `price`, `original_price`, `discount`, `subscription_note` string alanları **silinir**.
  - `convertToTry(amount, currency, signal): Promise<number>` (var) kullanılır; `formatPriceAsTry`/`formatTryPrice` silinir.
  - `Deal` (gameData): `{ platform; amount: number | null; originalAmount?: number | null; discountPercent: number; isFree: boolean; url: string; subscription?: 'game-pass' }`.
  - Favoriler: kayıtlı eski string fiyatlar okunurken yok sayılır (fiyat alanı olmadan yüklenir) — `favorites.ts` sürüm alanı `v: 2` ekler.

- [ ] **Step 1: Failing tests:** `edition-table.test.ts` teklif yardımcısı `{ amount: 900, discount_percent: 0, is_free: false }` biçimine geçer; ücretsiz teklif (`is_free: true, amount: 0`) en başa sıralanır; `amount: null` teklif tablodan düşer. Adapter testlerinde `price: '₺…'` beklentileri `amount` sayılarına çevrilir (ör. Steam TRY `final: 199900` → `amount: 1999`).
- [ ] **Step 2:** FAIL doğrula.
- [ ] **Step 3:** Implement. `price-parse.ts`'teki Türkçe sentinel kontrolleri (`'mevcut değil'`, `'bilinmiyor'`, `'ücretsiz'`) yalnız mağaza yanıtlarını ayrıştırırken (PS HTML, Xbox metin) kalır; uygulama içi hiçbir yerde üretilmez. `isUnavailablePrice(deal)` → `deal.amount === null && !deal.is_free`.
- [ ] **Step 4:** `grep -rnE "'(Ücretsiz|Bilinmiyor|Oyun bulunamadı|Oyun bilgileri)" src --include=*.ts | grep -v test` → boş. Servis hataları `new Error('not-found')`/`'load-failed'` kodlarıyla; `gameDetailStore.error: 'not-found' | 'load-failed' | null`.
- [ ] **Step 5:** `bun run test:coverage` PASS, typecheck/lint temiz.
- [ ] **Step 6: Commit** — `git commit -am "refactor(store): numeric prices, text only in the UI"`

---

### Task 10: Mağaza dili eşlemesi ve dil/ülke değişiminde yeniden yükleme

**Files:**
- Create: `src/services/store/languages.ts`
- Modify: `src/services/store/config.ts` (`getSteamLang`, `getEpicLocale`, `getPsLocale` silinir), `platforms/{steam,epic,ps,xbox,gog}.ts`, `prices.ts` (önbellek anahtarı), `src/services/country.ts`, `src/services/screenData/{homeStore,freeGamesStore,searchStore,gameDetailStore}.ts`, `src/services/catalog/*` (dil etkilemez; dokunma)
- Test: `src/services/store/languages.test.ts`, `country-routing.test.ts`, `request-cancellation.test.ts`

**Interfaces:**
- Produces:

```ts
// src/services/store/languages.ts
export type StoreId = 'steam' | 'epic' | 'ps' | 'xbox' | 'gog' | 'nintendo';
/** Store-specific language parameter for the app language + country, falling back to the country's own store language. */
export function storeLanguage(store: StoreId): string;
```

  Eşleme tabloları:
  - Steam `l=`: `tr→turkish, en→english, de→german, fr→french, es→spanish, es-419→latam, pt→portuguese, pt-BR→brazilian, it→italian, nl→dutch, pl→polish, ru→russian, uk→ukrainian, cs→czech, hu→hungarian, ro→romanian, bg→bulgarian, el→greek, da→danish, sv→swedish, no→norwegian, fi→finnish, ja→japanese, ko→koreana, zh-Hans→schinese, zh-Hant→tchinese, th→thai, vi→vietnamese, id→indonesian, ar→arabic` (hepsi destekli).
  - Epic `locale=`: `ar, de, en-US, es-ES, es-MX, fr, it, ja, ko, pl, pt-BR, ru, th, tr, zh-CN, zh-Hant`; tabloda olmayan dil → `en-US`.
  - GOG: `locale` parametresi yalnız `en-US, de-DE, fr-FR, pl-PL, ru-RU, zh-Hans` → diğerleri `en-US`.
  - PS/Xbox path `lang-country`: ülke başına geçerli dil kümesi; `SUPPORTED_COUNTRIES` satırına `storeLanguages: readonly string[]` eklenir (ilk eleman varsayılan): `TR ['tr','en']`, `US ['en','es']`, `GB ['en']`, `DE ['de','en']`, `FR ['fr','en']`, `NL ['nl','en']`, `PL ['pl','en']`, `UA ['uk','ru','en']`, `KZ ['ru','en']`, `AR ['es','en']`, `BR ['pt','en']`, `CA ['en','fr']`, `AU ['en']`, `JP ['ja','en']`, `IN ['en']`. Uygulama dilinin birincil alt etiketi kümedeyse o, değilse ilk eleman → `${lang}-${country.toLowerCase()}`.
  - Nintendo: her zaman `en-US` (US eShop).
  - `country.ts`: `name` alanı silinir; ad `t(\`country.${code}\`)`. İlk açılışta kayıt yoksa `deviceLocaleTag()` bölgesi `SUPPORTED_COUNTRIES` içindeyse o, değilse `TR`.

- [ ] **Step 1: Failing tests** (`languages.test.ts`):

```ts
test.each([
  ['de', 'TR', 'ps', 'tr-tr'],
  ['de', 'DE', 'ps', 'de-de'],
  ['fr', 'CA', 'xbox', 'fr-ca'],
  ['ja', 'US', 'xbox', 'en-us'],
  ['es-419', 'AR', 'steam', 'latam'],
  ['vi', 'TR', 'epic', 'en-US'],
  ['zh-Hant', 'TR', 'epic', 'zh-Hant'],
  ['ar', 'TR', 'nintendo', 'en-US'],
])('%s + %s → %s = %s', async (lang, country, store, expected) => {
  await setLanguage(lang); await setAppCountry(country);
  expect(storeLanguage(store)).toBe(expected);
});
```

`country-routing.test.ts`: dil `de`, ülke `TR` iken Steam arama URL'si `l=german&cc=TR`, PS URL'si `/TR/tr/`.
`request-cancellation.test.ts` (Review Focus #4): detay yüklenirken `setLanguage('de')` → eski sinyal `aborted`, snapshot sonunda yeni dilin sonucu.

- [ ] **Step 2:** FAIL doğrula.
- [ ] **Step 3:** Implement. Adapter'lar `storeLanguage('steam')` vb. çağırır. Fiyat önbelleği anahtarı `${country}|${language}|…`. Screen store'lar `languageStore.subscribe` ve yeni `countryStore.subscribe` (country.ts'e `subscribe`/`getSnapshot` eklenir) ile değişimde: `homeStore.load(true)`, `freeGamesStore.load(true)`, açık arama tekrar, detay girişleri için `reload` (bekleyen istek iptal). Abonelik modül yüklenirken bir kez kurulur (`screenData/index.ts`), effect yok.
- [ ] **Step 4:** PASS; typecheck/lint.
- [ ] **Step 5: Commit** — `git commit -am "feat(i18n): store language per app language and country, reload on change"`

---

### Task 11: Aşama 2 doğrulaması

- [ ] **Step 1:** `bun run typecheck && bun run lint && bun run test:coverage && bunx --bun expo-doctor && bun run doctor`
- [ ] **Step 2:** `grep -rnP "['\"][^'\"]*[ğüşöçıİĞÜŞÖÇ][^'\"]*['\"]" app src --include=*.ts --include=*.tsx | grep -v "test\.\|/i18n/messages/\|editions.ts\|match.ts\|price-parse.ts\|ps-parse.ts\|text.ts"` → yalnız Task 12+ ile yeniden yazılacak ekranlarda kalan metinler; listeyi Task 15–18'in kontrol listesi olarak kaydet (commit mesajına değil, task notuna).
- [ ] **Step 3: Commit** (değişiklik varsa) — `git commit -am "test: phase 2 verification"`

---

# AŞAMA 3 — Yeniden tasarım (kapak odaklı galeri)

### Task 12: Tasarım tokenları

**Files:**
- Rewrite: `src/constants/DesignSystem.ts`
- Modify: `app/_layout.tsx` (font yükleme, arka plan)
- Test: `src/constants/DesignSystem.test.ts`

**Interfaces:**
- Produces:

```ts
export const Palette = {
  background: '#0B0B0C',       // near-black, neutral (no blue cast)
  surface: '#151516',          // image placeholders, pressed rows
  surfaceRaised: '#1D1D1F',    // chips, inputs
  line: '#2A2A2D',             // hairlines
  text: '#F2F0EB',             // warm off-white
  textMuted: '#A8A6A0',
  textFaint: '#6E6C68',
  deal: '#FF5A36',             // the only accent: discounts, "Lowest"
  onDeal: '#0B0B0C',
  danger: '#FF6B6B',
  scrim: 'rgba(11,11,12,0.72)',// solid-ish chip behind icons on images
  overlay: 'rgba(0,0,0,0.9)',
} as const;

export const Space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const Radius = { none: 0, sm: 2, md: 4, full: 999 } as const;
export const Size = { touch: 44, icon: 20, iconSmall: 16, logo: 16, logoLarge: 20, tabBar: 56, stripCard: 264, hairline: 1 } as const;
export const Aspect = { cover: 16 / 9, portrait: 3 / 4 } as const;

export const Font = {
  regular: 'IBMPlexSans_400Regular',
  medium: 'IBMPlexSans_500Medium',
  semibold: 'IBMPlexSans_600SemiBold',
  bold: 'IBMPlexSans_700Bold',
} as const;

type TextStyleToken = Readonly<{ fontFamily?: string; fontSize: number; lineHeight: number; letterSpacing?: number; fontVariant?: readonly ['tabular-nums'] }>;

export const Type = {
  display: { fontFamily: Font.bold, fontSize: 28, lineHeight: 32, letterSpacing: -0.4 },
  title: { fontFamily: Font.semibold, fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
  heading: { fontFamily: Font.semibold, fontSize: 15, lineHeight: 20 },
  body: { fontFamily: Font.regular, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: Font.medium, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: Font.regular, fontSize: 12, lineHeight: 16 },
  overline: { fontFamily: Font.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 0.8 },
  price: { fontFamily: Font.semibold, fontSize: 15, lineHeight: 20, fontVariant: ['tabular-nums'] },
  priceLarge: { fontFamily: Font.bold, fontSize: 22, lineHeight: 26, fontVariant: ['tabular-nums'] },
} as const satisfies Record<string, TextStyleToken>;

/** Drops the custom family for scripts IBM Plex Sans does not cover, so the platform font renders the whole string. */
export function typeFor<K extends keyof typeof Type>(key: K, systemFont: boolean): TextStyleToken;
export function useType(): <K extends keyof typeof Type>(key: K) => TextStyleToken; // reads languageStore
```

- [ ] **Step 1: Failing test:** `typeFor('title', true).fontFamily` `undefined`; `typeFor('title', false).fontFamily === Font.semibold`; `Palette` değerlerinin hiçbiri `#E8FF47` değil (eski neon kaldırıldı).
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3:** Eski tokenları kullanan dosyalar kırılır; bu task'ta yalnız `DesignSystem.ts` ve `app/_layout.tsx` değişir, diğer dosyalar Task 13–18'de yeniden yazılana kadar geçici takma adlar bırakılmaz — bunun yerine Task 12–18 tek dalda sırayla yapılır ve typecheck Task 18 sonunda temizlenir. Her task'ın kendi testleri çalıştırılır (`bun test <dosya>`).
- [ ] **Step 4: Commit** — `git commit -am "feat(ui): new design tokens"`

---

### Task 13: `StoreLogo`

**Files:**
- Create: `src/components/StoreLogo.tsx`, `src/components/store-logo-paths.ts`
- Delete: `src/components/PlatformBadge.tsx`, `src/components/PlatformBadgeList.tsx`, `src/utils/platform.ts` (`getPlatformShortName`, `getPlatformAspectRatio` artık kullanılmıyorsa)
- Test: `src/components/components.test.tsx`

**Interfaces:**
- Produces: `StoreLogo({ platform, size = Size.logo, color = Palette.textMuted }: { platform: string; size?: number; color?: string })` — bilinmeyen platformda `null`; `accessibilityLabel={platform}`, `accessible`. `StoreLogoRow({ platforms }: { platforms: readonly string[] })` — sabit sırada (Steam, Epic Games, GOG, Xbox, PlayStation, Nintendo), `gap: Space.sm`.

- [ ] **Step 1: Path verisini al** (çalışma zamanında bağımlılık eklemeden):

```bash
cd /tmp/claude-1000/-home-b3t4-projects-GSALE/8c367b80-f85f-44ed-b080-ac3683a05b4a/scratchpad
curl -sL "$(curl -s https://registry.npmjs.org/simple-icons/latest | python3 -c 'import sys,json;print(json.load(sys.stdin)["dist"]["tarball"])')" | tar xz
for slug in steam epicgames gogdotcom xbox playstation nintendoswitch; do
  printf '%s ' "$slug"; python3 -c "import re,sys;print(re.search(r' d=\"([^\"]+)\"', open('package/icons/$slug.svg').read()).group(1))"
done
cat package/package.json | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d["version"],d["license"])'
```

Expected: altı slug için path, lisans `CC0-1.0`. Bir slug yoksa `package/icons/` altında `ls | grep -i <ad>` ile güncel slug'ı bul; mağaza Simple Icons'tan kaldırılmışsa o mağaza için logo yerine `Type.label` ile ad yazılır ve kullanıcıya bildirilir.

- [ ] **Step 2:** `store-logo-paths.ts`:

```ts
/** Monochrome brand marks from Simple Icons (CC0-1.0), 24×24 viewBox. Version: <yazılan sürüm>. */
export const STORE_LOGO_PATHS: Readonly<Record<string, string>> = {
  Steam: '<steam path>',
  'Epic Games': '<epicgames path>',
  GOG: '<gogdotcom path>',
  Xbox: '<xbox path>',
  PlayStation: '<playstation path>',
  Nintendo: '<nintendoswitch path>',
};
```

(`<… path>` yerlerine Step 1 çıktısındaki gerçek `d` değerleri yazılır.)

- [ ] **Step 3: Failing test → implement:**

```tsx
import Svg, { Path } from 'react-native-svg';
export function StoreLogo({ platform, size = Size.logo, color = Palette.textMuted }: StoreLogoProps) {
  const d = STORE_LOGO_PATHS[platform];
  if (!d) return null;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible accessibilityLabel={platform}>
      <Path d={d} fill={color} />
    </Svg>
  );
}
```

Test: her altı platform için `byLabel(tree, platform)` bulunur; `'Unknown'` için render boş; `StoreLogoRow` sırası girişten bağımsız sabit.
- [ ] **Step 4: Commit** — `git commit -am "feat(ui): store logos from simple icons"`

---

### Task 14: Temel bileşenler

**Files:**
- Create: `src/components/{CoverImage,CoverCard,CoverGrid,StoreStrip,SearchField,IconButton}.tsx`
- Rewrite: `src/components/{ScreenHeader,EmptyState,ScreenLoading}.tsx`
- Delete: `src/components/{CardImage,CardFooter,GameCard,GameListItem,FeaturedDeal,GameSearchBar,HomeTopBar,AppBackground}.tsx`
- Test: `src/components/components.test.tsx`

**Interfaces (hepsi `Readonly` props, RTL için `start/end`, metinler `useT()`):**
- `CoverImage({ sources: ImageSource[]; title: string; aspectRatio?: number })` — `expo-image`, `contentFit="cover"`, kaynaklar arasında hata sonrası geçiş (mevcut `CardImage` mantığı), son çare `Palette.surface` zemin + başlığın baş harfi (`Type.display`, `textFaint`). Radius `Radius.sm`.
- `CoverCard({ game: Game; width?: number; showPrice?: boolean })` — kapak; altında `Space.sm` boşlukla başlık (`Type.heading`, 2 satır), sonra tek satır: indirim varsa `-40%` (`Type.label`, `Palette.deal`), üstü çizili eski fiyat (`caption`, `textFaint`), fiyat (`Type.price`), satır sonunda `StoreLogoRow`. Kart kutusu/çerçeve yok. Basınca `opacity: 0.7`. `accessibilityRole="link"`, etiket = başlık. Basınca mevcut `rememberCardPreview` + `router.push('/game/[id]')` (GameCard'dan taşınır). `React.memo` + mevcut `propsAreEqual` mantığı (yeni alan adlarıyla).
- `CoverGrid({ games: Game[]; refreshing?: boolean; onRefresh?: () => void; header?: ReactElement; empty: ReactElement })` — `FlatList numColumns={2}`, `columnWrapperStyle={{ gap: Space.md }}`, yatay padding `Space.lg`, satır arası `Space.xl`.
- `StoreStrip({ platform: string; games: Game[] })` — başlık satırı: `StoreLogo size={Size.logoLarge} color={Palette.text}` + `t('home.onSale')` (`Type.overline`, büyük harf yalnız Latin dillerde: `textTransform` yerine katalogda büyük harf yazılmaz; stil `letterSpacing`). Yatay `FlatList`, kart genişliği `Size.stripCard`.
- `SearchField({ value; onChangeText; onSubmit; autoFocus? })` — `surfaceRaised` zemin, `Radius.md`, yükseklik `Size.touch`, `Search` ikonu başta, temizle butonu sonda.
- `IconButton({ icon: LucideIcon; label: string; onPress; tone?: 'plain' | 'scrim' })` — 44×44, `scrim` tonu görsel üstü için `Palette.scrim` zemin, `Radius.full`.
- `ScreenHeader({ title: string; trailing?: ReactNode })` — `Type.display`, sol hizalı, üst güvenli alan.
- `EmptyState({ message: string; action?: { label: string; onPress: () => void } })` — ikon yok, ortalanmış `body` + `textMuted`.
- `ScreenLoading({ message: string })` — `ActivityIndicator color={Palette.textMuted}` + mesaj.

- [ ] **Step 1: Failing tests** (`components.test.tsx`, `render`/`byLabel`/`fire` ile):
  - `CoverCard` indirimli oyun: `-40%`, eski ve yeni fiyat metinleri `formatMoney` çıktısıyla aynı; basınca `router.push` `{ pathname: '/game/[id]', params: { id, platform } }`.
  - `CoverCard` fiyatsız: fiyat satırı yok, logolar var.
  - `CoverImage` iki kaynak, ilki `onError` → ikinciye geçer; ikisi de hata → baş harf.
  - `SearchField` boş değilken temizle butonu `onChangeText('')` çağırır.
  - Dil `ar` iken `CoverCard` metin stili `fontFamily` içermez (`useType`).
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3: Commit** — `git commit -am "feat(ui): cover components"`

---

### Task 15: Sekmeler ve ana sayfa

**Files:**
- Rewrite: `app/(tabs)/_layout.tsx`, `app/(tabs)/index.tsx`
- Test: `src/__tests__/home-screen.test.tsx` (yeni; `z-detail-screen.test.tsx` desenini izler)

**Tasarım:**
- Sekmeler: Ana sayfa (`Home`), Ara (`Search`), Favoriler (`Heart`), Bedava (`Gift`), Ayarlar (`Settings`); başlıklar `t('tabs.*')`; `tabBarStyle`: `Palette.background`, üst `hairline` çizgi, yükseklik `Size.tabBar`; aktif `Palette.text`, pasif `textFaint`; etiket `Type.caption`. Arama artık görünür sekme (`href: null` kaldırılır); ana sayfadaki arama kutusu ve bildirim zili kalkar — zil Ayarlar başlığına `trailing` olarak taşınır.
- Ana sayfa: `ScreenHeader title="GSale"`; ardından "en derin indirim" bloğu: tam genişlik (`Space.lg` kenar boşluklu) `CoverImage` 16:9, altında `Type.overline` `t('home.biggestDiscount')`, `Type.title` başlık, satır: `-%` (`deal`), eski fiyat, `priceLarge`, `StoreLogo`. Ardından her mağaza için `StoreStrip`. Çek-yenile korunur. Mevcut `pickFeaturedDeal` mantığı korunur.

- [ ] **Step 1: Failing test:** home store mock'u iki bölüm (Steam, Xbox) döner → öne çıkan en yüksek indirimli oyun başlığı görünür; `byLabel(tree, 'Steam')` ve `'Xbox'` logoları var; öne çıkana basınca detay route'u.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3: Commit** — `git commit -am "feat(ui): tabs and home"`

---

### Task 16: Arama, Bedava, Favoriler

**Files:**
- Rewrite: `app/(tabs)/search.tsx`, `app/(tabs)/free.tsx`, `app/(tabs)/favorites.tsx`
- Test: `src/__tests__/list-screens.test.tsx`

**Tasarım:** Üçü de `ScreenHeader` + `CoverGrid`. Arama: başlık altında `SearchField` (`autoFocus` yalnız sekmeye ilk girişte değil — route param `q` varsa doldurulur ve arama başlar), sonuç sayısı `plural('search.resultCount', n)` (`caption`, `textMuted`), `searchStore` davranışı aynen (en az 2 harf, iptal). Bedava: fiyat yerine `t('price.free')`. Favoriler: kayıtlı oyunlar; boşsa `EmptyState`.

- [ ] **Step 1: Failing tests:** arama 1 harfte istek atmaz ve `search.hint` gösterir; 3 sonuçta "3 games/oyun"; favori boşken `favorites.empty`; bedava kartlarında `price.free`.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3: Commit** — `git commit -am "feat(ui): search, free and favorites grids"`

---

### Task 17: Detay ekranı — sürüm seçici ve fiyat tablosu

**Files:**
- Create: `src/components/EditionPicker.tsx`, `src/components/PriceTable.tsx`
- Rewrite: `app/game/[id].tsx`
- Test: `src/z-detail-screen.test.tsx`

**Interfaces:**
- `EditionPicker({ options: readonly { key: EditionKey; lowest: number | null }[]; selected: EditionKey; onSelect: (key: EditionKey) => void })` — tek seçenek varsa render etmez. Yatay `ScrollView`; her seçenek: `t(\`edition.${key}\`)` (`Type.label`) ve altında o sürümün en düşük fiyatı (`caption`, `textMuted`); seçili olanın altında 2 px `Palette.text` çizgi (sekme çipi değil, altı çizili metin). `accessibilityRole="tab"`, `accessibilityState={{ selected }}`.
- `PriceTable({ deals: readonly Deal[]; missingStores: readonly string[] })` — satır: `StoreLogo size={Size.logoLarge} color={Palette.text}` + mağaza adı (`Type.heading`) | sağda `-%` (`deal`), eski fiyat (çizili), fiyat (`Type.price`), `ExternalLink` ikonu (`iconSmall`, RTL'de aynalı). İlk satırda (en ucuz) fiyatın altında `t('detail.lowest')` (`Type.overline`, `deal`). Game Pass satırında fiyat yerine `t('price.gamePass')`. Satırlar arası `hairline` çizgi, satır yüksekliği ≥ `Size.touch + Space.lg`. `missingStores` satırları `opacity 0.45`, fiyat yerine `t('detail.notSoldHere')`, basılamaz. Basınca `isSafeExternalUrl(url)` ise `Linking.openURL`. `deals` boşsa `detail.noPrices`.
- `missingStores` = seçili sürümde olmayan ama başka sürümde olan mağazalar (tutarlılık: kullanıcı hangi mağazanın bu sürümü satmadığını görür).
- Ekran: `ScrollView` → kapak (tam genişlik, 16:9, üstünde `IconButton tone="scrim"` geri + favori; güvenli alan payı) → `Space.xl` → başlık (`Type.display`) → `EditionPicker` → `Type.overline` `t('detail.prices')` → `PriceTable`. Yükleme: kapak + başlık önizlemeden (detay-preview), tablo yerine 3 iskelet satır (`surface` bloklar). Hata: `EmptyState` + `common.retry` (`gameDetailStore.reload`).

- [ ] **Step 1: Failing tests** (`z-detail-screen.test.tsx`):
  - Deluxe route: `EditionPicker`'da Deluxe `selected`, tablo yalnız Deluxe satan mağazalar + base'i olup Deluxe'ü olmayan Epic `notSoldHere` satırı.
  - `Standard` sekmesine basınca Epic satırı fiyatlı görünür, istek sayısı artmaz.
  - İlk satır `detail.lowest` taşır; `http://` URL'li satır basılınca `Linking.openURL` çağrılmaz.
  - Açıklama/tür/tarih/medya metinleri hiçbir durumda render edilmez (`tree.root.findAll` ile `Genel Bakış`, `Calendar` ikon etiketi yok).
  - Tek sürüm varken `EditionPicker` render edilmez.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3: Commit** — `git commit -am "feat(ui): detail with edition picker and price table"`

---

### Task 18: Ayarlar ve bildirimler

**Files:**
- Create: `src/components/SettingsRow.tsx`, `src/components/OptionPicker.tsx`
- Rewrite: `app/(tabs)/settings.tsx`, `app/notifications.tsx`
- Test: `src/__tests__/settings-screen.test.tsx`

**Interfaces:**
- `SettingsRow({ label: string; value?: string; hint?: string; onPress?: () => void })` — hairline ayraçlı satır, değer sonda `textMuted`, basılabiliyorsa `ChevronRight` (RTL'de aynalı).
- `OptionPicker<T extends string>({ visible; title; searchPlaceholder; options: readonly { value: T; label: string; detail?: string }[]; selected: T; onSelect: (value: T) => void; onClose })` — tam ekran `Modal` (`presentationStyle="pageSheet"`), üstte `SearchField`, `FlatList`, seçili satırda `Check`.
- Ayarlar: `ScreenHeader title={t('settings.title')} trailing={<IconButton icon={Bell} … />}`; grup 1: Dil (değer: `nativeName`) → `OptionPicker` (etiket `nativeName`, detay İngilizce adı yok — yalnız yerel ad); Ülke (değer: `t('country.XX')`, detay: para birimi kodu `playStationCurrency ?? '—'`), ipucu `settings.countryHint`. Grup 2: Hakkında → sürüm + `settings.disclaimer`. Dil seçimi `setLanguage` → `true` dönerse `Alert.alert(t('settings.restartTitle'), t('settings.restartBody'))`.
- Bildirimler: `ScreenHeader` + mevcut içerik yeni bileşenlerle, metinler katalogdan.

- [ ] **Step 1: Failing tests:** dil `de` seçilince başlık "Einstellungen" (Task 19 öncesi `de` yoksa `en` fallback "Settings" — testi Task 19'da `de` için güncelle), ülke `DE` seçilince `setAppCountry('DE')`; `ar` seçilince `Alert.alert` çağrılır; arama kutusuna "port" yazınca yalnız Português seçenekleri kalır.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3:** `bun run typecheck && bun run lint` artık bütün projede temiz olmalı (Task 12'den beri kırık olan importlar bitti). `grep -rn "PlatformBadge\|GameCard\|CardImage\|AppBackground\|getGenreColor\|Typography\b\|Spacing\b" app src` → boş.
- [ ] **Step 4: Commit** — `git commit -am "feat(ui): settings with separate language and country"`

---

### Task 19: 28 dil kataloğu

**Files:**
- Create: `src/i18n/messages/{de,fr,es,es-419,pt,pt-BR,it,nl,pl,ru,uk,cs,hu,ro,bg,el,da,sv,no,fi,ja,ko,zh-Hans,zh-Hant,th,vi,id,ar}.ts`
- Modify: `src/i18n/messages/index.ts`
- Test: `src/i18n/catalogs.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, expect, test } from 'bun:test';
import { LANGUAGES } from '@/i18n/languages';
import { CATALOGS } from '@/i18n/messages';
import { en } from '@/i18n/messages/en';

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('catalogs', () => {
  for (const { code } of LANGUAGES) {
    test(`${code} has every key with the same placeholders`, () => {
      const catalog = CATALOGS[code];
      if (code !== 'en') expect(catalog).not.toBe(en);
      for (const key of Object.keys(en) as (keyof typeof en)[]) {
        expect(typeof catalog[key]).toBe('string');
        expect(catalog[key].trim().length).toBeGreaterThan(0);
        expect(placeholders(catalog[key])).toEqual(placeholders(en[key]));
      }
    });
  }
  test('every plural base has the CLDR categories the language needs', () => {
    for (const { code } of LANGUAGES) {
      const categories = new Intl.PluralRules(code).resolvedOptions().pluralCategories;
      for (const category of categories) {
        expect(CATALOGS[code][`search.resultCount.${category}` as keyof typeof en] ?? CATALOGS[code]['search.resultCount.other']).toBeTruthy();
      }
    }
  });
});
```

- [ ] **Step 2:** FAIL (katalogların çoğu `en`'e işaret ediyor).
- [ ] **Step 3:** Her dil için `en.ts`'in tamamını çevir; `satisfies Messages`. Plural kategorileri gereken dillerde (`ru, uk, pl, cs, ar`: `one/few/many/other`, `ar`: `zero/one/two/few/many/other`) `Messages` tipine ek anahtarlar opsiyonel olarak eklenir: `en.ts` içinde `'search.resultCount.few'` vb. bulunmaz, bu yüzden `Messages` = `{ readonly [K in keyof typeof en]: string } & Partial<Record<PluralExtraKey, string>>`, `PluralExtraKey = 'search.resultCount.zero' | '.two' | '.few' | '.many'` (tam anahtar adlarıyla). Mağaza/marka adları (Steam, Game Pass, GSale) çevrilmez. Ülke adları her dilde yerel adlarıyla.
- [ ] **Step 4:** PASS; Task 18 ayar testi `de` beklentisiyle güncellenir.
- [ ] **Step 5: Commit** — `git commit -am "feat(i18n): 28 translated catalogs"`

---

### Task 20: Dokümantasyon

**Files:** `AGENTS.md`, `CLAUDE.md`, `/home/b3t4/.claude/projects/-home-b3t4-projects-GSALE/memory/` (gerekirse)

- [ ] **Step 1:** AGENTS.md: "Store logos are not used… store names appear as plain text (`PlatformBadge`)" → "Stores are shown with monochrome Simple Icons marks (`StoreLogo`, CC0); unknown stores fall back to their name." "Architecture & Constraints"a ekle: sürüm kuralı (bir mağazanın fiyatı yalnız aynı `editionKey` ürününden), dil/ülke ayrımı ve `storeLanguage()`, sayısal fiyatlar ve UI'da `formatMoney`. "Regional prices are converted to TL" kalır.
- [ ] **Step 2:** CLAUDE.md: "User-facing strings are Turkish by default… locale comes from `src/services/locale.ts`" → "User-facing strings come from `src/i18n/messages/<lang>.ts` via `t()`/`useT()`; add every new key to `en.ts` first; `catalogs.test.ts` enforces parity." Data flow maddesine `fetchEditionTable` ekle; `test:coverage` kapsamına yeni test dizinleri gerekiyorsa `package.json` betiğini güncelle.
- [ ] **Step 3: Commit** — `git commit -am "docs: editions, i18n and logo conventions"`

---

### Task 21: Son doğrulama

- [ ] **Step 1:** `bun run typecheck` → 0 hata.
- [ ] **Step 2:** `bun run lint` → 0 hata/uyarı.
- [ ] **Step 3:** `bun run test:coverage` → hepsi PASS.
- [ ] **Step 4:** `bunx --bun expo-doctor` → 21/21 (veya o anki toplam) geçer. `expo-video` kaldırıldığı için gerekirse `bunx --bun expo install --check`.
- [ ] **Step 5:** `bun run doctor` → 0 uyarı hedefi. Başlangıçtaki 11 uyarı: `test-support/native-mocks.tsx` bileşenlerini `test-support/native-mock-components.tsx`'e ayır (only-export-components), `test-support/render.tsx` `flush` export'unu kaldır / `await` sırası (async-defer-await, async-await-in-loop — döngü sıralı olmak zorundaysa `for` yerine `reduce` zinciri), `store/index.ts:47` filter+map → tek `for…of`, `ps-parse.ts:554` dizi → `Set`, `ps-parse.ts:833` map+filter → `flatMap`. Her bulguyu kodu okuyup doğrula; kural bastırma yok.
- [ ] **Step 6:** SonarQube: `git diff --name-only main... -- '*.ts' '*.tsx' | grep -v '\.test\.' | xargs -n1 sonar analyze --file` → her dosya 0 issue. Bulunanları düzelt (bilişsel karmaşıklık > 15 → fonksiyon böl; tekrar eden string sabitleri; iç içe ternary). Sonra `sonar list issues -p beratcanceylan_GSALE` (dal analizi CI'da çalıştığında) kontrol edilir.
- [ ] **Step 7:** `bun run prebuild` gerektiğini PR açıklamasına yaz (`expo-video` kaldırıldı). Cihazda ekran görüntüsü alınamadığını belirt.
- [ ] **Step 8: Commit** — `git commit -am "chore: doctor and sonar clean-up"`
