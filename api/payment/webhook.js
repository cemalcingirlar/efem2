'use strict';

/* =========================================
   POST /api/payment/webhook
   =========================================
   iyzico'nun sunucudan sunucuya bildirimi. Tarayıcı callback'i hiç
   gelmese bile (kullanıcı sekmeyi kapattı, ağ koptu) sipariş durumu
   buradan doğru şekilde tamamlanır.

   - X-IYZ-SIGNATURE-V3 doğrulanmadan HİÇBİR durum değişikliği yapılmaz.
   - Aynı olay tekrar gelirse (replay) ikinci kez işlenmez.
   - Sonuç yine retrieve sorgusundan okunur; webhook gövdesindeki `status`
     tek başına yeterli sayılmaz.

   iyzico Merchant Panel → Ayarlar → Webhook adresine bu URL yazılmalıdır:
   https://efemiletisim.com/api/payment/webhook */

const crypto = require('crypto');
const { methodNotAllowed, json, fail, parseBody, logPaymentEvent } = require('../_lib/http');
const { iyzicoConfig, isCardPaymentEnabled } = require('../_lib/env');
const { verifyWebhookSignatureV3 } = require('../_lib/iyzico');
const { isValidOrderId } = require('../_lib/orders');
const store = require('../_lib/store');
const { settleByToken } = require('../_lib/settle');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  const cfg = iyzicoConfig();
  if (!cfg || !isCardPaymentEnabled()) {
    console.error('[webhook] ödeme yapılandırması kapalıyken webhook alındı.');
    return fail(res, 503, 'unavailable', 'unavailable');
  }

  const payload = parseBody(req);
  const signature =
    req.headers['x-iyz-signature-v3'] ||
    req.headers['X-IYZ-SIGNATURE-V3'] ||
    '';

  if (!verifyWebhookSignatureV3(payload, String(signature), cfg.secretKey)) {
    logPaymentEvent({
      event: 'webhook_bad_signature',
      eventType: payload.iyziEventType || null,
      conversationId: payload.paymentConversationId || null
    });
    return fail(res, 401, 'invalid_signature', 'invalid signature');
  }

  const eventId = crypto.createHash('sha256').update([
    payload.iyziEventType || '',
    payload.iyziPaymentId || payload.paymentId || '',
    payload.token || '',
    payload.paymentConversationId || '',
    payload.status || ''
  ].join('|')).digest('hex').slice(0, 40);

  const conversationId = String(payload.paymentConversationId || '');
  let token = String(payload.token || '');

  // Doğrudan (HPP olmayan) bildirimde token gelmez: siparişten okunur.
  if (!token && isValidOrderId(conversationId)) {
    try {
      const order = await store.getOrder(conversationId);
      token = order && order.checkoutToken ? order.checkoutToken : '';
    } catch (err) {
      console.error('[webhook] sipariş okunamadı (%s): %s', conversationId, err.message);
    }
  }

  if (!token) {
    logPaymentEvent({ event: 'webhook_no_token', eventId, conversationId: conversationId || null });
    // İmza geçerliydi; tekrar denenmesini istemiyoruz, mutabakat yakalar.
    return json(res, 200, { ok: true, handled: false });
  }

  try {
    const settlement = await settleByToken({
      token,
      expectedOrderId: isValidOrderId(conversationId) ? conversationId : null,
      source: 'webhook'
    });

    /* Olay günlüğü sonuçlandırmadan SONRA yazılır: kayıt önce yazılsaydı,
       sonuçlandırma hata verip iyzico tekrar denediğinde olay "duplicate"
       sayılıp asla işlenmezdi. Durum geçişi zaten transaction ile
       idempotent olduğu için tekrar işlenmesi güvenlidir. */
    await store.recordEventOnce(eventId, {
      eventType:      payload.iyziEventType || null,
      paymentId:      payload.iyziPaymentId || payload.paymentId || null,
      conversationId: conversationId || null,
      status:         payload.status || null,
      orderStatus:    settlement.status || null,
      source:         'webhook'
    }).catch(() => {});

    return json(res, 200, { ok: true, handled: settlement.outcome === 'ok' });
  } catch (err) {
    console.error('[webhook] sonuçlandırma hatası: %s', err.message);
    // 5xx → iyzico tekrar dener; işlem idempotent olduğu için güvenlidir.
    return fail(res, 500, 'settle_failed', 'retry later');
  }
};
