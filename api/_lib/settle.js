'use strict';

/* =========================================
   Ödeme sonucunu tek noktadan sonuçlandırma
   =========================================
   Callback (tarayıcı dönüşü) ve webhook (sunucudan sunucuya) AYNI kodu
   kullanır. Finansal doğruluğun kaynağı hiçbir zaman tarayıcı değil,
   iyzico'nun retrieve yanıtıdır.

   Karar tablosu:
     imza geçersiz            → pending_review (para çekilmiş olabilir, sevkiyat yok)
     conversationId uyuşmuyor → pending_review (payment swap denemesi)
     tutar uyuşmuyor          → pending_review
     fraudStatus = 0          → pending_review
     fraudStatus = -1         → failed
     paymentStatus = SUCCESS  → paid
     diğer                    → failed / awaiting_payment

   Geçişler transaction içinde yapıldığı için aynı olay tekrar tekrar
   gelse de sonuç tek ve aynı kalır (idempotency). */

const iyzico = require('./iyzico');
const store  = require('./store');
const { iyzicoConfig } = require('./env');
const { MERCHANT } = require('./merchant');
const { formatTry, legacyOrderSummary } = require('./orders');
const { logPaymentEvent } = require('./http');

const TERMINAL = new Set(['paid', 'refunded', 'cancelled']);

const CUSTOMER_MESSAGES = {
  failure:        'Ödeme işleminiz banka tarafından tamamlanamadı. Tutar kartınızdan çekilmedi.',
  fraud:          'Ödeme güvenlik kontrolünden geçemedi. Lütfen bizimle iletişime geçin.',
  pending_review: 'Ödemeniz alındı ancak doğrulama tamamlanmadı. Ekibimiz siparişinizi kontrol ediyor; sizinle iletişime geçeceğiz.',
  incomplete:     'Ödeme tamamlanmadı. Dilerseniz tekrar deneyebilirsiniz.'
};

