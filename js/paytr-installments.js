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
      genişletilmedi — gereksiz yere gevşetmemek için.
   2) document.write olmadığı için betik sayfa yüklendikten SONRA da
      çalışır; tutar değiştiğinde (sepette adet değişimi, kupon) tabloyu
      yeniden kurabiliyoruz.

   Tutar betiğe URL'de gider. PayTR "1881.38", "162,10", "2.640,50" gibi
   biçimleri kabul ediyor; karışıklık olmasın diye burada her zaman nokta
   ayraçlı, iki basamaklı sade biçim üretiliyor (23459.00).

   Buradaki token GİZLİ DEĞİLDİR: taksit tablosu herkese açık bir sayfada
   gömülü çalışır, yani zaten ziyaretçiye görünür. Ödeme imzasında kullanılan
   PAYTR_MERCHANT_KEY / PAYTR_MERCHANT_SALT ile ilgisi yoktur ve onlar
   yalnız sunucu ortam değişkeninde durur.                                  */

/* DİKKAT — tablo ile ödeme adımı ayrı ayarlardır.
   Burada gösterilen taksit seçenekleri ödeme sırasında otomatik olarak açılmaz.
   Ödeme adımında gerçekten sunulacak taksitleri sunucu belirler:
   api/_lib/env.js → installmentSettings() → PAYTR_NO_INSTALLMENT / PAYTR_MAX_INSTALLMENT.
   Varsayılan PAYTR_NO_INSTALLMENT=1, yani taksit KAPALI. Bu tabloyu yayında tutacaksanız
   ortam değişkenini 0 yapıp üst sınırı buradaki `taksit` değeriyle eşitleyin; aksi hâlde
   müşteri gördüğü taksidi ödeme ekranında bulamaz.
   Ayrıntı ve mevzuat uyarısı: docs/PAYTR-ENTEGRASYON.md → bölüm 10.                       */

const PAYTR_TAKSIT = {
  token:      'ba988551db9a3b16c19951991a177777a8a799ae666af296c3f56fc058bab395',
  merchantId: '743825',
  taksit:     0,   // 0 = sınır yok
  tumu:       1,   // 1 = yalnız avantajlılar değil, tüm seçenekler
  base:       'https://www.paytr.com/odeme/taksit-tablosu/v2'
};

const PAYTR_TABLO_ID  = 'paytr_taksit_tablosu';
const PAYTR_BETIK_ID  = 'paytr-taksit-betigi';
const PAYTR_BOLUM_ID  = 'paytr-taksit-bolumu';

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

/* Tabloyu verilen tutar için (yeniden) kurar.
   Tutar geçersizse veya sıfırsa bölüm gizlenir — PayTR amount=0 için boş
   yanıt döndürüyor, boş bir kutu göstermenin anlamı yok. */
function renderInstallmentTable(tutar) {
  const kutu = document.getElementById(PAYTR_TABLO_ID);
  if (!kutu) return;

  paytrIstenenTutar = paytrTutarBicimle(tutar);

  /* Sepette adet düğmesine üst üste basılabiliyor; her basışta PayTR'ye
     istek atmamak için kısa bir bekleme ile birleştiriliyor. */
  clearTimeout(paytrZamanlayici);
  paytrZamanlayici = setTimeout(paytrTabloyuKur, 120);
}

function paytrTabloyuKur() {
  const bolum = document.getElementById(PAYTR_BOLUM_ID);
  const kutu  = document.getElementById(PAYTR_TABLO_ID);
  if (!kutu) return;

  const miktar = paytrIstenenTutar;
  if (!miktar) {
    document.getElementById(PAYTR_BETIK_ID)?.remove();
    if (bolum) bolum.style.display = 'none';
    kutu.innerHTML = '';
    return;
  }

  // Aynı tutar zaten çizilmişse tekrar istek atma
  if (kutu.dataset.tutar === miktar && kutu.innerHTML.trim()) return;

  // Önceki betiği kaldır: aynı id ile yenisi eklenince tarayıcı tekrar çalıştırır
  document.getElementById(PAYTR_BETIK_ID)?.remove();
  kutu.innerHTML = '';

  const url = `${PAYTR_TAKSIT.base}?token=${encodeURIComponent(PAYTR_TAKSIT.token)}`
            + `&merchant_id=${encodeURIComponent(PAYTR_TAKSIT.merchantId)}`
            + `&amount=${encodeURIComponent(miktar)}`
            + `&taksit=${PAYTR_TAKSIT.taksit}&tumu=${PAYTR_TAKSIT.tumu}`;

  const betik = document.createElement('script');
  betik.id    = PAYTR_BETIK_ID;
  betik.src   = url;
  betik.async = true;

  /* PayTR'ye ulaşılamazsa sayfa bozulmamalı: bölüm sessizce gizlenir.
     Taksit tablosu bir kolaylık, satın almanın önkoşulu değil. */
  betik.onerror = () => {
    if (bolum) bolum.style.display = 'none';
    console.warn('[taksit] PayTR taksit tablosu yüklenemedi.');
  };

  betik.onload = () => {
    /* Bu betik yüklenirken tutar değiştiyse çizilen tablo eskidir; atılıp
       güncel tutarla yeniden kuruluyor. */
    if (paytrIstenenTutar !== miktar) { paytrTabloyuKur(); return; }
    kutu.dataset.tutar = miktar;
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
