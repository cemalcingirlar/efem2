'use strict';

/* =========================================
   Ortam yapılandırması (sunucu tarafı)
   =========================================
   Hiçbir sır (secretKey, service account) client bundle'ına GİRMEZ.
   Tüm değerler Vercel → Project → Settings → Environment Variables
   üzerinden gelir (bkz. .env.example ve docs/IYZICO-ENTEGRASYON.md).

   Tasarım kararı: yapılandırma eksikse kart ödemesi KAPALI kalır
   ("fail closed"). Site çalışmaya devam eder, checkout kart yerine
   EFT/havale sunar; hiçbir koşulda "ödeme başarılı" taklidi yapılmaz. */

const SANDBOX_URI    = 'https://sandbox-api.iyzipay.com';
const PRODUCTION_URI = 'https://api.iyzipay.com';

function str(name) {
  const v = process.env[name];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/* ─── iyzico ─── */
function iyzicoMode() {
  return str('IYZICO_MODE') === 'production' ? 'production' : 'sandbox';
}

function iyzicoBaseUrl() {
  const explicit = str('IYZICO_BASE_URL');
  if (explicit) return explicit.replace(/\/+$/, '');
  return iyzicoMode() === 'production' ? PRODUCTION_URI : SANDBOX_URI;
}

function iyzicoConfig() {
  const apiKey    = str('IYZICO_API_KEY');
  const secretKey = str('IYZICO_SECRET_KEY');
  if (!apiKey || !secretKey) return null;
  return { apiKey, secretKey, baseUrl: iyzicoBaseUrl(), mode: iyzicoMode() };
}

/* ─── Ortam tutarlılık kapısı (rapor: TC-ENV) ───
   production modda sandbox base URL'i (veya tersi) kullanılırsa
   ödeme başlatma reddedilir; yanlış ortama trafik gitmez. */
function environmentMismatch() {
  const cfg = iyzicoConfig();
  if (!cfg) return null;
  if (cfg.mode === 'production' && cfg.baseUrl.includes('sandbox')) {
    return 'IYZICO_MODE=production ancak IYZICO_BASE_URL sandbox adresini gösteriyor.';
  }
  if (cfg.mode === 'sandbox' && cfg.baseUrl === PRODUCTION_URI) {
    return 'IYZICO_MODE=sandbox ancak IYZICO_BASE_URL production adresini gösteriyor.';
  }
  return null;
}

/* ─── Taksit ───
   Varsayılan: tek çekim. Taksit açılacaksa hem merchant hesabında tanımlı
   hem de BDDK'nın ürün kategorisi için izin verdiği plan olmalıdır
   (bkz. docs/IYZICO-DENETIM-RAPORU.md → BDDK taksit uygunluğu). */
function enabledInstallments() {
  const raw = str('IYZICO_ENABLED_INSTALLMENTS');
  if (!raw) return [1];
  const list = raw.split(',')
    .map(n => parseInt(n.trim(), 10))
    .filter(n => Number.isInteger(n) && n >= 1 && n <= 12);
  return list.length ? [...new Set(list)] : [1];
}

/* ─── Site ─── */
function siteBaseUrl() {
  const explicit = str('SITE_BASE_URL');
  if (explicit) return explicit.replace(/\/+$/, '');
  const vercel = str('VERCEL_PROJECT_PRODUCTION_URL') || str('VERCEL_URL');
  if (vercel) return `https://${vercel.replace(/\/+$/, '')}`;
  return 'https://efemiletisim.com';
}

/* ─── Misafir siparişi erişim jetonu için HMAC anahtarı ───
   Ayrı bir sır tanımlanmadıysa iyzico secretKey'inden türetilir;
   böylece jeton üretimi hiçbir zaman zayıf/sabit bir anahtara düşmez. */
function orderTokenSecret() {
  const explicit = str('ORDER_TOKEN_SECRET');
  if (explicit) return explicit;
  const cfg = iyzicoConfig();
  return cfg ? `derived:${cfg.secretKey}` : null;
}

/* ─── Firebase Admin (sipariş defteri) ───
   FIREBASE_SERVICE_ACCOUNT: service account JSON'unun tamamı (tek satır)
   veya base64 hâli. */
function serviceAccount() {
  const raw = str('FIREBASE_SERVICE_ACCOUNT');
  if (!raw) return null;
  let text = raw;
  if (!text.trim().startsWith('{')) {
    try { text = Buffer.from(text, 'base64').toString('utf8'); }
    catch { return null; }
  }
  try {
    const parsed = JSON.parse(text);
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) return null;
    parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    return parsed;
  } catch {
    return null;
  }
}

/* ─── Genel durum ─── */
function paymentStatusReport() {
  return {
    iyzico:   Boolean(iyzicoConfig()),
    store:    Boolean(serviceAccount()),
    mismatch: environmentMismatch(),
    mode:     iyzicoMode()
  };
}

/* Kart ödemesi ancak hem iyzico kimlik bilgileri hem de sipariş defteri
   hazırsa açılır: sipariş kaydı olmadan idempotency/mutabakat yapılamaz. */
function isCardPaymentEnabled() {
  const s = paymentStatusReport();
  return s.iyzico && s.store && !s.mismatch;
}

module.exports = {
  SANDBOX_URI,
  PRODUCTION_URI,
  iyzicoMode,
  iyzicoBaseUrl,
  iyzicoConfig,
  environmentMismatch,
  enabledInstallments,
  siteBaseUrl,
  orderTokenSecret,
  serviceAccount,
  paymentStatusReport,
  isCardPaymentEnabled
};
