#!/usr/bin/env node
/* =========================================
   Stok testleri — varyant stoğu ve sipariş sonrası düşme
   =========================================
   Gerçek Firestore'a bağlanmaz; `db` katmanı bellekte taklit edilir.
   Doğruladıkları:

   - Yönetici varyant stoğu kaydedebiliyor (ürün stoğu varyant TOPLAMI)
   - Varyantlarda stok yoksa ürün stoğu 0 olur — 2026-09-02'de düzeltilen
     hata buydu, regresyon testi olarak duruyor
   - Sipariş ödendiğinde doğru varyantın stoğu düşer, ürün toplamı yeniden
     hesaplanır
   - Stok negatife inmez; yetersizlik siparişi iptal etmez, `shortages` ile
     raporlanır (ödeme çoktan alınmıştır)
   - Aynı üründen birden çok satır tek dokümanda toplanır
   - Varyantsız üründe ürün stoğu düşer
   - Bilinmeyen sku / olmayan ürün raporlanır, diğer satırları bozmaz

   Çalıştırma: node scripts/test-stock.mjs                                  */

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

let passed = 0, failed = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passed++; console.log(`  ok   ${name}`); }
  else    { failed++; console.error(`  FAIL ${name}\n       beklenen: ${JSON.stringify(expected)}\n       gelen   : ${JSON.stringify(actual)}`); }
}

process.env.ORDER_TOKEN_SECRET = 'stock-test-secret';
process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({
  project_id: 'test', client_email: 't@t.iam.gserviceaccount.com', private_key: 'x'
});

/* ─── Bellekte Firestore taklidi ───
   decrementStock transaction kullanıyor: tüm okumalar yazımlardan önce
   yapılmalı. Bu taklit de aynı sırayı bekler. */
const docs = new Map();                       // "products/1" -> veri

function makeDb() {
  return {
    collection: (name) => ({
      doc: (id) => ({ _path: `${name}/${id}` })
    }),
    async runTransaction(fn) {
      const yazimlar = [];
      const tx = {
        async get(ref) {
          const veri = docs.get(ref._path);
          return { exists: veri !== undefined, data: () => JSON.parse(JSON.stringify(veri)) };
        },
        update(ref, patch) { yazimlar.push([ref._path, patch]); }
      };
      const sonuc = await fn(tx);
      for (const [path, patch] of yazimlar) {
        const { updatedAt, ...temiz } = patch;
        docs.set(path, { ...docs.get(path), ...temiz });
      }
      return sonuc;
    }
  };
}

const fakeStoreInternals = { db: makeDb(), FieldValue: { serverTimestamp: () => 'TS' } };

/* firebase-admin kurulu değil ve store.js onu getStore() içinde tembel
   yüklüyor. Modül yükleyiciyi yönlendirip bellekteki taklidi veriyoruz;
   böylece decrementStock GERÇEK kodu ile, gerçek transaction sırasıyla
   (tüm okumalar yazımlardan önce) çalışır. */
const Module = require('node:module');
const origLoad = Module._load;
const fakeAdmin = {
  apps: [],
  app: () => ({}),
  initializeApp: () => ({}),
  credential: { cert: () => ({}) },
  firestore: Object.assign(() => fakeStoreInternals.db, { FieldValue: fakeStoreInternals.FieldValue }),
  auth: () => ({})
};
Module._load = function (request, ...rest) {
  if (request === 'firebase-admin') return fakeAdmin;
  return origLoad.call(this, request, ...rest);
};

const { normalizeAdminProduct } = require('../api/_lib/product-schema.js');
const storeModule = require('../api/_lib/store.js');

function seed(id, variants, stock) {
  docs.set(`products/${id}`, {
    id, name: `Ürün ${id}`, priceKurus: 100000, active: true,
    variants: variants ? JSON.parse(JSON.stringify(variants)) : undefined,
    stock: stock !== undefined ? stock : (variants ? variants.reduce((s, v) => s + v.stock, 0) : 0)
  });
}
const oku = (id) => docs.get(`products/${id}`);

/* ══════════════════════════════════════ */
console.log('\n1) ürün şeması — stok varyant toplamından türetilir');
{
  const temel = { id: 1, name: 'Watch', category: 'saat', brand: 'Apple', price: 100,
                  images: ['assets/images/products/a.jpg'] };

  const stoksuz = normalizeAdminProduct({ ...temel, stock: 2, variants: [
    { sku: 'A', color: 'Siyah' }, { sku: 'B', color: 'Beyaz' }
  ]});
  check('varyantlarda stok yoksa ürün stoğu 0 (düzeltilen hata)', stoksuz.product.stock, 0);

  const stoklu = normalizeAdminProduct({ ...temel, stock: 999, variants: [
    { sku: 'A', color: 'Siyah', size: 'S/M', stock: 2 },
    { sku: 'B', color: 'Beyaz', size: 'M/L', stock: 10 }
  ]});
  check('ürün stoğu varyant toplamı (2+10)', stoklu.product.stock, 12);
  check('tekil alan yok sayılır (999 değil)', stoklu.product.stock !== 999, true);
  check('varyant stokları korunur', stoklu.product.variants.map(v => v.stock), [2, 10]);
  check('renk/beden korunur', stoklu.product.variants[0], { sku: 'A', color: 'Siyah', size: 'S/M', stock: 2 });

  const tekil = normalizeAdminProduct({ ...temel, stock: 7, variants: [] });
  check('varyantsız üründe tekil stok çalışır', tekil.product.stock, 7);
}

