# efemiletisim.com — proje notları

Design direction: high-end-visual-design

Ana renk korunuyor: `--primary: #2563EB` (bkz. `css/main.css`). Tasarım yükseltmesi bu rengi değiştirmeden yapılıyor.

Kurumsal bilgi tek kaynak: `js/site-config.js`. Footer, hakkımızda, ödeme sayfası mağaza adresi gibi yerler `data-link`/`data-text` attribute'leriyle buradan besleniyor (`js/main.js` → `initSiteLinks()`).

Detaylı ilerleme raporu: `docs/RAPOR.md`. Değişiklik günlüğü: `CHANGELOG.md`. Arkadaşın için hazır AI prompt'ları: `docs/ARKADAS-YAPILACAKLAR.md`.

Proje kök dizini sadece: sayfa HTML'leri (routing gereği taşınamaz), `css/`/`js/`/`assets/`, hosting/config dosyaları (`vercel.json`, `firebase.json`, `firestore.rules`, `robots.txt`, `sitemap.xml`, `.gitignore`) ve `CLAUDE.md`/`CHANGELOG.md` içerir. Rapor/yardımcı doküman `docs/`'a, logo kaynak dosyası `assets/logos/source/`'a taşındı.
