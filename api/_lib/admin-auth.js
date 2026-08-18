'use strict';

/* =========================================
   Admin yetkilendirme (sunucu tarafı)
   =========================================
   admin.html'deki eski koruma İSTEMCİ TARAFINDAYDI: kullanıcı adı/şifre
   sayfanın kaynağında duruyordu, sayfayı açan herkes görebiliyordu ve
   sessionStorage'a bir bayrak yazmak yetiyordu.

   Buradaki kontrol sunucuda çalışır:
     1) İstek Firebase ID token taşımalı (gerçek bir oturum),
     2) e-posta doğrulanmış olmalı,
     3) e-posta ADMIN_EMAILS listesinde bulunmalı.

   Liste ortam değişkeninde durur; repoda veya istemci kodunda yer almaz.
   Örn: ADMIN_EMAILS=destek@efemiletisim.com,cemal@ornek.com               */

const { verifyIdToken } = require('./store');

function adminEmails() {
  const raw = process.env.ADMIN_EMAILS;
  if (typeof raw !== 'string' || !raw.trim()) return [];
  return raw.split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
}

/* ─── Kurulum teşhisi ───
   Yönetici adresleri dışarı verilmez (kişisel veri + hedef listesi olur);
   yalnız "kaç geçerli adres var" ve "geçersiz bir şey yapıştırılmış mı"
   bilgisi döner. Yanlış değer yapıştırıldığında sebebi görünsün diye. */
function adminEmailsDiagnostics() {
  const raw = process.env.ADMIN_EMAILS;

  if (typeof raw !== 'string' || !raw.trim()) {
    return { present: false, valid: 0, reason: 'not_set' };
  }

  const parts = raw.split(',').map(p => p.trim()).filter(Boolean);
  const EMAIL_RE = /^[^s@]+@[^s@]+.[^s@]{2,}$/;
  const valid = parts.filter(p => EMAIL_RE.test(p)).length;

  if (valid === 0) {
    return { present: true, valid: 0, reason: 'no_valid_email', length: raw.trim().length };
  }
  return { present: true, valid, invalid: parts.length - valid };
}

function isAdminConfigured() {
  return adminEmails().length > 0;
}

/* Dönüş: { ok: true, admin: {uid, email} } | { ok: false, code, message } */
async function requireAdmin(req) {
  const allow = adminEmails();
  if (!allow.length) {
    return {
      ok: false,
      code: 'admin_not_configured',
      message: 'Yönetici erişimi yapılandırılmamış. Sunucuda ADMIN_EMAILS tanımlanmalı.'
    };
  }

  const session = await verifyIdToken(req.headers.authorization);
  if (!session) {
    return { ok: false, code: 'unauthenticated', message: 'Oturum bulunamadı. Lütfen giriş yapın.' };
  }

  if (!session.emailVerified) {
    return { ok: false, code: 'email_unverified', message: 'E-posta adresiniz doğrulanmamış.' };
  }

  const email = String(session.email || '').toLowerCase();
  if (!email || !allow.includes(email)) {
    return { ok: false, code: 'forbidden', message: 'Bu hesabın yönetici yetkisi yok.' };
  }

  return { ok: true, admin: { uid: session.uid, email } };
}

/* Yetki hatasının HTTP karşılığı. 401 "kim olduğunu bilmiyorum",
   403 "biliyorum ama yetkin yok", 503 "sunucu yapılandırılmamış". */
function authStatus(code) {
  if (code === 'unauthenticated')     return 401;
  if (code === 'admin_not_configured') return 503;
  return 403;
}

/* Uçların ortak kapısı: yetki yoksa yanıtı kendisi yazar ve null döner.
   Kullanım:  const admin = await adminGate(req, res); if (!admin) return; */
async function adminGate(req, res) {
  const { fail } = require('./http');
  const store = require('./store');

  if (!store.isStoreConfigured()) {
    fail(res, 503, 'store_unavailable',
      'Sunucu veritabanı yapılandırılmamış. Sunucuda FIREBASE_SERVICE_ACCOUNT tanımlanmalı.');
    return null;
  }

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    fail(res, authStatus(auth.code), auth.code, auth.message);
    return null;
  }
  return auth.admin;
}

module.exports = { requireAdmin, adminGate, authStatus, isAdminConfigured, adminEmails, adminEmailsDiagnostics };
