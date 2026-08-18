'use strict';

/* =========================================
   Kupon doğrulama (sunucu tarafı)
   =========================================
   Kupon, sipariş tutarını değiştirir — bu yüzden indirim tutarı İSTEMCİDEN
   ALINMAZ. İstemci yalnız kupon KODUNU gönderir; geçerlilik ve indirim
   burada, Firestore'daki tanıma göre hesaplanır.

   (Aksi hâlde müşteri sepette indirimli tutarı görür, ödeme sayfasında tam
   tutarı öderdi ya da tersi olur, tutar uyuşmazlığı yüzünden sipariş
   `pending_review`a düşerdi.)

   Kaynak: Firestore `coupons` koleksiyonu. Yapılandırma yoksa kupon yoktur
   (fail closed) — uydurma indirim uygulanmaz.                              */

const store = require('./store');

const CACHE_TTL_MS = 60 * 1000;
let cache = null;

function normalizeCoupon(raw) {
  const code = String(raw && raw.code || '').trim().toUpperCase();
  if (!code) return null;

  const type = raw.type === 'percent' ? 'percent' : 'fixed';
  const value = Number(raw.value);
  if (!Number.isFinite(value) || value <= 0) return null;
  if (type === 'percent' && value > 90) return null;   // %90 üstü indirim kabul edilmez

  return {
    code,
    label:           String(raw.label || code),
    type,
    value,                                              // fixed → kuruş, percent → yüzde
    minSubtotalKurus: Math.max(0, Math.round(Number(raw.minSubtotalKurus) || 0)),
    enabled:         raw.enabled === true,
    expiresAt:       raw.expiresAt || null
  };
}

async function loadCoupons() {
  const now = Date.now();
  if (cache && now - cache.loadedAt < CACHE_TTL_MS) return cache.map;

  const map = new Map();
  if (store.isStoreConfigured()) {
    try {
      for (const doc of await store.listCoupons()) {
        const coupon = normalizeCoupon(doc);
        if (coupon) map.set(coupon.code, coupon);
      }
    } catch (err) {
      console.error('[coupon] kuponlar okunamadı: %s', err.message);
    }
  }

  cache = { map, loadedAt: Date.now() };
  return map;
}

function invalidateCoupons() {
  cache = null;
}

function isExpired(coupon, now = new Date()) {
  if (!coupon.expiresAt) return false;
  const end = new Date(coupon.expiresAt);
  return Number.isFinite(end.getTime()) && end.getTime() < now.getTime();
}

/* Dönüş:
   { discountKurus, coupon }            → uygulandı
   { error }                            → uygulanmadı (sebep müşteriye gösterilir)
   Kod boşsa { discountKurus: 0 }       → kupon kullanılmıyor                 */
async function applyCoupon(rawCode, subtotalKurus) {
  const code = String(rawCode || '').trim().toUpperCase();
  if (!code) return { discountKurus: 0, coupon: null };

  const coupons = await loadCoupons();
  const coupon = coupons.get(code);

  if (!coupon)          return { error: 'Geçersiz kupon kodu.' };
  if (!coupon.enabled)  return { error: 'Bu kupon şu anda kullanıma kapalı.' };
  if (isExpired(coupon)) return { error: 'Bu kuponun süresi dolmuş.' };
  if (subtotalKurus < coupon.minSubtotalKurus) {
    const min = (coupon.minSubtotalKurus / 100).toLocaleString('tr-TR');
    return { error: `Bu kupon en az ${min} ₺ tutarındaki sepetlerde geçerlidir.` };
  }

  const raw = coupon.type === 'percent'
    ? Math.round(subtotalKurus * coupon.value / 100)
    : Math.round(coupon.value);

  /* İndirim sepeti aşamaz; tutar asla sıfırın altına inmez. */
  const discountKurus = Math.max(0, Math.min(raw, subtotalKurus));

  return { discountKurus, coupon };
}

module.exports = { applyCoupon, loadCoupons, invalidateCoupons, normalizeCoupon, isExpired };
