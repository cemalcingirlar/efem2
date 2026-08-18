'use strict';

/* =========================================
   POST /api/payment/initialize
   =========================================
   PayTR iFrame API'sinin 1. adımını çalıştırır: ödeme token'ı alır.

   - Tutar SUNUCUDA hesaplanır; istemciden yalnız ürün id + sku + adet alınır.
   - Sipariş, ödeme formuna gitmeden önce `awaiting_payment` olarak yazılır;
     böylece PayTR bildirimi hangi anda gelirse gelsin eşleştirilebilir.
   - Kart verisi bu isteğe DAHİL DEĞİLDİR ve hiçbir zaman bu sunucudan geçmez;
     kart numarası/CVV yalnız PayTR'nin ödeme formuna girilir.
*/

const { methodNotAllowed, json, fail, parseBody, clientIp, rateLimit, logPaymentEvent } = require('../_lib/http');
const { isCardPaymentEnabled, paytrConfig, paytrMode, siteBaseUrl, installmentSettings } = require('../_lib/env');
const { MERCHANT } = require('../_lib/merchant');
const paytr = require('../_lib/paytr');
const store = require('../_lib/store');
const {
  priceBasket, validateBuyer, validateAddress, normalizeInvoice,
  newOrderId, orderAccessToken, lineTitle, clean
} = require('../_lib/orders');

const PAYMENT_TIMEOUT_MINUTES = 30;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  const ip = clientIp(req);
  const limit = rateLimit(`init:${ip}`, { limit: 8, windowMs: 5 * 60 * 1000 });
  if (!limit.allowed) {
    return fail(res, 429, 'rate_limited', 'Çok fazla ödeme denemesi yapıldı. Lütfen birkaç dakika sonra tekrar deneyin.');
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

  /* Kupon: istemci yalnız KODU gönderir, indirimi sunucu hesaplar. */
  const basket = await priceBasket(body.items, { couponCode: body.couponCode });
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

  /* PayTR merchant_oid alfanumerik olmak zorunda; üretici bunu garanti eder
     ama bir hata olursa ödemeyi başlatmadan durdururuz. */
  if (!paytr.isValidMerchantOid(orderId)) {
    console.error('[payment] üretilen sipariş numarası PayTR kuralına uymuyor: %s', orderId);
    return fail(res, 500, 'order_id_invalid', 'Siparişiniz oluşturulamadı. Lütfen tekrar deneyin.');
  }

  const accessToken = orderAccessToken(orderId);
  const cfg = paytrConfig();
  const { noInstallment, maxInstallment } = installmentSettings();

  /* ─── Siparişi ödeme öncesi yaz ─── */
  const orderRecord = {
    id:            orderId,
    date:          new Date().toISOString(),
    status:        'awaiting_payment',
    statusLabel:   'Ödeme bekleniyor',
    paymentMethod: 'kart',
    paymentProvider: 'paytr',
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
    environment:   paytrMode(),
    agreements: {
      distanceSales: true,
      preInfo:       true,
      acceptedAt:    new Date().toISOString(),
      ip
    },
    paymentId:     null
  };

  try {
    await store.createOrder(orderId, orderRecord);
  } catch (err) {
    console.error('[payment] sipariş oluşturulamadı (%s): %s', orderId, err.message);
    return fail(res, 503, 'order_create_failed', 'Siparişiniz oluşturulamadı. Lütfen birkaç dakika sonra tekrar deneyin.');
  }

  /* ─── PayTR token isteği ───
     Sepet satır adları varyantı da içerir ("Ürün (Renk · Beden)"), böylece
     PayTR ekranında ve mutabakatta hangi varyantın satıldığı görünür. */
  const base = siteBaseUrl();
  const resultUrl = `${base}/odeme-sonuc.html?order=${encodeURIComponent(orderId)}&t=${encodeURIComponent(accessToken)}`;

  const addressText = address
    ? `${address.adres} ${address.ilce}/${address.sehir}`
    : MERCHANT.address.full;

  let result;
  try {
    result = await paytr.createPaymentToken({
      userIp:        ip,
      merchantOid:   orderId,
      email:         buyer.email,
      totalKurus:    basket.totalKurus,
      lines:         basket.lines.map(l => ({ name: clean(lineTitle(l), 100), unitKurus: l.unitKurus, qty: l.qty })),
      noInstallment,
      maxInstallment,
      currency:      'TL',
      userName:      `${buyer.ad} ${buyer.soyad}`,
      userAddress:   addressText,
      userPhone:     buyer.telefon,
      okUrl:         resultUrl,
      failUrl:       `${resultUrl}&durum=basarisiz`,
      timeoutMinutes: PAYMENT_TIMEOUT_MINUTES
    }, cfg, { timeoutMs: 20000 });
  } catch (err) {
    console.error('[payment] PayTR token isteği başarısız (%s): %s', orderId, err.message);
    await safeMarkFailed(orderId, 'gateway_unreachable', 'Ödeme sağlayıcısına ulaşılamadı.');
    return fail(res, 503, 'gateway_unreachable', 'Ödeme sayfası şu anda açılamadı. Lütfen tekrar deneyin; kartınızdan herhangi bir çekim yapılmadı.');
  }

  if (result.status !== 'success' || !result.token) {
    logPaymentEvent({
      event: 'initialize_failed',
      orderId,
      provider: 'paytr',
      environment: paytrMode(),
      httpStatus: result.httpStatus,
      reason: result.reason || null
    });
    await safeMarkFailed(orderId, 'token_failed', result.reason || 'Ödeme başlatılamadı.');
    return fail(res, 502, 'initialize_failed', 'Ödeme başlatılamadı. Lütfen tekrar deneyin; kartınızdan herhangi bir çekim yapılmadı.');
  }

  try {
    await store.updateOrder(orderId, {
      checkoutToken: result.token,
      tokenCreatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('[payment] token kaydedilemedi (%s): %s', orderId, err.message);
  }

  logPaymentEvent({
    event: 'initialize_ok',
    orderId,
    provider: 'paytr',
    environment: paytrMode(),
    totalKurus: basket.totalKurus,
    itemCount: basket.lines.length,
    member: Boolean(session)
  });

  return json(res, 200, {
    ok: true,
    orderId,
    accessToken,
    // Ödeme formu bu adreste açılır (iframe). Kart verisi yalnız PayTR'ye gider.
    iframeUrl: result.iframeUrl,
    paymentToken: result.token,
    totalKurus: basket.totalKurus,
    timeoutMinutes: PAYMENT_TIMEOUT_MINUTES
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
