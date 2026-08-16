'use strict';

/* =========================================
   iyzico HTTP istemcisi (bağımlılıksız)
   =========================================
   Resmî Node SDK'sı (iyzipay) `fs.readdirSync` ile dinamik require yapar;
   Vercel'in serverless bundler'ı bu dosyaları izleyemediği için burada
   iyzico'nun dokümante ettiği HMACSHA256 (IYZWSv2) yetkilendirmesi ve
   Checkout Form endpoint'leri doğrudan uygulanmıştır. Referanslar:

   - IYZWSv2 imzası : randomKey + uriPath + JSON body → HMAC-SHA256(secretKey), hex
                      Authorization: IYZWSv2 base64("apiKey:..&randomKey:..&signature:..")
                      x-iyzi-rnd: randomKey
   - Yanıt imzası   : ilgili alanların ':' ile birleştirilip
                      HMAC-SHA256(secretKey) → hex hâli, yanıttaki `signature`
   - Webhook imzası : X-IYZ-SIGNATURE-V3 (eski V1/V2 desteklenmiyor)

   Bu dosya kart verisi GÖRMEZ: Checkout Form'da PAN/CVV yalnız iyzico'nun
   kendi ödeme sayfasına girilir (PCI kapsamı minimumda tutulur). */

const crypto = require('crypto');

const PATHS = {
  checkoutFormInitialize: '/payment/iyzipos/checkoutform/initialize/auth/ecom',
  checkoutFormRetrieve:   '/payment/iyzipos/checkoutform/auth/ecom/detail',
  paymentRetrieve:        '/payment/detail'
};

const DEFAULT_TIMEOUT_MS = 20000;

/* ─── Fiyat formatı ───
   iyzico "1" yerine "1.0", "12.5" yerine "12.5" bekler; SDK'nın
   formatPrice davranışı birebir taklit edilir. Girdi kuruş cinsindendir. */
function formatPriceFromKurus(kurus) {
  const value = (Number(kurus) / 100).toFixed(2);          // "7499.00"
  const trimmed = value.replace(/0+$/, '').replace(/\.$/, ''); // "7499"
  return trimmed.includes('.') ? trimmed : `${trimmed}.0`;  // "7499.0"
}

/* ─── IYZWSv2 başlıkları ─── */
function authHeaders(uriPath, bodyJson, cfg) {
  const randomKey = crypto.randomBytes(12).toString('hex');
  const signature = crypto
    .createHmac('sha256', cfg.secretKey)
    .update(randomKey + uriPath + bodyJson)
    .digest('hex');

  const authorization = Buffer.from(
    `apiKey:${cfg.apiKey}&randomKey:${randomKey}&signature:${signature}`
  ).toString('base64');

  return {
    'Authorization':  `IYZWSv2 ${authorization}`,
    'x-iyzi-rnd':     randomKey,
    'x-iyzi-client-version': 'efemiletisim-1.0',
    'Content-Type':   'application/json',
    'Accept':         'application/json'
  };
}

/* ─── İstek ───
   Dönüş: { ok, status, body, rawText }
   `rawText` yanıt imzasının doğrulanabilmesi için saklanır: sayısal
   alanlar JSON.parse'tan sonra ("7499.0" → 7499) formatını kaybeder. */
async function request(uriPath, payload, cfg, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const bodyJson = JSON.stringify(payload);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(cfg.baseUrl + uriPath, {
      method:  'POST',
      headers: authHeaders(uriPath, bodyJson, cfg),
      body:    bodyJson,
      signal:  controller.signal
    });

    const rawText = await res.text();
    let body = null;
    try { body = JSON.parse(rawText); } catch { /* iyzico her zaman JSON döner; değilse body null kalır */ }

    return { ok: res.ok, status: res.status, body, rawText };
  } finally {
    clearTimeout(timer);
  }
}

/* ─── Yanıttaki KÖK seviye skaler alanların ham metin hâli ───
   itemTransactions içinde de `price`/`paidPrice` bulunduğu için
   yalnızca birinci seviye anahtarlar toplanır. */
