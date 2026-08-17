'use strict';

/* =========================================
   /api/admin/coupons — yönetici kupon yönetimi
   =========================================
   GET    → tüm kuponlar (pasif ve süresi dolmuş olanlar dahil)
   POST   → kupon ekle/güncelle ({ coupon: {...} })
   DELETE → kupon sil            ({ code })

   Kupon sipariş tutarını değiştirir; bu yüzden kuponun kendisi de fiyat
   kadar hassastır. Tanım yalnız buradan (yönetici doğrulamasıyla, Admin
   SDK ile) yazılır; istemci Firestore'a kupon yazamaz ve indirim tutarını
   kendisi bildiremez — indirimi sunucu hesaplar (api/_lib/coupons.js).

   Panel tutarları ₺ cinsinden gönderir, Firestore'a KURUŞ yazılır: sipariş
   tarafındaki bütün hesaplar kuruş üzerinden yapılır, yuvarlama farkı
   oluşmasın diye dönüşüm tek yerde (burada) yapılır.                      */

const { methodNotAllowed, json, fail, parseBody, rateLimit, clientIp } = require('../_lib/http');
const { adminGate } = require('../_lib/admin-auth');
const { clean } = require('../_lib/orders');
const { invalidateCoupons, isExpired, normalizeCoupon } = require('../_lib/coupons');
const store = require('../_lib/store');

const ALLOWED = ['GET', 'POST', 'DELETE'];
const CODE_RE = /^[A-Z0-9][A-Z0-9-]{2,23}$/;   // 3–24 karakter, boşluksuz

module.exports = async (req, res) => {
  if (!ALLOWED.includes(req.method)) return methodNotAllowed(res, ALLOWED);

  const limit = rateLimit(`admin-coupons:${clientIp(req)}`, { limit: 120, windowMs: 60 * 1000 });
  if (!limit.allowed) return fail(res, 429, 'rate_limited', 'Çok fazla istek gönderildi.');

  const admin = await adminGate(req, res);
  if (!admin) return;

  if (req.method === 'GET')  return listHandler(req, res);
  if (req.method === 'POST') return saveHandler(req, res, admin);
  return deleteHandler(req, res, admin);
};

/* Panelin gösterdiği biçim: tutarlar ₺, durum etiketi hesaplanmış. */
function adminCouponView(raw) {
  const coupon = normalizeCoupon(raw);
  if (!coupon) return null;
  return {
    code:        coupon.code,
    label:       coupon.label,
    type:        coupon.type,
    value:       coupon.type === 'percent' ? coupon.value : coupon.value / 100,
    valueText:   coupon.type === 'percent' ? `%${coupon.value}` : `${(coupon.value / 100).toLocaleString('tr-TR')} ₺`,
    minSubtotal: coupon.minSubtotalKurus / 100,
    enabled:     coupon.enabled,
    expiresAt:   coupon.expiresAt,
    expired:     isExpired(coupon),
    updatedBy:   raw.updatedBy || null
  };
}

async function listHandler(req, res) {
  let docs;
  try {
    docs = await store.listCoupons();
  } catch (err) {
    console.error('[admin/coupons] kuponlar okunamadı: %s', err.message);
    return fail(res, 503, 'list_failed', 'Kuponlar okunamadı. Lütfen tekrar deneyin.');
  }

  const coupons = docs.map(adminCouponView).filter(Boolean).sort((a, b) => a.code.localeCompare(b.code, 'tr'));
  return json(res, 200, { ok: true, count: coupons.length, coupons });
}

/* Dönüş: { coupon } | { error } — panelden gelen ham veriyi Firestore şekline getirir. */
function normalizeInput(raw) {
  if (!raw || typeof raw !== 'object') return { error: 'Kupon verisi okunamadı.' };

  const code = clean(raw.code, 24).toUpperCase().replace(/\s+/g, '');
  if (!CODE_RE.test(code)) {
    return { error: 'Kupon kodu 3–24 karakter olmalı; yalnız harf, rakam ve tire içerebilir.' };
  }

  const type = raw.type === 'percent' ? 'percent' : 'fixed';
  const value = Number(raw.value);
  if (!Number.isFinite(value) || value <= 0) return { error: 'İndirim değeri sıfırdan büyük olmalıdır.' };

  if (type === 'percent' && value > 90) {
    return { error: 'Yüzde indirim en fazla %90 olabilir.' };
  }
  if (type === 'fixed' && value > 100000) {
    return { error: 'Sabit indirim en fazla 100.000 ₺ olabilir.' };
  }

  const minSubtotal = Number(raw.minSubtotal);
  const minSubtotalKurus = Number.isFinite(minSubtotal) && minSubtotal > 0 ? Math.round(minSubtotal * 100) : 0;

  let expiresAt = null;
  if (raw.expiresAt) {
    const parsed = new Date(raw.expiresAt);
    if (!Number.isFinite(parsed.getTime())) return { error: 'Son kullanma tarihi okunamadı.' };
    expiresAt = parsed.toISOString();
  }

  return {
    coupon: {
      code,
      label: clean(raw.label, 80) || code,
      type,
      /* percent → yüzde, fixed → KURUŞ. Sipariş tarafı bu birimi bekliyor. */
      value: type === 'percent' ? Math.round(value) : Math.round(value * 100),
      minSubtotalKurus,
      enabled: raw.enabled === true,
      expiresAt
    }
  };
}

async function saveHandler(req, res, admin) {
  const body = parseBody(req);
  const result = normalizeInput(body.coupon || body);
  if (result.error) return fail(res, 400, 'coupon_invalid', result.error);

  const coupon = { ...result.coupon, updatedBy: admin.email };

  try {
    await store.saveCoupon(coupon);
  } catch (err) {
    console.error('[admin/coupons] kupon kaydedilemedi (%s): %s', coupon.code, err.message);
    return fail(res, 503, 'save_failed', 'Kupon kaydedilemedi. Lütfen tekrar deneyin.');
  }

  invalidateCoupons();
  console.log('[admin] kupon kaydedildi: %s by=%s', coupon.code, admin.email);
  return json(res, 200, { ok: true, coupon: adminCouponView(coupon) });
}

async function deleteHandler(req, res, admin) {
  const body = parseBody(req);
  const code = clean(body.code || (req.query && req.query.code), 24).toUpperCase();
  if (!CODE_RE.test(code)) return fail(res, 400, 'invalid_code', 'Kupon kodu geçersiz.');

  try {
    await store.deleteCoupon(code);
  } catch (err) {
    console.error('[admin/coupons] kupon silinemedi (%s): %s', code, err.message);
    return fail(res, 503, 'delete_failed', 'Kupon silinemedi. Lütfen tekrar deneyin.');
  }

  invalidateCoupons();
  console.log('[admin] kupon silindi: %s by=%s', code, admin.email);
  return json(res, 200, { ok: true, code });
}
