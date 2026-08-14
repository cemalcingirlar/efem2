# Changelog

Bu dosya projede yapılan her ekleme, değişiklik ve kaldırmayı kayıt altına alır.
En yeni kayıtlar en üstte.

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
