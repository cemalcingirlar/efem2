# Changelog

Bu dosya projede yapılan her ekleme, değişiklik ve kaldırmayı kayıt altına alır.
En yeni kayıtlar en üstte.

## 2026-08-16

### Gerçek iyzico entegrasyonu (Checkout Form) + canlı öncesi denetim düzeltmeleri

`docs/deep-research-report.md` içindeki denetim promptu proje üzerinde uygulandı;
çıkan CRITICAL bulgular kapatıldı. Denetim sonucu: `docs/IYZICO-DENETIM-RAPORU.md`.

**Kaldırılanlar (CRITICAL)**
- Remove: `js/payment.js` içindeki **sahte ödeme simülasyonu**. `simulatePaymentResult()`
  kart numarasına bakıp 1,5 sn sonra "başarılı" dönüyordu ve **tanınmayan her kart başarılı
  sayılıyordu** (`testCards[cleanNumber] || 'success'`) — yani hiç para tahsil edilmeden
  sipariş "Hazırlanıyor" olarak oluşuyor, müşteriye "ödeme alındı" deniyordu.
- Remove: `odeme.html` kart formu (kart no, son kullanma, **CVV**, kart sahibi) ve kart
  önizleme bileşeni. Kart verisi artık bu sitede hiç toplanmıyor; PAN/CVV yalnız iyzico'nun
  kendi ödeme sayfasına giriliyor (PCI kapsamı dışında kalmak için).
- Remove: Canlı checkout sayfasında gösterilen **test kartı listesi** (`showTestCards()`).
- Remove: `css/pages.css` içindeki kart input stilleri; `vercel.json` CSP `connect-src`
  listesinden iyzico host'ları (tarayıcı artık gateway'e doğrudan konuşamaz).

**Eklenenler — sunucu tarafı ödeme (Vercel Functions)**
- Add: `api/payment/config.js` — kart ödemesinin açık olup olmadığını bildirir.
  Yapılandırma eksikse checkout kart sekmesini kapatır, EFT/havaleye düşer.
- Add: `api/payment/initialize.js` — sepeti **sunucu fiyatlarıyla** yeniden hesaplar,
  siparişi `awaiting_payment` olarak açar, iyzico Checkout Form'u başlatır ve ödeme
  sayfasına yönlendirir. İstemciden yalnız `{id, qty}` kabul edilir; gönderilen
  fiyat/tutar alanları yok sayılır.
- Add: `api/payment/callback.js` — tarayıcı dönüşü. Callback'teki hiçbir parametre kanıt
  sayılmaz; sonuç iyzico retrieve ile sorgulanır, yanıt imzası + `conversationId` + tutar
  + fraud durumu doğrulanır. Uyuşmazlıkta sipariş `pending_review` olur, sevkiyat başlamaz.
- Add: `api/payment/webhook.js` — `X-IYZ-SIGNATURE-V3` doğrulaması (V1/V2 desteklenmiyor).
  Kullanıcı sekmeyi kapatsa bile sipariş doğru sonuçlanır; tekrar gelen olaylar tek sonuç üretir.
- Add: `api/order/eft.js`, `api/order/status.js` — sunucu tarafı EFT siparişi ve
  siparişe özel HMAC jetonuyla korunan durum sorgusu (IDOR koruması).
