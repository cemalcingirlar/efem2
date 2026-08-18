'use strict';

/* =========================================
   Ürün şeması (admin → Firestore)
   =========================================
   Admin panelinden gelen ürün verisi doğrudan Firestore'a yazılmaz; önce
   burada temizlenir. İki sebeple:

   1) Fiyat otoritesi sunucudadır. `priceKurus` alanı BURADA `price`ten
      hesaplanır; istemcinin gönderdiği bir priceKurus dikkate alınmaz.
      Ödeme akışı (api/_lib/orders.js → priceBasket) yalnız bu alanı okur,
      yani panelde girilen fiyat ile tahsil edilen tutar aynı olur.
   2) Serbest metinler (ad, açıklama, teknik özellik) kırpılır ve kontrol
      karakterlerinden arındırılır; görsel yolları protokol bazında
      sınırlanır (javascript: gibi şemalar kabul edilmez).

   Alan isimleri js/data.js → BASE_PRODUCTS ile birebir aynıdır; böylece
   Firestore'dan gelen ürün istemcide ek dönüşüm olmadan kullanılabilir. */

const { clean } = require('./orders');

const CATEGORIES = {
  saat:     'Akıllı Saatler',
  kulaklik: 'Kulaklıklar',
  aksesuar: 'Aksesuarlar',
  ses:      'Ses & Diğer'
};

const BADGES = {
  bestseller: 'Çok Satan',
  new:        'Yeni',
  discount:   'İndirim',
  limited:    'Sınırlı Stok'
};

const MAX_VARIANTS = 40;
const MAX_IMAGES   = 8;
const MAX_SPECS    = 30;

/* Görsel yolu: yalnız site içi göreli yol veya https adresi.
   `javascript:`, `data:` gibi şemalar reddedilir (XSS yüzeyi). */
function safeImagePath(value) {
  const raw = clean(value, 400);
  if (!raw) return '';
  if (/^https:\/\//i.test(raw)) return raw;
  if (/^(assets|img|images)\//i.test(raw)) return raw;
  return '';
}

function normalizeVariants(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];

  for (const v of raw.slice(0, MAX_VARIANTS)) {
    const sku = clean(v && v.sku, 40);
    if (!sku || seen.has(sku)) continue;      // sku sepetin satır anahtarı: tekil olmalı
    seen.add(sku);
    out.push({
      sku,
      color: clean(v && v.color, 60),
      size:  clean(v && v.size, 30),
      stock: Math.max(0, Math.round(Number(v && v.stock) || 0))
    });
  }
  return out;
}

function normalizeSpecs(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, MAX_SPECS)
    .map(s => ({ key: clean(s && s.key, 60), value: clean(s && s.value, 400) }))
    .filter(s => s.key && s.value);
}

function normalizeColorImages(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  for (const [color, path] of Object.entries(raw).slice(0, MAX_VARIANTS)) {
    const key = clean(color, 60);
    const img = safeImagePath(path);
    if (key && img) out[key] = img;
  }
  return out;
}

/* Dönüş: { product } | { error }
   `existing` verilirse (düzenleme) id korunur. */
function normalizeAdminProduct(raw, { existing = null } = {}) {
  if (!raw || typeof raw !== 'object') return { error: 'Ürün verisi okunamadı.' };

  const id = Number(raw.id !== undefined && raw.id !== null && raw.id !== '' ? raw.id : (existing && existing.id));
  if (!Number.isInteger(id) || id <= 0) {
    return { error: 'Ürün numarası (id) pozitif bir tam sayı olmalıdır.' };
  }

  const name = clean(raw.name, 160);
  if (name.length < 2) return { error: 'Ürün adı zorunludur.' };

  const category = String(raw.category || '').trim();
  if (!Object.prototype.hasOwnProperty.call(CATEGORIES, category)) {
    return { error: `Geçersiz kategori. İzin verilenler: ${Object.keys(CATEGORIES).join(', ')}` };
  }

  const price = Number(raw.price);
  if (!Number.isFinite(price) || price <= 0) return { error: 'Fiyat sıfırdan büyük olmalıdır.' };
  if (price > 500000) return { error: 'Fiyat çok yüksek görünüyor (en fazla 500.000 ₺).' };

  const originalPriceRaw = Number(raw.originalPrice);
  const originalPrice = Number.isFinite(originalPriceRaw) && originalPriceRaw > price
    ? Math.round(originalPriceRaw * 100) / 100
    : null;

  const images = (Array.isArray(raw.images) ? raw.images : [raw.image])
    .map(safeImagePath)
    .filter(Boolean)
    .slice(0, MAX_IMAGES);
  if (!images.length) return { error: 'En az bir ürün görseli gereklidir.' };

  const variants = normalizeVariants(raw.variants);

  const badge = Object.prototype.hasOwnProperty.call(BADGES, raw.badge) ? raw.badge : null;

  /* Stok: varyantlı üründe varyant stoklarının toplamı, tekil üründe alan. */
  const stock = variants.length
    ? variants.reduce((sum, v) => sum + v.stock, 0)
    : Math.max(0, Math.round(Number(raw.stock) || 0));

  return {
    product: {
      id,
      name,
      category,
      categoryLabel: CATEGORIES[category],
      brand:         clean(raw.brand, 60),
      price:         Math.round(price * 100) / 100,
      /* Ödeme tarafının okuduğu TEK fiyat alanı — burada türetilir. */
      priceKurus:    Math.round(price * 100),
      originalPrice,
      stock,
      badge,
      badgeLabel:    badge ? BADGES[badge] : null,
      images,
      image:         images[0],
      colorImages:   normalizeColorImages(raw.colorImages),
      desc:          clean(raw.desc, 2000),
      specs:         normalizeSpecs(raw.specs),
      variants,
      sizeLabel:     clean(raw.sizeLabel, 40) || null,
      rating:        0,
      reviewCount:   0,
      featured:      raw.featured === true,
      active:        raw.active !== false,
      source:        'firestore'
    }
  };
}

module.exports = { normalizeAdminProduct, CATEGORIES, BADGES, safeImagePath };
