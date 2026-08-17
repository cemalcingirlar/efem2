#!/usr/bin/env node
/* =========================================
   Yönetici katalog / kupon / görsel testleri
   =========================================
   Gerçek Firestore veya Storage'a bağlanmaz; store katmanı sahtelenir.
   Doğruladıkları:

   - Yetki: token yok → 401, yetkisiz e-posta → 403, ADMIN_EMAILS yok → 503
   - Ürün yazma: priceKurus istemciden alınmaz, `price`ten türetilir
   - Katalog: Firestore ürünü statik listenin üzerine biner ve sipariş
     tutarı ARTIK O FİYATTAN hesaplanır (fiyat otoritesi zinciri)
   - Kupon: indirim sunucuda hesaplanır, kapalı/süresi dolmuş/minimum
     tutarı tutmayan kuponlar reddedilir, indirim sepeti aşamaz
   - Sipariş toplamı kupon uygulandığında düşer
   - Görsel yükleme: içerik türü ilk baytlardan doğrulanır, dosya adı
     sunucuda yeniden üretilir

   Çalıştırma: node scripts/test-admin-catalog.mjs                          */

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

let passed = 0, failed = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passed++; console.log(`  ok   ${name}`); }
  else    { failed++; console.error(`  FAIL ${name}\n       beklenen: ${JSON.stringify(expected)}\n       gelen   : ${JSON.stringify(actual)}`); }
}
function truthy(name, value) { check(name, Boolean(value), true); }

process.env.ORDER_TOKEN_SECRET = 'catalog-test-secret';
process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({
  project_id: 'test', client_email: 't@t.iam.gserviceaccount.com', private_key: 'x'
});
process.env.ADMIN_EMAILS = 'patron@efemiletisim.com';

/* ─── Sahte depo ─── */
const products = new Map();
const coupons  = new Map();
const uploads  = [];
let tokenIdentity = null;

const fakeStore = {
  getStore: () => ({}),
  isStoreConfigured: () => true,
  verifyIdToken: async (header) => (header && tokenIdentity ? tokenIdentity : null),
  listProducts: async () => [...products.values()],
  saveProduct:  async (p) => { products.set(String(p.id), p); },
  deleteProduct: async (id) => { products.delete(String(id)); },
  listCoupons:  async () => [...coupons.values()],
  saveCoupon:   async (c) => { coupons.set(c.code, c); },
  deleteCoupon: async (code) => { coupons.delete(String(code).toUpperCase()); },
  uploadImage:  async (path, buffer, contentType) => {
    uploads.push({ path, bytes: buffer.length, contentType });
    return `https://storage.googleapis.com/test-bucket/${path}`;
  },
  createOrder: async () => {}, getOrder: async () => null, updateOrder: async () => {},
  queueMail: async () => {}, appendOrderToUserProfile: async () => {}
};

require.cache[require.resolve('../api/_lib/store.js')] = {
  id: require.resolve('../api/_lib/store.js'),
  filename: require.resolve('../api/_lib/store.js'),
  loaded: true,
  exports: fakeStore
};

const adminProducts = require('../api/admin/products.js');
const adminCoupons  = require('../api/admin/coupons.js');
const adminUpload   = require('../api/admin/upload.js');
const verifyAdmin   = require('../api/verify-admin.js');
const couponValidate = require('../api/coupon/validate.js');
const { priceBasket } = require('../api/_lib/orders.js');
const { invalidateCatalog } = require('../api/_lib/catalog-store.js');
const { invalidateCoupons } = require('../api/_lib/coupons.js');
const catalog = require('../api/_lib/catalog.json');

const P1   = catalog.products[0];
const SKU1 = P1.variants[0].sku;

function makeRes() {
  return {
    statusCode: 200, headers: {}, body: null,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    status(c) { this.statusCode = c; return this; },
    send(p) { this.body = p; return this; },
    end(p) { if (p !== undefined) this.body = p; return this; }
  };
}

