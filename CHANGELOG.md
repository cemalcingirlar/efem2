# Changelog

Bu dosya projede yapılan her ekleme, değişiklik ve kaldırmayı kayıt altına alır.
En yeni kayıtlar en üstte.

## 2026-08-18 (kurulum teşhisi)

### `/api/payment/config` artık yapılandırma hatasının SEBEBİNİ söylüyor
Panel canlıya alınırken `FIREBASE_SERVICE_ACCOUNT` okunamadı, ama sunucunun
verdiği tek bilgi `store: false` idi. "Değişken hiç tanımlı değil", "tanımlı ama
yanlış şey yapıştırılmış" ve "değer kırpılmış" durumlarının hepsi aynı görünüyordu;
her tahmin bir deploy turu demekti.

- Add: `serviceAccountDiagnostics()` (`api/_lib/env.js`) — `present` / `parsed` /
  `reason` (`not_set`, `not_json_not_base64`, `invalid_json`, `missing_fields`)
  ve çözülebildiyse `projectId`.
- Add: `valueShapeHint()` — değer çözülemediğinde NE olduğunu sınıflandırır
  (tırnak içinde yapıştırılmış, dosya yolu/adı, sadece private_key, web API key)
  ve uzunluğunu verir. Kurulumdaki hatayı ilk bakışta gösterdi: 182 karakter =
  Firebase Console'daki Admin SDK kod örneği, 24 karakter = e-posta adresi.
- Add: `adminEmailsDiagnostics()` (`api/_lib/admin-auth.js`) — kaç geçerli adres
  var, kaçı bozuk. Aynı hata `ADMIN_EMAILS`'e de yapılmıştı ve hiçbir yerden
  görünmüyordu; yalnız giriş denemesinde 403 alınıyordu.

**Sır sızdırmama kuralı:** Hiçbiri değerin İÇERİĞİNDEN parça döndürmez.
Servis hesabı tarafında yalnız `project_id` verilir — o da zaten
`js/firebase-config.js` içinde açıkta. Yönetici adresleri hiç verilmez: kişisel
veri olmasının yanı sıra, yönetici hesaplarının listesi saldırgan için doğrudan bir
hedef listesidir. Sınıf ve uzunluk bilgisi de yalnız değer ZATEN çözülemediğinde
hesaplanır, yani çalışan bir anahtar hakkında hiçbir şey söylenmez.

- Change: `dev-server.js` → `api/` altındaki tüm modüller her istekte tazeleniyor
  (önceden yalnız handler dosyası; `api/_lib/*` değişiklikleri sunucu yeniden
  başlatılana kadar görünmüyordu) ve `vercel.json` başlıkları yerelde de uygulanıyor.

İlgili PR'lar: #14, #15, #16.

## 2026-08-18 (CSP: ödeme sayfası sıkılaştırıldı)

### `odeme-guvenli.html` artık `'unsafe-inline'` olmadan servis ediliyor
Talep: `docs/ARKADAS-YAPILACAKLAR.md` → Prompt 6 (CSP sıkılaştırma). Talep tüm siteyi
kapsıyordu; **kapsamı bilerek daralttık, sebebi aşağıda.**

Kart formunun taşındığı sayfa e-skimming açısından sitenin en kritik yeri. Bu sayfa
artık satır içi hiçbir script, style bloğu veya `style=""` attribute'u içermiyor;
kendisine özel ve `script-src 'self' https://www.paytr.com` ile sınırlı bir CSP ile
servis ediliyor. Sayfaya enjekte edilen bir script tarayıcı tarafından çalıştırılmaz.

- Add: `js/theme-init.js` — `<head>` içindeki tema (FOUC) betiği dışarı alındı.
- Add: `css/odeme-guvenli.css` — sayfanın stilleri; `style=""` attribute'ları
  sınıflara çevrildi.
- Add: `js/odeme-guvenli.js` — sayfanın iframe/özet mantığı.
- Change: `vercel.json` → `/odeme-guvenli(.html)?` için ayrı, sıkı CSP.
  Sitenin geri kalanı eski (gevşek) politikayla kalır.
- Fix: `js/main.js` → toast kapatma düğmesi satır içi `onclick` yerine
  `addEventListener` kullanıyor. Satır içi handler sıkı CSP altında SESSİZCE
  çalışmaz; ödeme sayfasındaki bir bildirimin kapatma düğmesi ölü kalırdı.
