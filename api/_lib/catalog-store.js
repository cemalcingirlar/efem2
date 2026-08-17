'use strict';

/* =========================================
   Ürün kataloğu: Firestore + statik yedek
   =========================================
   Katalogun iki kaynağı var:

   1) `api/_lib/catalog.json` — js/data.js'ten üretilen statik liste.
      Sunucu yapılandırılmamışsa (Firebase yoksa) tek kaynak budur;
      site böyle bir kurulumda da sipariş alabilir.
   2) Firestore `products` koleksiyonu — admin panelinden yönetilen ürünler.
      Varsa statik listenin ÜZERİNE yazılır (aynı id → Firestore kazanır),
      yeni id'ler listeye eklenir.

   Fiyat otoritesi hâlâ sunucudadır: istemci yalnız {id, sku, qty} gönderir,
   tutar buradaki fiyatlarla hesaplanır. Bu yüzden admin panelinden eklenen
   bir ürün, sipariş edilebilmesi için MUTLAKA buraya da yansımalıdır —
   `catalog.json` tek başına bırakılırsa yeni ürünler "satışta değil" hatası
   verirdi.

   Serverless örneği kısa yaşadığı için önbellek ömrü kısa tutulur. */

const staticCatalog = require('./catalog.json');
const store = require('./store');

const CACHE_TTL_MS = 60 * 1000;

let cache = null;        // { products: Map<id, product>, source, loadedAt }
let inflight = null;

/* Firestore dokümanını sunucunun beklediği şekle getirir; eksik/bozuk
   alanlar sessizce atlanır (yanlış fiyatla sipariş almaktansa ürünü hiç
   listelememek yeğdir). */
function normalizeProduct(raw) {
  const id = Number(raw && raw.id);
  const priceKurus = Number(raw && raw.priceKurus);
  if (!Number.isInteger(id) || !Number.isFinite(priceKurus) || priceKurus <= 0) return null;

  const variants = Array.isArray(raw.variants)
    ? raw.variants
        .map(v => ({
          sku:   String(v && v.sku || '').trim(),
          color: v && v.color ? String(v.color) : '',
          size:  v && v.size ? String(v.size) : ''
        }))
        .filter(v => v.sku)
    : [];

  return {
    id,
    name:       String(raw.name || `Ürün ${id}`),
    category:   String(raw.category || 'Aksesuar'),
    brand:      String(raw.brand || ''),
    priceKurus: Math.round(priceKurus),
    itemType:   'PHYSICAL',
    variants,
    active:     raw.active !== false
  };
}

function baseMap() {
  const map = new Map();
  for (const p of staticCatalog.products) map.set(p.id, { ...p, active: true });
  return map;
}

/* Katalogu döndürür: Map<id, product>. Firestore erişilemezse statik listeye
   düşer — ödeme akışı asla katalog yüzünden tamamen durmaz. */
async function loadCatalog() {
  const now = Date.now();
  if (cache && now - cache.loadedAt < CACHE_TTL_MS) return cache;
  if (inflight) return inflight;

  inflight = (async () => {
    const products = baseMap();
    let source = 'static';

    if (store.isStoreConfigured()) {
      try {
        const docs = await store.listProducts();
        let applied = 0;
        for (const doc of docs) {
          const product = normalizeProduct(doc);
          if (!product) continue;
          products.set(product.id, product);
          applied++;
        }
        source = applied > 0 ? 'firestore+static' : 'static';
      } catch (err) {
        console.error('[catalog] Firestore ürünleri okunamadı, statik listeye düşüldü: %s', err.message);
      }
    }

    cache = { products, source, loadedAt: Date.now() };
    inflight = null;
    return cache;
  })();

  return inflight;
}

/* Admin bir ürünü değiştirdiğinde önbelleği hemen düşür. */
function invalidateCatalog() {
  cache = null;
  rawCache = null;
}

/* ─── Firestore ürün dokümanlarının TAMAMI ───
   loadCatalog() yalnız ödeme için gereken alanları tutar (id, fiyat, varyant).
   Vitrin tarafı ise görsel/açıklama/teknik özellik gibi alanların hepsine
   ihtiyaç duyar; bu yüzden ham dokümanlar ayrı ve kısa ömürlü bir önbellekte
   saklanır. Firestore erişilemezse boş liste döner — site statik katalogla
   çalışmayı sürdürür. */
let rawCache = null;

async function listStoredProducts({ fresh = false } = {}) {
  const now = Date.now();
  if (!fresh && rawCache && now - rawCache.loadedAt < CACHE_TTL_MS) return rawCache.products;
  if (!store.isStoreConfigured()) return [];

  const products = (await store.listProducts())
    .filter(p => p && Number.isInteger(Number(p.id)))
    .sort((a, b) => Number(a.id) - Number(b.id));

  rawCache = { products, loadedAt: Date.now() };
  return products;
}

async function getProduct(id) {
  const { products } = await loadCatalog();
  const product = products.get(Number(id));
  return product && product.active !== false ? product : null;
}

async function listActiveProducts() {
  const { products, source } = await loadCatalog();
  return {
    source,
    products: [...products.values()].filter(p => p.active !== false).sort((a, b) => a.id - b.id)
  };
}

module.exports = {
  loadCatalog, invalidateCatalog, getProduct, listActiveProducts,
  normalizeProduct, listStoredProducts
};