console.log('\n2) sipariş sonrası stok düşer');
{
  docs.clear();
  seed(1, [
    { sku: '1422880', color: 'Jet Siyah', size: 'S/M', stock: 10 },
    { sku: '1422884', color: 'Roze Altın', size: 'S/M', stock: 10 }
  ]);

  const r = await storeModule.decrementStock([{ id: 1, sku: '1422880', qty: 3 }]);
  check('işlem uygulandı', r.applied, true);
  check('doğru varyant düştü (10-3)', oku(1).variants[0].stock, 7);
  check('diğer varyant değişmedi', oku(1).variants[1].stock, 10);
  check('ürün toplamı yeniden hesaplandı', oku(1).stock, 17);
  check('eksik yok', r.shortages, []);
}

console.log('\n3) aynı üründen birden çok satır');
{
  docs.clear();
  seed(2, [
    { sku: 'S1', color: 'Siyah', stock: 5 },
    { sku: 'S2', color: 'Beyaz', stock: 5 }
  ]);

  await storeModule.decrementStock([
    { id: 2, sku: 'S1', qty: 2 },
    { id: 2, sku: 'S2', qty: 1 }
  ]);
  check('birinci varyant 5-2', oku(2).variants[0].stock, 3);
  check('ikinci varyant 5-1', oku(2).variants[1].stock, 4);
  check('toplam 7', oku(2).stock, 7);
}

console.log('\n4) stok negatife inmez, eksik raporlanır');
{
  docs.clear();
  seed(3, [{ sku: 'T1', color: 'Siyah', stock: 2 }]);

  const r = await storeModule.decrementStock([{ id: 3, sku: 'T1', qty: 5 }]);
  check('stok 0\'da durur', oku(3).variants[0].stock, 0);
  check('ürün toplamı 0', oku(3).stock, 0);
  check('eksiklik raporlandı', r.shortages.length, 1);
  check('eksiklik ayrıntısı', r.shortages[0].reason, 'insufficient_stock');
  check('kaç adet düşülebildi', r.shortages[0].dusen, 2);
}

console.log('\n5) varyantsız ürün');
{
  docs.clear();
  docs.set('products/4', { id: 4, name: 'Adaptör', priceKurus: 100000, stock: 6, active: true });

  await storeModule.decrementStock([{ id: 4, qty: 2 }]);
  check('ürün stoğu düştü (6-2)', oku(4).stock, 4);
  check('varyant alanı eklenmedi', oku(4).variants, undefined);
}

console.log('\n6) hatalı satırlar diğerlerini bozmaz');
{
  docs.clear();
  seed(5, [{ sku: 'X1', color: 'Siyah', stock: 8 }]);

  const r = await storeModule.decrementStock([
    { id: 5, sku: 'YOK', qty: 1 },       // bilinmeyen sku
    { id: 99, sku: 'X1', qty: 1 },       // olmayan ürün
    { id: 5, sku: 'X1', qty: 3 }         // geçerli
  ]);
  check('geçerli satır işlendi (8-3)', oku(5).variants[0].stock, 5);
  check('iki sorun raporlandı', r.shortages.length, 2);
  check('sebepler', r.shortages.map(s => s.reason).sort(), ['product_not_found', 'variant_not_found']);
}

console.log('\n7) geçersiz girdi');
{
  docs.clear();
  seed(6, [{ sku: 'Z1', color: 'Siyah', stock: 4 }]);

  check('boş liste', (await storeModule.decrementStock([])).applied, false);
  check('null', (await storeModule.decrementStock(null)).applied, false);
  await storeModule.decrementStock([{ id: 6, sku: 'Z1', qty: 0 }]);
  check('qty 0 stoğu değiştirmez', oku(6).variants[0].stock, 4);
  await storeModule.decrementStock([{ id: 6, sku: 'Z1', qty: -5 }]);
  check('negatif qty stoğu artırmaz', oku(6).variants[0].stock, 4);
}

console.log('\n8) satıştan kaldırma — ödeme kataloğu pasif ürünü vermez');
{
  const catalogStore = require('../api/_lib/catalog-store.js');

  /* active:false olan Firestore kaydı statik kaydın ÜZERİNE biner; böylece
     kod içinde tanımlı bir ürün de satıştan kaldırılabilir. */
  const pasif = catalogStore.normalizeProduct({
    id: 1, name: 'Kaldırılmış', priceKurus: 100000, active: false,
    variants: [{ sku: 'A', color: 'Siyah' }]
  });
  check('normalizeProduct active:false taşır', pasif.active, false);

  const aktif = catalogStore.normalizeProduct({ id: 2, name: 'Satılan', priceKurus: 100000, variants: [] });
  check('active verilmezse ürün satıştadır', aktif.active, true);
}

console.log('\n9) ürün şeması active alanını korur');
{
  const temel = {
    id: 1, name: 'Watch', category: 'saat', brand: 'Apple', price: 100,
    images: ['assets/images/products/a.jpg'],
    variants: [{ sku: 'A', color: 'Siyah', stock: 3 }]
  };

  check('active:false yazılabilir', normalizeAdminProduct({ ...temel, active: false }).product.active, false);
  check('active:true geri alınabilir', normalizeAdminProduct({ ...temel, active: true }).product.active, true);
  check('active verilmezse satışta', normalizeAdminProduct({ ...temel }).product.active, true);
  check('satıştan kaldırmak stoğu silmez', normalizeAdminProduct({ ...temel, active: false }).product.variants[0].stock, 3);
}

console.log(`\n${passed} test geçti, ${failed} test başarısız.`);
process.exit(failed ? 1 : 0);
