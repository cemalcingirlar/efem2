'use strict';

/* =========================================
   POST /api/payment/callback
   =========================================
   iyzico ödeme sayfasından dönüşte müşterinin tarayıcısını buraya
   yönlendirir. Bu istekteki HİÇBİR parametre "ödeme başarılı" kanıtı
   sayılmaz; sonuç yalnızca iyzico retrieve sorgusuyla belirlenir
   (rapor: "Callback", TC-CALLBACK-REPLAY, TC-ORDER-SWAP).

   Yanıt her zaman sonuç sayfasına 303 yönlendirmesidir; kullanıcı ham
   JSON görmez. */

const { parseBody, logPaymentEvent } = require('../_lib/http');
const { siteBaseUrl, isCardPaymentEnabled } = require('../_lib/env');
const { isValidOrderId, orderAccessToken } = require('../_lib/orders');
const { settleByToken } = require('../_lib/settle');

function redirect(res, url) {
  res.statusCode = 303;
  res.setHeader('Location', url);
  res.setHeader('Cache-Control', 'no-store');
  res.end();
}

function resultUrl(params) {
  const qs = new URLSearchParams(params).toString();
  return `${siteBaseUrl()}/odeme-sonuc.html?${qs}`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return redirect(res, resultUrl({ durum: 'hata' }));
  }

  const body  = parseBody(req);
  const query = req.query || {};
  const token = String(body.token || query.token || '').trim();
  const orderIdFromUrl = String(query.order || body.order || '').trim();

  if (!token) {
    logPaymentEvent({ event: 'callback_no_token', orderId: orderIdFromUrl || null });
    return redirect(res, resultUrl({ durum: 'hata' }));
  }

  if (!isCardPaymentEnabled()) {
    console.error('[callback] ödeme yapılandırması kapalıyken callback alındı.');
    return redirect(res, resultUrl({ durum: 'hata' }));
  }

  let settlement;
  try {
    settlement = await settleByToken({
      token,
      expectedOrderId: isValidOrderId(orderIdFromUrl) ? orderIdFromUrl : null,
      source: 'callback'
    });
  } catch (err) {
    console.error('[callback] sonuçlandırma hatası: %s', err.message);
    return redirect(res, resultUrl({ durum: 'hata' }));
  }

  if (settlement.outcome !== 'ok' || !settlement.orderId) {
    // Ödeme durumu bilinmiyor olabilir: kullanıcıya "kontrol ediliyor" denir,
    // sipariş mutabakat kuyruğunda kalır.
    return redirect(res, resultUrl({
      durum: settlement.orderId ? 'kontrol' : 'hata',
      ...(settlement.orderId ? { order: settlement.orderId, t: orderAccessToken(settlement.orderId) } : {})
    }));
  }

  return redirect(res, resultUrl({
    order: settlement.orderId,
    t:     orderAccessToken(settlement.orderId)
  }));
};
