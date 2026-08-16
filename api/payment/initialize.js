'use strict';

/* =========================================
   POST /api/payment/initialize
   =========================================
   iyzico Checkout Form akışını başlatır.

   - Tutar SUNUCUDA hesaplanır; istemciden yalnız ürün id + adet alınır.
   - Sipariş, ödeme sayfasına gitmeden önce `awaiting_payment` olarak yazılır;
     böylece callback/webhook hangi sırada gelirse gelsin eşleştirilebilir.
   - Kart verisi bu isteğe DAHİL DEĞİLDİR ve hiçbir zaman bu sunucudan geçmez;
     PAN/CVV yalnız iyzico'nun ödeme sayfasına girilir.
*/

const { methodNotAllowed, json, fail, parseBody, clientIp, rateLimit, logPaymentEvent } = require('../_lib/http');
const { isCardPaymentEnabled, iyzicoConfig, siteBaseUrl, enabledInstallments, environmentMismatch } = require('../_lib/env');
const { MERCHANT, IDENTITY_PLACEHOLDER } = require('../_lib/merchant');
const iyzico = require('../_lib/iyzico');
const store  = require('../_lib/store');
const {
  priceBasket, validateBuyer, validateAddress, normalizeInvoice,
  newOrderId, orderAccessToken, toGsmNumber
} = require('../_lib/orders');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  const ip = clientIp(req);
  const limit = rateLimit(`init:${ip}`, { limit: 8, windowMs: 5 * 60 * 1000 });
  if (!limit.allowed) {
    return fail(res, 429, 'rate_limited', 'Çok fazla ödeme denemesi yapıldı. Lütfen birkaç dakika sonra tekrar deneyin.');
  }

  const mismatch = environmentMismatch();
  if (mismatch) {
    console.error('[payment] ortam uyuşmazlığı: %s', mismatch);
    return fail(res, 503, 'payment_unavailable', 'Kart ile ödeme şu anda kullanılamıyor. EFT/havale ile devam edebilir veya bizimle iletişime geçebilirsiniz.');
  }
  if (!isCardPaymentEnabled()) {
    return fail(res, 503, 'payment_unavailable', 'Kart ile ödeme şu anda kullanılamıyor. EFT/havale ile devam edebilir veya bizimle iletişime geçebilirsiniz.');
  }

  const body = parseBody(req);

  /* ─── Mesafeli satış: ön bilgilendirme ve sözleşme onayı ödemeden önce ─── */
  const agreements = body.agreements || {};
  if (!agreements.distanceSales || !agreements.preInfo) {
    return fail(res, 400, 'agreement_required', 'Ön Bilgilendirme Formu ve Mesafeli Satış Sözleşmesi onayı olmadan ödeme başlatılamaz.');
  }

  const delivery = body.delivery === 'magaza' ? 'magaza' : 'kargo';

  const basket = priceBasket(body.items);
  if (basket.error) return fail(res, 400, 'basket_invalid', basket.error);

  const buyerResult = validateBuyer(body.buyer);
  if (buyerResult.error) return fail(res, 400, 'buyer_invalid', buyerResult.error);
  const buyer = buyerResult.buyer;

  const addressResult = validateAddress(body.address, delivery);
  if (addressResult.error) return fail(res, 400, 'address_invalid', addressResult.error);
  const address = addressResult.address;

  const invoice = normalizeInvoice(body.invoice, buyer, address);

  const session = await store.verifyIdToken(req.headers.authorization);
  const orderId = newOrderId();
  const accessToken = orderAccessToken(orderId);
  const cfg = iyzicoConfig();

  /* ─── Siparişi ödeme öncesi yaz ─── */
  const orderRecord = {
    id:            orderId,
    date:          new Date().toISOString(),
    status:        'awaiting_payment',
    statusLabel:   'Ödeme bekleniyor',
    paymentMethod: 'kart',
    delivery,
    userId:        session ? session.uid : null,
    guest:         !session,
    buyer,
    address,
    invoice,
    items:         basket.lines,
    subtotalKurus: basket.subtotalKurus,
    shippingKurus: basket.shippingKurus,
    totalKurus:    basket.totalKurus,
    currency:      'TRY',
    environment:   cfg.mode,
    agreements: {
      distanceSales: true,
      preInfo:       true,
      acceptedAt:    new Date().toISOString(),
      ip
    },
    paymentId:     null,
    conversationId: orderId
  };

  try {
    await store.createOrder(orderId, orderRecord);
  } catch (err) {
    console.error('[payment] sipariş oluşturulamadı (%s): %s', orderId, err.message);
    return fail(res, 503, 'order_create_failed', 'Siparişiniz oluşturulamadı. Lütfen birkaç dakika sonra tekrar deneyin.');
  }

  /* ─── iyzico Checkout Form initialize ─── */
  const shippingAddress = {
    contactName: `${buyer.ad} ${buyer.soyad}`,
    city:        address ? address.sehir : MERCHANT.address.city,
    country:     'Turkey',
    address:     address ? `${address.adres} ${address.ilce}` : MERCHANT.address.full,
    zipCode:     address && address.posta ? address.posta : MERCHANT.address.zipCode
  };

  const billingAddress = {
    contactName: invoice.unvan,
    city:        address ? address.sehir : MERCHANT.address.city,
    country:     'Turkey',
    address:     invoice.adres || shippingAddress.address,
    zipCode:     shippingAddress.zipCode
  };

  const payload = {
    locale:         'tr',
    conversationId: orderId,
    price:          iyzico.formatPriceFromKurus(basket.subtotalKurus),
    paidPrice:      iyzico.formatPriceFromKurus(basket.totalKurus),
    currency:       'TRY',
    basketId:       orderId,
    paymentGroup:   'PRODUCT',
    callbackUrl:    `${siteBaseUrl()}/api/payment/callback`,
    enabledInstallments: enabledInstallments(),
    buyer: {
      id:                  session ? session.uid : `GUEST-${orderId}`,
      name:                buyer.ad,
      surname:             buyer.soyad,
      gsmNumber:           toGsmNumber(buyer.telefon),
      email:               buyer.email,
      identityNumber:      IDENTITY_PLACEHOLDER,
      registrationAddress: address ? address.adres : MERCHANT.address.full,
      ip,
      city:                address ? address.sehir : MERCHANT.address.city,
      country:             'Turkey',
      zipCode:             address && address.posta ? address.posta : MERCHANT.address.zipCode
    },
    shippingAddress,
    billingAddress,
    basketItems: basket.lines.map(line => ({
      id:        String(line.id),
      name:      line.name,
      category1: line.category,
      itemType:  'PHYSICAL',
      price:     iyzico.formatPriceFromKurus(line.totalKurus)
    }))
  };

  let result;
  try {
    result = await iyzico.initializeCheckoutForm(payload, cfg, { timeoutMs: 20000 });
  } catch (err) {
    console.error('[payment] initialize çağrısı başarısız (%s): %s', orderId, err.message);
    await safeMarkFailed(orderId, 'gateway_unreachable', 'Ödeme sağlayıcısına ulaşılamadı.');
    return fail(res, 503, 'gateway_unreachable', 'Ödeme sayfası şu anda açılamadı. Lütfen tekrar deneyin; kartınızdan herhangi bir çekim yapılmadı.');
  }

  const resultBody = result.body || {};

  if (resultBody.status !== 'success') {
    logPaymentEvent({
      event: 'initialize_failed',
      orderId,
      environment: cfg.mode,
      httpStatus: result.status,
      errorCode: resultBody.errorCode || null,
      errorMessage: resultBody.errorMessage || null
    });
    await safeMarkFailed(orderId, resultBody.errorCode || 'initialize_failed', resultBody.errorMessage || 'Ödeme başlatılamadı.');
    return fail(res, 502, 'initialize_failed', 'Ödeme başlatılamadı. Lütfen tekrar deneyin; kartınızdan herhangi bir çekim yapılmadı.');
  }

  /* Yanıt imzası doğrulanamıyorsa kullanıcıyı bu ödeme sayfasına yollamayız. */
  if (!result.signatureValid) {
    console.error('[payment] initialize imza doğrulaması başarısız (%s)', orderId);
    await safeMarkFailed(orderId, 'signature_invalid', 'Ödeme yanıtı doğrulanamadı.');
    return fail(res, 502, 'signature_invalid', 'Ödeme başlatılamadı. Lütfen tekrar deneyin; kartınızdan herhangi bir çekim yapılmadı.');
  }

  const paymentPageUrl = resultBody.paymentPageUrl || resultBody.payWithIyzicoPageUrl || null;
  if (!paymentPageUrl) {
    console.error('[payment] initialize yanıtında paymentPageUrl yok (%s)', orderId);
    await safeMarkFailed(orderId, 'no_payment_page', 'Ödeme sayfası adresi alınamadı.');
    return fail(res, 502, 'no_payment_page', 'Ödeme sayfası açılamadı. Lütfen tekrar deneyin; kartınızdan herhangi bir çekim yapılmadı.');
  }

  try {
    await store.updateOrder(orderId, {
      checkoutToken:   resultBody.token,
      tokenExpireTime: resultBody.tokenExpireTime || null
    });
  } catch (err) {
    console.error('[payment] token kaydedilemedi (%s): %s', orderId, err.message);
  }

  logPaymentEvent({
    event: 'initialize_ok',
    orderId,
    environment: cfg.mode,
    totalKurus: basket.totalKurus,
    itemCount: basket.lines.length,
    member: Boolean(session)
  });

  return json(res, 200, {
    ok: true,
    orderId,
    accessToken,
    paymentPageUrl,
    totalKurus: basket.totalKurus
  });
};

async function safeMarkFailed(orderId, code, message) {
  try {
    await store.updateOrder(orderId, {
      status: 'failed',
      statusLabel: 'Ödeme alınamadı',
      failureCode: code,
      failureMessage: message
    });
  } catch (err) {
    console.error('[payment] sipariş "failed" olarak işaretlenemedi (%s): %s', orderId, err.message);
  }
}
