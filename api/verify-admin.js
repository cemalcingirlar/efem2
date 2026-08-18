'use strict';

/* =========================================
   GET/POST /api/verify-admin
   =========================================
   Admin panelinin kapısı. Tarayıcı "ben yöneticiyim" diyemez: bu uç,
   isteğin taşıdığı Firebase ID token'ı SUNUCUDA doğrular ve e-postanın
   ADMIN_EMAILS listesinde olup olmadığına bakar.

   Panelin kendisi statik bir HTML olduğu için dosyanın indirilmesi
   engellenemez; asıl koruma verinin bulunduğu yerdedir — /api/admin/*
   uçlarının hepsi aynı kontrolden geçer ve Firestore kuralları istemciye
   yazma izni vermez. Bu uç yalnızca panelin "kimsin?" sorusunu yanıtlar,
   tek başına bir yetki kaynağı değildir.                                  */

const { methodNotAllowed, json, fail, rateLimit, clientIp } = require('./_lib/http');
const { requireAdmin, authStatus } = require('./_lib/admin-auth');
const store = require('./_lib/store');

module.exports = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return methodNotAllowed(res, ['GET', 'POST']);
  }

  /* Yetki denemesi ucuz olmamalı: aynı IP'den kaba kuvvet denemesi frenlenir. */
  const limit = rateLimit(`verify-admin:${clientIp(req)}`, { limit: 30, windowMs: 5 * 60 * 1000 });
  if (!limit.allowed) return fail(res, 429, 'rate_limited', 'Çok fazla deneme yapıldı. Lütfen birkaç dakika sonra tekrar deneyin.');

  if (!store.isStoreConfigured()) {
    return fail(res, 503, 'store_unavailable',
      'Yönetim servisi yapılandırılmamış. Sunucuda FIREBASE_SERVICE_ACCOUNT tanımlanmalı.');
  }

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return fail(res, authStatus(auth.code), auth.code, auth.message);
  }

  return json(res, 200, { ok: true, admin: { email: auth.admin.email } });
};
