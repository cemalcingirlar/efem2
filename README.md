<div align="center">
  <img src="assets/logos/logo-full.png" alt="efem iletişim" width="220">

  <h1>efemiletisim.com</h1>
  <p><strong>Akıllı saat, kulaklık ve teknoloji aksesuarları mağazası</strong> — Vanilla JS + Firebase ile inşa edilmiş, statik hosting üzerinde çalışan hızlı bir e-ticaret sitesi.</p>

  <p>
    <img src="https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E?style=flat-square&logo=javascript&logoColor=black" alt="Vanilla JS">
    <img src="https://img.shields.io/badge/Firebase-Auth%20%2B%20Firestore-FFCA28?style=flat-square&logo=firebase&logoColor=black" alt="Firebase">
    <img src="https://img.shields.io/badge/Hosting-Vercel-000000?style=flat-square&logo=vercel" alt="Vercel">
    <img src="https://img.shields.io/badge/Payment-PayTR-1B3C87?style=flat-square" alt="PayTR">
    <img src="https://img.shields.io/badge/license-Proprietary-lightgrey?style=flat-square" alt="License">
  </p>
</div>

---

## Ekran Görüntüleri

| Ana Sayfa | Ürün Listeleme |
|---|---|
| ![Ana Sayfa](docs/screenshots/home.jpg) | ![Ürünler](docs/screenshots/products.jpg) |

| Ürün Detay | Sepet |
|---|---|
| ![Ürün Detay](docs/screenshots/product-detail.jpg) | ![Sepet](docs/screenshots/cart.jpg) |

---

## Özellikler

- **Ürün kataloğu** — kategori (akıllı saat / kulaklık / aksesuar / ses & diğer) ve marka bazlı filtreleme, fiyat aralığı, minimum puan, sıralama (fiyat/puan/yeni/öne çıkan)
- **Canlı arama** — navbar üzerinden anlık ürün/marka arama dropdown'u
- **Ürün detay** — galeri, teknik özellik tablosu, ilgili ürünler, stok durumu
- **Favoriler** — localStorage tabanlı, profil sayfasında listeleniyor
- **Sepet** — miktar güncelleme, kupon kodu desteği (altyapı hazır, kampanya aktif edilmeyi bekliyor)
- **Ödeme akışı** — adres/fatura formu + PayTR iFrame ödeme formu; kart bilgisi sitede toplanmaz, tutar sunucuda hesaplanır, sonuç PayTR'nin imzalı bildiriminden yazılır (`api/`)
- **Üyelik** — Firebase Authentication (e-posta doğrulama dahil), Firestore'da sipariş/favori geçmişi
- **Hesap paneli** — sipariş geçmişi, favoriler, adres ve profil yönetimi
- **Admin paneli** (`admin.html`) — ürün/sipariş yönetimi arayüzü
- **Kurumsal tek-kaynak yapı** — tüm marka/iletişim/yasal bilgiler `js/site-config.js`'ten besleniyor, sayfalarda tekrar yok
- **SEO** — `sitemap.xml`, `robots.txt`, Organization/Product schema.org enjeksiyonu
- **Yasal sayfalar** — KVKK/gizlilik, mesafeli satış sözleşmesi, iptal/iade
- **Güvenlik başlıkları** — CSP, HSTS, X-Frame-Options vb. `vercel.json` üzerinden
- **Mikro etkileşimler** — magnetic hover butonlar, scroll-reveal, sayaç animasyonları

## Teknoloji Yığını

| Katman | Teknoloji |
|---|---|
| Frontend | Vanilla HTML5 / CSS3 / JavaScript (framework yok, build adımı yok) |
| Kimlik doğrulama & veri | Firebase Authentication + Firestore |
| Ödeme | **PayTR iFrame API** — Vercel Functions (`api/`), Node.js, bağımlılıksız HMAC-SHA256 imzalama |
| Hosting | Vercel (`vercel.json`) + Firebase Hosting yapılandırması (`firebase.json`) |
| Diğer | localStorage (sepet/favoriler), schema.org JSON-LD, CSP güvenlik başlıkları |

## Proje Yapısı

```
├─ index.html, urunler.html, urun-detay.html,
│  sepet.html, odeme.html, hesap.html, profil.html,
│  hakkimizda.html, admin.html          → sayfalar (routing nedeniyle kökte)
├─ css/                                  → main / components / pages
├─ js/
│  ├─ site-config.js                     → TEK kaynak: marka, iletişim, yasal künye
│  ├─ data.js                            → ürün kataloğu
│  ├─ products.js                        → filtre, arama, favori, ürün kartı
│  ├─ cart.js                            → sepet, kupon, toplam hesaplama
│  ├─ payment.js                         → ödeme API istemcisi (kart verisi toplamaz)
│  ├─ auth.js / firebase-auth.js         → üyelik, Firestore sipariş/favori
│  └─ main.js                            → navbar, toast, animasyonlar, SEO schema
├─ api/                                  → Vercel Functions (sunucu tarafı ödeme)
│  ├─ _lib/                              → PayTR istemcisi, sipariş/fiyat mantığı, Firestore
│  ├─ payment/                           → config · initialize · notify
│  └─ order/                             → eft · status
├─ scripts/                              → sync-catalog · test-payment-lib · test-payment-flow
├─ assets/                               → images, icons, logos
├─ docs/                                 → RAPOR.md, IYZICO-DENETIM-RAPORU.md,
│                                          PAYTR-ENTEGRASYON.md, ARKADAS-YAPILACAKLAR.md
├─ vercel.json / firebase.json           → hosting + güvenlik başlıkları
├─ .env.example                          → sunucu ortam değişkenleri şablonu
└─ sitemap.xml / robots.txt
```

## Kurulum

Vitrin tarafında build adımı yok. Ödeme API'si (`api/`) Node.js gerektirir:

```bash
npm install
```

```bash
node dev-server.js
```

Ardından `http://localhost:3000` adresini açın — `dev-server.js` hem statik dosyaları servis eder hem de `/api/*` isteklerini Vercel Functions ile aynı imzayla çalıştırır. Ödeme kütüphanesinin birim testleri: `npm run test:payment`.

Firebase bağlantısı için `js/firebase-config.js` içindeki proje anahtarlarını kendi Firebase projenizle güncelleyin. Ödeme için gereken sunucu değişkenleri: `.env.example`.

## Durum

Gerçek **PayTR iFrame API** entegrasyonu yazıldı: tutar sunucuda hesaplanır, sipariş sunucuda açılır, ödeme sonucu PayTR'nin imzalı bildiriminden yazılır; kart numarası/CVV bu projenin hiçbir katmanına girmez.

Ortam değişkenleri (`.env.example`) girilene kadar kart ödemesi **kapalıdır** — checkout bu durumda EFT/havale sunar ve hiçbir koşulda "ödeme başarılı" taklidi yapılmaz.

Canlıya çıkış adımları: `docs/PAYTR-ENTEGRASYON.md` · Denetim bulguları: `docs/IYZICO-DENETIM-RAPORU.md`

---

<div align="center">
  <sub>© 2026 efemiletisim.com — Efem İletişim Teknoloji San. ve Tic. Ltd. Şti.</sub>
</div>
