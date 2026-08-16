# efemiletisim.com — proje notları

Design direction: high-end-visual-design

Ana renk korunuyor: `--primary: #2563EB` (bkz. `css/main.css`). Tasarım yükseltmesi bu rengi değiştirmeden yapılıyor.

Kurumsal bilgi tek kaynak: `js/site-config.js`. Footer, hakkımızda, ödeme sayfası mağaza adresi gibi yerler `data-link`/`data-text` attribute'leriyle buradan besleniyor (`js/main.js` → `initSiteLinks()`). Sunucu tarafının ihtiyaç duyduğu künye alanları `api/_lib/merchant.js` içinde kopyalanmıştır; `site-config.js` değişirse orası da güncellenmeli.

Detaylı ilerleme raporu: `docs/RAPOR.md`. Değişiklik günlüğü: `CHANGELOG.md`. Arkadaşın için hazır AI prompt'ları: `docs/ARKADAS-YAPILACAKLAR.md`.

## Ödeme — değiştirmeden önce oku

Ödeme **iyzico Checkout Form** (hosted, yönlendirmeli) ile çalışır. Kurulum ve canlıya çıkış: `docs/IYZICO-ENTEGRASYON.md`. Denetim bulguları: `docs/IYZICO-DENETIM-RAPORU.md`.

Bozulmaması gereken kurallar:

- Bu projede **kart numarası/CVV toplanmaz, taşınmaz, saklanmaz.** Checkout'a kart alanı geri eklenmez.
- **Tutar istemciden alınmaz.** Sunucu, sepeti `api/_lib/catalog.json` üzerinden yeniden fiyatlar; istemciden yalnız `{id, sku, qty}` kabul edilir; renk/beden bilgisi de katalogdan okunur, istemciden gelen metin kullanılmaz. Katalog (fiyat/varyant) değişirse `npm run sync-catalog`.
- **Ödeme sonucu tarayıcıdan gelen veriye göre belirlenmez.** Callback/webhook yalnız tetikleyicidir; sonuç iyzico retrieve yanıtından okunur ve imzası doğrulanır (`api/_lib/settle.js`).
- İmza/tutar/`conversationId` uyuşmazlığında sipariş `pending_review` olur — `failed` veya `paid` yapılmaz, sevkiyat başlamaz.
- Sırlar (`IYZICO_SECRET_KEY`, service account) yalnız sunucu ortam değişkeninde durur; repoya, istemci koduna veya loga girmez.
- Yapılandırma eksikse kart ödemesi kapalı kalır ve checkout EFT'ye düşer ("fail closed"); sahte başarı üretilmez.

Ödeme kütüphanesini değiştirdikten sonra `npm run test:payment` çalıştırılmalı.

## Kök dizin

Proje kök dizini: sayfa HTML'leri (routing gereği taşınamaz), `css/`/`js/`/`assets/`, sunucu tarafı ödeme için `api/` ve `scripts/`, hosting/config dosyaları (`vercel.json`, `firebase.json`, `firestore.rules`, `robots.txt`, `sitemap.xml`, `.gitignore`, `.vercelignore`, `package.json`, `.env.example`, `dev-server.js`) ve `CLAUDE.md`/`CHANGELOG.md`/`README.md` içerir. Rapor/yardımcı doküman `docs/`'a, logo kaynak dosyası `assets/logos/source/`'a taşındı.
