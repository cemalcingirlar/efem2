'use strict';

/* =========================================
   sitemap.xml içeriği
   =========================================
   Sitemap eskiden derleme anında üretilen statik bir dosyaydı ve tüm
   ürünleri listeliyordu. Sorun: "satıştan kaldır" durumu Firestore'da
   tutuluyor, statik katalogda değil. Sonuçta satıştan kaldırılmış ürünler
   de arama motorlarına bildiriliyor, tıklayan ziyaretçi (ve tarayıcı bot)
   ürün listesine geri atılıyordu — yumuşak 404.

   Bu yüzden sitemap artık çalışma anında, canlı katalogdan üretiliyor
   (bkz. api/sitemap.js). Sabit sayfa listesi burada tek yerde durur.      */

const BASE = 'https://efemiletisim.com';

/* [yol, güncellenme sıklığı, öncelik] */
const SABIT_SAYFALAR = [
  ['/',                              'daily',   '1.0'],
  ['/urunler.html',                  'daily',   '0.9'],
  ['/hakkimizda.html',               'monthly', '0.6'],
  ['/gizlilik-kvkk.html',            'yearly',  '0.3'],
  ['/on-bilgilendirme-formu.html',   'yearly',  '0.3'],
  ['/mesafeli-satis-sozlesmesi.html','yearly',  '0.3'],
  ['/iptal-iade.html',               'yearly',  '0.3']
];

function girdi(loc, freq, pri) {
  return `  <url>\n    <loc>${BASE}${loc}</loc>\n    <changefreq>${freq}</changefreq>\n    <priority>${pri}</priority>\n  </url>`;
}

/* Verilen ürün id'leriyle sitemap XML'i üretir.
   id'ler sayıya çevrilir ve sıralanır: sayfa sırası kararlı olsun. */
function buildSitemap(productIds) {
  const urunler = [...new Set((productIds || []).map(Number).filter(Number.isInteger))]
    .sort((a, b) => a - b);

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...SABIT_SAYFALAR.map(([l, f, p]) => girdi(l, f, p)),
    ...urunler.map(id => girdi(`/urun-detay.html?id=${id}`, 'weekly', '0.8')),
    '</urlset>',
    ''
  ].join('\n');
}

module.exports = { BASE, SABIT_SAYFALAR, buildSitemap };