- Change: `dev-server.js` → `vercel.json` başlıklarını yerelde de uyguluyor.
  Aksi hâlde sıkı CSP yalnız canlıda ortaya çıkar ve "yerelde çalışıyordu" durumu doğardı.

**Neden tüm site değil:** `'unsafe-inline'` ancak sayfadaki satır içi handler/script'in
**tamamı** kaldırıldığında düşürülebilir — kısmi temizlik sıfır güvenlik kazancı verir.
Sitede 16 sayfada ~300 statik `on*="…"` handler'ı ve bunlara ek olarak ürün kartı,
sepet satırı, admin tablosu gibi **çalışma anında üretilen** işaretlemede yüzlerce handler
daha var; bunların tamamı olay delegasyonuna çevrilmeli. Bu, sitenin her etkileşimli
öğesine dokunan ve regresyon riski yüksek bir refactor. Ödeme sağlayıcısı geçişi ve panel
yeniden yazımının hemen ardından tek seferde yapılması doğru bulunmadı; kritik sayfa
bugün korunuyor, kalan sayfalar ayrı bir çalışma olarak duruyor.

## 2026-08-18 (katalog, kupon, gerçek admin auth)

### Admin paneli Firestore + Storage üzerine taşındı; yetki artık sunucuda
Talep: `docs/ARKADAS-YAPILACAKLAR.md` → Prompt 1 ve Prompt 2. Panelin ürün
yönetimi `localStorage` yazıyordu: bir ürün eklendiğinde yalnızca O TARAYICIDA
görülüyordu, siteyi açan müşteri görmüyordu. Giriş ekranı da sayfanın kaynağındaki
sabit bir şifreyi kontrol ediyordu — bu bir yetki kontrolü değildir.

**Yetkilendirme**

- Add: `api/verify-admin.js` — panelin kapısı. Firebase ID token sunucuda
  doğrulanır, e-posta doğrulanmış olmalı ve `ADMIN_EMAILS` listesinde bulunmalı.
- Change: `admin.html` giriş ekranı gerçek Firebase e-posta/şifre girişi yapıyor;
  sabit kullanıcı adı/şifre (`ADMIN_CREDS`) ve `sessionStorage` bayrağı kaldırıldı.
  Kimlik doğru ama yetki yoksa oturum açık bırakılmıyor, hemen kapatılıyor.
- Change: `admin.html` → Ayarlar ekranındaki istemci tarafı şifre değiştirme
  kaldırıldı; yerine oturum sahibi bilgisi ve Firebase şifre sıfırlama e-postası geldi.
- Add: `adminGate(req, res)` — tüm yönetici uçlarının ortak kapısı
  (401 kimlik yok / 403 yetki yok / 503 yapılandırma yok).

**Ürün kataloğu**

- Add: `api/admin/products.js` — GET/POST/DELETE. `priceKurus` alanı
  İSTEMCİDEN ALINMAZ, `price` üzerinden sunucuda türetilir; ödeme akışı yalnız
  bu alanı okuduğu için panelde girilen fiyat ile tahsil edilen tutar birbirine bağlıdır.
- Add: `api/_lib/product-schema.js` — serbest metinler kırpılır, `javascript:`
  gibi görsel yolları reddedilir, varyant sku'ları tekilleştirilir.
- Add: `api/_lib/catalog-store.js` — Firestore `products` koleksiyonu statik
  `catalog.json` üzerine biner (aynı id → Firestore kazanır). Firestore okunamazsa
  statik listeye düşülür: katalog servisi çökse bile ödeme akışı durmaz.
- Add: `api/catalog.js` — vitrinin okuduğu, herkese açık uç.
- Change: `js/data.js` → `PRODUCTS` artık BASE_PRODUCTS + sunucu kataloğu.
  `whenCatalogReady()` eklendi; sayfalar hem DOM'u hem katalogu bekliyor, böylece
  yalnızca Firestore'da olan bir ürünün detay sayfası "bulunamadı" diye yönlendirilmiyor.
- Change: `index.html`, `urunler.html`, `urun-detay.html`, `sepet.html`
  bu bekleyişi kullanıyor.

**Görsel yükleme (Firebase Storage)**

