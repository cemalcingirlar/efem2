'use strict';

/* =========================================
   POST /api/order/eft
   =========================================
   EFT/havale siparişi oluşturur. Kart işlemi yoktur; sipariş "ödeme
   bekliyor" durumunda açılır ve para hesaba geçtiğinde işletme tarafından
   onaylanır.

   Kart akışında olduğu gibi tutar SUNUCUDA hesaplanır: müşteriye
   gösterilen ve e-postada yazan tutar ile beklenen transfer tutarı
   arasında fark oluşamaz. */

const { methodNotAllowed, json, fail, parseBody, clientIp, rateLimit, logPaymentEvent } = require('../_lib/http');
const { isStoreConfigured, verifyIdToken, createOrder, appendOrderToUserProfile, queueMail } = require('../_lib/store');
const { MERCHANT } = require('../_lib/merchant');
const { buildMerchantMail } = require('../_lib/notify-merchant');
const {
  priceBasket, validateBuyer, validateAddress, normalizeInvoice,
  newOrderId, orderAccessToken, clean, formatTry, legacyOrderSummary, publicOrderView
} = require('../_lib/orders');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  const ip = clientIp(req);
  const limit = rateLimit(`eft:${ip}`, { limit: 8, windowMs: 5 * 60 * 1000 });
  if (!limit.allowed) return fail(res, 429, 'rate_limited', 'Çok fazla sipariş denemesi. Lütfen birkaç dakika sonra tekrar deneyin.');

  if (!isStoreConfigured()) {
    // Sipariş defteri yapılandırılmamış: istemci eski yerel akışa döner.
    return fail(res, 503, 'order_api_unavailable', 'Sipariş servisi şu anda kullanılamıyor.');
  }

  const body = parseBody(req);
  const agreements = body.agreements || {};
  if (!agreements.distanceSales || !agreements.preInfo) {
    return fail(res, 400, 'agreement_required', 'Ön Bilgilendirme Formu ve Mesafeli Satış Sözleşmesi onayı olmadan sipariş oluşturulamaz.');
  }

  const delivery = body.delivery === 'magaza' ? 'magaza' : 'kargo';

  const basket = await priceBasket(body.items, { couponCode: body.couponCode });
  if (basket.error) return fail(res, 400, 'basket_invalid', basket.error);

  const buyerResult = validateBuyer(body.buyer);
  if (buyerResult.error) return fail(res, 400, 'buyer_invalid', buyerResult.error);
  const buyer = buyerResult.buyer;

  const addressResult = validateAddress(body.address, delivery);
  if (addressResult.error) return fail(res, 400, 'address_invalid', addressResult.error);
  const address = addressResult.address;

  const invoice = normalizeInvoice(body.invoice, buyer, address);
  const session = await verifyIdToken(req.headers.authorization);

  const orderId = newOrderId();
  const order = {
    id:            orderId,
    date:          new Date().toISOString(),
    status:        'awaiting_transfer',
    statusLabel:   'EFT/havale bekleniyor',
    paymentMethod: 'eft',
    delivery,
    userId:        session ? session.uid : null,
    guest:         !session,
    buyer,
    address,
    invoice,
    items:         basket.lines,
    subtotalKurus: basket.subtotalKurus,
    shippingKurus: basket.shippingKurus,
    discountKurus: basket.discountKurus,
    coupon:        basket.coupon,
    totalKurus:    basket.totalKurus,
    currency:      'TRY',
    eftReceiptNo:  clean(body.eftReceiptNo, 60) || null,
    paymentId:     null,
    agreements: {
      distanceSales: true,
      preInfo:       true,
      acceptedAt:    new Date().toISOString(),
      ip
    }
  };

  try {
    await createOrder(orderId, order);
  } catch (err) {
    console.error('[order/eft] sipariş oluşturulamadı (%s): %s', orderId, err.message);
    return fail(res, 503, 'order_create_failed', 'Siparişiniz oluşturulamadı. Lütfen tekrar deneyin.');
  }

  if (session) {
    await appendOrderToUserProfile(session.uid, legacyOrderSummary(order));
  }

  await queueMail(
    buyer.email,
    `Siparişiniz alındı – ${orderId} (EFT/havale bekleniyor)`,
    `<p>Merhaba ${escapeHtml(buyer.ad)},</p>
     <p><strong>${orderId}</strong> numaralı siparişiniz oluşturuldu. Ödemenizi aşağıdaki hesaba
     gönderdiğinizde siparişiniz hazırlanmaya başlar.</p>
     <p><strong>Tutar: ${formatTry(basket.totalKurus)}</strong> (KDV dahil)<br>
     Açıklama kısmına sipariş numaranızı (<strong>${orderId}</strong>) yazmayı unutmayın.</p>
     <p>Sorularınız için: ${MERCHANT.supportEmail}<br>${escapeHtml(MERCHANT.brandName)}</p>`
  );

  /* İşletmeye bildirim: sipariş geldiğinden haberdar olmalı. */
  const merchantMail = buildMerchantMail(order);
  await queueMail(merchantMail.to, merchantMail.subject, merchantMail.html);

  logPaymentEvent({
    event: 'eft_order_created',
    orderId,
    totalKurus: basket.totalKurus,
    member: Boolean(session)
  });

  return json(res, 201, {
    ok: true,
    orderId,
    accessToken: orderAccessToken(orderId),
    order: publicOrderView(order)
  });
};

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