let ipCounter = 0;
async function call(handler, { method = 'GET', body = {}, query = {}, auth = true } = {}) {
  /* Her çağrıya ayrı IP: hız sınırı testleri birbirine karıştırmasın. */
  const ip = `10.1.${Math.floor(ipCounter / 250) % 250}.${(ipCounter++ % 250) + 1}`;
  const headers = { 'x-forwarded-for': ip };
  if (auth) headers.authorization = 'Bearer sahte-token';
  const res = makeRes();
  await handler({ method, body, query, headers, socket: { remoteAddress: ip } }, res);
  let json = null;
  try { json = JSON.parse(res.body); } catch { /* düz metin */ }
  return { res, json };
}

const ADMIN = { uid: 'u1', email: 'patron@efemiletisim.com', emailVerified: true };

/* ═════════════════════════════════════ */
console.log('\n1) yetki kapısı (/api/verify-admin ve /api/admin/*)');
{
  tokenIdentity = null;
  check('token yoksa 401', (await call(verifyAdmin, { method: 'POST', auth: false })).res.statusCode, 401);

  tokenIdentity = { uid: 'u9', email: 'yabanci@gmail.com', emailVerified: true };
  check('yetkisiz e-posta 403', (await call(verifyAdmin, { method: 'POST' })).res.statusCode, 403);

  tokenIdentity = { ...ADMIN, emailVerified: false };
  check('doğrulanmamış e-posta 403', (await call(verifyAdmin, { method: 'POST' })).res.statusCode, 403);

  tokenIdentity = ADMIN;
  const ok = await call(verifyAdmin, { method: 'POST' });
  check('yönetici 200', ok.res.statusCode, 200);
  check('e-posta dönüyor', ok.json.admin.email, 'patron@efemiletisim.com');

  const saved = process.env.ADMIN_EMAILS;
  delete process.env.ADMIN_EMAILS;
  check('ADMIN_EMAILS yoksa 503', (await call(verifyAdmin, { method: 'POST' })).res.statusCode, 503);
  process.env.ADMIN_EMAILS = saved;

  tokenIdentity = null;
  check('ürün ucu da korumalı', (await call(adminProducts, { auth: false })).res.statusCode, 401);
  check('kupon ucu da korumalı', (await call(adminCoupons, { auth: false })).res.statusCode, 401);
  check('yükleme ucu da korumalı', (await call(adminUpload, { method: 'POST', auth: false })).res.statusCode, 401);
  tokenIdentity = ADMIN;
}

/* ═════════════════════════════════════ */
console.log('\n2) ürün kaydetme — fiyat otoritesi sunucuda');
{
  const bad = await call(adminProducts, { method: 'POST', body: { product: { id: 900, name: 'X', category: 'yok', price: 10, images: ['assets/a.png'] } } });
  check('geçersiz kategori 400', bad.res.statusCode, 400);

  const noPrice = await call(adminProducts, { method: 'POST', body: { product: { id: 900, name: 'X', category: 'saat', price: 0, images: ['assets/a.png'] } } });
  check('sıfır fiyat 400', noPrice.res.statusCode, 400);

  const evil = await call(adminProducts, {
    method: 'POST',
    body: { product: { id: 900, name: 'Test Saat', category: 'saat', price: 1999.5, priceKurus: 1, images: ['javascript:alert(1)', 'assets/images/products/x.png'] } }
  });
  check('ürün kaydedildi', evil.res.statusCode, 200);
  check('priceKurus fiyattan türetildi', evil.json.product.priceKurus, 199950);
  check('javascript: görseli atıldı', evil.json.product.images, ['assets/images/products/x.png']);
  check('kategori etiketi eklendi', evil.json.product.categoryLabel, 'Akıllı Saatler');

  const noImage = await call(adminProducts, { method: 'POST', body: { product: { id: 901, name: 'Y', category: 'saat', price: 10, images: ['javascript:x'] } } });
  check('geçerli görsel yoksa 400', noImage.res.statusCode, 400);
}

