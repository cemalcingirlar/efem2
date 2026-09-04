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

  /* Token yoksa/biçimi bozuksa iframe hiç açılmaz.

     Desen neden bu kadar geniş: PayTR'nin ödeme token'ı base64 üretiliyor,
     yani `+`, `/`, `=` içerebiliyor. Önceki desen yalnız harf-rakam kabul
     ediyordu (`[A-Za-z0-9]{10,128}`) ve testlerdeki sahte token da harf-rakam
     olduğu için bu hiç yakalanmamıştı; canlıda gerçek token reddedilip
     "Ödeme formu açılamadı" hatası veriyordu. Sunucu tarafı token'ı başarıyla
     almış oluyordu, yani para akışında değil yalnız bu kontrolde takılıyordu.

     Güvenlik: token zaten encodeURIComponent ile URL'e konuyor, bu desen
     yalnız açıkça bozuk girdiyi eleyen bir ön kontroldür. Boşluk, `<`, `"`,
     `?`, `#` gibi karakterler hâlâ reddedilir. */
  const TOKEN_DESENI = /^[A-Za-z0-9+/=_-]{10,256}$/;

  if (!token) {
    /* Parametresiz gelinmiş: kullanıcı bu sayfaya doğrudan girmiş ya da
       yönlendirme parametreleri kaybolmuş. */
    console.warn('[odeme] token parametresi yok; ödeme adımından gelinmemiş.');
    error.hidden = false;
    return;
  }

  if (!TOKEN_DESENI.test(token)) {
    /* Token'ın kendisi loga YAZILMAZ; yalnız neden reddedildiği. */
    console.warn('[odeme] token biçimi reddedildi (uzunluk: %d).', token.length);
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
