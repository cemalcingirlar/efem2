'use strict';

/* =========================================
   /api/admin/orders — yönetici sipariş yönetimi
   =========================================
   GET  → tüm siparişler (üye + misafir) tek listede
   POST → sipariş durumunu güncelle ({ orderId, status })

   Yetki sunucuda doğrulanır: Firebase ID token + doğrulanmış e-posta +
   ADMIN_EMAILS listesinde bulunma (bkz. api/_lib/admin-auth.js).
   admin.html'in eski istemci tarafı şifresi bir yetki kontrolü DEĞİLDİR;
   bu uç ondan bağımsız olarak korunur.

   Durum güncellemesi iki yeri birden günceller:
     orders/{orderId}                → tek doğruluk kaynağı
     users/{uid}.orders[] içindeki kopya → müşteri profil.html'de görsün    */

const { methodNotAllowed, json, fail, parseBody, rateLimit, clientIp, logPaymentEvent } = require('../_lib/http');
const { shipmentMailSubject, shipmentMailHtml, trackingUrl } = require('../_lib/shipping');
const { requireAdmin } = require('../_lib/admin-auth');
const { isValidOrderId, formatTry } = require('../_lib/orders');
const store = require('../_lib/store');

/* Yöneticinin elle atayabileceği sevkiyat durumları. Ödeme durumları
   (paid, pending_review, failed …) buradan değiştirilemez; onları yalnız
   ödeme bildirimi yazar. */
const FULFILLMENT_STATUS = {
  processing: 'Hazırlanıyor',
  shipped:    'Kargoda',
  delivered:  'Teslim Edildi',
  cancelled:  'İptal'
};

/* Listede müşteriye ait hassas alanların tamamı yöneticiye gösterilir
   (sipariş yönetimi için gerekli), ancak ödeme sağlayıcısının ham yanıtı
   ve iç kimlikler dışarı verilmez. */
function adminOrderView(order) {
  return {
    id:            order.id,
    date:          order.date,
    status:        order.status,
    statusLabel:   order.statusLabel,
    paymentMethod: order.paymentMethod,
    paymentProvider: order.paymentProvider || null,
    environment:   order.environment || null,
    guest:         Boolean(order.guest),
    userId:        order.userId || null,
    buyer:         order.buyer || null,
    address:       order.address || null,
    invoice:       order.invoice || null,
    delivery:      order.delivery || 'kargo',
    eftReceiptNo:  order.eftReceiptNo || null,
    /* Kargo takip numarası panelde gösterilir ve kaydedildikten sonra
       listede görünmelidir. */
    trackingNumber: order.trackingNumber || null,
    shipping:      order.shipping || null,
    items: (order.items || []).map(i => ({
      id: i.id, sku: i.sku || null, name: i.name,
      color: i.color || '', size: i.size || '',
      qty: i.qty, unitKurus: i.unitKurus, totalKurus: i.totalKurus
    })),
    totalKurus:  order.totalKurus,
    totalText:   formatTry(order.totalKurus),
    paidAt:      order.paidAt || null,
    fulfillment: order.fulfillment || null,
    payment: order.payment ? {
      paymentType:      order.payment.paymentType || null,
      installmentCount: order.payment.installmentCount || 0,
      testMode:         Boolean(order.payment.testMode),
      problems:         order.payment.problems || []
    } : null
  };
}

module.exports = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return methodNotAllowed(res, ['GET', 'POST']);
  }

  const limit = rateLimit(`admin:${clientIp(req)}`, { limit: 120, windowMs: 60 * 1000 });
  if (!limit.allowed) return fail(res, 429, 'rate_limited', 'Çok fazla istek gönderildi.');

  if (!store.isStoreConfigured()) {
    return fail(res, 503, 'store_unavailable',
      'Sipariş defteri yapılandırılmamış. Sunucuda FIREBASE_SERVICE_ACCOUNT tanımlanmalı.');
  }

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    const status = auth.code === 'unauthenticated' ? 401
      : auth.code === 'admin_not_configured' ? 503
      : 403;
    return fail(res, status, auth.code, auth.message);
  }

  if (req.method === 'GET') return listHandler(req, res);

  /* Aynı uç iki işi görür: durum güncelleme ve kargo takip numarası.
     Gövdede `trackingNumber` alanı varsa takip akışına gider. */
  const body = parseBody(req);
  if (Object.prototype.hasOwnProperty.call(body, 'trackingNumber')) {
    return trackingHandler(req, res, auth.admin);
  }
  return updateHandler(req, res, auth.admin);
};

async function listHandler(req, res) {
  const query = req.query || {};
  const status = typeof query.status === 'string' && query.status !== 'all' ? query.status : null;
  const limit = Math.min(parseInt(query.limit, 10) || 200, 500);

  let orders;
  try {
    orders = await store.listOrders({ limit, status });
  } catch (err) {
    console.error('[admin] siparişler okunamadı: %s', err.message);
    return fail(res, 503, 'list_failed', 'Siparişler okunamadı. Lütfen tekrar deneyin.');
  }

  return json(res, 200, {
    ok: true,
    count: orders.length,
    statuses: FULFILLMENT_STATUS,
    orders: orders.map(adminOrderView)
  });
}