- Add: `api/admin/upload.js` — görsel Admin SDK ile yüklenir; istemcinin
  Storage'a yazma yetkisi yoktur. İçerik türü gönderilen `contentType` alanına değil
  dosyanın İLK BAYTLARINA bakılarak belirlenir; dosya adı sunucuda yeniden üretilir
  (dizin geçişi ve üzerine yazma riski). Sınır 3 MB.
- Change: `admin.html` görseli artık ürün kaydının içine gömülü `data:` URI
  olarak değil, Storage URL'si olarak saklıyor.

**Kuponlar**

- Add: `api/admin/coupons.js` + `api/_lib/coupons.js` — kupon tanımları
  Firestore `coupons` koleksiyonunda. Panel ₺ girer, kuruşa çevrilerek yazılır.
- Add: `api/coupon/validate.js` — sepetin kullandığı, herkese açık uç. İstemci
  yalnız KODU gönderir; indirim sunucuda hesaplanır.
- Change: `api/_lib/orders.js` → `priceBasket()` asenkron oldu ve kupon
  kodunu kabul ediyor. İndirim sepeti aşamaz; toplam sıfıra inerse sipariş reddedilir
  (0 ₺ tahsil edilemez).
- Change: `js/cart.js` → sabit `COUPONS` objesi kaldırıldı. Sepet değişince
  uygulanan kupon düşürülüyor: minimum tutar şartı bozulmuş bir indirimin ekranda
  kalması ödeme adımında sürpriz yapardı.
- Change: `odeme.html` özetine kupon satırı eklendi; tutar `/api/coupon/validate`'ten.
- Add: `admin.html` → "Kuponlar" sekmesi (liste, ekle/düzenle, aç/kapat, sil).

**Kurallar (deploy SİZDE)**

- Change: `firestore.rules` → `products` okumaya açık / yazmaya kapalı,
  `coupons` tamamen kapalı (istemci kupon listesini göremez).
- Add: `storage.rules` — `products/**` herkese açık okuma, yazma kapalı.
  Yükleme Admin SDK ile yapıldığı için kuralları gevşetmeye gerek yok.
- Add: `firebase.json` → `storage.rules` bağlandı.

**Diğer**

- Add: `docs/ADMIN-KURULUMU.md` — mimari, ortam değişkenleri, yönetici hesabı
  açma, kural yayınlama ve canlıya çıkış doğrulama listesi.
- Add: `FIREBASE_STORAGE_BUCKET` (`.env.example`); boş bırakılırsa
  `<project_id>.firebasestorage.app` varsayılır.
- Add: `npm run test:admin:catalog` — 52 test. `npm test` toplam 180 test.
- Fix: `dev-server.js` artık `api/` altındaki TÜM modülleri her istekte
  tazeliyor; önceden yalnız handler dosyası tazeleniyordu ve `api/_lib/*` değişiklikleri
  sunucu yeniden başlatılana kadar görünmüyordu.

## 2026-08-18 (devam)

### Sipariş yönetimi: admin paneli artık TÜM siparişleri sunucudan görüyor
Talep: `docs/ARKADAS-YAPILACAKLAR.md` → Prompt 3. Talebin ilk iki maddesi (top-level
`orders` koleksiyonu + misafir siparişlerinin sunucu tarafında kaydı) PayTR/iyzico
çalışmasıyla birlikte zaten yapılmıştı; eksik olan panel tarafı tamamlandı.

**Tespit edilen eksik:** `admin.html` sipariş ekranı `getAllOrders()` ile
`localStorage` okuyordu — yani yalnızca O TARAYICIDA verilmiş siparişleri gösteriyordu.
Firestore'daki gerçek siparişler (üye + misafir) panelde hiç görünmüyordu; durum
değiştirmek de yalnız yerel deftere yazıyor, müşterinin profiline yansımıyordu.

- Add: `api/admin/orders.js` — `GET` tüm siparişleri listeler (üye + misafir),
  `POST` sipariş durumunu değiştirir. Yalnız sevkiyat durumları atanabilir
  (Hazırlanıyor / Kargoda / Teslim Edildi / İptal); ödeme durumları (`paid` vb.) elle
  değiştirilemez, onları yalnız ödeme bildirimi yazar.
- Add: `api/_lib/admin-auth.js` — yetki SUNUCUDA doğrulanıyor: Firebase ID token +
  doğrulanmış e-posta + `ADMIN_EMAILS` listesi. Panelin istemci tarafı şifresi bir
  yetki kontrolü değildir; bu uç ondan bağımsız korunur.
