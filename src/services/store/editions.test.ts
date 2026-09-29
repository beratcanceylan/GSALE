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
    ["Death Stranding Director's Cut", 'directors-cut'],
    ['Ghost of Tsushima Yönetmenin Sürümü', 'directors-cut'],
    ["Assassin's Creed Mirage Deluxe Sürümü", 'deluxe'],
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
    ["Mortal Kombat 1 Collector's Edition", 'collector'],
    ["Assassin's Creed Shadows Anniversary Edition", 'anniversary'],
    ['Ultimate Chicken Horse', 'base'],
    ['Gold Rush: The Game', 'base'],
    ["Demon's Souls Dijital Deluxe Sürüm", 'deluxe'],
    ['Hogwarts Legacy: Dijital Lüks Sürüm', 'deluxe'],
    ['EA SPORTS FC™ 25 Standart Sürüm PS4 ve PS5', 'base'],
    ['Grand Theft Auto V (PS4™ ve PS5™)', 'base'],
    ['Ghost of Tsushima YÖNETMENİN SÜRÜMÜ', 'directors-cut'],
    ['Call of Duty®: Black Ops 6 - Kasa Sürümü', 'vault'],
    ['Grand Theft Auto V: Premium Edition', 'premium'],
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
    ['Édition Définitive de Sleeping Dogs', 'Sleeping Dogs'],
    ['Forza Horizon 5 (PC)', 'Forza Horizon 5'],
    ['Resident Evil 4 PS4 & PS5', 'Resident Evil 4'],
    ['Cyberpunk 2077™', 'Cyberpunk 2077'],
    ['Final Fantasy XVI', 'Final Fantasy XVI'],
    ['Ultimate Chicken Horse', 'Ultimate Chicken Horse'],
    ["Baldur's Gate 3 - Dijital Deluxe Sürümü", "Baldur's Gate 3"],
    ['EA SPORTS FC™ 25 Standart Sürüm PS4 ve PS5', 'EA SPORTS FC 25'],
    ['Grand Theft Auto V (PS4™ ve PS5™)', 'Grand Theft Auto V'],
    ['Ghost of Tsushima YÖNETMENİN SÜRÜMÜ', 'Ghost of Tsushima'],
    ['Call of Duty®: Black Ops 6 - Kasa Sürümü', 'Call of Duty: Black Ops 6'],
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
    expect(isDlcTitle('Forza Horizon 5 Car Pass')).toBe(true);
  });
  test('editions are not DLC', () => {
    expect(isDlcTitle('ELDEN RING Deluxe Edition')).toBe(false);
    expect(isDlcTitle('Horizon Forbidden West Cross-Gen Bundle')).toBe(false);
    expect(isDlcTitle('Grand Theft Auto V Story Mode')).toBe(false);
    expect(isDlcTitle('Cyberpunk 2077 ve Phantom Liberty Paketi')).toBe(true);
  });
});

describe('compareEditions', () => {
  test('base first, then the fixed order', () => {
    const keys = ['ultimate', 'base', 'deluxe', 'goty'] as const;
    expect(keys.slice().sort(compareEditions)).toEqual(['base', 'deluxe', 'ultimate', 'goty']);
  });
});
