'use strict';

/* =========================================
   Ödeme sonucunu tek noktadan sonuçlandırma (PayTR)
   =========================================
   PayTR akışı ASENKRONDUR: müşterinin döndüğü `merchant_ok_url` sayfası
   "ödeme başarılı" kanıtı DEĞİLDİR. Finansal doğruluğun tek kaynağı
   PayTR'nin Bildirim URL'sine (server-to-server) gönderdiği, imzası
   doğrulanmış POST'tur.

   Karar tablosu:
     imza geçersiz        → hiçbir şey yazılmaz, istek reddedilir (401)
     tutar uyuşmuyor      → pending_review (para çekilmiş olabilir, sevkiyat yok)
     status = success     → paid
     status = failed      → failed (kullanıcıya banka mesajı gösterilmez)

   Geçişler transaction içinde yapıldığı için aynı bildirim tekrar tekrar
   gelse de sonuç tek ve aynı kalır (PayTR bildirimi tekrarlayabilir). */

const store  = require('./store');
const { paytrMode } = require('./env');
const { MERCHANT } = require('./merchant');
const { formatTry, legacyOrderSummary, lineTitle } = require('./orders');
const { buildMerchantMail } = require('./notify-merchant');
const { logPaymentEvent } = require('./http');

/* Bu durumlardaki sipariş, sonradan gelen bir bildirimle GERİ ALINMAZ.
   Ödeme sonuçlananlar (paid/refunded/cancelled) ve yöneticinin elle geçirdiği
   sevkiyat durumları burada: kargoya verilmiş bir sipariş, geç gelen bir
   bildirim yüzünden "hazırlanıyor"a dönmemeli. */
const TERMINAL = new Set([
  'paid', 'refunded', 'cancelled',
  'processing', 'shipped', 'delivered'
]);

const CUSTOMER_MESSAGES = {
  failure:        'Ödeme işleminiz banka tarafından tamamlanamadı. Tutar kartınızdan çekilmedi.',
  pending_review: 'Ödemeniz alındı ancak doğrulama tamamlanmadı. Ekibimiz siparişinizi kontrol ediyor; sizinle iletişime geçeceğiz.'
};

function statusLabelFor(status) {
  switch (status) {
    case 'paid':              return 'Hazırlanıyor';
    case 'pending_review':    return 'İnceleniyor';
    case 'failed':            return 'Ödeme alınamadı';
    case 'awaiting_payment':  return 'Ödeme bekleniyor';
    case 'awaiting_transfer': return 'EFT/havale bekleniyor';
    default:                  return 'Bilinmiyor';
  }
}

/* ─── PayTR bildirimini uygula ───
   payload: PayTR'nin POST ettiği, imzası ZATEN doğrulanmış gövde.
   Dönüş: { outcome, orderId, status, applied } */
