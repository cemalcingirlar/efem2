/* =========================================
   PayTR taksit tablosu
   =========================================
   PayTR'nin verdiği gömme kodu tek bir <script> etiketi ve sabit bir
   <div id="paytr_taksit_tablosu"> bekliyor. Betik yaptığı tek iş:

     document.getElementById('paytr_taksit_tablosu').innerHTML = '...'

   XHR/fetch yapmıyor, document.write kullanmıyor. Bu iki özellik önemli:

   1) İçerik Güvenliği Politikası (vercel.json) tarafında ek izin gerekmiyor:
      betik `script-src ... https://www.paytr.com` ile yükleniyor, banka
      logoları `img-src 'self' data: https:` ile geliyor. `connect-src`
      genişletilmedi — yapılandırma sorgusu kendi kaynağımıza ('self') gidiyor.
   2) document.write olmadığı için betik sayfa yüklendikten SONRA da
      çalışır; tutar değiştiğinde (sepette adet değişimi, kupon) tabloyu
      yeniden kurabiliyoruz.

   Tutar betiğe URL'de gider. PayTR "1881.38", "162,10", "2.640,50" gibi
   biçimleri kabul ediyor; karışıklık olmasın diye burada her zaman nokta
   ayraçlı, iki basamaklı sade biçim üretiliyor (23459.00).

   Buradaki token GİZLİ DEĞİLDİR: taksit tablosu herkese açık bir sayfada
   gömülü çalışır, yani zaten ziyaretçiye görünür. Ödeme imzasında kullanılan
   PAYTR_MERCHANT_KEY / PAYTR_MERCHANT_SALT ile ilgisi yoktur ve onlar
   yalnız sunucu ortam değişkeninde durur.

   ── Tablo ile ödeme adımı neden hep aynı şeyi söyler ──
   Gösterilecek taksit sayısı burada sabit yazılmaz; /api/payment/config'ten
   okunur. O uç sunucunun PayTR'ye gerçekten göndereceği ayarı döndürür
   (api/_lib/env.js → installmentSettings()). Böylece:

     - Kart ödemesi kapalıysa veya taksit kapalıysa tablo hiç gösterilmez.
     - Üst sınır (PAYTR_MAX_INSTALLMENT) neyse tablo da o kadar taksit gösterir.

   Yani müşteriye vitrinde gösterilen taksit, ödeme ekranında bulacağı
   taksittir. Ortam değişkeni değişince tablo kendiliğinden uyar; iki yeri
   elle eşitlemek gerekmez.                                                 */

const PAYTR_TAKSIT = {
  token:      'ba988551db9a3b16c19951991a177777a8a799ae666af296c3f56fc058bab395',
  merchantId: '743825',
  tumu:       1,   // 1 = yalnız avantajlılar değil, tüm seçenekler
  base:       'https://www.paytr.com/odeme/taksit-tablosu/v2'
};

const PAYTR_TABLO_ID  = 'paytr_taksit_tablosu';
const PAYTR_BETIK_ID  = 'paytr-taksit-betigi';
const PAYTR_BOLUM_ID  = 'paytr-taksit-bolumu';

/* Sunucunun taksit ayarı. Sayfa başına bir kez sorulur.
   Ulaşılamazsa null döner ve tablo gösterilmez ("fail closed"): olmayan bir
   taksidi reklam etmektense hiç göstermemek doğrudur. */
let paytrAyarSozu = null;

function paytrAyar() {
  if (!paytrAyarSozu) {
    paytrAyarSozu = fetch('/api/payment/config')
      .then(r => (r.ok ? r.json() : null))
      .catch(() => null);
  }
  return paytrAyarSozu;
}

/* Tutarı PayTR'nin beklediği sade biçime çevirir: 23459 → "23459.00" */
function paytrTutarBicimle(tutar) {
  const n = Number(tutar);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n.toFixed(2);
}

/* Gösterilmesi istenen son tutar. Betikler eşzamansız yüklendiği için
   geç dönen eski bir istek yenisinin üzerine yazabilir; yüklenme anında
   bu değerle karşılaştırıp gerekirse tablo yeniden kurulur. */
let paytrIstenenTutar = null;
let paytrZamanlayici  = null;

function paytrBolumuGizle() {
  const bolum = document.getElementById(PAYTR_BOLUM_ID);
  const kutu  = document.getElementById(PAYTR_TABLO_ID);
  document.getElementById(PAYTR_BETIK_ID)?.remove();
  if (bolum) bolum.style.display = 'none';
  if (kutu) { kutu.innerHTML = ''; delete kutu.dataset.cizim; }
}

