'use strict';

/* =========================================
   GET /api/catalog — vitrin kataloğu (herkese açık)
   =========================================
   Admin panelinden Firestore'a yazılan ürünleri istemciye verir.
   `js/data.js` bu listeyi BASE_PRODUCTS üzerine bindirir: aynı id →
   Firestore kazanır, yeni id → listeye eklenir.

   Neden istemci Firestore'u doğrudan okumuyor?
   - Firebase istemci SDK'sı ürün listesi için ek bir ağ katmanı ve
     bundle yükü getirir; site geri kalanı saf statik.
   - Aynı uç, sunucu yapılandırılmamışsa BOŞ liste döner ve site statik
     katalogla sorunsuz çalışmaya devam eder (fail soft).
   - Okuma herkese açık olduğu için burada yetki aranmaz; yazma yalnızca
     /api/admin/products üzerinden ve yönetici doğrulamasıyla yapılır.

   ── /sitemap.xml de buradan çıkar (?format=sitemap) ──
   Sitemap ayrı bir uç (api/sitemap.js) olarak yazılmıştı ama Vercel Hobby
   planında deploy başına en fazla 12 Serverless Function var; proje tam
   12'deydi, 13'üncü fonksiyon deploy'u komple düşürdü
   (errorCode: exceeded_serverless_functions_per_deployment).

   Sitemap zaten bu ucun hesapladığı "satıştaki ürünler" listesinden başka
   bir şeye ihtiyaç duymuyor. Ayrı fonksiyon yerine aynı ucun ikinci çıktı
   biçimi olması hem limiti aşmıyor hem de tek bir okuma yolu bırakıyor.
   Yeni bir uç eklemek gerekirse önce fonksiyon sayısına bakın.            */

const { methodNotAllowed, json } = require('./_lib/http');
const { listStoredProducts } = require('./_lib/catalog-store');
const { buildSitemap } = require('./_lib/sitemap');
const staticCatalog = require('./_lib/catalog.json');
const store = require('./_lib/store');

/* Vitrin verisi sık değişmez; CDN'de kısa süre tutulur, arkada tazelenir. */
const CACHE_HEADER = 'public, max-age=60, s-maxage=60, stale-while-revalidate=300';

/* Sitemap'i tarayıcı botları saatte birden sık çekmez. */
const SITEMAP_CACHE_HEADER = 'public, max-age=3600, s-maxage=3600';

module.exports = async (req, res) => {
  const sitemapIstendi = String(req.query?.format || '') === 'sitemap';

  /* Sitemap HEAD isteğine de yanıt vermeli; bazı botlar önce HEAD atar. */
  const izinli = sitemapIstendi ? ['GET', 'HEAD'] : ['GET'];
  if (!izinli.includes(req.method)) return methodNotAllowed(res, izinli);

  let products = null;
  let kaynak = 'firestore';

  if (!store.isStoreConfigured()) {
    kaynak = 'static';
  } else {
    try {
      products = await listStoredProducts();
    } catch (err) {
      /* Katalog okunamazsa site çökmemeli: istemci statik listeyle devam eder. */
      console.error('[catalog] ürünler okunamadı: %s', err.message);
      kaynak = 'degraded';
    }
  }

  if (sitemapIstendi) return sendSitemap(req, res, products, kaynak);

  if (!products) {
    return send(res, kaynak === 'degraded'
      ? { ok: true, source: 'static', count: 0, products: [], hiddenIds: [], degraded: true }
      : { ok: true, source: 'static', count: 0, products: [], hiddenIds: [] });
  }

  const active = products.filter(p => p.active !== false);

  /* Satıştan kaldırılan ürünlerin id'leri ayrıca bildirilir.
     Neden gerekli: istemci (js/data.js) statik BASE_PRODUCTS üzerine bu
     listeyi biner. Pasif ürün yanıttan çıkarılınca statik kayıt ayakta
     kalır ve ürün vitrinde görünmeye devam ederdi. */
  const hiddenIds = products.filter(p => p.active === false).map(p => Number(p.id));

  return send(res, { ok: true, source: 'firestore', count: active.length, products: active, hiddenIds });
};

/* Sitemap'e girecek ürün id'leri.

   Vitrin (js/data.js) statik BASE_PRODUCTS üzerine Firestore listesini
   biniyor: aynı id → Firestore kazanır, Firestore'da HİÇ kaydı olmayan
   statik ürün listede kalır. Sitemap yalnız Firestore'u okusaydı, panelden
   hiç kaydedilmemiş ürünler (müşteri onları görüyor ve satın alabiliyor)
   sitemap'e girmezdi — ölçüldü: vitrin 35 ürün, sitemap 31.

   Bu yüzden aynı birleştirme burada da yapılıyor:
     - Firestore'da satışta olanlar,
     - artı Firestore'da hiç kaydı olmayan statik ürünler.
   Firestore'da satıştan KALDIRILMIŞ bir ürün, statik katalogda dursa bile
   girmez; kaldırma kararı her zaman kazanır. */
function sitemapIdleri(products) {
  const kayitli = new Set(products.map(p => Number(p.id)));
  const satistakiler = products.filter(p => p.active !== false).map(p => Number(p.id));
  const yalnizStatik = staticCatalog.products
    .map(p => Number(p.id))
    .filter(id => !kayitli.has(id));

  return [...satistakiler, ...yalnizStatik];
}

/* ─── /sitemap.xml ───
   Sitemap canlı katalogdan üretilir; satıştan kaldırılmış ürün girmez.

   Neden derleme anında üretilen statik dosya değil: "satıştan kaldır"
   durumu Firestore'da tutuluyor. Statik sitemap 54 ürünün tamamını
   bildiriyordu; satıştan kaldırılmış ürünlerin sayfası ziyaretçiyi ürün
   listesine geri attığı için bunlar arama motoru gözünde yumuşak 404'tü.

   Katalog okunamazsa statik listeyle devam edilir: sitemap'in hiç dönmemesi,
   fazladan ürün bildirmesinden daha kötüdür. X-Sitemap-Source hangi kaynağın
   kullanıldığını söyler.                                                  */
function sendSitemap(req, res, products, kaynak) {
  const ids = products ? sitemapIdleri(products) : staticCatalog.products.map(p => p.id);

  const xml = buildSitemap(ids);

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  /* /api/(.*) altındaki no-store başlığı burada bilinçli olarak eziliyor. */
  res.setHeader('Cache-Control', SITEMAP_CACHE_HEADER);
  res.setHeader('X-Sitemap-Source', products ? kaynak : (kaynak === 'firestore' ? 'static' : kaynak));

  if (req.method === 'HEAD') return res.status(200).send('');
  return res.status(200).send(xml);
}

function send(res, payload) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', CACHE_HEADER);
  res.status(200).send(JSON.stringify(payload));
}
