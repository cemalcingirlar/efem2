/* =========================================
   efemiletisim.com – Ödeme (PayTR iFrame API)
   =========================================
   ÖNEMLİ: Bu dosya kart bilgisi TOPLAMAZ ve ödeme sonucunu ÜRETMEZ.

   Akış:
     1) /api/payment/config      → kart ödemesi açık mı?
     2) /api/payment/initialize  → sunucu sepeti kendi fiyatlarıyla
                                   hesaplar, siparişi açar ve PayTR'den
                                   ödeme token'ı alır
     3) odeme-guvenli.html       → PayTR ödeme formu iframe içinde açılır
                                   (kart no/CVV yalnız PayTR'ye gider,
                                   PCI kapsamı bu sitede tutulmaz)
     4) /api/payment/notify      → PayTR sonucu sunucuya bildirir (imzalı)
     5) odeme-sonuc.html         → sipariş durumu sunucudan okunur

   PayTR akışı ASENKRONDUR: müşterinin döndüğü sayfa "ödeme başarılı"
   kanıtı değildir; sonuç yalnız bildirim ile yazılır. */

const PAYMENT_API = {
  config:     '/api/payment/config',
  initialize: '/api/payment/initialize',
  eftOrder:   '/api/order/eft',
  orderStatus:'/api/order/status'
};

/* ─── Ödeme yetenekleri ───
   Yapılandırma yoksa kart ödemesi kapalıdır; checkout kart sekmesini
   göstermez ve müşteriyi EFT/havaleye yönlendirir. */
let paymentCapabilities = null;

async function loadPaymentCapabilities() {
  if (paymentCapabilities) return paymentCapabilities;
  try {
    const res = await fetch(PAYMENT_API.config, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error(`config HTTP ${res.status}`);
    const data = await res.json();
    paymentCapabilities = {
      cardEnabled:         Boolean(data.cardEnabled),
      orderApiEnabled:     Boolean(data.orderApiEnabled),
      mode:                data.mode || null,          // 'test' | 'production'
      installmentsEnabled: Boolean(data.installmentsEnabled),
      maxInstallment:      Number(data.maxInstallment) || 0,
      provider:            data.provider || 'paytr'
    };
  } catch (err) {
    console.warn('[payment] ödeme yapılandırması okunamadı, kart ödemesi kapalı kabul edildi:', err.message);
    paymentCapabilities = {
      cardEnabled: false, orderApiEnabled: false, mode: null,
      installmentsEnabled: false, maxInstallment: 0, provider: 'paytr'
    };
  }
  return paymentCapabilities;
}

/* ─── Sunucuya gidecek sepet ───
   Yalnız ürün kimliği, varyant sku'su ve adet gönderilir. Fiyat/toplam ve
   renk/beden metni gönderilmez; sunucu bunları kendi kataloğundan okur. */
function cartForServer() {
  return getCart().map(item => ({ id: item.id, sku: item.sku || null, qty: item.qty }));
}

async function authHeader() {
  if (typeof window.getIdToken !== 'function') return {};
  const token = await window.getIdToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

async function postJson(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(await authHeader())
    },
    body: JSON.stringify(payload)
  });

  let data = null;
  try { data = await res.json(); } catch { /* gövde JSON değil */ }

  if (!res.ok || !data || data.ok !== true) {
    const error = new Error((data && data.message) || 'İşlem tamamlanamadı. Lütfen tekrar deneyin.');
    error.code = (data && data.code) || `http_${res.status}`;
    error.status = res.status;
    throw error;
  }
  return data;
}

/* ─── Kart ile ödemeyi başlat ───
   Başarılıysa bu fonksiyon DÖNMEZ: tarayıcı güvenli ödeme sayfasına gider.
   PayTR ödeme formu orada iframe içinde açılır. */
