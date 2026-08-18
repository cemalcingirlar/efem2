'use strict';

/* =========================================
   Ortam yapılandırması (sunucu tarafı)
   =========================================
   Hiçbir sır (merchant key/salt, service account) client bundle'ına GİRMEZ.
   Tüm değerler Vercel → Project → Settings → Environment Variables
   üzerinden gelir (bkz. .env.example ve docs/PAYTR-ENTEGRASYON.md).

   Tasarım kararı: yapılandırma eksikse kart ödemesi KAPALI kalır
   ("fail closed"). Site çalışmaya devam eder, checkout kart yerine
   EFT/havale sunar; hiçbir koşulda "ödeme başarılı" taklidi yapılmaz. */

const PAYTR_TOKEN_URL = 'https://www.paytr.com/odeme/api/get-token';
const PAYTR_IFRAME_URL = 'https://www.paytr.com/odeme/guvenli';

function str(name) {
  const v = process.env[name];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/* ─── PayTR ───
   merchant_id / merchant_key / merchant_salt üçü de PayTR mağaza panelinden
   alınır. Üçü birden yoksa kart ödemesi açılmaz. */
function paytrConfig() {
  const merchantId   = str('PAYTR_MERCHANT_ID');
  const merchantKey  = str('PAYTR_MERCHANT_KEY');
  const merchantSalt = str('PAYTR_MERCHANT_SALT');
  if (!merchantId || !merchantKey || !merchantSalt) return null;

  return {
    merchantId,
    merchantKey,
    merchantSalt,
    tokenUrl:  PAYTR_TOKEN_URL,
    iframeUrl: PAYTR_IFRAME_URL,
    testMode:  isTestMode(),
    debugOn:   str('PAYTR_DEBUG_ON') === '1'
  };
}

/* PayTR'de "test modu" mağaza canlıyken bile işlem başına gönderilebilir.
   Varsayılan: TEST (1). Canlıya geçerken PAYTR_TEST_MODE=0 yapılır —
   yani yanlışlıkla gerçek para çekmek değil, test kalmak varsayılandır. */
function isTestMode() {
  return str('PAYTR_TEST_MODE') === '0' ? false : true;
}

function paytrMode() {
  return isTestMode() ? 'test' : 'production';
}

/* ─── Taksit ───
   Varsayılan: taksit kapalı (no_installment = 1). Elektronik/telekomünikasyon
   ürünlerinde BDDK taksit kısıtları vardır; taksit açılacaksa hem PayTR
   panelinde tanımlı hem de kategori için mevzuata uygun olmalıdır. */
function installmentSettings() {
  const noInstallment = str('PAYTR_NO_INSTALLMENT') === '0' ? 0 : 1;
  const raw = parseInt(str('PAYTR_MAX_INSTALLMENT') || '0', 10);
  const maxInstallment = Number.isInteger(raw) && raw >= 0 && raw <= 12 ? raw : 0;
  return { noInstallment, maxInstallment };
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
   Ayrı bir sır tanımlanmadıysa PayTR merchant key'inden türetilir;
   böylece jeton üretimi hiçbir zaman zayıf/sabit bir anahtara düşmez. */
function orderTokenSecret() {
  const explicit = str('ORDER_TOKEN_SECRET');
  if (explicit) return explicit;
  const cfg = paytrConfig();
  return cfg ? `derived:${cfg.merchantKey}` : null;
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
/* Çalışmayan bir değerin NE olduğunu tahmin eder. İçeriğinden hiçbir şey
   döndürmez, yalnız sınıfını. */
function valueShapeHint(text) {
  if (/^["']/.test(text))              return 'tirnak_icinde_yapistirilmis';
  if (/^[A-Za-z]:[\/]/.test(text))     return 'windows_dosya_yolu';
  if (/^[~/]/.test(text))               return 'unix_dosya_yolu';
  if (/.json$/i.test(text))            return 'dosya_adi';
  if (/^-----BEGIN/.test(text))         return 'sadece_private_key';
  if (/^AIza/.test(text))               return 'web_api_key';
  return 'bilinmiyor';
}

/* ─── Servis hesabı teşhisi ───
   "Değişken hiç yok" ile "var ama okunamıyor" aynı sonucu (store: false)
   verdiği için ayırt edilemiyordu. Bu fonksiyon SADECE durumu söyler;
   anahtarın kendisinden hiçbir parça dışarı verilmez.

   present  : ortam değişkeni tanımlı mı
   parsed   : JSON olarak çözülüp zorunlu alanları taşıyor mu
   reason   : çözülemediyse hangi aşamada takıldı                        */
function serviceAccountDiagnostics() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (typeof raw !== 'string' || !raw.trim()) {
    return { present: false, parsed: false, reason: 'not_set' };
  }

  let text = raw.trim();
  if (!text.startsWith('{')) {
    let decoded = null;
    try {
      const candidate = Buffer.from(text, 'base64').toString('utf8').trim();
      if (candidate.startsWith('{')) decoded = candidate;
    } catch { /* base64 değil */ }

    if (decoded === null) {
      return {
        present: true,
        parsed:  false,
        reason:  'not_json_not_base64',
        hint:    valueShapeHint(text),
        length:  text.length
      };
    }
    text = decoded;
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { present: true, parsed: false, reason: 'invalid_json' };
  }

  const missing = ['project_id', 'client_email', 'private_key']
    .filter(k => !parsed[k]);
  if (missing.length) {
    return { present: true, parsed: false, reason: 'missing_fields', missing };
  }

  // project_id gizli bir bilgi değil; istemci SDK yapılandırmasında zaten var.
  return { present: true, parsed: true, projectId: String(parsed.project_id) };
}

function paymentStatusReport() {
  return {
    paytr: Boolean(paytrConfig()),
    store: Boolean(serviceAccount()),
    mode:  paytrMode()
  };
}

/* Kart ödemesi ancak hem PayTR kimlik bilgileri hem de sipariş defteri
   hazırsa açılır: sipariş kaydı olmadan idempotency/mutabakat yapılamaz. */
function isCardPaymentEnabled() {
  const s = paymentStatusReport();
  return s.paytr && s.store;
}

module.exports = {
  PAYTR_TOKEN_URL,
  PAYTR_IFRAME_URL,
  paytrConfig,
  paytrMode,
  isTestMode,
  installmentSettings,
  siteBaseUrl,
  orderTokenSecret,
  serviceAccount,
  serviceAccountDiagnostics,
  paymentStatusReport,
  isCardPaymentEnabled
};