- Add: `store.listOrders()`, `store.setOrderStatus()`, `store.syncUserOrderStatus()`.
  Sonuncusu üye siparişlerinde `users/{uid}.orders` dizisindeki kopyayı transaction
  içinde günceller — müşteri `profil.html` sayfasında güncel durumu görür.
- Change: `admin.html` sipariş ekranı sunucudan besleniyor; sunucu yapılandırılmamışsa
  eski yerel deftere düşüyor ve bunu ekranda **uyarı şeridiyle** açıkça söylüyor
  (hangi ortam değişkeninin eksik olduğu dahil).
- Change: `api/_lib/settle.js` → terminal durumlara `processing/shipped/delivered` eklendi;
  geç gelen bir ödeme bildirimi kargoya verilmiş siparişi geri alamaz.
- Add: `npm run test:admin` — 29 test (yetkisiz erişim 401/403/503, üye+misafir listesi,
  geçersiz durum reddi, profil senkronu, geç bildirim koruması). `npm test` hepsini koşar.

**Kalan:** `admin.html` hâlâ istemci tarafı bir şifre ekranı gösteriyor. Bu ekran güvenlik
değildir (kaynak kodda görünür), yalnızca paneli kazara açmayı önler — gerçek sipariş verisi
sunucu yetkisiyle korunuyor. Panelin tamamının Firebase girişine bağlanması Prompt 2'nin işi.

## 2026-08-18

### Sipariş e-postası gitmiyordu — teşhis ve düzeltme
Misafir olarak verilen bir siparişte ne müşteriye ne işletmeye mail ulaştı.
Üç ayrı eksik tespit edildi:

1. **Misafir siparişlerinde hiç mail gönderilmiyordu.** `odeme.html` içindeki yerel
   (sunucusuz) sipariş akışı yalnızca ÜYE siparişlerinde `sendOrderConfirmationMail()`
   çağırıyordu; misafir dalında hiçbir mail çağrısı yoktu.
2. **İşletmeye sipariş bildirimi hiç yoktu.** Hiçbir kod yolu yeni siparişi işletmeye
   haber vermiyordu (`sendSupportNotificationMail` yalnız ürün sorusu formunda kullanılıyordu).
3. Canlıda `orderApiEnabled: false` — `FIREBASE_SERVICE_ACCOUNT` girilmediği için sunucu
   sipariş API'si kapalı; sipariş yalnızca müşterinin tarayıcısındaki yerel deftere yazıldı.

