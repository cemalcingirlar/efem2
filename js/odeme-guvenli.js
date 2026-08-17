/* =========================================
   PayTR ödeme formu (iFrame API 1. adım çıktısı)
   =========================================
   Token, /api/payment/initialize çağrısından gelir ve bu sayfaya sorgu
   parametresiyle taşınır. Buradaki hiçbir kod ödeme sonucu ÜRETMEZ; sonuç
   yalnızca PayTR'nin sunucumuza gönderdiği, imzası doğrulanmış bildirimden
   okunur (api/payment/notify.js).

   Bu dosya satır içi <script> yerine ayrı bir dosyadır: sayfa 'unsafe-inline'
   içermeyen sıkı bir Content-Security-Policy ile servis edilir, böylece
   sayfaya enjekte edilen bir script (e-skimming) tarayıcı tarafından
   çalıştırılmaz. Bkz. vercel.json → /odeme-guvenli.html başlıkları.       */

document.addEventListener('DOMContentLoaded', () => {
  const params  = new URLSearchParams(window.location.search);
  const token   = (params.get('token') || '').trim();
  const orderId = (params.get('order') || '').trim();
  const access  = (params.get('t') || '').trim();

  const wrap  = document.getElementById('frame-wrap');
  const error = document.getElementById('frame-error');

  // Token yoksa/biçimi bozuksa iframe hiç açılmaz.
  if (!/^[A-Za-z0-9]{10,128}$/.test(token)) {
    error.hidden = false;
    return;
  }

  const frame = document.createElement('iframe');
  frame.id = 'paytriframe';
  frame.src = 'https://www.paytr.com/odeme/guvenli/' + encodeURIComponent(token);
  frame.setAttribute('frameborder', '0');
  frame.setAttribute('scrolling', 'no');
  frame.setAttribute('title', 'PayTR güvenli ödeme formu');
  wrap.appendChild(frame);

  if (typeof iFrameResize === 'function') {
    iFrameResize({ checkOrigin: false }, '#paytriframe');
  }

  // Sipariş özeti (bilgi amaçlı; tutarın kaynağı sunucudur)
  if (orderId && access) {
    document.getElementById('summary-order').textContent = orderId;
    fetchOrderStatus(orderId, access)
      .then(order => {
        document.getElementById('summary-total').textContent = order.totalText;
        document.getElementById('secure-summary').hidden = false;
      })
      .catch(() => { /* özet gösterilemezse ödeme akışı yine de sürer */ });
  }
});
