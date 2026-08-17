# efemiletisim.com — proje notları

Design direction: high-end-visual-design

Ana renk korunuyor: `--primary: #2563EB` (bkz. `css/main.css`). Tasarım yükseltmesi bu rengi değiştirmeden yapılıyor.

Kurumsal bilgi tek kaynak: `js/site-config.js`. Footer, hakkımızda, ödeme sayfası mağaza adresi gibi yerler `data-link`/`data-text` attribute'leriyle buradan besleniyor (`js/main.js` → `initSiteLinks()`). Sunucu tarafının ihtiyaç duyduğu künye alanları `api/_lib/merchant.js` içinde kopyalanmıştır; `site-config.js` değişirse orası da güncellenmeli.

Detaylı ilerleme raporu: `docs/RAPOR.md`. Değişiklik günlüğü: `CHANGELOG.md`. Arkadaşın için hazır AI prompt'ları: `docs/ARKADAS-YAPILACAKLAR.md`.

## Ödeme — değiştirmeden önce oku

Ödeme **PayTR iFrame API** ile çalışır (kart formu PayTR tarafında, iframe içinde). Kurulum ve canlıya çıkış: `docs/PAYTR-ENTEGRASYON.md`. Denetim bulguları: `docs/IYZICO-DENETIM-RAPORU.md` (sağlayıcıdan bağımsız mevzuat/güvenlik bulguları hâlâ geçerlidir).

Bozulmaması gereken kurallar:

- Bu projede **kart numarası/CVV toplanmaz, taşınmaz, saklanmaz.** Checkout'a kart alanı geri eklenmez.
- **Tutar istemciden alınmaz.** Sunucu sepeti kendi kataloğundan yeniden fiyatlar (`api/_lib/catalog-store.js`: Firestore `products` → statik `api/_lib/catalog.json`); istemciden yalnız `{id, sku, qty}` ve **kupon kodu** kabul edilir. Renk/beden bilgisi ve indirim tutarı da sunucuda hesaplanır, istemciden gelen değer kullanılmaz. Statik katalog (fiyat/varyant) değişirse `npm run sync-catalog`.
- **Ödeme sonucu tarayıcıdan gelen veriye göre belirlenmez.** Sonucun tek kaynağı PayTR'nin Bildirim URL'sine (`/api/payment/notify`) gönderdiği, `hash`'i doğrulanmış POST'tur; işlendiğinde PayTR'ye gövdesi tam olarak `OK` olan yanıt dönülür (`api/_lib/settle.js`).
- Tahsil edilen tutar sipariş tutarıyla uyuşmazsa sipariş `pending_review` olur — `paid` yapılmaz, sevkiyat başlamaz. `hash` doğrulanamayan bildirim hiçbir durumu değiştirmez.
- Sırlar (`PAYTR_MERCHANT_KEY`, `PAYTR_MERCHANT_SALT`, service account) yalnız sunucu ortam değişkeninde durur; repoya, istemci koduna veya loga girmez.
- Yapılandırma eksikse kart ödemesi kapalı kalır ve checkout EFT'ye düşer ("fail closed"); sahte başarı üretilmez.

- Sipariş numarası (`merchant_oid`) **alfanumerik** olmak zorundadır (PayTR kuralı); `newOrderId()` bunu garanti eder.

Ödeme kütüphanesini değiştirdikten sonra `npm run test:payment` çalıştırılmalı.

## Yönetim paneli (ürün · kupon · görsel)

Kurulum ve doğrulama listesi: `docs/ADMIN-KURULUMU.md`.

- Panele giriş **Firebase Authentication** ile, yetki **sunucuda** (`/api/verify-admin` → ID token + doğrulanmış e-posta + `ADMIN_EMAILS`). `admin.html` içindeki hiçbir istemci bayrağı yetki yerine geçmez; panele sabit şifre geri eklenmez.
- Ürün, kupon ve görsel yazma işlemlerinin tamamı `/api/admin/*` üzerinden, Admin SDK ile yapılır. `firestore.rules` istemciye `products` yazmayı, `coupons` okumayı **kapatır**; `storage.rules` yazmayı tamamen kapatır. Kuralları gevşetmek yerine uç eklenir.
- `priceKurus` istemciden alınmaz; `price` üzerinden `api/_lib/product-schema.js` içinde türetilir. Ödeme akışı yalnız `priceKurus` okur.
- Kupon indirimi istemciden alınmaz; kod sunucuda `api/_lib/coupons.js` ile doğrulanır. İndirim sepeti aşamaz, toplam sıfıra inerse sipariş reddedilir.
- Güvenlik kuralları (`firestore.rules`, `storage.rules`) repoda durur, **deploy'u proje sahibi yapar**.

Panel/katalog tarafını değiştirdikten sonra `npm run test:admin` çalıştırılmalı.

## Kök dizin

Proje kök dizini: sayfa HTML'leri (routing gereği taşınamaz), `css/`/`js/`/`assets/`, sunucu tarafı ödeme için `api/` ve `scripts/`, hosting/config dosyaları (`vercel.json`, `firebase.json`, `firestore.rules`, `storage.rules`, `robots.txt`, `sitemap.xml`, `.gitignore`, `.vercelignore`, `package.json`, `.env.example`, `dev-server.js`) ve `CLAUDE.md`/`CHANGELOG.md`/`README.md` içerir. Rapor/yardımcı doküman `docs/`'a, logo kaynak dosyası `assets/logos/source/`'a taşındı.