- Add: `api/_lib/notify-merchant.js` — işletme bildirim maili (sipariş no, durum, ödeme
  tipi, tutar, müşteri iletişim bilgisi, teslimat adresi, fatura bilgisi, SKU'lu ürün tablosu).
- Change: `api/order/eft.js` ve `api/_lib/settle.js` — sipariş oluşunca / ödeme
  onaylanınca işletmeye de bildirim kuyruğa giriyor (müşteri onayına ek olarak).
- Change: `odeme.html` — sunucu API'si kapalıyken bile işletmeye sipariş bildirimi
  gönderiliyor (üye/misafir fark etmeksizin). Firestore kuralları `destek@` adresine
  yazmaya izin verdiği için bu yol misafirlerde de çalışıyor.
- Change: `docs/EMAIL-KURULUMU.md` — hangi mailin hangi koşulda gittiği netleştirildi;
  müşteri onay mailinin neden sunucu tarafı gerektirdiği (Firestore kuralları) açıklandı.
- Change: Akış testlerine işletme bildirimi kontrolü eklendi (`52 + 47` test).

**Not:** Bu düzeltmeler mailin ÜRETİLMESİNİ sağlar; gerçekten gönderilmesi için Firebase
"Trigger Email from Firestore" extension'ının kurulu olması şart (bkz. `docs/EMAIL-KURULUMU.md`).
Müşteriye onay maili için ayrıca `FIREBASE_SERVICE_ACCOUNT` ortam değişkeni gerekir.

## 2026-08-17 (devam)

### Ödeme sağlayıcısı değişti: iyzico → PayTR (iFrame API)
Kurulum ve işletim rehberi: `docs/PAYTR-ENTEGRASYON.md`.
Kart verisi bu projede hâlâ hiçbir yerde toplanmıyor; değişen yalnız sağlayıcı.

**Sunucu tarafı**
- Add: `api/_lib/paytr.js` — PayTR iFrame API istemcisi. `paytr_token` üretimi
  (merchant_id + user_ip + merchant_oid + email + payment_amount + user_basket +
  no_installment + max_installment + currency + test_mode + salt → HMAC-SHA256 → base64),
  bildirim `hash` doğrulaması, sepet (base64 JSON) ve kuruş biçimlendirme.
- Add: `api/payment/notify.js` — PayTR "Bildirim URL"si. **Sonucun tek yetkili kaynağı.**
  `hash` doğrulanmadan hiçbir sipariş durumu değişmez; işlem bitince gövdesi
  **tam olarak `OK`** olan yanıt döner (aksi hâlde PayTR bildirimi tekrarlar).
  Aynı bildirim tekrar gelse de ikinci kez işlenmez.
- Change: `api/payment/initialize.js` — iyzico Checkout Form yerine PayTR get-token.
  Sipariş yine ödeme öncesi `awaiting_payment` olarak açılıyor, tutar yine sunucuda
  hesaplanıyor, sepet satırları varyant adıyla (`Ürün (Renk · Beden)`) gönderiliyor.
- Change: `api/_lib/settle.js` — PayTR bildirim modeline göre yeniden yazıldı.
  Tahsil edilen tutar, para birimi veya test/canlı ortam sipariş kaydıyla uyuşmazsa sipariş `paid` değil
  **`pending_review`** olur; sevkiyat başlamaz, mail gitmez.
- Change: `api/_lib/env.js` — `PAYTR_*` değişkenleri. **Varsayılan test modu**:
  `PAYTR_TEST_MODE` açıkça `0` yapılmadıkça gerçek para çekilmez.
- Change: Sipariş numarası artık **alfanumerik** (`EFM260817A5973E`) — PayTR
  `merchant_oid` alanı tire/boşluk kabul etmiyor. Eski tireli numaralar okunmaya
  devam ediyor (geçmiş siparişler bozulmasın diye).
- Remove: `api/_lib/iyzico.js`, `api/payment/callback.js`, `api/payment/webhook.js`
  ve iyzico'ya özel yardımcılar (`toGsmNumber`, `IDENTITY_PLACEHOLDER`).

**Arayüz**
- Add: `odeme-guvenli.html` — PayTR ödeme formunu iframe içinde açan, üzerinde
  başka iş mantığı çalışmayan sade sayfa (e-skimming yüzeyini küçültmek için).
- Change: `odeme.html` ve `js/payment.js` PayTR akışına bağlandı; kart alanı yok,
  test modunda müşteriye açık uyarı gösteriliyor.
- Change: `odeme-sonuc.html` — bildirim henüz ulaşmadıysa "ödeme tamamlanmadı"
  yerine **"sonucunuz kontrol ediliyor"** gösteriliyor (PayTR akışı asenkron).
- Change: Tüm sayfalardaki ödeme rozeti ve yasal metinlerdeki sağlayıcı adı
  PayTR olarak güncellendi (`mark-paytr`, `.provider-badge`).
- Change: `vercel.json` CSP — `frame-src` ve `script-src` için `https://www.paytr.com`.

**Test**
- Change: `npm run test:payment` → **52 birim + 45 akış testi**. Akış testleri
  PayTR'yi taklit eden yerel bir sunucuya karşı koşuyor ve gönderilen
  `paytr_token` imzasını bağımsız olarak yeniden hesaplayıp doğruluyor.
  Kapsananlar: imzalı bildirim → `paid`, bildirim tekrarı → tek etki, tutar
  uyuşmazlığı → `pending_review`, ortam/para birimi uyuşmazlığı → `pending_review`,
  bozuk imza → 401 ve değişiklik yok,
  `status=failed` → `failed`, "OK" gövdesi, doğrulama kapıları, hız sınırı.

**Dokümantasyon**
- Add: `docs/PAYTR-ENTEGRASYON.md` (mimari, kurulum, kabul testleri, canlıya geçiş,
  işletim, mutabakat, sık hatalar, güvenlik kuralları).
- Change: `docs/IYZICO-ENTEGRASYON.md` → `docs/ARSIV-IYZICO-ENTEGRASYON.md` (arşiv notu ile).
  `docs/IYZICO-DENETIM-RAPORU.md` başına sağlayıcı değişikliği notu eklendi —
  mevzuat/KVKK/PCI/fiyat bütünlüğü bulguları aynen geçerli.
- Change: `CLAUDE.md` ödeme kuralları, `README.md`, `.env.example`,
  `docs/ARKADAS-YAPILACAKLAR.md` PayTR'ye göre güncellendi.

## 2026-08-17

### Katalog doğruluk denetimi: teknik özellikler, renk görselleri
Talep: `docs/visual-fix.md`. Tam rapor: `docs/KATALOG-DENETIM-RAPORU.md`.
Her değer üreticinin kendi teknik özellik sayfasından doğrulandı; doğrulanamayan
mevcut iddialar silindi (uydurma yok).

- Fix: **Huawei WiFi Mesh X3 Pro "Wi-Fi 6" olarak satılıyordu; ürün Wi-Fi 7.**
  Hız, ethernet portu ve model kodu (GAEA2-PLM21) da düzeltildi.
- Fix: Huawei Watch GT 6 / GT 6 Pro'da **Bluetooth 5.2 → 6.0** (GT 5 Pro ve Fit 4
  gerçekten 5.2, onlar korundu).