async function settleNotification(payload, { source = 'notification' } = {}) {
  const orderId = String(payload.merchant_oid || '');
  if (!orderId) return { outcome: 'invalid_payload' };

  let order;
  try {
    order = await store.getOrder(orderId);
  } catch (err) {
    console.error('[settle] sipariş okunamadı (%s): %s', orderId, err.message);
    return { outcome: 'store_unavailable', orderId };
  }

  if (!order) {
    logPaymentEvent({ event: 'settle_order_not_found', source, orderId });
    return { outcome: 'order_not_found', orderId };
  }

  const paidKurus   = Number.parseInt(payload.total_amount, 10);
  const sentKurus   = Number.parseInt(payload.payment_amount, 10);
  const isSuccess   = String(payload.status) === 'success';

  /* PayTR total_amount = gerçekten tahsil edilen tutar. Siparişin sunucuda
     hesaplanmış tutarıyla birebir tutmalı; tutmuyorsa sevkiyat başlamaz. */
  const problems = [];
  if (isSuccess && Number.isFinite(paidKurus) && paidKurus !== order.totalKurus) problems.push('amount_mismatch');
  if (isSuccess && !Number.isFinite(paidKurus)) problems.push('amount_unreadable');
  if (Number.isFinite(sentKurus) && sentKurus !== order.totalKurus) problems.push('sent_amount_mismatch');

  /* Para birimi: siparişlerimiz her zaman TL. Farklı bir para biriminde
     tahsilat bildirilirse otomatik onaylamayız. */
  const notifiedCurrency = String(payload.currency || 'TL').toUpperCase();
  if (isSuccess && notifiedCurrency !== 'TL' && notifiedCurrency !== 'TRY') problems.push('currency_mismatch');

  /* Ortam tutarlılığı: sipariş canlı modda açıldıysa test bildirimi (veya
     tersi) kabul edilmez — test işlemiyle gerçek sipariş "ödendi" olamaz. */
  const notifiedTestMode = String(payload.test_mode || '') === '1';
  const orderWasTest = order.environment === 'test';
  if (isSuccess && notifiedTestMode !== orderWasTest) problems.push('environment_mismatch');

  let nextStatus;
  let customerMessage = null;

  if (isSuccess && problems.length === 0) {
    nextStatus = 'paid';
  } else if (isSuccess) {
    nextStatus = 'pending_review';
    customerMessage = CUSTOMER_MESSAGES.pending_review;
  } else {
    nextStatus = 'failed';
    customerMessage = CUSTOMER_MESSAGES.failure;
  }

  if (problems.length) {
    console.error('[settle] doğrulama uyarısı (%s): %s', orderId, problems.join(','));
  }

  const paymentSnapshot = {
    provider:        'paytr',
    paymentType:     payload.payment_type || null,     // card | eft
    currency:        payload.currency || 'TL',
    paidKurus:       Number.isFinite(paidKurus) ? paidKurus : null,
    installmentCount: Number(payload.installment_count) || 0,
    testMode:        String(payload.test_mode || '') === '1',
    failedReasonCode: payload.failed_reason_code || null,
    failedReasonMsg:  payload.failed_reason_msg || null,
    checkedAt:       new Date().toISOString(),
    checkedBy:       source,
    problems
  };

  const transition = await store.transitionOrder(orderId, (current) => {
    // Sonuçlanmış sipariş tekrar yazılmaz (bildirim tekrarına karşı).
    if (TERMINAL.has(current.status)) return null;
    if (current.status === nextStatus && current.payment && current.payment.checkedBy) return null;

    return {
      status:      nextStatus,
      statusLabel: statusLabelFor(nextStatus),
      customerMessage,
      payment:     paymentSnapshot,
      ...(nextStatus === 'paid' ? { paidAt: new Date().toISOString() } : {})
    };
  });

  logPaymentEvent({
    event: 'settle',
    source,
    orderId,
    status: nextStatus,
    applied: transition.applied,
    provider: 'paytr',
    paymentType: paymentSnapshot.paymentType,
    environment: paytrMode(),
    amountKurus: order.totalKurus,
    paidKurus: paymentSnapshot.paidKurus,
    installment: paymentSnapshot.installmentCount,
    failedReasonCode: paymentSnapshot.failedReasonCode,
    problems
  });

  const finalOrder = transition.order || order;

  // Yan etkiler yalnızca durumu gerçekten değiştiren çağrıda çalışır.
  if (transition.applied && nextStatus === 'paid') {
    await runPaidSideEffects(finalOrder);
  }

  return { outcome: 'ok', orderId, status: nextStatus, applied: transition.applied, order: finalOrder };
}

async function runPaidSideEffects(order) {
  try {
    if (order.userId) {
      await store.appendOrderToUserProfile(order.userId, legacyOrderSummary(order));
    }

    // Müşteriye sipariş onayı
    await store.queueMail(
      order.buyer.email,
      `Siparişiniz alındı – ${order.id}`,
      orderMailHtml(order)
    );

    // İşletmeye sipariş bildirimi
    const merchantMail = buildMerchantMail(order);
    await store.queueMail(merchantMail.to, merchantMail.subject, merchantMail.html);
  } catch (err) {
    console.error('[settle] yan etkiler tamamlanamadı (%s): %s', order.id, err.message);
  }
}

function orderMailHtml(order) {
  const rows = (order.items || [])
    .map(i => `<li>${escapeHtml(lineTitle(i))} × ${i.qty} — ${formatTry(i.totalKurus)}</li>`)
    .join('');

  return `<p>Merhaba ${escapeHtml(order.buyer.ad)},</p>
    <p><strong>${order.id}</strong> numaralı siparişiniz alındı ve hazırlanmaya başlandı.</p>
    <ul>${rows}</ul>
    <p><strong>Toplam: ${formatTry(order.totalKurus)}</strong> (KDV dahil)</p>
    <p>${order.delivery === 'magaza'
      ? `Siparişinizi mağazamızdan teslim alabilirsiniz: ${escapeHtml(MERCHANT.address.full)}`
      : 'Siparişiniz kargoya verildiğinde takip numarası tarafınıza iletilecektir.'}</p>
    <p>Sorularınız için: ${MERCHANT.supportEmail}<br>${escapeHtml(MERCHANT.brandName)}</p>`;
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

module.exports = { settleNotification, statusLabelFor, CUSTOMER_MESSAGES };
