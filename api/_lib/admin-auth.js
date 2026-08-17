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

module.exports = { requireAdmin, isAdminConfigured, adminEmails };