- Add: `api/_lib/` — `iyzico.js` (bağımlılıksız IYZWSv2 imzalama, endpoint'ler, yanıt imzası),
  `settle.js` (callback + webhook ortak, idempotent sonuçlandırma), `store.js` (Firebase Admin),
  `orders.js` (fiyatlama/doğrulama/kimlikler), `env.js`, `http.js`, `merchant.js`, `catalog.json`.
- Add: `odeme-sonuc.html` — ödeme sonucu sayfası. "Başarılı" bilgisi tarayıcıda üretilmez,
  `/api/order/status` üzerinden sunucudan okunur.
- Add: `package.json`, `.env.example`, `scripts/sync-catalog.mjs` (js/data.js → sunucu fiyat
  kataloğu), `scripts/test-payment-lib.mjs` (34 birim testi: imza, fiyat manipülasyonu,
  webhook doğrulama, erişim jetonu).
- Change: `dev-server.js` artık `/api/*` isteklerini Vercel Functions imzasıyla çalıştırıyor
  ve `.env.local` yüklüyor; ödeme akışı yerelde test edilebiliyor.

**Mevzuat**
- Add: `on-bilgilendirme-formu.html` — Mesafeli Sözleşmeler Yönetmeliği'nin aradığı ön
  bilgilendirme (satıcı künyesi, KDV dahil toplam, ödeme/teslimat, cayma hakkı ve
  istisnaları, şikâyet yolları). Tüm sayfaların footer'ına ve `sitemap.xml`'e eklendi.
- Add: `odeme.html` — sipariş onayından hemen önce satıcı + ödenecek tutar + **"Bu sipariş
  ödeme yükümlülüğü doğurur"** bloğu; onay kutusu ön bilgilendirme formuna da atıf yapıyor;
  onay kaydı (zaman damgası + IP) siparişle birlikte saklanıyor. Buton metni "Ödemeyi Tamamla".

**Güvenlik**
- Change: `firestore.rules` — yeni `orders` koleksiyonu yalnız sunucudan yazılabilir, üye
  yalnız kendi siparişini okur; `paymentEvents` istemciye tamamen kapalı. `users/{uid}.orders`
  yazma izni, sunucu API'si yapılandırılana kadar EFT yedeği için bilinçli olarak açık
  bırakıldı (bulgu F-06, kapatma kuralı dosyada yorumlu).
- Change: `.gitignore` — `node_modules/`, `.env*`, service account JSON'ları; `.vercelignore`
  — `scripts/`, `.env*`, Firebase yapılandırmaları.
- Add: `js/auth.js` → `getIdToken()`; sipariş API'sine üyelik kanıtı Firebase ID token ile
  gönderiliyor ve sunucuda Admin SDK ile doğrulanıyor.

**Dokümantasyon**
- Add: `docs/IYZICO-DENETIM-RAPORU.md` (bulgular, test matrisi, PCI veri akışı, rollback,
  mutabakat, nihai kararlar), `docs/IYZICO-ENTEGRASYON.md` (kurulum, sandbox kabul testleri,
  production geçiş, işletim, sık hatalar).

## 2026-08-15 (devam 2)

### Adres senkronu, 81 il, navbar dropdown bug, ürün fotoğrafları
- Add: `js/site-config.js` → `TURKIYE_ILLERI` (81 il, plaka sırasıyla) tek kaynak olarak eklendi.
  `odeme.html` Şehir seçimi artık 10 sabit şehir yerine bu listeden JS ile dolduruluyor;
  `profil.html` adres modalındaki İl serbest metin alanı da aynı listeyle beslenen `<select>`
  oldu. Bu ikisi aynı yazımı kullanmadığı için (ör. "adana" vs "Adana") kayıtlı adres
  ödeme ekranına uygulanınca Şehir alanı boş kalıyordu — artık her iki form da aynı
  kaynaktan aynı değerleri kullandığı için senkron.
- Fix: Posta Kodu zorunlu alan olmaktan çıkarıldı (`odeme.html` label + `js/payment.js` →
  `ADDRESS_REQUIRED_FIELDS`). `profil.html` adres modalına da (opsiyonel) Posta Kodu alanı
  eklendi, checkout formuyla alan seti eşleşsin diye.
- Add: `odeme.html` — kayıtlı adres kartlarına düzenle (kalem) ikonu eklendi; adres formunu
  doldurup "Bu kayıtlı adresi güncelle" butonuna basınca o adres Firestore'daki
  `users/{uid}.addresses` içinde güncelleniyor. Daha önce ödeme ekranından kayıtlı adres
  sadece seçilebiliyordu, düzenlenemiyordu.
- Fix: Navbar "Ürünler" mega menüsü, tetikleyici link ile açılan menü arasındaki 8px boşlukta
  fare hover'ı kırılıp menü kapandığı için tıklanamıyordu (klasik CSS hover-gap sorunu).
  `.nav-dropdown::after` ile görünmez bir köprü eklendi, boşluk artık hover'ı kesmiyor.
- Fix: Ürün kartı hover galerisi geçiş süresi 2sn'den 3sn'ye çıkarıldı (`js/products.js`).
- Add: 20 ürünün her birine internetten (resmi üretici/perakendeci kaynaklarından) 4'er ek
  gerçek fotoğraf eklendi — toplam 100 görsel (`assets/images/products/`), `js/data.js`
  içindeki `images` dizileri güncellendi. Artık ürün kartına gelince (hover) zaten var olan
  galeri geçiş mekanizması gerçek görsellerle çalışıyor.

## 2026-08-15 (devam)

### Hakkımızda vergi dairesi/KEP satırları, Firebase mail dili
- Fix: `hakkimizda.html` şirket bilgileri kartında Vergi Dairesi ve KEP Adresi verisi
  `site-config.js`'te vardı ama satırlar HTML'de eksikti, görünmüyordu. Eklendi.
- Fix: `js/firebase-config.js` → `auth.languageCode = 'tr'` eklendi, Firebase Auth
  e-postaları (şifre sıfırlama, e-posta doğrulama) artık Türkçe gönderiliyor.

## 2026-08-15

### Adres autofill, admin ayarlar
- Fix: `odeme.html` teslimat adresi formunda `autocomplete` attribute'leri eksikti
  (ad/soyad/adres/şehir/ilçe/posta kodu) — tarayıcının kayıtlı adres önerisine tıklandığında
  sadece telefon/e-posta doluyor, gerisi boş kalıyordu. Standart autocomplete token'ları eklendi.
- Add: Admin panel — yeni "Ayarlar" sekmesi: şifre değiştirme (mevcut şifre doğrulamalı,
  yeni şifre iki kez sorulup eşleştirilir), kurtarma e-postası ve telefon numarası.
  `localStorage` tabanlı (mevcut admin auth zaten client-side demo seviyesinde).

## 2026-08-14 (devam 9)

### Üyelik, sipariş ve kurumsal bilgi eksikleri
- Add: `site-config.js` — ünvan, vergi dairesi (Seyhan VD), KEP adresi, IBAN, çalışma saati
  (10:00–22:00), Instagram (`efemelektronik`) güncellendi; `odeme.html`/`mesafeli-satis-sozlesmesi.html`
  bu tek kaynaktan besleniyor, sahte banka/IBAN verileri kaldırıldı.
- Add: `hakkimizda.html` distribütör şeridindeki İndeks Bilgisayar ve Ouno Servis artık metin
  etiketi değil gerçek logo (`assets/logos/indeks.png`, `assets/logos/ouno.png`, kullanıcı
  tarafından sağlandı), `site-config.js` distributors listesi güncellendi.
- Fix: Sepetteki ürüne (görsel/isim) tıklayınca artık ürün detay sayfasına gidiyor.
- Add: Profil sayfasına cep telefonu, doğum tarihi, T.C. kimlik no (algoritma doğrulamalı)
  alanları, çoklu adres yönetimi (ekle/düzenle/sil, Ev/İş/Diğer etiketli) ve "Hesabımı Sil"
  (şifre ile yeniden kimlik doğrulama + Firestore + Auth hesabı kalıcı silme) eklendi.
- Add: Ödeme sayfası — kayıtlı adreslerden tek tıkla seçim, EFT dekont no alanı, ayrı fatura
  bilgileri formu (bireysel/kurumsal, TCK veya vergi no, vergi dairesi). Admin panelinde sipariş
  detayında fatura bilgileri ve EFT dekont no görüntüleniyor, kargo takip no girilebiliyor.
- Add: Şifre sıfırlama artık Firebase'in genel İngilizce sayfası yerine kendi Türkçe
  `sifre-sifirla.html` sayfasına yönleniyor; yeni şifre iki kere sorulup eşleştiriliyor.
- Add: Firestore `mail` koleksiyonu + güvenlik kuralı — üye sipariş onayı ve ürün soru-cevap
  bildirimleri (`destek@efemiletisim.com`) otomatik kuyruğa yazılıyor. Gerçek gönderim için
  Firebase Console'da kurulacak extension adımları `docs/EMAIL-KURULUMU.md`'de. Admin panelinde
  iptal edilen siparişler için tek tıkla müşteriye mail taslağı açan buton eklendi (otomatik
  iptal maili, admin panelinin gerçek Firestore bağlantısı olmadığından şimdilik desteklenmiyor
  — bkz. `docs/EMAIL-KURULUMU.md` "Bilinen sınırlama").

## 2026-08-14 (devam 8)

### Karanlık mod, footer, admin panel, sipariş yönetimi
- Fix: Karanlık modda `--secondary` (sabit koyu lacivert) metin rengi olarak kullanılan yerler
  (feature-title, section-title, fiyatlar, logo, başlıklar) `--text-primary`'ye çevrildi —
  koyu metin koyu zeminde görünmez oluyordu. Sadece amber/dekoratif sabit-koyu zeminler
  (btn-dark, footer bg, rozetler) olduğu gibi bırakıldı.
- Add: Footer — sahte sosyal linkler (Twitter/Facebook/YouTube, hepsi `#`'e gidiyordu)
  kaldırıldı, yerine yalnızca gerçek kanallar (Instagram, WhatsApp — `site-config.js`).
  Ödeme rozetleri düz metinden gerçek marka işaretlerine (VISA/Mastercard/troy/iyzico/SSL)
  çevrildi, tüm sayfalarda tutarlı.
- Fix: Ürün kartına tıklayınca detay sayfası açılmıyordu — kod hatası değil, yerel test
  sunucusunun (`npx serve`) `.html` → uzantısız yönlendirmesi `?id=` parametresini
  düşürüyordu. Yerel sunucu değiştirildi, prod (Vercel `cleanUrls`) bu sorunu yaşamaz.
- Add: Admin panel — artık sabit (BASE_PRODUCTS) ürünler de düzenlenebiliyor; düzenleme
  tarayıcıda "override" olarak saklanıyor (orijinal bozulmuyor), "Sıfırla" ile geri alınabilir.
  Dashboard'a envanter değeri, kategori dağılımı, stok sağlığı grafiklerİ eklendi.
- Add: `hesap.html`'e "Admin girişi" linki eklendi (admin.html'e yönlendiriyor).
- Add: `docs/ARKADAS-YAPILACAKLAR.md`'a domain bağlama (Vercel + Firebase Authorized Domains)
  adım adım rehberi eklendi.
- Add: Gemini ile üretilen çizim-stili görseller (`assets/images/*-sketch.*`,
  `category-*.webp`) siteye bağlandı: ana sayfa kategori kartları, hakkımızda sayfası
  hikaye bölümü. Hero ve ödeme sayfası için bilerek kullanılmadı (koyu hero zeminiyle
  krem çizim stili çakışıyor, checkout'ta dikkat dağıtmasın diye) — 404 sayfası yok, o da
  atlandı.
- Add: Ürün kartlarında mouse ile üzerine gelince 2 saniyede bir görsel geçişi + nokta
  göstergesi (`js/products.js` → `startCardImageCycle`) — şu an her ürün 1 görsel olduğu
  için pasif, ürün başına görsel eklenince otomatik devreye giriyor. `urun-detay.html`'in
  zaten var olan thumbnail galerisi de aynı mekanizmayı kullanıyor.
- Add: Ürün detay sayfasına "hızlı bakış" öne çıkan özellikler kutusu (ilk 4 teknik özellik,
  ikon+kısa metin).
- Redesign: Admin ürün ekle/düzenle modalı dar tek sütundan geniş iki sütunlu (görsel solda,
  form alanları sağda) düzene geçti.
- Add: Admin panelde bilgisayardan görsel yükleme (dosya seçilip otomatik 800px'e
  küçültülüp sıkıştırılarak kaydediliyor, localStorage'ı şişirmesin diye) — URL yapıştırma
  hâlâ alternatif olarak duruyor.
- Add: Admin panele Sipariş Yönetimi sekmesi — sipariş listesi, durum güncelleme
  (Hazırlanıyor/Kargoda/Teslim Edildi/İptal), sipariş detay görünümü, arama/filtre.
  Checkout akışı (üye + misafir) artık `efemi_all_orders` yerel defterine de yazıyor
  (gerçek çok-cihazlı sipariş yönetimi için hâlâ Firestore backend gerekiyor, bkz.
  ARKADAS-YAPILACAKLAR.md Prompt 3). Uçtan uca gerçek checkout ile test edildi.

## 2026-08-14 (devam 7)

### Müşteri deneyimi + tasarım (öncelik listesi uygulandı)
- Fix: `js/main.js` — `initScrollAnimations()`/`initStatCounters()` above-the-fold içeriği (hero,
  sayaçlar, ilk ekrandaki ürün kartları) artık `IntersectionObserver`'ın ilk callback'ini
  beklemeden anında görünür/animasyonlu; scroll edilene kadar soluk kalma hatası giderildi.
- Add: Karanlık mod — token bazlı (`css/main.css` `:root[data-theme="dark"]`), sistem tercihiyle
  ilk açılışta otomatik, sonrasında `localStorage` ile hatırlanıyor. Tüm müşteri sayfalarına
  (`index`, `urunler`, `urun-detay`, `sepet`, `odeme`, `hesap`, `profil`, `hakkimizda`,
  `gizlilik-kvkk`, `iptal-iade`, `mesafeli-satis-sozlesmesi`) `<head>` içine flaş-önleyici inline
  script + navbar'a tema değiştirme butonu eklendi. Ana mavi (`--primary`) değişmedi.
- Add: `odeme.html` — Ödeme adımına VISA/Mastercard/Troy/SSL güven rozeti şeridi (stepper ve
  İyzico rozeti zaten mevcuttu, sadece kart marka rozetleri belirginleştirildi).
- Add: `urun-detay.html` — Galeri artık dokunmatikte kaydırılabiliyor (swipe ile sonraki/önceki
  görsel). Stok tükendiğinde "Haber Ver" formu (e-posta → Firestore `stockAlerts`). Ürün altına
  Soru & Cevap bölümü (Firestore `productQuestions`, herkes okuyabilir/soru sorabilir, yanıt
  alanı şimdilik Firebase Console'dan doldurulacak — admin panelinden yanıtlama akışı yok).
- Add: `firestore.rules` — `stockAlerts`/`productQuestions` koleksiyonları için doğrulamalı
  `create` kuralları eklendi. **Deploy edilmedi** — `firebase deploy --only firestore:rules`
  çalıştırılana kadar yeni koleksiyonlara yazma prod'da reddedilir.
- Add: Skeleton loading — `urunler.html` (#products-grid), `index.html` (#featured-products,
  #all-products-preview), `urun-detay.html` (#related-products) artık JS render edene kadar boş
  değil, statik iskelet kartlarla açılıyor (CSS'teki `.skeleton` shimmer'ı zaten vardı, ilk kez
  gerçek kullanım alanı kazandı).
- Verify: Ürün kartı hover derinliği (double-bezel + görsel zoom), checkout stepper/İyzico rozeti,
  favoriler/sipariş geçmişi boş durumları, guest checkout akışı (`sepet.html` → `odeme.html`
  girişsiz erişilebiliyor) — kod incelemesiyle kontrol edildi, zaten yeterli kalitede; ek değişiklik
  gerekmedi.
- Add: `docs/gemini-gorsel-promptlari.md` — siteye "sanatsal hava" katacak çizim tarzı minimalist
  görseller için hazır Gemini prompt seti (hero, kategori, hakkımızda, boş durumlar, ödeme,
  gelecekte 404 sayfası).

## 2026-08-14 (devam 6)

- Add: Kök dizine premium `README.md` — badge'ler, 4 ekran görüntüsü (`docs/screenshots/`),
  özellik listesi, teknoloji yığını, proje yapısı, kurulum talimatı.
- Audit: Genel e-ticaret eksik/geliştirme taraması yapıldı (bkz. sohbet geçmişi / `docs/RAPOR.md`
  güncellemesi gerekirse) — canlı sitede scroll-reveal animasyonunun above-the-fold içeriği
  (hero, sayaçlar) ilk yüklemede soluk/0 değerde bıraktığı tespit edildi, düzeltme bekliyor.

## 2026-08-14 (devam 5)

### Faz 4 — SEO, güvenlik header, yasal metinler, KDV (tamamlandı)
- Add: `gizlilik-kvkk.html`, `mesafeli-satis-sozlesmesi.html`, `iptal-iade.html` — üç yasal metin
  sayfası (taslak, `site-config.js`'ten beslenen künye bilgileriyle) eklendi, tüm sayfaların
  footer'ına link eklendi.
- Add: `odeme.html` ödeme adımına zorunlu "Mesafeli Satış Sözleşmesi'ni kabul ediyorum" checkbox'ı;
  onaylanmadan `handlePayment()` durduruluyor. `hesap.html` kayıt formundaki eski placeholder
  "Kullanım Koşulları" linki gerçek Gizlilik/KVKK sayfasına bağlandı.
- Add: Tüm genel sayfalara OG/Twitter meta etiketleri, canonical link, `robots` (özel sayfalar
  `noindex`), `assets/logos/og-image.jpg` (1200×630 paylaşım görseli, logo baz alınarak üretildi).
- Add: `injectOrganizationSchema()` (index.html, ElectronicsStore JSON-LD, site-config.js'ten
  üretilir) ve `injectProductSchema()` (urun-detay.html, Product/Offer/AggregateRating JSON-LD).
- Add: `robots.txt`, `sitemap.xml` (6 statik sayfa + 20 ürün detay URL'si).
- Add: `vercel.json`'a güvenlik header'ları — X-Frame-Options, X-Content-Type-Options,
  Referrer-Policy, Permissions-Policy, HSTS, Content-Security-Policy (script/style-src şu an
  `unsafe-inline` içeriyor çünkü sayfalarda inline `<script>`/`<style>` yaygın — sıkılaştırma
  `ARKADAS-YAPILACAKLAR.md` Prompt 6'da).
- Add: "Tüm fiyatlara KDV dahildir" ibaresi sepet/ödeme özeti ve ürün detay fiyatının yanına.
- Change: `js/main.js` → `initSiteLinks()` içine `taxOffice` (boşsa placeholder metin döner) ve
  `returnDays` resolver'ları eklendi.
- Fix: `index.html`/`hakkimizda.html`'deki eski data-URI emoji favicon linki kaldırıldı (yeni PNG
  favicon'u override ediyordu).

### Arkadaşa devir — `ARKADAS-YAPILACAKLAR.md`
- Add: Vercel/Firebase hesabı gerektiren tüm kalan işler (gerçek iyzico entegrasyonu — şu an
  `js/payment.js` tamamen client-side simülasyon, hiçbir gerçek API çağrısı yok; admin panelini
  Firestore+Storage'a taşıma; misafir siparişlerinin hiçbir yere kaydedilmemesi sorunu; kupon
  yönetimi; mobil app; CSP sıkılaştırma) AI'ya verilecek hazır prompt'lar hâlinde bu dosyaya
  yazıldı. Bu işler kullanıcının kendi Vercel/Firebase hesabına, kendi AI asistanıyla yapılacak —
  bu oturumda kod olarak uygulanmadı. Mevcut Firebase entegrasyonu (`js/firebase-config.js`,
  `js/firebase-auth.js`, `firestore.rules`) incelendi, bilinen bir hata bulunmadı.

## 2026-08-14 (devam 4)

### Gerçek logo entegrasyonu
- Add: Kullanıcının sağladığı resmi logo (`Copy of Sağdaki Gemini Logosunu Kaldır.png`, beyaz zeminli, transparan yapılamadı) kırpılarak `assets/logos/` altına eklendi: `icon-square.png` (navbar/footer/admin ikon rozeti), `logo-full.png` / `logo-full-tagline.png` (büyük kullanım için), `favicon-32/180/512.png`.
- Change: Tüm sayfalardaki (index, ürünler, ürün detay, sepet, ödeme, profil, hesap, hakkımızda, admin) navbar/footer/auth-logo/admin-sidebar ikonu, eski inline SVG telefon ikonundan gerçek marka logosuna geçirildi. `.logo-icon` / `.admin-brand-icon` arka planı beyaz rozet olacak şekilde güncellendi (görsel kendi mavi tonunu taşıyor).
- Add: Tüm sayfalara favicon (`<link rel="icon">` + `apple-touch-icon`) eklendi — önceden hiç favicon yoktu.
- Verify: Yerel sunucuda index.html ve hesap.html tarayıcıda kontrol edildi, konsol hatası yok.

## 2026-08-14 (devam 3)

### Faz 3 — Tasarım yükseltmesi (tamamlandı)
- Change: `urunler.html`, `urun-detay.html`, `sepet.html`, `odeme.html`, `profil.html`, `admin.html` — hepsi ortak tasarım diline taşındı: pill buton, spring hareket (`--ease-spring`), double-bezel derinlik.
- Add: `odeme.html` — `.payment-method-card`, `.delivery-option-card`, `.iban-row`/`.iban-copy-btn` bileşenleri (checkout adres/ödeme/EFT kartları için).
- Add: `admin.html` — sidebar/stat kartı/tablo/modal spring+pill'e yükseltildi (kendi `<style>` bloğu içinde), yeni `.status-dot` bileşeni.
- Add: `.scroll-top-btn` (main.css → components.css, paylaşılan class), `.category-bg-fallback` (kategori kartı görsel yoksa gradyan+ikon watermark).
- Remove: ~110 emoji ikon, site genelinde (navbar/footer zaten Faz 3'te yapılmıştı) kalan tüm sayfa-özel emoji SVG ikon setine geçirildi — `js/main.js` `showToast()`, `js/products.js` (favori kalp, hızlı incele, sepete ekle), `js/cart.js`, `js/payment.js` dahil.
- Remove: ~230 inline `style="..."` attribute'ü kaldırıldı, gerçek CSS class'larına taşındı (`css/pages.css`/`css/components.css`).
- Fix: `admin.html` `js/site-config.js`'i yüklemeden `js/main.js`'i çağırıyordu → `initSiteLinks()` her sayfa yüklemesinde konsola exception atıyordu; script sırası düzeltildi.
- Change: `js/site-config.js` — `legal.tradeName` tam unvana ("Efem İletişim Teknoloji San. ve Tic. Ltd. Şti.") güncellendi, `phoneTodo`/`whatsappTodo`/`instagramTodo`/`tradeNameTodo` bayrakları kullanıcı onayıyla kapatıldı. `legal.taxOffice` hâlâ boş (bilinmiyor).
- Verify: Tarayıcıda uçtan uca test edildi (ürün detay → sepete ekle → favorilere ekle → sepet → ödeme adım 1/2/3, EFT paneli, admin giriş/dashboard/ürün listesi/ürün ekle modalı) — konsol hatası yok.

## 2026-08-14 (devam 2)

### Faz 3 — Tasarım yükseltmesi (kısmi)
- Add: `high-end-visual-design` yönü kaydedildi (proje `CLAUDE.md`), ana mavi `#2563EB` korundu.
- Add: `Plus Jakarta Sans` başlık/UI fontu eklendi (Inter yalnızca gövde metninde kalıyor).
- Change: Tüm butonlar pill-shape (`radius-full`) + spring cubic-bezier motion + daha yumuşak/derin gölge.
- Change: Ürün kartına "double-bezel" iç-dış katman derinliği (10px iç boşluk + ayrı radius'lu görsel çekirdek).
- Change: Kategori kartı ikonlarına cam efektli (backdrop-blur) yuvarlak rozet.
- Change: `.section` dikey boşluğu 64px'ten 96px'e çıkarıldı (yeni `--space-24`/`--space-28` token'ları).
- Add: ~35 emoji, tutarlı ince çizgili (line) SVG ikon setiyle değiştirildi (`assets/icons` yerine inline SVG) — navbar, mobil menü, footer, kategori/özellik ikonları, güven rozetleri.
- Fix: `hakkimizda.html` kendi başına farklı, eksik bir navbar kullanıyordu (Ana Sayfa/Ürünler linki yoktu) — standart navbar ile birleştirildi.
- Add: Tüm sayfalara (index, ürünler, ürün detay, sepet, profil, hakkımızda) "Hakkımızda" nav linki eklendi (masaüstü + mobil menü).
- Add: `assets/logos/` — Vodafone, Datagate, Genpa, KVK, Başarı Elektronik resmi logoları indirildi; hakkımızda sayfasına eklendi. İndeks ve Ouno Servis için erişilebilir logo bulunamadı, metin rozeti olarak kaldı.
- Fix: Datagate logosu "white" varyant olduğu için beyaz kart üzerinde görünmüyordu; koyu arka planlı kutuya alındı.
- Change: Hakkımızda sayfası "Şirket Bilgileri" kartı `site-config.js`'e bağlandı (Ticaret Unvanı/Sicil/Mersis/Vergi No/Adres artık tek kaynaktan geliyor); WhatsApp/Telefon/Instagram butonlu "Bize Ulaşın" kartı eklendi.

**Faz 3'te yapılmayanlar** (devam prompt'unda detaylı):
- Nav/hamburger için gerçek morph animasyonu, magnetic button JS etkileşimi — sadece CSS-seviyeli motion yapıldı.
- Ürün detay, sepet, ödeme, admin sayfalarındaki bileşenlere aynı derinlik/motion yükseltmesi uygulanmadı (sadece anasayfa + hakkımızda + paylaşılan navbar/footer/buton stilleri).
- Inline style kullanımı (Gemini'nin "kod kalitesi" eleştirisi) hâlâ yaygın, temizlenmedi.

## 2026-08-14 (devam)

### Faz 2 — Ürün görselleri
- Add: 18/20 ürün için markanın resmi kaynağından (Apple.com/Newsroom, Samsung Mobile Press, Anker/Soundcore Shopify CDN, Casper.com.tr) yüksek çözünürlüklü ürün görseli indirildi, `js/data.js` güncellendi.
- Add: Profesyonel SVG placeholder (`assets/images/products/placeholder-product.svg`) — Huawei (2) ve JBL (2) ürünleri için, bu markaların siteleri bot korumalı olduğundan otomatik indirilemedi.
- Change: Tüm `onerror` görsel fallback'leri (cart, ürün kartı, arama sonucu, hero banner) eski emoji tabanlı innerHTML enjeksiyonundan yeni placeholder SVG'sine geçirildi.
- Fix: Yanlış uzantılı dosyalar (aslında PNG olup `.jpg` olarak kaydedilen 5 dosya) doğru uzantıya taşındı.

## 2026-08-14

### Faz 1 — Kimlik doğrulama ve oturum yönetimi
- Fix: `odeme.html` içindeki `handlePayment()` fonksiyonunda `async` olmadan `await` kullanımı giderildi — bu syntax error ödeme sayfasının tüm script bloğunu çalışmaz hale getiriyordu.
- Fix: `odeme.html` `auth.js` yüklemeden `getCurrentUser()` ve `updateNavAuth()` çağırıyordu; ReferenceError gideridi.
- Fix: `main.js` her sayfada `initSearch()` çağırıyordu; arama kutusu olmayan sayfalarda (`hesap.html`) `DOMContentLoaded` zinciri kopuyordu.
- Change: Paralel çalışan iki ayrı oturum sistemi (localStorage tabanlı `auth.js` + Firebase) tek bir Firebase tabanlı ES module'de birleştirildi (`js/auth.js`).
- Fix: E-posta doğrulama ve şifre sıfırlama maillerindeki `continueUrl` parametresi kaldırıldı — alan adı Firebase "Authorized domains" listesinde olmadığında `auth/unauthorized-continue-uri` hatası veriyor ve mail hiç gönderilmiyordu.
- Add: Firebase hata haritasına yapılandırma hataları eklendi (`auth/operation-not-allowed`, `auth/unauthorized-continue-uri`, `auth/quota-exceeded`, `auth/invalid-api-key` vb.); bilinmeyen hatalarda kod artık mesajda görünüyor.
- Change: `saveOrderToFirestore` hatayı yutup `null` döndürmek yerine açık hata fırlatıyor.
- Add: "Üye Olmadan Devam Et" (misafir alışverişi) — `hesap.html` girişine buton, `odeme.html` misafir siparişlerine açıldı.
- Add: Ödeme adımına zorunlu e-posta alanı (misafir siparişlerinde sipariş takibi için).
- Fix: `hesap.html` logosundaki "efemi" yazım hatası "efem" olarak düzeltildi, logo boyutu büyütüldü.
- Change: `profil.html` içindeki tekrarlayan Firebase auth kodu kaldırıldı, ortak `requireAuth()` kullanılıyor.

### Faz 0 — Altyapı ve temizlik
- Add: `js/site-config.js` — tüm kurumsal bilgi, iletişim, yasal künye ve sosyal medya tek kaynaktan besleniyor.
- Add: `main.js` içine `initSiteLinks()` — `data-link` / `data-text` attribute'leri ile sayfa içeriği config'ten dolduruluyor.
- Fix: `hakkimizda.html` tanımsız CSS değişkenleri (`--bg-alt`, `--bg-body`) kullanıyordu; tanımlı karşılıklarıyla değiştirildi.
- Remove: `EFEMI10`, `EFEMI50`, `HOSGELDIN` kupon kodları ve bunların site genelindeki reklamları kaldırıldı.
- Change: Tek kupon `EFEM500` olarak tanımlandı, tutar/şart kararı verilene kadar `enabled: false`.
- Change: Ana sayfadaki indirim kodu banner'ı, mağaza güveni ve WhatsApp iletişimi vurgulayan bölümle değiştirildi.
- Remove: `main.js` içindeki kullanılmayan `PRODUCT_IMAGES` bloğu.
