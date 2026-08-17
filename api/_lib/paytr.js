'use strict';

/* =========================================
   PayTR iFrame API istemcisi (bağımlılıksız)
   =========================================
   PayTR'nin dokümante ettiği iki adım:

   1) Token alma  → POST https://www.paytr.com/odeme/api/get-token
      paytr_token = base64( HMAC-SHA256(
        merchant_id + user_ip + merchant_oid + email + payment_amount +
        user_basket + no_installment + max_installment + currency + test_mode +
        merchant_salt, merchant_key ) )
      Dönen token ile ödeme formu açılır:
        https://www.paytr.com/odeme/guvenli/<token>

   2) Bildirim URL (server-to-server) → PayTR sonucu POST eder
      hash = base64( HMAC-SHA256(
        merchant_oid + merchant_salt + status + total_amount, merchant_key ) )
      Doğrulandıktan sonra gövdesi TAM OLARAK "OK" olan yanıt dönülmelidir.

   ÖNEMLİ kurallar (PayTR dokümanı):
   - payment_amount ve total_amount kuruş cinsindendir (34,56 TL → 3456).
   - merchant_oid EN FAZLA 64 karakter ve ALFANUMERİK olmalıdır (tire/boşluk yok).
   - Sipariş sonucu merchant_ok_url'den DEĞİL, bildirim URL'sinden belirlenir;
     PayTR akışı asenkrondur.

   Bu dosya kart verisi GÖRMEZ: kart numarası/CVV yalnız PayTR'nin kendi
   ödeme formuna girilir.                                                     */

const crypto = require('crypto');

const DEFAULT_TIMEOUT_MS = 20000;

/* ─── Yardımcılar ─── */

/* Kuruş → PayTR'nin beklediği tamsayı string (34,56 TL → "3456") */
function amountFromKurus(kurus) {
  return String(Math.round(Number(kurus)));
}

/* Kuruş → sepet satırındaki birim fiyat string'i ("18.00") */
function priceText(kurus) {
  return (Number(kurus) / 100).toFixed(2);
}

/* PayTR sepet formatı: [[ürün adı, birim fiyat, adet], ...] → JSON → base64 */
function buildBasket(lines) {
  const rows = lines.map(l => [String(l.name), priceText(l.unitKurus), Number(l.qty)]);
  return Buffer.from(JSON.stringify(rows), 'utf8').toString('base64');
}

/* merchant_oid: alfanumerik zorunluluğu PayTR tarafından konur. */
const OID_RE = /^[A-Za-z0-9]{1,64}$/;
function isValidMerchantOid(value) {
  return typeof value === 'string' && OID_RE.test(value);
}

/* PayTR e-posta alanında Türkçe karakter istemiyor; adres/ad alanlarında da
   çok uzun değerler sorun çıkarıyor. Aksanları sadeleştirip kırpıyoruz. */
function asciiSafe(value, maxLength) {
  const map = { ç: 'c', Ç: 'C', ğ: 'g', Ğ: 'G', ı: 'i', İ: 'I', ö: 'o', Ö: 'O', ş: 's', Ş: 'S', ü: 'u', Ü: 'U' };
  return String(value || '')
    .replace(/[çÇğĞıİöÖşŞüÜ]/g, ch => map[ch])
    .replace(/[^\x20-\x7E]/g, '')
    .trim()
    .slice(0, maxLength);
}

function safeEquals(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/* ─── 1. adım: token isteği imzası ─── */
function tokenHash(fields, cfg) {
  const hashStr =
    cfg.merchantId +
    fields.user_ip +
    fields.merchant_oid +
    fields.email +
    fields.payment_amount +
    fields.user_basket +
    fields.no_installment +
    fields.max_installment +
    fields.currency +
    fields.test_mode;

  return crypto
    .createHmac('sha256', cfg.merchantKey)
    .update(hashStr + cfg.merchantSalt)
    .digest('base64');
}

/* ─── 1. adım: token al ───
   Dönüş: { ok, status, body, token, reason, iframeUrl } */
async function createPaymentToken(input, cfg, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const fields = {
    merchant_id:      cfg.merchantId,
    user_ip:          input.userIp,
    merchant_oid:     input.merchantOid,
    email:            asciiSafe(input.email, 100),
    payment_amount:   amountFromKurus(input.totalKurus),
    user_basket:      buildBasket(input.lines),
    no_installment:   String(input.noInstallment),
    max_installment:  String(input.maxInstallment),
    currency:         input.currency || 'TL',
    test_mode:        cfg.testMode ? '1' : '0'
  };

  fields.paytr_token      = tokenHash(fields, cfg);
  fields.user_name        = asciiSafe(input.userName, 60);
  fields.user_address     = asciiSafe(input.userAddress, 400);
  fields.user_phone       = asciiSafe(input.userPhone, 20);
  fields.merchant_ok_url  = input.okUrl;
  fields.merchant_fail_url = input.failUrl;
  fields.timeout_limit    = String(input.timeoutMinutes || 30);
  fields.debug_on         = cfg.debugOn ? '1' : '0';
  fields.lang             = 'tr';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(cfg.tokenUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams(fields).toString(),
      signal:  controller.signal
    });

    const rawText = await res.text();
    let body = null;
    try { body = JSON.parse(rawText); } catch { /* PayTR JSON döner; değilse body null */ }

    const token = body && body.status === 'success' ? String(body.token || '') : null;

    return {
      ok: res.ok,
      httpStatus: res.status,
      status: body ? body.status : null,
      reason: body ? body.reason : null,
      token,
      iframeUrl: token ? `${cfg.iframeUrl}/${token}` : null,
      sentAmount: fields.payment_amount
    };
  } finally {
    clearTimeout(timer);
  }
}

/* ─── 2. adım: bildirim (callback) imzası ─── */
function notificationHash(payload, cfg) {
  return crypto
    .createHmac('sha256', cfg.merchantKey)
    .update(
      String(payload.merchant_oid || '') +
      cfg.merchantSalt +
      String(payload.status || '') +
      String(payload.total_amount || '')
    )
    .digest('base64');
}

function verifyNotification(payload, cfg) {
  const expected = notificationHash(payload, cfg);
  return safeEquals(expected, String(payload.hash || ''));
}

module.exports = {
  amountFromKurus,
  priceText,
  buildBasket,
  asciiSafe,
  isValidMerchantOid,
  safeEquals,
  tokenHash,
  createPaymentToken,
  notificationHash,
  verifyNotification
};