- Fix: GT 6 pil ömrü "tipik" diye yazılan değerler aslında **maksimum** kullanım
  değeriymiş (41 mm: maks 14 / tipik 7 gün, 46 mm: maks 21 / tipik 12 gün).
- Fix: Apple Watch Series 10 titanyumda **var olmayan "Silver" kaplama** iddiası
  kaldırıldı (Apple: Natural / Gold / Slate).
- Fix: Apple Watch SE 3'te Apple'ın belirtmediği **IP6X** iddiası kaldırıldı;
  Wi-Fi'nin yalnız 2,4 GHz olduğu eklendi.
- Fix: Huawei Watch Fit 4'te doğrulanamayan **SpO2** iddiası kaldırıldı.
- Fix: Huawei FreeBuds SE 3 **BT 5.3 → 5.4**; "kılıfla uzun kullanım" yerine
  9 saat + 42 saat; IP54'ün yalnız kulaklıklar için geçerli olduğu notu.
- Fix: Samsung Galaxy Watch9'da doğrulanamayan **IP68** kaldırıldı (5 ATM +
  MIL-STD-810H); Galaxy Buds4 Pro **IP54 → IP57**.
- Fix: AirPods Pro 3 açıklamasından Apple TR sayfasında geçmeyen "köpük katmanlı
  uçlar" ve "Canlı Çeviri" ifadeleri çıkarıldı.
- Fix: Xiaomi Redmi Watch 6 ve Redmi Buds 8 ailesindeki ölçüsüz ifadeler
  ("uzun ömürlü", "kılıfla uzun süreli kullanım") gerçek değerlerle değiştirildi.
- Add: **Renk seçilince galeri o rengi gösteriyor.** `js/data.js` ürünlerine
  opsiyonel `colorImages` haritası, `urun-detay.html`'e `showColorImage()` eklendi;
  renk görselleri galeriye küçük resim olarak da giriyor. Daha önce müşteri
  "Roze Altın" seçse de ekranda siyah ürün kalıyordu.
- Add: `scripts/fetch-apple-watch-images.mjs` — Apple'ın kendi CDN'inden
  1200 × 1200 şeffaf arka planlı **14 renk görseli** indirildi (Series 11 42/46,
  SE 3 40/44, Series 10 46 alüminyum, Series 9 41).
- Add: `scripts/catalog-audit.mjs` — katalog sağlık raporu (eksik dosya, düşük
  çözünürlük, tek görsel, zayıf açıklama, varyant/renk dökümü).
- Not: Samsung'un renk görselleri ada uymayan renkler döndürdüğü için
  **kullanılmadı**; JBL (10 ürün) jbl.com otomatik isteklere kapalı olduğu için
  bu turda doğrulanamadı — ayrıntı ve kalan iş listesi raporda.

## 2026-08-16 (devam 3)

### Ödeme sunucusu ürün varyantlarına (renk/beden) uyarlandı
- Change: `scripts/sync-catalog.mjs` artık varyantları da yazıyor; `api/_lib/catalog.json`
  yeni katalogdan yeniden üretildi (**54 ürün, 114 varyant**). Katalog eski 20 ürünlük
  listeden kaldığı sürece yeni ürünlerin siparişi reddediliyordu.
