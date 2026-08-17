/* =========================================
   Tema başlangıcı (FOUC önleyici)
   =========================================
   CSS'ten önce, sayfa boyanmadan çalışması gerekir; bu yüzden <head>
   içinde ve senkron yüklenir.

   Ayrı bir dosya olmasının sebebi güvenlik: ödeme sayfası (odeme-guvenli.html)
   'unsafe-inline' içermeyen sıkı bir Content-Security-Policy ile servis
   ediliyor, orada satır içi <script> bloğu çalışmaz.                        */

(function () {
  try {
    var t = localStorage.getItem('efemi_theme');
    if (!t) {
      t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', t);
  } catch (e) { /* localStorage kapalıysa varsayılan tema kullanılır */ }
})();
