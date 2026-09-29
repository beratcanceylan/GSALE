# Sürümler, dil/ülke ayrımı ve yeniden tasarım

Tarih: 2026-09-29 · Durum: onaylandı (sohbette), spec incelemesi bekliyor

## Amaç

1. Bir sürüme (Deluxe, Ultimate…) girildiğinde base oyun açılmasın; her mağaza sürümleri aynı kuralla ele alsın; detayda sürümler seçilebilsin.
2. Detay ekranı yalnızca fiyat karşılaştırması olsun: çıkış tarihi, geliştirici/yayıncı, açıklama, tür etiketleri, "Genel Bakış" sekmesi ve medya galerisi kalkar.
3. Uygulama, kullanılan mağazaların desteklediği bütün dillerde çalışsın (RTL dahil); dil ve ülke ayrı ayarlar olsun.
4. Uygulamanın tamamı "kapak odaklı galeri" diliyle baştan tasarlansın; mağazalar logo ile gösterilsin; gereksiz bileşenler silinsin.
5. `bun run typecheck`, `bun run lint`, `bunx --bun expo-doctor`, `bun run doctor` (react-doctor) ve SonarQube (`sonar analyze`) temiz geçsin.

Kapsam dışı: backend, kalıcı fiyat deposu, React Query/SWR (AGENTS.md kısıtları aynen geçerli), 30 oyun limiti, timeout/retry değerleri, 60 sn fiyat önbelleği.

## Aşama 1 — Sürüm modeli ve detay sadeleştirme

### Sürüm normalleştirici: `src/services/store/editions.ts`

- `type EditionKey = 'base' | 'deluxe' | 'ultimate' | 'gold' | 'goty' | 'complete' | 'definitive' | 'premium' | 'collector' | 'special' | 'anniversary' | 'directors-cut' | 'enhanced' | 'legendary' | 'champion' | 'vault' | 'cross-gen'`
- `editionKey(title): EditionKey` — çok dilli kalıplar (EN, TR, DE, FR, ES, PT, IT, PL, RU…): "Deluxe Edition", "Édition Deluxe", "Edición Deluxe", "Deluxe-Edition", "Altın Sürüm", "Game of the Year", "Director's Cut", "Yönetmenin Sürümü"… "Standard/Standart" → `base`.
- `baseTitle(title): string` — sürüm, platform ve parantez eklerini atan tek fonksiyon (bugünkü `cleanTitleForCrossPlatform` bunun üzerine kurulur).
- `extractEdition` (match.ts), `extractPsEdition` (ps-parse.ts) ve Xbox `hasPremiumEdition` bu modüle bağlanır; kopyalar silinir.

### Tek kural

Bir mağazanın fiyatı, yalnızca o mağazadaki ürünün `editionKey` değeri seçili sürümle aynıysa gösterilir. Başka sürüm asla ikame edilmez. Bütün `PriceFetcher`'lar `edition` parametresini kullanır (bugün yalnız Steam kullanıyor) ve eşleşme adayı sürüm anahtarı farklıysa reddedilir.

### Arama

- Oyun başına tek kart kalır (grup anahtarı `baseTitle`).
- Kart base ürüne yönlendirir; base yoksa en iyi sıralanan sürüme.

### Detay

- Route id somut bir ürün; açılışta seçili sürüm = o ürünün `editionKey`'i (Deluxe kartından girilirse Deluxe seçili).
- Sürüm × mağaza fiyat tablosu tek geçişte kurulur: her mağaza adapter'ı `baseTitle` ile **bir** arama yapar ve `EditionOffer[]` döner (her isabetin sürüm anahtarı + fiyatı; mağaza aramaları fiyatı zaten içeriyor). Steam için en iyi base uygulamanın `appdetails.package_groups` alt paketleri de sürüm olarak eklenir. `baseTitle` eşleşmesi < 50 olan ve DLC isabetleri atılır. Sıra: base önce, sonra sabit sürüm sırası.
- Sürüm seçimi anlıktır (ek istek yok). Fiyat önbelleği (60 sn) mağaza+ülke+dil+baseTitle anahtarıyla tabloyu tutar. Bu, önceki "seçimde tembel yükleme" fikrinin yerine geçer: daha az istek, tek iptal noktası.
- `gameDetailStore` anahtarı `slug|platform` kalır; snapshot `editions` tablosunu ve `selectedEdition`'ı taşır; `selectEdition()` yalnız UI durumunu değiştirir.

