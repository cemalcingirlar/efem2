/* =========================================
   efemiletisim.com – Oturum Yönetimi (tek kaynak)
   =========================================
   Tüm oturum durumu Firebase Authentication üzerinden yürür.
   Bu dosya ES module'dür ve sayfalara şu şekilde eklenir:
     <script type="module" src="js/auth.js"></script>

   Inline onclick handler'ları için gerekli fonksiyonlar window'a bağlanır.
   ========================================= */

import {
  onAuthChange,
  firebaseLogout,
  getUserProfile,
  updateUserProfile,
  replaceUserAddresses,
  deleteUserAccount
} from './firebase-auth.js';

/* ─── Misafir oturumu ───
   "Üye olmadan devam et" seçildiğinde tutulan hafif oturum.
   Sipariş takibi için e-posta ve telefon ödeme adımında toplanır. */
const GUEST_KEY = 'efemi_guest';

/* ─── Oturum durumu ─── */
const session = {
  user:      null,   // Firebase User
  profile:   null,   // Firestore users/{uid} dokümanı
  guest:     null,   // { ad, soyad, email, telefon } | null
  ready:     false
};

let resolveAuthReady;
const authReady = new Promise(resolve => { resolveAuthReady = resolve; });

/* ─── Misafir oturumu oku/yaz ─── */
function getGuest() {
  const raw = localStorage.getItem(GUEST_KEY);
  if (!raw) return null;
  return JSON.parse(raw);
}

function setGuest(data) {
  localStorage.setItem(GUEST_KEY, JSON.stringify(data));
  session.guest = data;
  updateNavAuth();
}

function clearGuest() {
  localStorage.removeItem(GUEST_KEY);
  session.guest = null;
  updateNavAuth();
}

/* ─── "Üye olmadan devam et" ─── */
function continueAsGuest(redirectTo) {
  setGuest({ startedAt: new Date().toISOString() });
  window.location.href = redirectTo || 'urunler.html';
}

/* ─── Durum sorguları ─── */
function isLoggedIn()  { return session.user !== null; }
function isGuest()     { return session.user === null && session.guest !== null; }

function getCurrentUser() {
  if (session.user) {
    const [ad, ...rest] = (session.user.displayName || '').split(' ');
    return {
      uid:   session.user.uid,
      email: session.user.email,
      ad:    session.profile?.ad    ?? ad   ?? '',
      soyad: session.profile?.soyad ?? rest.join(' ') ?? '',
      telefon:      session.profile?.telefon      ?? '',
      tck:          session.profile?.tck          ?? '',
      dogumTarihi:  session.profile?.dogumTarihi  ?? '',
      orders:    session.profile?.orders    ?? [],
      addresses: session.profile?.addresses ?? []
    };
  }
  if (session.guest) {
    return {
      uid:   null,
      guest: true,
      email: session.guest.email ?? '',
      ad:    session.guest.ad    ?? '',
      soyad: session.guest.soyad ?? '',
      orders: [],
      addresses: []
    };
  }
  return null;
}

/* ─── Profil bilgilerini güncelle ─── */
async function saveProfileFields(data) {
  if (!session.user) return { success: false, msg: "Oturum bulunamadı." };
  const result = await updateUserProfile(session.user.uid, data);
  if (result.success) {
    session.profile = { ...session.profile, ...data };
  }
  return result;
}

/* ─── Kayıtlı adres listesini güncelle ─── */
async function saveAddresses(addresses) {
  if (!session.user) return { success: false, msg: "Oturum bulunamadı." };
  const result = await replaceUserAddresses(session.user.uid, addresses);
  if (result.success) {
    session.profile = { ...session.profile, addresses };
  }
  return result;
}

/* ─── Hesabı kalıcı sil ─── */
async function deleteAccount(password) {
  const result = await deleteUserAccount(password);
  if (result.success) {
    clearGuest();
    session.user    = null;
    session.profile = null;
  }
  return result;
}

