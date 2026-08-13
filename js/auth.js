/* =========================================
   efemiletisim.com – Kimlik Doğrulama
   ========================================= */

const AUTH_KEY  = 'efemi_user';
const USERS_KEY = 'efemi_users';

/* ─── Kullanıcıları oku ─── */
function getUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; }
  catch { return []; }
}

/* ─── Mevcut kullanıcıyı oku ─── */
function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem(AUTH_KEY)) || null; }
  catch { return null; }
}

/* ─── Giriş yapılmış mı? ─── */
function isLoggedIn() {
  return getCurrentUser() !== null;
}

/* ─── Kayıt ─── */
function register(ad, soyad, email, password) {
  const users = getUsers();

  if (users.find(u => u.email === email)) {
    return { success: false, msg: 'Bu e-posta adresi zaten kayıtlı.' };
  }

  const user = {
    id:        Date.now(),
    ad,
    soyad,
    email,
    password:  btoa(password), // basit encoding (demo)
    createdAt: new Date().toISOString(),
    orders:    [],
    addresses: []
  };

  users.push(user);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));

  // Otomatik giriş
  const { password: _, ...safeUser } = user;
  localStorage.setItem(AUTH_KEY, JSON.stringify(safeUser));

  updateNavAuth();
  return { success: true, user: safeUser };
}

/* ─── Giriş ─── */
function login(email, password) {
  const users = getUsers();
  const user  = users.find(u => u.email === email && u.password === btoa(password));

  if (!user) {
    return { success: false, msg: 'E-posta veya şifre hatalı.' };
  }

  const { password: _, ...safeUser } = user;
  localStorage.setItem(AUTH_KEY, JSON.stringify(safeUser));

  updateNavAuth();
  return { success: true, user: safeUser };
}

/* ─── Çıkış ─── */
function logout() {
  localStorage.removeItem(AUTH_KEY);
  updateNavAuth();
  showToast('Başarıyla çıkış yapıldı.', 'success');
  setTimeout(() => { window.location.href = 'index.html'; }, 800);
}

/* ─── Sipariş kaydet ─── */
function saveOrder(orderData) {
  const currentUser = getCurrentUser();
  if (!currentUser) return null;

  const users = getUsers();
  const userIdx = users.findIndex(u => u.id === currentUser.id);
  if (userIdx < 0) return null;

  const order = {
    id:        'EFM' + Date.now().toString().slice(-6),
    date:      new Date().toISOString(),
    status:    'processing',
    statusLabel: 'Hazırlanıyor',
    items:     orderData.items,
    total:     orderData.total,
    address:   orderData.address
  };

  users[userIdx].orders.unshift(order);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));

  // Session'ı güncelle
  const { password: _, ...safeUser } = users[userIdx];
  localStorage.setItem(AUTH_KEY, JSON.stringify(safeUser));

  return order;
}

/* ─── Navbar auth durumunu güncelle ─── */
function updateNavAuth() {
  const user = getCurrentUser();
  const loginLink   = document.getElementById('nav-login-link');
  const userMenu    = document.getElementById('nav-user-menu');
  const userNameEl  = document.getElementById('nav-user-name');

  if (loginLink && userMenu) {
    if (user) {
      loginLink.classList.add('hidden');
      userMenu.classList.remove('hidden');
      if (userNameEl) userNameEl.textContent = user.ad;
    } else {
      loginLink.classList.remove('hidden');
      userMenu.classList.add('hidden');
    }
  }
}

/* ─── Sayfa koruma: Giriş gerektiren sayfalar ─── */
function requireAuth(redirectTo = 'hesap.html') {
  if (!isLoggedIn()) {
    window.location.href = redirectTo + '?redirect=' + encodeURIComponent(window.location.href);
    return false;
  }
  return true;
}

/* ─── Form validasyonu ─── */
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password) {
  return password.length >= 6;
}