async function startCardPayment(orderInput) {
  const data = await postJson(PAYMENT_API.initialize, {
    items:      cartForServer(),
    // Yalnız KOD gider; indirim tutarını sunucu kendi tanımından hesaplar.
    couponCode: typeof getAppliedCouponCode === 'function' ? getAppliedCouponCode() : '',
    buyer:      orderInput.buyer,
    address:    orderInput.address,
    invoice:    orderInput.invoice,
    delivery:   orderInput.delivery,
    agreements: orderInput.agreements
  });

  // Sipariş numarası ve erişim jetonu, ödeme sayfasından dönülemezse
  // (sekme kapandı vb.) sonucu tekrar sorgulayabilmek için saklanır.
  rememberPendingOrder(data.orderId, data.accessToken);

  const params = new URLSearchParams({
    token: data.paymentToken,
    order: data.orderId,
    t:     data.accessToken
  });
  window.location.href = 'odeme-guvenli.html?' + params.toString();
  return data;
}

/* ─── EFT/havale siparişi oluştur ─── */
async function createEftOrder(orderInput) {
  const data = await postJson(PAYMENT_API.eftOrder, {
    items:        cartForServer(),
    couponCode:   typeof getAppliedCouponCode === 'function' ? getAppliedCouponCode() : '',
    buyer:        orderInput.buyer,
    address:      orderInput.address,
    invoice:      orderInput.invoice,
    delivery:     orderInput.delivery,
    agreements:   orderInput.agreements,
    eftReceiptNo: orderInput.eftReceiptNo || null
  });
  return data;
}

/* ─── Bekleyen sipariş hatırlatıcısı ─── */
const PENDING_ORDER_KEY = 'efemi_pending_order';

function rememberPendingOrder(orderId, accessToken) {
  try {
    localStorage.setItem(PENDING_ORDER_KEY, JSON.stringify({
      orderId, accessToken, startedAt: Date.now()
    }));
  } catch { /* localStorage kapalı olabilir */ }
}

function readPendingOrder() {
  try {
    const raw = localStorage.getItem(PENDING_ORDER_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    // 24 saatten eski kayıt anlamsızdır
    if (!data.orderId || Date.now() - data.startedAt > 86400000) return null;
    return data;
  } catch { return null; }
}

function clearPendingOrder() {
  try { localStorage.removeItem(PENDING_ORDER_KEY); } catch { /* yoksay */ }
}

/* ─── Sipariş durumunu sunucudan oku ─── */
async function fetchOrderStatus(orderId, accessToken) {
  const url = `${PAYMENT_API.orderStatus}?order=${encodeURIComponent(orderId)}&t=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || data.ok !== true) {
    const error = new Error((data && data.message) || 'Sipariş durumu okunamadı.');
    error.code = (data && data.code) || `http_${res.status}`;
    throw error;
  }
  return data.order;
}

/* ─── Adres form validasyonu ───
   Bu yalnızca kullanıcıya hızlı geri bildirim içindir; gerçek doğrulama
   sunucuda tekrar yapılır (istemci doğrulaması bir güvenlik kontrolü değildir). */
const ADDRESS_REQUIRED_FIELDS = ['ad', 'soyad', 'telefon', 'email', 'adres', 'sehir', 'ilce'];

function validateAddressForm(data, required = ADDRESS_REQUIRED_FIELDS) {
  const errors = [];

  required.forEach(field => {
    if (!data[field] || !data[field].toString().trim()) {
      errors.push({ field: `addr-${field}`, msg: 'Bu alan zorunludur.' });
    }
  });

  if (data.telefon && !/^(\+90|0)?[5][0-9]{9}$/.test(data.telefon.replace(/\s/g, ''))) {
    errors.push({ field: 'addr-telefon', msg: 'Geçerli bir Türkiye telefon numarası girin.' });
  }

  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
    errors.push({ field: 'addr-email', msg: 'Geçerli bir e-posta adresi girin.' });
  }

  return errors;
}

/* ─── Hata mesajlarını göster ─── */
function showFormErrors(errors) {
  document.querySelectorAll('.form-error').forEach(el => el.textContent = '');
  document.querySelectorAll('.form-input.error, .form-select.error').forEach(el => el.classList.remove('error'));

  errors.forEach(({ field, msg }) => {
    const input = document.getElementById(field);
    const errorEl = document.getElementById(`${field}-error`);
    if (input)   input.classList.add('error');
    if (errorEl) errorEl.textContent = msg;
  });
}