/* ─── Çıkış ───
   `silent: true` yalnız oturumu kapatır; toast göstermez ve sayfayı
   değiştirmez (admin paneli gibi kendi yönlendirmesini yapan ekranlar
   için). */
async function logout({ silent = false } = {}) {
  const result = await firebaseLogout();
  if (!result.success) {
    if (!silent) showToast(result.msg, 'error');
    return result;
  }
  clearGuest();
  if (silent) return result;

  showToast('Başarıyla çıkış yapıldı.', 'success');
  setTimeout(() => { window.location.href = 'index.html'; }, 800);
  return result;
}

/* ─── Navbar oturum durumunu güncelle ─── */
function updateNavAuth() {
  const user       = getCurrentUser();
  const loginLink  = document.getElementById('nav-login-link');
  const userMenu   = document.getElementById('nav-user-menu');
  const userNameEl = document.getElementById('nav-user-name');

  if (!loginLink || !userMenu) return;

  const signedIn = isLoggedIn();
  loginLink.classList.toggle('hidden', signedIn);
  userMenu.classList.toggle('hidden', !signedIn);

  if (signedIn && userNameEl) {
    userNameEl.textContent = user.ad || user.email.split('@')[0];
  }

  // Misafir modunda giriş linki "Giriş Yap" olarak kalır ama etiket değişir
  if (isGuest() && !signedIn) {
    loginLink.textContent = 'Giriş Yap / Kayıt Ol';
  }
}

/* ─── Giriş gerektiren sayfalar ───
   allowGuest: true → misafir oturumu da kabul edilir (ör. ödeme sayfası) */
async function requireAuth({ allowGuest = false, redirectTo = 'hesap.html' } = {}) {
  await authReady;

  if (isLoggedIn()) return true;
  if (allowGuest && isGuest()) return true;

  const target = `${redirectTo}?redirect=${encodeURIComponent(window.location.href)}`;
  window.location.href = target;
  return false;
}

/* ─── Firebase ID token ───
   Ödeme/sipariş API'sine "bu istek gerçekten bu üyeye ait" kanıtı olarak
   gönderilir; sunucu tokenı Firebase Admin ile doğrular. Üye değilse null
   döner ve sipariş misafir siparişi olarak açılır. */
async function getIdToken() {
  await authReady;
  if (!session.user) return null;
  try {
    return await session.user.getIdToken();
  } catch (err) {
    console.error('[auth] ID token alınamadı:', err.message);
    return null;
  }
}

/* ─── Form validasyonu ─── */
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password) {
  return password.length >= 6;
}

/* ─── Firebase oturum dinleyicisi ─── */
onAuthChange(async (user) => {
  session.user = user && user.emailVerified ? user : null;

  if (session.user) {
    session.profile = await getUserProfile(session.user.uid);
    // Giriş yapan kullanıcı için misafir oturumu anlamsız
    if (localStorage.getItem(GUEST_KEY)) clearGuest();
  } else {
    session.profile = null;
    session.guest   = getGuest();
  }

  session.ready = true;
  resolveAuthReady(session);
  updateNavAuth();

  window.dispatchEvent(new CustomEvent('authChanged', {
    detail: { user: getCurrentUser(), signedIn: isLoggedIn(), guest: isGuest() }
  }));
});

/* ─── Inline handler'lar ve klasik script'ler için window'a bağla ─── */
Object.assign(window, {
  authReady,
  isLoggedIn,
  isGuest,
  getCurrentUser,
  getIdToken,
  continueAsGuest,
  setGuest,
  clearGuest,
  logout,
  updateNavAuth,
  requireAuth,
  validateEmail,
  validatePassword,
  saveProfileFields,
  saveAddresses,
  deleteAccount
});

export {
  authReady,
  isLoggedIn,
  isGuest,
  getCurrentUser,
  getIdToken,
  continueAsGuest,
  setGuest,
  clearGuest,
  logout,
  updateNavAuth,
  requireAuth,
  saveProfileFields,
  saveAddresses,
  deleteAccount
};