async function updateHandler(req, res, admin) {
  const body = parseBody(req);
  const orderId = String(body.orderId || '');
  const status  = String(body.status || '');

  if (!isValidOrderId(orderId)) {
    return fail(res, 400, 'invalid_order', 'Sipariş numarası geçersiz.');
  }
  if (!Object.prototype.hasOwnProperty.call(FULFILLMENT_STATUS, status)) {
    return fail(res, 400, 'invalid_status',
      `Geçersiz durum. İzin verilenler: ${Object.keys(FULFILLMENT_STATUS).join(', ')}`);
  }

  let result;
  try {
    result = await store.setOrderStatus(orderId, status, FULFILLMENT_STATUS[status], admin.email);
  } catch (err) {
    console.error('[admin] durum güncellenemedi (%s): %s', orderId, err.message);
    return fail(res, 503, 'update_failed', 'Sipariş durumu güncellenemedi.');
  }

  if (!result.applied && result.reason === 'not_found') {
    return fail(res, 404, 'not_found', 'Sipariş bulunamadı.');
  }

  /* Üye siparişiyse profildeki kopyayı da güncelle; başarısız olursa
     yönetici işlemi bloklanmaz, sonuçta bildirilir. */
  let profileSync = { applied: false, reason: 'guest' };
  const order = result.order;
  if (order && order.userId) {
    profileSync = await store.syncUserOrderStatus(order.userId, orderId, status, FULFILLMENT_STATUS[status]);
  }

  logPaymentEvent({
    event: 'admin_order_status',
    orderId,
    status,
    applied: result.applied,
    profileSynced: profileSync.applied,
    actor: admin.email
  });

  return json(res, 200, {
    ok: true,
    orderId,
    status,
    statusLabel: FULFILLMENT_STATUS[status],
    applied: result.applied,
    profileSynced: profileSync.applied,
    profileSyncReason: profileSync.reason || null
  });
}

/* Kargo takip numarası kaydı + müşteriye HepsiJET takip e-postası.
   POST { orderId, trackingNumber }  → { ok, trackingNumber, mailed }

   Numara boş gönderilirse takip bilgisi kaldırılır (yanlış girilmiş olabilir)
   ve e-posta gönderilmez. */
async function trackingHandler(req, res, admin) {
  const body    = parseBody(req);
  const orderId = String(body.orderId || '');
  const ham     = String(body.trackingNumber == null ? '' : body.trackingNumber).trim();

  if (!isValidOrderId(orderId)) {
    return fail(res, 400, 'invalid_order', 'Sipariş numarası geçersiz.');
  }

  /* Takip numarası taşıyıcının sistemine girilecek bir referans; serbest
     metin olarak saklanır ama boşluk/kontrol karakteri temizlenir. */
  const takipNo = ham.replace(/[^A-Za-z0-9-]/g, '').slice(0, 40);
  if (ham && !takipNo) {
    return fail(res, 400, 'invalid_tracking', 'Takip numarası yalnız harf, rakam ve tire içerebilir.');
  }

  let result;
  try {
    result = await store.setOrderTracking(orderId, takipNo || null, admin.email);
  } catch (err) {
    console.error('[admin] takip no yazılamadı (%s): %s', orderId, err.message);
    return fail(res, 503, 'tracking_failed', 'Takip numarası kaydedilemedi.');
  }

  if (!result.applied && result.reason === 'not_found') {
    return fail(res, 404, 'not_found', 'Sipariş bulunamadı.');
  }

  /* E-posta YALNIZ numara gerçekten değiştiğinde ve dolu olduğunda gider;
     aynı numara tekrar kaydedilirse müşteriye ikinci bildirim gitmez.
     Gönderim başarısız olursa yönetici işlemi bloklanmaz — numara zaten
     yazıldı, sonuç `mailed: false` ile bildirilir. */
  /* Numara müşterinin sipariş ekranında da görünsün.
     setOrderTracking yalnız orders/{id}'ye yazıyor; profil.html ise
     users/{uid}.orders dizisini okuyor. Bu satır olmadan müşteri takip
     numarasını yalnız e-postada görüyordu, sitede hiç göremiyordu.
     Hata yönetici işlemini bloklamaz: numara zaten kaydedildi. */
  if (result.applied && result.order && result.order.userId) {
    await store.syncUserOrderTracking(result.order.userId, orderId, takipNo || null);
  }

  let mailed = false;
  const order = result.order;
  const alici = order && ((order.buyer && order.buyer.email) || order.customerEmail);

  if (result.changed && alici) {
    try {
      await store.queueMail(alici, shipmentMailSubject(order), shipmentMailHtml(order));
      mailed = true;
    } catch (err) {
      console.error('[admin] kargo e-postası kuyruğa yazılamadı (%s): %s', orderId, err.message);
    }
  }

  logPaymentEvent({
    event: 'admin_order_tracking',
    orderId,
    applied: result.applied,
    changed: result.changed,
    mailed,
    carrier: 'hepsijet',
    actor: admin.email
  });

  return json(res, 200, {
    ok: true,
    orderId,
    trackingNumber: takipNo || null,
    trackingUrl: takipNo ? trackingUrl(takipNo) : null,
    applied: result.applied,
    mailed,
    mailSkipReason: result.changed ? (alici ? null : 'no_email') : 'no_change'
  });
}

module.exports.FULFILLMENT_STATUS = FULFILLMENT_STATUS;
module.exports.adminOrderView = adminOrderView;