- Change: `api/_lib/orders.js` → `priceBasket()` sepet satırlarını artık **ürün id + sku**
  ile ayrıştırıyor (`js/cart.js` → `cartLineKey` ile aynı mantık). Aynı ürünün iki farklı
  rengi iki ayrı satır olarak fiyatlanıyor; daha önce "aynı ürün iki satırda" diye
  reddediliyordu.
- Change: sku doğrulaması eklendi — sku eksikse, sahteyse veya **başka bir ürünün**
  sku'suysa sipariş reddediliyor.
- Change: Renk/beden bilgisi istemciden değil **sunucudaki katalogdan** okunuyor; müşteri
  yalnız hangi sku'yu seçtiğini bildiriyor (uydurulan renk metni yok sayılıyor).
- Change: iyzico sepet kaleminin kimliği varyantlı üründe **sku**, adı ise
  `Ürün (Renk · Beden)` biçiminde gönderiliyor — ödeme kaydı ile depodan çıkan ürün birebir
  eşleşiyor. Sipariş kaydı, sipariş maili, profil siparişleri ve ödeme sonucu sayfası da
  varyantı gösteriyor.
- Change: `js/payment.js` → `cartForServer()` artık `{id, sku, qty}` gönderiyor.
- Add: Testler yeni katalog ve varyant kurallarına göre genişletildi; fiyat/sku sabitleri
  katalogdan okunuyor, böylece katalog değişince testler kendiliğinden uyum sağlıyor.
  `npm run test:payment` → **43 birim + 38 akış testi** (hız sınırı testi dahil).

## 2026-08-16 (devam 2)

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

## 2026-08-16 (devam)

### Renk / beden varyantları — müşteri sepete eklerken seçiyor
- Add: `js/data.js` → her ürüne `variants: [{ sku, color, size? }]` eklendi. Excel'deki
  **114 satırın her biri bir varyant**; SKU listedeki Malzeme kodudur. Daha önce renkler
  sadece `specs` içinde metin olarak yazıyordu, seçilemiyordu. Doğrulandı: 114 Excel satırı
  ↔ 114 varyant, birebir eşleşiyor, tekrar eden SKU yok. Apple Watch ürünlerinde ayrıca
  kordon bedeni (`size`: S/M, M/L) var; `sizeLabel` ile etiketleniyor.
- Add: `js/data.js` → varyant yardımcıları (`getVariantColors`, `getSizesForColor`,
  `findVariant`, `hasVariantChoice`, `defaultVariant`) ve `COLOR_SWATCHES` renk paleti.
- Add: `urun-detay.html` → renk ve beden seçici (`buildVariantPicker`). **Her renk × beden
  kombinasyonu mevcut değil** (ör. Watch Series 11 42mm Jet Siyah yalnızca S/M) — seçili
  renkte üretilmeyen beden pasif ve üstü çizili gösteriliyor, altında "Jet Siyah rengi
  yalnızca S/M bedeninde mevcut." açıklaması çıkıyor. Olmayan kombinasyon sepete eklenemiyor.
- Change: `js/cart.js` → sepet satırları artık ürün id'si yerine **varyant SKU'su** ile
  ayrışıyor (`cartLineKey`). Aynı ürünün farklı rengi ayrı satır; aynı varyant tekrar
  eklenince miktar artıyor. `addToCart(id, qty, variant)`; seçim gerektiren üründe varyant
  verilmezse ekleme reddediliyor. `removeFromCart`/`updateCartQty` artık satır anahtarı alıyor.
- Change: Seçilen renk/beden sepet kartında (renk noktası + metin), ödeme özetinde, sipariş
  geçmişinde (`profil.html`) ve admin sipariş detayında (Malzeme kodu ile birlikte) görünüyor.
- Change: `js/products.js` → çok seçenekli ürünlerin kartındaki buton "Sepete Ekle" yerine
  **"Seçenekleri Gör"** (renk seçmeden sepete eklenemez); kartlarda renk noktaları gösteriliyor.
  Tek varyantlı 24 üründe buton eskisi gibi doğrudan ekliyor.

## 2026-08-16

### Gerçek stok kataloğu (54 ürün), yeni kategoriler, ürün görselleri
- Change: `js/data.js` → `BASE_PRODUCTS` tamamen değiştirildi. Kaynak: `stok bilgisi.xlsx`
  (114 satır). Satırların çoğu aynı modelin renk çeşidi olduğu için **marka + model + fiyat**
  kırılımıyla gruplandı → **54 ürün**. Renkler ürün başına tek satırda (`specs` → "Renk")
  listeleniyor. Her üründe `sku` alanı var (listedeki Malzeme kodu), stok tümünde 10.
  Önceki 20 demo ürün (iPad, Casper tablet, Anker/Sony vb.) kaldırıldı — stokta olmayan
  ürünün sitede satılıyor görünmemesi için.