### Kaldırılanlar

- `LiveGame`/`GameSummary`/`Game`: `description`, `genres`, `developers`, `release_date`, `screenshots`, `videos` alanları ve bunları dolduran adapter kodu.
- `detail-metadata.ts`, `fetchMetadataCandidates` (detayda başka mağazalara giden metadata istekleri) ve testleri.
- Medya: ekran görüntüsü/video listesi, `ScreenshotModal`, `VideoModal`; kullanılmazsa `expo-video` bağımlılığı (`app.json` plugin'i dahil; `bun run prebuild` gerekir).
- `getGenreColor`, `formatDate`, Game Pass yeşili gibi kullanılmayan token/yardımcılar.

### Testler

- `editions.test.ts`: dillere göre tablo testleri, base/Standart, DLC ayrımı, numaralı devam oyunları (FF XVI ≠ FF XV).
- Her adapter için "yanlış sürümü reddeder" testi.
- `merge.test.ts`: sürümler tek kartta toplanır, `editions` doğru dolar.
- Detay: Deluxe route'u Deluxe fiyatlarını getirir; o sürümü satmayan mağaza "yok" döner, base fiyatı dönmez.
- `request-efficiency` / `request-cancellation`: yeni istek sayıları ve sürüm değişiminde iptal.

## Aşama 2 — Dil/ülke ayrımı ve i18n

### Diller

`tr, en, de, fr, es, es-419, pt, pt-BR, it, nl, pl, ru, uk, cs, hu, ro, bg, el, da, sv, no, fi, ja, ko, zh-Hans, zh-Hant, th, vi, id, ar` (Steam'in dil listesi temel alınır).

### Katalog

- `src/i18n/messages/en.ts` kaynak; `export type Messages = typeof en`. Diğer diller `satisfies Messages` — eksik anahtar derleme hatasıdır.
- `src/i18n/index.ts`: `t(key, params?)`, `useT()` (dil store'unu `useSyncExternalStore` ile okur, effect yok), çoğul için `Intl.PluralRules`, sayı/para için `Intl.NumberFormat`.
- Uygulamadaki bütün kullanıcıya görünen metinler (hata mesajları dahil) anahtarla gelir. Servis katmanı Türkçe metin üretmez; hata kodları döner, ekran çevirir.
- Çeviriler model tarafından üretilir; ana dili konuşan birinin gözden geçirmesi önerilir (README/PR notu).

### Ayarlar

- Dil (`gsale_locale`) ve ülke (`gsale_country`) bağımsızdır; anahtarlar aynı kalır.
- İlk açılış: cihaz dili/bölgesi (`Intl.DateTimeFormat().resolvedOptions().locale`) destekleniyorsa seçilir; değilse dil `en`, ülke `TR`.
- Ülke yalnız fiyat bölgesini/para birimini belirler. Ülke adları `Intl.DisplayNames` yerine katalogdan gelir (Hermes desteği belirsiz).

### Fiyatlar dilden bağımsız

`PlatformPriceResult`/`GameDeal` sayısal alan taşır: `amount` (TL, `null` = bilinmiyor), `original_amount`, `discount_percent`, `is_free`. Metin ("₺312,00", "Ücretsiz") yalnız UI'da `Intl.NumberFormat(lang, { style: 'currency', currency: 'TRY' })` ve katalogla üretilir. Fiyatlar AGENTS.md gereği TL'ye çevrilmeye devam eder.

### Mağaza dili: `src/services/store/languages.ts`

- Mağaza başına desteklenen diller ve (PS/Xbox için) geçerli dil-ülke ikilileri.
- `storeLanguage(store, appLang, country)`: destekleniyorsa uygulama dili, değilse ülkenin varsayılan dili (`storeLocale`).
- `getSteamLang`, `getEpicLocale`, `getPsLocale`, `getPsLanguage` bununla değiştirilir. Fiyat önbellek anahtarı dili de içerir (başlık dile göre değişebilir).
- Dil değişince screen store'lar yeniden yüklenir.

### RTL

- Arapça seçilince `I18nManager.allowRTL(true)` + `forceRTL(true)`; diğerlerinde `forceRTL(false)`. Yön değişiyorsa kullanıcıya "uygulamayı yeniden başlatın" bildirimi gösterilir.
- Stiller `start/end` kullanır; yön ikonları RTL'de aynalanır.

### Font

IBM Plex Sans: Latin, Kiril, Yunan. `ar`, `ja`, `ko`, `zh-*`, `th` için `Font` tokenları sistem fontuna düşer (dil store'undan türetilir).

### Testler

- Her katalog `en` ile aynı anahtar kümesine sahip (tip + çalışma zamanı testi), parametre yer tutucuları aynı.
- `storeLanguage` tablo testleri; adapter URL'lerinde doğru dil parametresi.
- Dil değişiminde store yeniden yükleme; RTL bayrağı.

## Aşama 3 — Yeniden tasarım (kapak odaklı galeri)

### İlkeler (anti-slop)

Gradyan, glow, neon vurgu, emoji, "✨" başlık yok. Görseller kenardan kenara, radius 2–4. Hiyerarşi tipografiyle. Tek vurgu rengi: indirim için sıcak kırmızı-turuncu. Fiyatlar tabular rakam (`fontVariant: ['tabular-nums']`). Kart kutuları yerine görsel + altında düz metin şeridi.

### Tokenlar (`src/constants/DesignSystem.ts` yeniden)

Renk (zemin, yüzey, çizgi, metin 3 seviye, indirim, hata), tipografi ölçeği (display, title, body, label, price, priceLarge), spacing, radius (0/2/4/full), dokunma hedefi (44). ESLint `enforce-design-tokens` kuralıyla uyumlu.

### Logolar

`src/components/StoreLogo.tsx`: Simple Icons (CC0) tek renk SVG path'leri, `react-native-svg` ile; Steam, Epic Games, GOG, Xbox, PlayStation, Nintendo. Erişilebilirlik etiketi mağaza adı. `PlatformBadge`/`PlatformBadgeList` bununla değiştirilir. AGENTS.md'deki "Store logos are not used" kuralı güncellenir.

### Ekranlar

- **Sekmeler:** Ana sayfa, Ara, Favoriler, Bedava, Ayarlar (Ara görünür sekme olur).
- **Ana sayfa:** en derin indirim tam genişlik 16:9 kapak + altında başlık, indirim, fiyat, logo. Mağaza başına şerit: logo + "İndirimde", yatay büyük kapaklar, altında başlık ve fiyat.
- **Arama / Bedava / Favoriler:** ortak `CoverGrid` (2 sütun); kapak + başlık + logo satırı (+ fiyat varsa).
- **Detay:** tam genişlik kapak (geri/favori düz koyu çiplerde), başlık, yatay sürüm seçici, fiyat tablosu (satır: logo, indirim, çizili fiyat, fiyat, dış bağlantı ikonu; fiyata göre sıralı; en ucuza "En düşük" etiketi; o sürümü olmayan mağazalar sönük "Bu sürüm yok"; yüklenirken satır iskeleti).
- **Ayarlar:** gruplu liste — Dil, Ülke (para birimiyle), Hakkında; seçiciler tam ekran aranabilir liste.
- **Bildirimler:** mevcut ekran yeni bileşenlerle; içerik değişmez.

### Silinecek/yeniden yazılacak bileşenler

Kullanılmayanlar silinir (örn. `FeaturedDeal`, `GameListItem`, `CardFooter`, `PlatformBadge*`, `AppBackground` gerekmezse). Kalanlar: `CoverImage`, `CoverCard`, `CoverGrid`, `StoreStrip`, `StoreLogo`, `PriceTable`, `EditionPicker`, `SearchField`, `ScreenHeader`, `EmptyState`, `ScreenLoading`, `SettingsRow`, `OptionPicker`.

### Testler

`src/components/components.test.tsx` ve `src/z-detail-screen.test.tsx` yeni bileşenlere göre yeniden yazılır (react-test-renderer, `byLabel`): sürüm seçimi fiyatları değiştirir, "Bu sürüm yok" satırı, en ucuz etiketi, dış bağlantı yalnız HTTPS.

## Doğrulama (her aşama sonunda)

`bun run typecheck`, `bun run lint`, `bun run test:coverage`, `bunx --bun expo-doctor`, `bun run doctor` (hedef: 0 uyarı; mevcut 11 uyarı da giderilir), değişen dosyalarda `sonar analyze --file`. Gerçek cihaz/simülatör testi bu ortamda yapılamaz; PR'da ekran görüntüsü için kullanıcıya not düşülür.
