# Mağaza Başvurusu Metinleri

App Store ve Google Play başvurusunda kullanılacak metinler ve kontrol listesi.

## Kontrol listesi

- [ ] **Uygulama ikonu:** `assets/images/icon.png` hâlâ Expo'nun varsayılan ikonu. Yayından önce GSale'e özel bir ikon gerekiyor. İkonda Steam, PlayStation, Xbox, Nintendo, Epic ya da GOG logosu veya logoya benzeyen bir şekil olmamalı.
- [ ] **Uygulama adı ve alt başlığı:** Mağaza adı geçmemeli. ("GSale – Steam Fiyatları" olmaz, "GSale – Oyun Fiyat Karşılaştırma" olur.)
- [ ] **Ekran görüntüleri:** Oyun kapakları görünebilir. Mağaza logoları uygulamada zaten yok, sadece mağaza adı düz metin olarak yazıyor. Tanıtım görsellerine de logo eklenmemeli.
- [ ] **Anahtar kelimeler (iOS):** Başka şirketlerin marka adları anahtar kelime alanına yazılmamalı.
- [x] Uygulama içi sorumluluk reddi: Ayarlar ekranının altında.
- [x] Her fiyat resmi mağaza sayfasını açıyor ("Mağazada aç"). Uygulamada satın alma yok.

## Kısa açıklama (Google Play, en fazla 80 karakter)

Oyun fiyatlarını mağazalar arasında karşılaştır, indirimleri tek yerde gör.

## Açıklama

GSale, bir oyunun farklı dijital mağazalardaki güncel fiyatını tek ekranda gösterir.

• Ana sayfada mağazaların güncel indirimleri
• Oyun ara, bütün mağazalardaki fiyatları yan yana gör
• Mağaza ülkesini seç: fiyatlar o bölgenin mağazalarından gelir ve TL'ye çevrilir
• Favorilerini takip et

GSale bir fiyat karşılaştırma aracıdır. Uygulamada satın alma yapılmaz. "Mağazada aç" düğmesi oyunun resmi mağaza sayfasını açar.

GSale bağımsız bir uygulamadır; hiçbir mağaza veya platform sahibiyle bağlantılı değildir ve onlar tarafından desteklenmez. Adı geçen markalar ve oyun görselleri sahiplerine aittir. Fiyatlar mağazaların herkese açık sayfalarından alınır; TL karşılıkları yaklaşık kurla hesaplanır ve mağazadaki fiyattan farklı olabilir.

## App Review notları (İngilizce, Apple için)

GSale is a price comparison app for PC and console games. It shows publicly listed prices from several digital storefronts side by side, and it now includes a home page of current discounts per store.

- No purchases happen in the app. Every price has an "Open in store" button (labelled "Mağazada aç") that opens the game's official store page in the browser.
- The app has no user accounts, backend or in-app purchases. Prices are requested from the stores' public web endpoints directly on the device, the same way a browser would load the store pages.
- The app does not use any store logos; store names appear only as plain text so users know where a price comes from. The Settings screen states that GSale is independent and not affiliated with or endorsed by any store.
- Game cover images are loaded from the stores' own image servers to identify the product whose price is shown.

Test steps: open the app → the Home tab lists current discounts per store → tap any game → "Fiyatlar" tab → "Mağazada aç" opens the official store page. Settings → "Mağaza ülkesi" changes the store region.

## Google Play notları

- **Content rating anketi:** Kullanıcı içeriği yok, satın alma yok, reklam yok (reklam eklenirse güncellenmeli).
- **Data safety:** Uygulama kişisel veri toplamıyor. Dil, ülke ve favoriler yalnızca cihazda saklanıyor. Mağazalara istek cihazdan gidiyor.
- **IP şikâyeti gelirse:** Uygulamanın yalnızca herkese açık fiyatları gösterdiğini, satın almayı resmi mağazaya yönlendirdiğini ve logo kullanmadığını belirten bir yanıt ver. Talep edilen içeriği (belirli bir mağazanın görsellerini ya da tüm bölümünü) gerekirse kaldır.