function topLevelRawScalars(text) {
  const out = {};
  if (typeof text !== 'string') return out;

  let i = 0, depth = 0;
  const n = text.length;

  const skipWs = () => { while (i < n && /\s/.test(text[i])) i++; };
  const readString = () => {
    // text[i] === '"'
    const start = i;
    i++;
    while (i < n) {
      if (text[i] === '\\') { i += 2; continue; }
      if (text[i] === '"')  { i++; break; }
      i++;
    }
    return text.slice(start, i);
  };

  while (i < n) {
    const ch = text[i];

    if (ch === '{' || ch === '[') { depth++; i++; continue; }
    if (ch === '}' || ch === ']') { depth--; i++; continue; }
    if (ch === '"') {
      const rawKey = readString();
      skipWs();
      if (text[i] !== ':') continue;   // dizi elemanı gibi bir string, anahtar değil
      i++;
      skipWs();

      if (depth !== 1) continue;       // iç içe objelerin anahtarları atlanır

      let key;
      try { key = JSON.parse(rawKey); } catch { continue; }

      if (text[i] === '"') {
        const rawVal = readString();
        try { out[key] = JSON.parse(rawVal); } catch { /* yoksay */ }
      } else if (text[i] === '{' || text[i] === '[') {
        continue;                       // skaler değil
      } else {
        const start = i;
        while (i < n && !',}] \n\r\t'.includes(text[i])) i++;
        out[key] = text.slice(start, i);
      }
      continue;
    }
    i++;
  }
  return out;
}

/* ─── Yanıt imzası ─── */
function calculateSignature(params, secretKey) {
  return crypto
    .createHmac('sha256', secretKey)
    .update(params.map(p => (p === undefined || p === null ? '' : String(p))).join(':'))
    .digest('hex');
}

function safeEquals(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/* ─── Checkout Form: initialize ─── */
async function initializeCheckoutForm(payload, cfg, options) {
  const res = await request(PATHS.checkoutFormInitialize, payload, cfg, options);
  const body = res.body || {};
  const raw  = topLevelRawScalars(res.rawText);

  const signatureValid = body.status === 'success' && Boolean(body.signature) && safeEquals(
    calculateSignature([raw.conversationId, raw.token], cfg.secretKey),
    String(body.signature)
  );

  return { ...res, signatureValid };
}

/* ─── Checkout Form: sonucu sorgula (tek doğruluk kaynağı) ───
   Tarayıcının döndürdüğü callback verisi DEĞİL, bu sorgunun sonucu esastır. */
async function retrieveCheckoutForm({ token, conversationId }, cfg, options) {
  const payload = { locale: 'tr', conversationId: String(conversationId || ''), token: String(token) };
  const res = await request(PATHS.checkoutFormRetrieve, payload, cfg, options);
  const body = res.body || {};
  const raw  = topLevelRawScalars(res.rawText);

  const signatureValid = body.status === 'success' && Boolean(body.signature) && safeEquals(
    calculateSignature(
      [
        raw.paymentStatus, raw.paymentId, raw.currency, raw.basketId,
        raw.conversationId, raw.paidPrice, raw.price, raw.token
      ],
      cfg.secretKey
    ),
    String(body.signature)
  );

  return { ...res, raw, signatureValid };
}

/* ─── Ödeme detayını sorgula (webhook/mutabakat) ─── */
async function retrievePayment({ paymentId, paymentConversationId }, cfg, options) {
  const payload = { locale: 'tr' };
  if (paymentId)             payload.paymentId = String(paymentId);
  if (paymentConversationId) payload.paymentConversationId = String(paymentConversationId);
  const res = await request(PATHS.paymentRetrieve, payload, cfg, options);
  return { ...res, raw: topLevelRawScalars(res.rawText) };
}

/* ─── Webhook: X-IYZ-SIGNATURE-V3 ───
   HPP (Checkout Form) : secretKey + iyziEventType + iyziPaymentId + token +
                         paymentConversationId + status
   Doğrudan (API)      : secretKey + iyziEventType + paymentId +
                         paymentConversationId + status
   İki biçim de denenir; hangisi eşleşirse istek iyzico'dan gelmiştir. */
function verifyWebhookSignatureV3(payload, headerSignature, secretKey) {
  if (!headerSignature || typeof headerSignature !== 'string') return false;

  const eventType    = payload.iyziEventType || '';
  const paymentId    = payload.iyziPaymentId || payload.paymentId || '';
  const token        = payload.token || '';
  const conversation = payload.paymentConversationId || '';
  const status       = payload.status || '';

  const candidates = [
    `${secretKey}${eventType}${paymentId}${token}${conversation}${status}`,
    `${secretKey}${eventType}${paymentId}${conversation}${status}`
  ];

  return candidates.some(data => safeEquals(
    crypto.createHmac('sha256', secretKey).update(data).digest('hex'),
    headerSignature.trim()
  ));
}

module.exports = {
  PATHS,
  formatPriceFromKurus,
  topLevelRawScalars,
  calculateSignature,
  safeEquals,
  initializeCheckoutForm,
  retrieveCheckoutForm,
  retrievePayment,
  verifyWebhookSignatureV3
};
