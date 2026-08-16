'use strict';

/* =========================================
   GET /api/order/status?order=EFM...&t=<erişim jetonu>
   =========================================
   Ödeme sonuç sayfası siparişin GERÇEK durumunu buradan okur. "Ödeme
   başarılı" bilgisi tarayıcıda üretilmez; sunucudaki doğrulanmış duruma
   bakılır.

   Erişim, siparişe özel HMAC jetonu ile korunur (sipariş numarasını bilen
   biri başkasının siparişini göremez). */

const { methodNotAllowed, json, fail, rateLimit, clientIp } = require('../_lib/http');
const { isValidOrderId, verifyOrderAccessToken, publicOrderView } = require('../_lib/orders');
const { isStoreConfigured, getOrder } = require('../_lib/store');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

  const limit = rateLimit(`status:${clientIp(req)}`, { limit: 60, windowMs: 60 * 1000 });
  if (!limit.allowed) return fail(res, 429, 'rate_limited', 'Çok fazla istek gönderildi.');

  const query = req.query || {};
  const orderId = String(query.order || '');
  const token   = String(query.t || '');

  if (!isValidOrderId(orderId)) return fail(res, 400, 'invalid_order', 'Sipariş numarası geçersiz.');
  if (!verifyOrderAccessToken(orderId, token)) return fail(res, 403, 'forbidden', 'Bu siparişi görüntüleme yetkiniz yok.');
  if (!isStoreConfigured()) return fail(res, 503, 'unavailable', 'Sipariş kaydı şu anda okunamıyor.');

  let order;
  try {
    order = await getOrder(orderId);
  } catch (err) {
    console.error('[order/status] okunamadı (%s): %s', orderId, err.message);
    return fail(res, 503, 'unavailable', 'Sipariş kaydı şu anda okunamıyor.');
  }

  if (!order) return fail(res, 404, 'not_found', 'Sipariş bulunamadı.');

  return json(res, 200, { ok: true, order: publicOrderView(order) });
};
