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

   ── PayTR'nin ham çıktısı neden olduğu gibi gösterilmiyor ──
   PayTR 9 kart programı için 2'den 12'ye kadar HER taksidi ayrı ayrı, alt
   alta basıyor: 9 x 11 = 99 satır, yaklaşık 5000 piksel. Üstelik dokuz
   programın oranları çoğu zaman birebir aynı; yani aynı sayılar dokuz kez
   tekrarlanıyor ve sayfa gereksiz uzuyor.

   Bu yüzden çıktı okunup yeniden çiziliyor:
     - Yalnız 3 / 6 / 9 / 12 taksit gösteriliyor, yan yana.
     - Oranları aynı olan kart programları tek grupta toplanıyor; grubun
       logoları tablonun altında sıralanıyor.
     - Oranlar farklıysa gruplar ayrı ayrı gösteriliyor — birleştirme yalnız
       gerçekten aynı olan satırlar için yapılıyor, sayı uydurulmuyor.
     - Müşteri kendi kartını seçince yalnız o kartın seçenekleri kalıyor.

   Tutarlar PayTR'nin döndürdüğü metinden ALINDIĞI GİBİ kullanılır; burada
   hiçbir hesap yapılmaz. Üçüncü taraf içeriği olduğu için DOM düğümleri
   textContent ile kuruluyor, innerHTML ile değil.

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

/* Vitrinde gösterilen taksit adetleri. PayTR aradaki her adedi de döndürüyor
   ama 2,4,5,7,8,10,11 satırları tabloyu okunmaz hale getiriyordu. */
const PAYTR_GOSTERILEN = [3, 6, 9, 12];

const PAYTR_TABLO_ID = 'paytr_taksit_tablosu';
const PAYTR_BETIK_ID = 'paytr-taksit-betigi';
const PAYTR_BOLUM_ID = 'paytr-taksit-bolumu';

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

/* PayTR çıktısından okunan gruplar ve müşterinin seçtiği kart programı.
   Kart seçimi tabloyu yeniden çizer; PayTR'ye tekrar istek gitmez. */
let paytrGruplar     = [];
let paytrSecilenKart = null;

function paytrBolumuGizle() {
  const bolum = document.getElementById(PAYTR_BOLUM_ID);
  const kutu  = document.getElementById(PAYTR_TABLO_ID);
  document.getElementById(PAYTR_BETIK_ID)?.remove();
  paytrGruplar = [];
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

    paytrGruplar     = paytrCiktiyiOku(kutu, sinir);
    paytrSecilenKart = null;

    if (!paytrGruplar.length) { paytrBolumuGizle(); return; }

    kutu.dataset.cizim = cizimAnahtari;
    paytrOzetiCiz();
  };

  document.body.appendChild(betik);
}

/* ─── PayTR çıktısını oku ───
   Dönen HTML'den yalnız gösterilecek taksitler alınır ve oranları birebir
   aynı olan kart programları tek grupta toplanır. */
function paytrCiktiyiOku(kutu, sinir) {
  const gruplar = new Map();

  for (const kart of kutu.querySelectorAll('.taksit-tablosu-wrapper')) {
    const secenekler = [];

    for (const satir of kart.querySelectorAll('.taksit-tutar-wrapper')) {
      const hucre = satir.querySelectorAll('.taksit-tutari');
      if (hucre.length < 2) continue;

      // "12 x 2.532,93 TL" → adet 12, aylık "2.532,93 TL"
      const okunan = hucre[0].textContent.match(/(\d+)\s*[x×]\s*(.+)/i);
      if (!okunan) continue;

      const adet = Number(okunan[1]);
      if (!PAYTR_GOSTERILEN.includes(adet)) continue;
      if (sinir && adet > sinir) continue;

      secenekler.push({
        adet,
        aylik:  okunan[2].trim(),
        toplam: hucre[1].textContent.trim()
      });
    }

    if (!secenekler.length) continue;
    secenekler.sort((a, b) => a.adet - b.adet);

    const imza = secenekler.map(s => `${s.adet}|${s.aylik}|${s.toplam}`).join(';');
    if (!gruplar.has(imza)) gruplar.set(imza, { secenekler, kartlar: [] });

    const logo = kart.querySelector('.taksit-logo img');
    if (logo) {
      gruplar.get(imza).kartlar.push({
        src: logo.getAttribute('src') || '',
        ad:  (logo.getAttribute('alt') || '').trim()
      });
    }
  }

  return [...gruplar.values()];
}

/* ─── Kompakt özeti çiz ───
   Seçili kart varsa yalnız onun grubu gösterilir. */