- Change: Kategori yapısı `saat / kulaklik / tablet` → **`saat` (22) · `kulaklik` (21) ·
  `aksesuar` (7) · `ses` (4)**. Stok listesinde hiç tablet yok; buna karşılık şarj adaptörü,
  şarj kablosu, telefon askısı (→ Aksesuarlar) ve Bluetooth hoparlör, WiFi mesh, projektör
  (→ Ses & Diğer) var. Navbar dropdown, mobil menü, footer, `urunler.html` filtreleri ve
  hızlı kategori butonları, `index.html` kategori kartları, `admin.html` istatistik/seçim
  alanları güncellendi.
- Add: `js/data.js` → `CATEGORY_LABELS` tek kaynak olarak eklendi. `urunler.html` breadcrumb'ı,
  `urun-detay.html` kategori linki ve `admin.html` ürün kaydetme akışı artık kendi kopya
  kategori haritalarını tutmuyor, buradan besleniyor. Yeni kategori eklerken tek yer değişiyor
  (navbar/footer linkleri hâlâ HTML içinde sabit).
- Add: Ürün görselleri internetten indirildi — toplam **153 görsel** (48 üründe 3'er,
  6 üründe 1–2 tane; `assets/images/products/`). Kaynak seçimi önce markanın resmi sitesiyle
  (`site:apple.com`, `site:samsung.com` …) kısıtlanıyor, ardından aday URL'nin **model kodunu
  içermesi zorunlu** tutuluyor (`fetch-images.ps1` → `Test-Relevant`); ayrıca üst model
  görselinin alt modele girmemesi için negatif eşleşme (ör. "buds4" ararken "buds4pro" hariç),
  stok fotoğraf/konsept-render siteleri, 500px altı görseller ve 16:9'dan geniş reklam
  banner'ları eleniyor.
  Bu filtreler şart: filtresiz denemede görsel arama AirPods 4 yerine AirPods Pro,
  Samsung üçlü adaptör yerine alakasız bir stok fotoğraf, Galaxy Watch9 yerine Watch8 ve
  JBL Tune 680BT NC yerine 530BT getirdi. **Yanlış görsel yerine eksik görsel** tercih edildi:
  2026 modeli olduğu için resmi görseli az olan 6 üründe (Galaxy Watch9 40/44mm, Redmi Watch 6,
  Redmi Buds 8, JBL Tune 680BT NC, JBL Go 5) 3 yerine 1–2 görsel var.
- Remove: Katalogdan çıkan 20 demo ürünün 100 görseli silindi (13.2 MB).
- Change: Ürünlerin `rating`/`reviewCount` değerleri 0. Gerçek müşteri değerlendirmesi
  olmadan yıldız/yorum sayısı göstermek yanıltıcı olduğu için ürün kartında ve detay
  sayfasında puan bloğu yerine "Henüz değerlendirilmedi" yazıyor (`js/products.js`,
  `urun-detay.html`); `urunler.html` içindeki "Minimum Puan" filtresi ve "En Çok Beğenilen"
  sıralaması hiç değerlendirme yokken otomatik gizleniyor. `js/main.js` ürün schema'sı zaten
  `reviewCount > 0` koşuluyla `aggregateRating` yayınlıyordu, o davranış korundu.
- Change: `urunler.html` sol filtredeki kategori sayaçları ("Tümü (20)" gibi) HTML'de sabit
  yazılıydı, katalog değişince yanlış oluyordu; artık `PRODUCTS`'tan hesaplanıyor.
- Change: `index.html` öne çıkanlar şeridi ilk 8 ürünle sınırlandı (21 "featured" ürün
  şeridi şişiriyordu). `.categories-grid` 3 → 4 sütun.
- Change: Meta açıklamalar, sayfa başlıkları ve footer metinleri gerçek katalogla uyumlandı
  (artık satılmayan "tablet" ve "Sony/Anker" ifadeleri kaldırıldı; `js/site-config.js` →
  `brand.description` dahil).
- Add: `.claude/launch.json` — `node dev-server.js` (port 3000) preview yapılandırması.

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
