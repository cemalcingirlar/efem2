'use strict';

/* =========================================
   POST /api/payment/notify  — PayTR "Bildirim URL"
   =========================================
   Ödeme sonucunun TEK yetkili kaynağı burasıdır. PayTR bu adrese
   sunucudan sunucuya POST atar; müşterinin tarayıcısı buraya gelmez.

   Kurallar (PayTR dokümanı):
   - hash doğrulanmadan hiçbir sipariş durumu değiştirilmez.
   - İşlem bittiğinde gövdesi TAM OLARAK "OK" olan bir yanıt dönülmelidir;
     aksi hâlde PayTR bildirimi tekrar tekrar gönderir.
   - Aynı sipariş için bildirim birden fazla kez gelebilir; ikinci kez
     işlenmemelidir (durum geçişi transaction içinde, idempotent).

   PayTR Mağaza Paneli → Ayarlar → Bildirim URL:
   https://efemiletisim.com/api/payment/notify                              */

const crypto = require('crypto');
const { methodNotAllowed, parseBody, logPaymentEvent } = require('../_lib/http');
const { paytrConfig, isCardPaymentEnabled } = require('../_lib/env');
const { verifyNotification } = require('../_lib/paytr');
const store = require('../_lib/store');
const { settleNotification } = require('../_lib/settle');

/* PayTR yalnız düz "OK" metnini kabul eder. */
function respondOk(res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end('OK');
}

function respondError(res, code, message) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(message);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  const cfg = paytrConfig();
  if (!cfg || !isCardPaymentEnabled()) {
    console.error('[notify] ödeme yapılandırması kapalıyken bildirim alındı.');
    // 5xx dönüyoruz ki PayTR tekrar denesin; yapılandırma düzelince işlenir.
    return respondError(res, 503, 'unavailable');
  }

  const payload = parseBody(req);

  if (!verifyNotification(payload, cfg)) {
    logPaymentEvent({
      event: 'notify_bad_hash',
      orderId: payload.merchant_oid || null,
      status: payload.status || null
    });
    return respondError(res, 401, 'PAYTR notification failed: bad hash');
  }

  /* İmza geçerli. Bundan sonrası tekrar gelse de aynı sonucu üretir. */
  let settlement;
  try {
    settlement = await settleNotification(payload, { source: 'notify' });
  } catch (err) {
    console.error('[notify] sonuçlandırma hatası: %s', err.message);
    // OK dönmezsek PayTR tekrar dener — işlem idempotent olduğu için güvenli.
    return respondError(res, 500, 'retry later');
  }

  /* Sipariş bulunamadıysa bile PayTR'ye OK denir: aksi hâlde bildirim
     sonsuza kadar tekrar gelir. Durum loglanır ve mutabakatta yakalanır. */
  if (settlement.outcome === 'store_unavailable') {
    return respondError(res, 503, 'retry later');
  }

  /* Olay günlüğü sonuçlandırmadan SONRA yazılır; kayıt önce yazılsaydı
     sonuçlandırma hata verip PayTR tekrar denediğinde olay "duplicate"
     sayılıp asla işlenmezdi. */
  const eventId = crypto.createHash('sha256').update([
    payload.merchant_oid || '',
    payload.status || '',
    payload.total_amount || '',
    payload.hash || ''
  ].join('|')).digest('hex').slice(0, 40);

  await store.recordEventOnce(eventId, {
    provider:      'paytr',
    orderId:       payload.merchant_oid || null,
    status:        payload.status || null,
    totalAmount:   payload.total_amount || null,
    paymentType:   payload.payment_type || null,
    orderStatus:   settlement.status || null,
    outcome:       settlement.outcome,
    source:        'notify'
  }).catch(() => {});

  return respondOk(res);
};
