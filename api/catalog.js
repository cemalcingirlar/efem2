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
     /api/admin/products üzerinden ve yönetici doğrulamasıyla yapılır.  */

const { methodNotAllowed, json } = require('./_lib/http');
const { listStoredProducts } = require('./_lib/catalog-store');
const store = require('./_lib/store');

/* Vitrin verisi sık değişmez; CDN'de kısa süre tutulur, arkada tazelenir. */
const CACHE_HEADER = 'public, max-age=60, s-maxage=60, stale-while-revalidate=300';

module.exports = async (req, res) => {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

  if (!store.isStoreConfigured()) {
    return send(res, { ok: true, source: 'static', count: 0, products: [] });
  }

  let products;
  try {
    products = await listStoredProducts();
  } catch (err) {
    /* Katalog okunamazsa site çökmemeli: istemci statik listeyle devam eder. */
    console.error('[catalog] ürünler okunamadı: %s', err.message);
    return send(res, { ok: true, source: 'static', count: 0, products: [], degraded: true });
  }

  const active = products.filter(p => p.active !== false);
  return send(res, { ok: true, source: 'firestore', count: active.length, products: active });
};

function send(res, payload) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', CACHE_HEADER);
  res.status(200).send(JSON.stringify(payload));
}