/* Tabloyu verilen tutar için (yeniden) kurar.
   Tutar geçersizse veya sıfırsa bölüm gizlenir — PayTR amount=0 için boş
   yanıt döndürüyor, boş bir kutu göstermenin anlamı yok. */
function renderInstallmentTable(tutar) {
  if (!document.getElementById(PAYTR_TABLO_ID)) return;

  paytrIstenenTutar = paytrTutarBicimle(tutar);

  /* Sepette adet düğmesine üst üste basılabiliyor; her basışta PayTR'ye
     istek atmamak için kısa bir bekleme ile birleştiriliyor. */
  clearTimeout(paytrZamanlayici);
  paytrZamanlayici = setTimeout(paytrTabloyuKur, 120);
}

async function paytrTabloyuKur() {
  const kutu = document.getElementById(PAYTR_TABLO_ID);
  if (!kutu) return;

  const miktar = paytrIstenenTutar;
  if (!miktar) { paytrBolumuGizle(); return; }

  /* Kart ödemesi veya taksit kapalıysa tablo gösterilmez. Bu kontrol
     olmadan vitrinde 12 taksit yazıp ödeme ekranında tek çekim çıkabilirdi. */
  const ayar = await paytrAyar();
  if (!ayar || !ayar.installmentsEnabled) { paytrBolumuGizle(); return; }

  // Tutar bu arada değiştiyse güncel değerle devam et
  if (paytrIstenenTutar !== miktar) { paytrTabloyuKur(); return; }

  const bolum = document.getElementById(PAYTR_BOLUM_ID);

  /* PAYTR_MAX_INSTALLMENT ile aynı sınır. 0 = sınır yok (PayTR neyi
     destekliyorsa onu gösterir). */
  const sinir = Number(ayar.maxInstallment) || 0;

  /* Aynı çizim zaten duruyorsa tekrar istek atma. Anahtara sınır da giriyor:
     yalnız tutara bakılsaydı üst sınır değiştiğinde eski tablo ekranda kalırdı. */
  const cizimAnahtari = miktar + '|' + sinir;
  if (kutu.dataset.cizim === cizimAnahtari && kutu.innerHTML.trim()) return;

  // Önceki betiği kaldır: aynı id ile yenisi eklenince tarayıcı tekrar çalıştırır
  document.getElementById(PAYTR_BETIK_ID)?.remove();
  kutu.innerHTML = '';

  const url = `${PAYTR_TAKSIT.base}?token=${encodeURIComponent(PAYTR_TAKSIT.token)}`
            + `&merchant_id=${encodeURIComponent(PAYTR_TAKSIT.merchantId)}`
            + `&amount=${encodeURIComponent(miktar)}`
            + `&taksit=${sinir}&tumu=${PAYTR_TAKSIT.tumu}`;

  const betik = document.createElement('script');
  betik.id    = PAYTR_BETIK_ID;
  betik.src   = url;
  betik.async = true;

  /* PayTR'ye ulaşılamazsa sayfa bozulmamalı: bölüm sessizce gizlenir.
     Taksit tablosu bir kolaylık, satın almanın önkoşulu değil. */
  betik.onerror = () => {
    paytrBolumuGizle();
    console.warn('[taksit] PayTR taksit tablosu yüklenemedi.');
  };

  betik.onload = () => {
    /* Bu betik yüklenirken tutar değiştiyse çizilen tablo eskidir; atılıp
       güncel tutarla yeniden kuruluyor. */
    if (paytrIstenenTutar !== miktar) { paytrTabloyuKur(); return; }
    kutu.dataset.cizim = cizimAnahtari;
    // Boş yanıt geldiyse (ör. tutar tablo için çok düşük) bölümü gösterme
    if (bolum) bolum.style.display = kutu.innerHTML.trim() ? 'block' : 'none';
  };

  document.body.appendChild(betik);
}

/* Sayfaya taksit bölümünü basar. Çağıran yer yalnız nereye ve hangi
   tutarla koyacağını söyler. */
function installmentSectionHtml(baslik) {
  return `
    <div id="${PAYTR_BOLUM_ID}" class="taksit-bolumu" style="display:none">
      <div class="taksit-bolum-baslik">
        <svg class="icon icon-sm" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M2 10h20"/></svg>
        ${baslik || 'Taksit Seçenekleri'}
      </div>
      <div id="${PAYTR_TABLO_ID}"></div>
      <div class="taksit-not">
        Taksit tutarları bankaların güncel oranlarına göre hesaplanır; kartınıza
        özel kampanyalar ödeme adımında geçerli olabilir.
      </div>
    </div>`;
}
