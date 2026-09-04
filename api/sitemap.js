'use strict';

/* GET /sitemap.xml  (vercel.json → /api/sitemap)
   =============================================
   Sitemap canlı katalogdan üretilir; satıştan kaldırılmış ürünler girmez.

   Neden statik dosya değil: "satıştan kaldır" durumu Firestore'da tutuluyor,
   derleme anında üretilen statik katalogda değil. Statik sitemap 54 ürünün
   tamamını bildiriyordu; satıştan kaldırılmış 19 ürünün sayfası ziyaretçiyi
   ürün listesine geri attığı için bunlar arama motoru gözünde yumuşak 404'tü.

   Katalog okunamazsa statik katalogla devam edilir: sitemap hiç dönmemesi,
   fazladan ürün bildirmesinden daha kötü. Bu, önceki davranışın aynısıdır. */

const { methodNotAllowed } = require('./_lib/http');
const { listActiveProducts } = require('./_lib/catalog-store');
const { buildSitemap } = require('./_lib/sitemap');
const staticCatalog = require('./_lib/catalog.json');

module.exports = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return methodNotAllowed(res, ['GET', 'HEAD']);

  let ids;
  let kaynak;
  try {
    const { products, source } = await listActiveProducts();
    ids = products.map(p => p.id);
    kaynak = source;
  } catch (err) {
    ids = staticCatalog.products.filter(p => p.active !== false).map(p => p.id);
    kaynak = 'static_fallback';
    console.error('[sitemap] katalog okunamadı, statik listeye düşüldü: %s', err.message);
  }

  const xml = buildSitemap(ids);

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  /* Tarayıcı botları için 1 saat önbellek yeterli; /api/(.*) altındaki
     no-store başlığı burada bilinçli olarak geçersiz kılınıyor. */
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
  res.setHeader('X-Sitemap-Source', kaynak);

  if (req.method === 'HEAD') { res.end(); return; }
  res.end(xml);
};