/* ═════════════════════════════════════ */
console.log('\n3) katalog zinciri — panel fiyatı sipariş tutarını belirler');
{
  invalidateCatalog();
  const before = await priceBasket([{ id: P1.id, sku: SKU1, qty: 1 }]);
  check('statik fiyat', before.totalKurus, P1.priceKurus);

  // Aynı id'yi Firestore'a farklı fiyatla yaz
  await call(adminProducts, {
    method: 'POST',
    body: { product: {
      id: P1.id, name: P1.name, category: 'saat', price: 100,
      images: ['assets/images/products/x.png'],
      variants: P1.variants.map(v => ({ sku: v.sku, color: v.color, size: v.size }))
    } }
  });

  const after = await priceBasket([{ id: P1.id, sku: SKU1, qty: 2 }]);
  check('Firestore fiyatı statik listeyi ezdi', after.totalKurus, 20000);
  truthy('varyant hâlâ tanınıyor', after.lines[0].sku === SKU1);

  // Sil → statik katalog hâline döner
  const del = await call(adminProducts, { method: 'DELETE', body: { id: P1.id } });
  check('silme 200', del.res.statusCode, 200);
  check('statik ürün olduğu bildirildi', del.json.revertedToStatic, true);

  const reverted = await priceBasket([{ id: P1.id, sku: SKU1, qty: 1 }]);
  check('fiyat statik listeye döndü', reverted.totalKurus, P1.priceKurus);
}

/* ═════════════════════════════════════ */
console.log('\n4) kupon tanımı');
{
  const badCode = await call(adminCoupons, { method: 'POST', body: { coupon: { code: 'A B', type: 'fixed', value: 100 } } });
  check('boşluklu kod 400', badCode.res.statusCode, 400);

  const tooMuch = await call(adminCoupons, { method: 'POST', body: { coupon: { code: 'BEDAVA', type: 'percent', value: 99 } } });
  check('%90 üstü indirim 400', tooMuch.res.statusCode, 400);

  const saved = await call(adminCoupons, {
    method: 'POST',
    body: { coupon: { code: 'efem500', label: '500₺ İndirim', type: 'fixed', value: 500, minSubtotal: 5000, enabled: true } }
  });
  check('kupon kaydedildi', saved.res.statusCode, 200);
  check('kod büyük harfe çevrildi', saved.json.coupon.code, 'EFEM500');
  check('tutar kuruşa çevrildi', coupons.get('EFEM500').value, 50000);
  check('minimum sepet kuruşa çevrildi', coupons.get('EFEM500').minSubtotalKurus, 500000);

  const list = await call(adminCoupons);
  check('listede bir kupon', list.json.count, 1);
  check('panelde ₺ olarak gösteriliyor', list.json.coupons[0].value, 500);
}