function paytrOzetiCiz() {
  const kutu  = document.getElementById(PAYTR_TABLO_ID);
  const bolum = document.getElementById(PAYTR_BOLUM_ID);
  if (!kutu) return;

  const gosterilecek = paytrSecilenKart
    ? paytrGruplar.filter(g => g.kartlar.some(k => k.ad === paytrSecilenKart))
    : paytrGruplar;

  kutu.innerHTML = '';
  const kok = document.createElement('div');
  kok.className = 'taksit-ozet';

  // Kart seçimi: müşteri kendi kartını seçince yalnız o kartın oranları kalır
  const tumKartlar = paytrGruplar.flatMap(g => g.kartlar);
  if (tumKartlar.length > 1) kok.appendChild(paytrKartSecimi(tumKartlar));

  for (const grup of gosterilecek) {
    const kutucuk = document.createElement('div');
    kutucuk.className = 'taksit-grup';

    const izgara = document.createElement('div');
    izgara.className = 'taksit-secenekler';

    for (const s of grup.secenekler) {
      const hucre = document.createElement('div');
      hucre.className = 'taksit-secenek';

      const adet = document.createElement('span');
      adet.className = 'taksit-adet';
      adet.textContent = `${s.adet} Taksit`;

      const aylik = document.createElement('span');
      aylik.className = 'taksit-aylik';
      aylik.textContent = s.aylik;

      const toplam = document.createElement('span');
      toplam.className = 'taksit-toplam';
      toplam.textContent = `Toplam ${s.toplam}`;

      hucre.append(adet, aylik, toplam);
      izgara.appendChild(hucre);
    }

    kutucuk.appendChild(izgara);

    /* Grup birden çok kart programını kapsıyorsa logoları altına yazılır:
       "bu oranlar şu kartlar için geçerli". Tek kart seçiliyken gereksiz. */
    if (!paytrSecilenKart && grup.kartlar.length) {
      const serit = document.createElement('div');
      serit.className = 'taksit-kart-serit';
      for (const k of grup.kartlar) serit.appendChild(paytrLogo(k));
      kutucuk.appendChild(serit);
    }

    kok.appendChild(kutucuk);
  }

  kutu.appendChild(kok);
  if (bolum) bolum.style.display = 'block';
}

function paytrLogo(kart) {
  const img = document.createElement('img');
  img.className = 'taksit-kart-logo';
  img.src = kart.src;
  img.alt = kart.ad;
  img.loading = 'lazy';
  return img;
}

/* Kart programı seçici. Kart NUMARASI hiçbir yerde istenmez — müşteri yalnız
   kartının programını (Bonus, Axess, World…) seçer. Kart numarası bu projede
   hiçbir zaman toplanmaz; gerçek karta özel seçenekleri ödeme adımındaki
   PayTR formu, kart girildikten sonra kendisi gösterir. */
function paytrKartSecimi(kartlar) {
  const sarmal = document.createElement('div');
  sarmal.className = 'taksit-kart-secim';

  const etiket = document.createElement('span');
  etiket.className = 'taksit-kart-secim-etiket';
  etiket.textContent = 'Kartınız:';
  sarmal.appendChild(etiket);

  const tumu = document.createElement('button');
  tumu.type = 'button';
  tumu.className = 'taksit-kart-dugme taksit-kart-tumu' + (paytrSecilenKart ? '' : ' secili');
  tumu.textContent = 'Tümü';
  tumu.onclick = () => { paytrSecilenKart = null; paytrOzetiCiz(); };
  sarmal.appendChild(tumu);

  const gorulen = new Set();
  for (const k of kartlar) {
    if (!k.ad || gorulen.has(k.ad)) continue;
    gorulen.add(k.ad);

    const dugme = document.createElement('button');
    dugme.type = 'button';
    dugme.className = 'taksit-kart-dugme' + (paytrSecilenKart === k.ad ? ' secili' : '');
    dugme.title = k.ad;
    dugme.setAttribute('aria-label', k.ad);
    dugme.appendChild(paytrLogo(k));
    dugme.onclick = () => { paytrSecilenKart = k.ad; paytrOzetiCiz(); };
    sarmal.appendChild(dugme);
  }

  return sarmal;
}

/* Sayfaya taksit bölümünü basar. Çağıran yer yalnız nereye, hangi tutarla
   ve hangi dipnotla koyacağını söyler. */
function installmentSectionHtml(baslik, not) {
  return `
    <div id="${PAYTR_BOLUM_ID}" class="taksit-bolumu" style="display:none">
      <div class="taksit-bolum-baslik">
        <svg class="icon icon-sm" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M2 10h20"/></svg>
        ${baslik || 'Taksit Seçenekleri'}
      </div>
      <div id="${PAYTR_TABLO_ID}"></div>
      <div class="taksit-not">
        ${not || 'Taksit tutarları bankaların güncel oranlarına göre hesaplanır; kartınıza özel kampanyalar ödeme adımında geçerli olabilir.'}
      </div>
    </div>`;
}