function kurusFromRaw(rawValue) {
  const n = Number.parseFloat(rawValue);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/* ─── Checkout Form jetonuyla sonucu sonuçlandır ─── */
async function settleByToken({ token, expectedOrderId = null, source }) {
  const cfg = iyzicoConfig();
  if (!cfg) return { outcome: 'unavailable' };

  let order = null;
  if (expectedOrderId) {
    order = await store.getOrder(expectedOrderId);
  }
  if (!order) {
    order = await store.findOrderByCheckoutToken(token);
  }
  if (!order) {
    logPaymentEvent({ event: 'settle_order_not_found', source, expectedOrderId: expectedOrderId || null });
    return { outcome: 'order_not_found' };
  }

  const orderId = order.id;

  let result;
  try {
    result = await iyzico.retrieveCheckoutForm({ token, conversationId: orderId }, cfg, { timeoutMs: 20000 });
  } catch (err) {
    console.error('[settle] retrieve başarısız (%s): %s', orderId, err.message);
    return { outcome: 'gateway_unreachable', orderId };
  }

  const body = result.body || {};
  const raw  = result.raw  || {};

  /* Sorgu başarısız: ödeme durumu BİLİNMİYOR. Siparişi "başarısız"
     saymak yerine olduğu gibi bırakıp mutabakata düşürürüz. */
  if (body.status !== 'success') {
    logPaymentEvent({
      event: 'settle_retrieve_failed', source, orderId,
      errorCode: body.errorCode || null, httpStatus: result.status
    });
    return { outcome: 'retrieve_failed', orderId, order };
  }

  const paidKurus     = kurusFromRaw(raw.paidPrice);
  const paymentStatus = String(body.paymentStatus || '');
  const fraudStatus   = Number(body.fraudStatus);

  const problems = [];
  if (!result.signatureValid)                          problems.push('signature_invalid');
  if (String(body.conversationId || '') !== orderId)   problems.push('conversation_mismatch');
  if (String(body.currency || 'TRY') !== 'TRY')        problems.push('currency_mismatch');
  if (paymentStatus === 'SUCCESS' && paidKurus !== order.totalKurus) problems.push('amount_mismatch');
  if (paymentStatus === 'SUCCESS' && fraudStatus === 0) problems.push('fraud_review');

  let nextStatus;
  let customerMessage = null;

  if (paymentStatus === 'SUCCESS' && problems.length === 0) {
    nextStatus = 'paid';
  } else if (paymentStatus === 'SUCCESS') {
    nextStatus = 'pending_review';
    customerMessage = CUSTOMER_MESSAGES.pending_review;
  } else if (fraudStatus === -1) {
    nextStatus = 'failed';
    customerMessage = CUSTOMER_MESSAGES.fraud;
  } else if (paymentStatus === 'FAILURE' || body.errorCode) {
    nextStatus = 'failed';
    customerMessage = CUSTOMER_MESSAGES.failure;
  } else {
    // INIT_THREEDS / CALLBACK_THREEDS / BKM_POS_SELECTED: akış sürüyor.
    nextStatus = 'awaiting_payment';
    customerMessage = CUSTOMER_MESSAGES.incomplete;
  }

  if (problems.length) {
    console.error('[settle] doğrulama uyarısı (%s): %s', orderId, problems.join(','));
  }

  const paymentSnapshot = {
    paymentId:            body.paymentId ? String(body.paymentId) : null,
    paymentTransactionIds: Array.isArray(body.itemTransactions)
      ? body.itemTransactions.map(t => String(t.paymentTransactionId)).slice(0, 20)
      : [],
    paidKurus,
    paymentStatus,
    fraudStatus: Number.isFinite(fraudStatus) ? fraudStatus : null,
    installment: Number(body.installment) || 1,
    cardAssociation: body.cardAssociation || null,   // VISA/MASTER_CARD — PAN değil
    cardFamily:      body.cardFamily || null,
    binNumber:       body.binNumber || null,         // ilk 6 hane; PCI kapsamında PAN değildir
    lastFourDigits:  body.lastFourDigits || null,
    checkedAt: new Date().toISOString(),
    checkedBy: source,
    problems
  };

  const transition = await store.transitionOrder(orderId, (current) => {
    // Sonuçlanmış sipariş tekrar yazılmaz (replay koruması).
    if (TERMINAL.has(current.status)) return null;
    if (current.status === nextStatus && current.paymentId === paymentSnapshot.paymentId) return null;

    return {
      status:      nextStatus,
      statusLabel: statusLabelFor(nextStatus),
      customerMessage,
      payment:     paymentSnapshot,
      paymentId:   paymentSnapshot.paymentId,
      // Ödendi işaretlendiği anda sipariş hazırlanmaya alınır.
      ...(nextStatus === 'paid' ? { paidAt: new Date().toISOString() } : {})
    };
  });

  logPaymentEvent({
    event: 'settle',
    source,
    orderId,
    status: nextStatus,
    applied: transition.applied,
    paymentId: paymentSnapshot.paymentId,
    paymentStatus,
    fraudStatus: paymentSnapshot.fraudStatus,
    amountKurus: order.totalKurus,
    paidKurus,
    problems
  });

  const finalOrder = transition.order || order;

  // Yan etkiler yalnızca durumu gerçekten değiştiren çağrıda çalışır.
  if (transition.applied && nextStatus === 'paid') {
    await runPaidSideEffects(finalOrder);
  }

  return { outcome: 'ok', orderId, status: nextStatus, applied: transition.applied, order: finalOrder };
}

function statusLabelFor(status) {
  switch (status) {
    case 'paid':             return 'Hazırlanıyor';
    case 'pending_review':   return 'İnceleniyor';
    case 'failed':           return 'Ödeme alınamadı';
    case 'awaiting_payment': return 'Ödeme bekleniyor';
    case 'awaiting_transfer':return 'EFT/havale bekleniyor';
    default:                 return 'Bilinmiyor';
  }
}

async function runPaidSideEffects(order) {
  try {
    if (order.userId) {
      await store.appendOrderToUserProfile(order.userId, legacyOrderSummary(order));
    }
    await store.queueMail(
      order.buyer.email,
      `Siparişiniz alındı – ${order.id}`,
      orderMailHtml(order)
    );
  } catch (err) {
    console.error('[settle] yan etkiler tamamlanamadı (%s): %s', order.id, err.message);
  }
}

function orderMailHtml(order) {
  const rows = (order.items || [])
    .map(i => `<li>${escapeHtml(i.name)} × ${i.qty} — ${formatTry(i.totalKurus)}</li>`)
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

module.exports = { settleByToken, statusLabelFor, CUSTOMER_MESSAGES };
