'use strict';

/* =========================================
   /api/admin/products — yönetici ürün yönetimi
   =========================================
   GET    → Firestore'daki ürünler (statik katalog dahil, kaynak bilgisiyle)
   POST   → ürün ekle/güncelle  ({ product: {...} })
   DELETE → ürünü sil           ({ id })  — yalnız Firestore ürünleri

   Neden istemci Firestore'a doğrudan yazmıyor?
   Ürün fiyatı sipariş tutarını belirler. Tarayıcıya yazma izni verilseydi,
   "admin" oturumu ele geçiren biri fiyatı 1 ₺ yapıp sipariş verebilirdi.
   Bu yüzden yazma yalnız Admin SDK ile buradan yapılır; firestore.rules
   `products` koleksiyonunda istemci yazmasını tamamen kapatır.

   `priceKurus` alanı istemciden ALINMAZ, `price` üzerinden burada türetilir
   (api/_lib/product-schema.js).                                            */

const { methodNotAllowed, json, fail, parseBody, rateLimit, clientIp } = require('../_lib/http');
const { adminGate } = require('../_lib/admin-auth');
const { normalizeAdminProduct, CATEGORIES, BADGES } = require('../_lib/product-schema');
const { invalidateCatalog, listStoredProducts } = require('../_lib/catalog-store');
const staticCatalog = require('../_lib/catalog.json');
const store = require('../_lib/store');

const ALLOWED = ['GET', 'POST', 'DELETE'];

module.exports = async (req, res) => {
  if (!ALLOWED.includes(req.method)) return methodNotAllowed(res, ALLOWED);

  const limit = rateLimit(`admin-products:${clientIp(req)}`, { limit: 120, windowMs: 60 * 1000 });
  if (!limit.allowed) return fail(res, 429, 'rate_limited', 'Çok fazla istek gönderildi.');

  const admin = await adminGate(req, res);
  if (!admin) return;

  if (req.method === 'GET')    return listHandler(req, res);
  if (req.method === 'POST')   return saveHandler(req, res, admin);
  return deleteHandler(req, res, admin);
};

async function listHandler(req, res) {
  let stored;
  try {
    stored = await listStoredProducts({ fresh: true });
  } catch (err) {
    console.error('[admin/products] ürünler okunamadı: %s', err.message);
    return fail(res, 503, 'list_failed', 'Ürünler okunamadı. Lütfen tekrar deneyin.');
  }

  /* Statik katalogdaki id'ler panelde "kod içinde tanımlı" olarak işaretlenir;
     düzenlenince Firestore'a bir kopya yazılır ve üzerine biner. */
  const staticIds = staticCatalog.products.map(p => p.id);

  return json(res, 200, {
    ok: true,
    count: stored.length,
    products: stored,
    staticIds,
    categories: CATEGORIES,
    badges: BADGES
  });
}

async function saveHandler(req, res, admin) {
  const body = parseBody(req);
  const result = normalizeAdminProduct(body.product || body);
  if (result.error) return fail(res, 400, 'product_invalid', result.error);

  const product = { ...result.product, updatedBy: admin.email };

  try {
    await store.saveProduct(product);
  } catch (err) {
    console.error('[admin/products] ürün kaydedilemedi (%s): %s', product.id, err.message);
    return fail(res, 503, 'save_failed', 'Ürün kaydedilemedi. Lütfen tekrar deneyin.');
  }

  invalidateCatalog();
  console.log('[admin] ürün kaydedildi: id=%s by=%s', product.id, admin.email);
  return json(res, 200, { ok: true, product });
}

async function deleteHandler(req, res, admin) {
  const body = parseBody(req);
  const id = Number(body.id !== undefined ? body.id : (req.query && req.query.id));

  if (!Number.isInteger(id) || id <= 0) {
    return fail(res, 400, 'invalid_id', 'Silinecek ürün numarası geçersiz.');
  }

  try {
    await store.deleteProduct(id);
  } catch (err) {
    console.error('[admin/products] ürün silinemedi (%s): %s', id, err.message);
    return fail(res, 503, 'delete_failed', 'Ürün silinemedi. Lütfen tekrar deneyin.');
  }

  invalidateCatalog();
  console.log('[admin] ürün silindi: id=%s by=%s', id, admin.email);

  /* Statik katalogda da varsa ürün tamamen kaybolmaz, kod içindeki hâline
     geri döner — bunu panele söylüyoruz ki "silinmedi" sanılmasın. */
  const revertedToStatic = staticCatalog.products.some(p => p.id === id);
  return json(res, 200, { ok: true, id, revertedToStatic });
}