/* ═════════════════════════════════════ */
console.log('\n5) kupon uygulaması — indirim sunucuda hesaplanır');
{
  invalidateCoupons();
  const base = await priceBasket([{ id: P1.id, sku: SKU1, qty: 1 }]);

  const withCoupon = await priceBasket([{ id: P1.id, sku: SKU1, qty: 1 }], { couponCode: 'efem500' });
  check('indirim uygulandı', withCoupon.discountKurus, 50000);
  check('toplam düştü', withCoupon.totalKurus, base.totalKurus - 50000);
  check('kupon kaydı döndü', withCoupon.coupon.code, 'EFEM500');

  check('bilinmeyen kupon reddedilir',
    (await priceBasket([{ id: P1.id, sku: SKU1, qty: 1 }], { couponCode: 'YOKBOYLE' })).error,
    'Geçersiz kupon kodu.');

  check('kupon kodu boşsa indirim yok',
    (await priceBasket([{ id: P1.id, sku: SKU1, qty: 1 }], { couponCode: '' })).discountKurus, 0);

  // Kapatılınca kullanılamaz
  await call(adminCoupons, { method: 'POST', body: { coupon: { code: 'EFEM500', type: 'fixed', value: 500, minSubtotal: 5000, enabled: false } } });
  invalidateCoupons();
  check('kapalı kupon reddedilir',
    (await priceBasket([{ id: P1.id, sku: SKU1, qty: 1 }], { couponCode: 'EFEM500' })).error,
    'Bu kupon şu anda kullanıma kapalı.');

  // Süresi dolmuş
  await call(adminCoupons, { method: 'POST', body: { coupon: { code: 'ESKI', type: 'percent', value: 10, enabled: true, expiresAt: '2020-01-01' } } });
  invalidateCoupons();
  check('süresi dolmuş kupon reddedilir',
    (await priceBasket([{ id: P1.id, sku: SKU1, qty: 1 }], { couponCode: 'ESKI' })).error,
    'Bu kuponun süresi dolmuş.');

  // Minimum sepet tutmuyor
  await call(adminCoupons, { method: 'POST', body: { coupon: { code: 'BUYUK', type: 'fixed', value: 100, minSubtotal: 999999, enabled: true } } });
  invalidateCoupons();
  truthy('minimum sepet altı reddedilir',
    /en az/.test((await priceBasket([{ id: P1.id, sku: SKU1, qty: 1 }], { couponCode: 'BUYUK' })).error || ''));

  // Sabit indirim 100.000 ₺ üstü olamaz (panel doğrulaması)
  check('aşırı sabit indirim 400',
    (await call(adminCoupons, { method: 'POST', body: { coupon: { code: 'DEVASA', type: 'fixed', value: 999999, enabled: true } } })).res.statusCode,
    400);

  // İndirim ara toplamı yiyorsa sipariş oluşmaz (0 ₺ tahsil edilemez)
  await call(adminCoupons, { method: 'POST', body: { coupon: { code: 'HEPSI', type: 'fixed', value: 100000, enabled: true } } });
  invalidateCoupons();
  const clamped = await priceBasket([{ id: P1.id, sku: SKU1, qty: 1 }], { couponCode: 'HEPSI' });
  check('indirim sepetin tamamını yerse reddedilir', clamped.error,
    'Bu kupon sepet tutarının tamamını karşılıyor; sipariş tutarı sıfır olamaz.');

  // Yüzde indirim
  await call(adminCoupons, { method: 'POST', body: { coupon: { code: 'YUZDE10', type: 'percent', value: 10, enabled: true } } });
  invalidateCoupons();
  const pct = await priceBasket([{ id: P1.id, sku: SKU1, qty: 1 }], { couponCode: 'YUZDE10' });
  check('yüzde indirim doğru', pct.discountKurus, Math.round(base.subtotalKurus * 0.1));
}

/* ═════════════════════════════════════ */
console.log('\n6) /api/coupon/validate — herkese açık uç');
{
  invalidateCoupons();
  const ok = await call(couponValidate, {
    method: 'POST', auth: false,
    body: { code: 'yuzde10', items: [{ id: P1.id, sku: SKU1, qty: 1 }] }
  });
  check('geçerli kupon 200', ok.res.statusCode, 200);
  truthy('indirim tutarı döndü', ok.json.discountKurus > 0);

  const nope = await call(couponValidate, {
    method: 'POST', auth: false,
    body: { code: 'YOKBOYLE', items: [{ id: P1.id, sku: SKU1, qty: 1 }] }
  });
  check('geçersiz kupon 400', nope.res.statusCode, 400);

  const empty = await call(couponValidate, { method: 'POST', auth: false, body: { code: '', items: [] } });
  check('kod boşsa 400', empty.res.statusCode, 400);
}

/* ═════════════════════════════════════ */
console.log('\n7) görsel yükleme');
{
  const png = Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    Buffer.alloc(64, 1)
  ]);

  const fake = await call(adminUpload, {
    method: 'POST',
    body: { fileName: '../../etc/passwd.png', contentType: 'image/png', data: Buffer.from('<html>merhaba dunya</html>').toString('base64') }
  });
  check('görsel olmayan içerik 415', fake.res.statusCode, 415);

  const ok = await call(adminUpload, {
    method: 'POST',
    body: { fileName: '../../etc/passwd.png', data: `data:image/png;base64,${png.toString('base64')}` }
  });
  check('png yüklendi', ok.res.statusCode, 201);
  truthy('URL döndü', /^https:\/\/storage\.googleapis\.com\//.test(ok.json.url));
  truthy('yol products/ altında', ok.json.path.startsWith('products/'));
  check('dizin geçişi yok', ok.json.path.includes('..'), false);
  check('içerik türü baytlardan okundu', ok.json.contentType, 'image/png');

  const empty = await call(adminUpload, { method: 'POST', body: { fileName: 'a.png', data: '' } });
  check('boş dosya 400', empty.res.statusCode, 400);
}

console.log(`\n${passed} test geçti, ${failed} test başarısız.`);
process.exit(failed ? 1 : 0);
