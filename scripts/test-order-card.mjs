/* Müşteri sipariş kartı testleri
   ==============================
   Kart, profil.html içindeki satır içi betikte duruyor. Fonksiyonlar saf
   metin üreticileri (DOM'a dokunmuyorlar), bu yüzden kaynaktan okunup
   yalıtılmış bir bağlamda çalıştırılabiliyorlar.

   Sınanan asıl mesele: müşteri siparişi hakkında NE görüyor. Kargo takip
   numarası uzun süre hiç görünmüyordu — sunucu onu yalnız orders/{id}
   belgesine yazıyor, bu sayfa ise users/{uid}.orders dizisini okuyor. */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const kok = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

let passed = 0, failed = 0;
function check(ad, gercek, beklenen) {
  const ok = JSON.stringify(gercek) === JSON.stringify(beklenen);
  if (ok) { passed++; console.log('  ok   ' + ad); }
  else { failed++; console.log(`  HATA ${ad}\n       beklenen: ${JSON.stringify(beklenen)}\n       gelen:    ${JSON.stringify(gercek)}`); }
}
function icerir(ad, metin, parca) { check(ad, String(metin).includes(parca), true); }
function icermez(ad, metin, parca) { check(ad, String(metin).includes(parca), false); }

/* ─── Kart fonksiyonlarını profil.html'den al ─── */
const kaynak = fs.readFileSync(path.join(kok, 'profil.html'), 'utf8');

function islevAl(ad) {
  const bas = kaynak.indexOf(`function ${ad}(`);
  if (bas < 0) throw new Error(`profil.html içinde ${ad}() bulunamadı`);
  // Süslü parantezleri sayarak fonksiyon gövdesinin sonunu bul
  let i = kaynak.indexOf('{', bas), derinlik = 0;
  for (; i < kaynak.length; i++) {
    if (kaynak[i] === '{') derinlik++;
    else if (kaynak[i] === '}') { derinlik--; if (derinlik === 0) break; }
  }
  return kaynak.slice(bas, i + 1);
}

const ISLEVLER = ['kacis', 'siparisKarti', 'kargoBlogu', 'odemeEtiketi', 'odemeSimgesi', 'adresMetni', 'faturaSatiri', 'detaySatiri'];

const kutu = {
  formatPrice: (n) => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2 }).format(n) + ' ₺',
  STATUS_MAP: {
    processing: { cls: 'processing', label: 'Hazırlanıyor', icon: '<svg></svg>' },
    shipping:   { cls: 'shipping',   label: 'Kargoda',      icon: '<svg></svg>' },
    delivered:  { cls: 'delivered',  label: 'Teslim Edildi', icon: '<svg></svg>' },
    cancelled:  { cls: 'cancelled',  label: 'İptal Edildi',  icon: '<svg></svg>' }
  },
  encodeURIComponent
};
vm.createContext(kutu);
vm.runInContext(ISLEVLER.map(islevAl).join('\n') + '\n;globalThis.__k = { ' + ISLEVLER.join(', ') + ' };', kutu);
const K = kutu.__k;

/* ─── Örnek sipariş ─── */
const TEMEL = {
  id: 'EFM260904F99789',
  date: '2026-09-04T11:00:00.000Z',
  status: 'processing',
  items: [{ id: 44, name: 'Apple 20W USB-C Güç Adaptörü', qty: 1, price: 1048.99, color: 'Beyaz', size: '' }],
  total: 1048.99,
  delivery: 'kargo',
  paymentMethod: 'kart',
  address: { ad: 'Cemal', soyad: 'Çıngırlar', adres: 'Yeni Mahalle 87071 Sokak No:5', ilce: 'Seyhan', sehir: 'Adana', posta: '01000', telefon: '05001234567' },
  invoice: null,
  eftReceiptNo: null,
  trackingNumber: null
};

console.log('\n1) kargo takip numarası');
{
  const yok = K.siparisKarti({ ...TEMEL }, 0);
  icerir('numara yokken bilgilendirir', yok, 'kargoya verildiğinde burada görünecek');
  icermez('numara yokken HepsiJET linki YOK', yok, 'hepsijet.com');

  const var_ = K.siparisKarti({ ...TEMEL, trackingNumber: '1234567890' }, 0);
  icerir('numara gösteriliyor', var_, '1234567890');
  icerir('HepsiJET takip linki doğru', var_, 'https://hepsijet.com/coklu-gonderi-takibi/1234567890');
  icerir('link yeni sekmede açılır', var_, 'rel="noopener noreferrer"');

  const magaza = K.siparisKarti({ ...TEMEL, delivery: 'magaza' }, 0);
  icerir('mağazadan teslimde kargo takibi yok denir', magaza, 'kargo takibi yoktur');
  icermez('mağazadan teslimde HepsiJET linki YOK', magaza, 'hepsijet.com');
}

console.log('\n2) ödeme yöntemi');
{
  check('kart etiketi',  K.odemeEtiketi('kart'), 'Kredi / Banka Kartı');
  check('eft etiketi',   K.odemeEtiketi('eft'),  'EFT / Havale');
  check('bilinmeyen',    K.odemeEtiketi(null),   'Belirtilmemiş');

  const kart = K.siparisKarti({ ...TEMEL }, 0);
  icerir('kartla ödeme kartta görünüyor', kart, 'Kredi / Banka Kartı');

  const eft = K.siparisKarti({ ...TEMEL, paymentMethod: 'eft', eftReceiptNo: 'DEK-42' }, 0);
  icerir('EFT görünüyor', eft, 'EFT / Havale');
  icerir('dekont numarası görünüyor', eft, 'DEK-42');
  icermez('kartla ödemede dekont satırı yok', kart, 'Havale Dekont No');
}

console.log('\n3) teslimat ve adres');
{
  const kart = K.siparisKarti({ ...TEMEL }, 0);
  icerir('adres gösteriliyor', kart, 'Yeni Mahalle 87071 Sokak No:5');
  icerir('ilçe / şehir', kart, 'Seyhan / Adana');
  icerir('telefon', kart, '05001234567');

  const magaza = K.siparisKarti({ ...TEMEL, delivery: 'magaza' }, 0);
  icerir('mağazadan teslim yazıyor', magaza, 'Mağazadan Teslim');
  icermez('mağazadan teslimde adres satırı yok', magaza, 'Teslimat Adresi');
}

console.log('\n4) fatura');
{
  const bireysel = K.siparisKarti({ ...TEMEL }, 0);
  icermez('bireyselde fatura satırı yok', bireysel, 'Fatura');

  const kurumsal = K.siparisKarti({ ...TEMEL, invoice: { unvan: 'Efem Ltd', vergiNo: '1234567890', vergiDairesi: 'Seyhan' } }, 0);
  icerir('kurumsal unvan', kurumsal, 'Efem Ltd');
  icerir('vergi no', kurumsal, 'VKN 1234567890');
}

console.log('\n5) HTML kaçışı (müşterinin kendi yazdığı metinler)');
{
  /* Adres alanını müşteri yazıyor ve innerHTML ile basılıyor. Kaçış olmazsa
     kendi sayfasında betik çalıştırabilirdi. */
  const kotu = K.siparisKarti({
    ...TEMEL,
    address: { ...TEMEL.address, adres: '<img src=x onerror=alert(1)>' }
  }, 0);
  icermez('ham <img etiketi geçmiyor', kotu, '<img src=x');
  icerir('kaçırılmış hâli var', kotu, '&lt;img src=x');

  check('kacis() temel karakterler', K.kacis(`<>&"'`), '&lt;&gt;&amp;&quot;&#39;');
  check('kacis() null güvenli', K.kacis(null), '');
}

console.log('\n6) ürün satırları');
{
  const kart = K.siparisKarti({ ...TEMEL }, 0);
  icerir('ürün adı', kart, 'Apple 20W USB-C Güç Adaptörü');
  icerir('varyant', kart, 'Beyaz');
  icerir('sipariş numarası', kart, 'EFM260904F99789');
  icerir('durum etiketi', kart, 'Hazırlanıyor');

  const cokUrun = K.siparisKarti({
    ...TEMEL,
    items: [
      { name: 'A', qty: 2, price: 100, color: null, size: null },
      { name: 'B', qty: 1, price: 50,  color: 'Siyah', size: 'M' }
    ]
  }, 0);
  /* A varyantsiz: <span>A × 2</span>. B varyantli, adindan hemen sonra
     varyant span'i geliyor: <span>B<span ...>(Siyah · M)</span> × 1</span>. */
  icerir('varyantsiz ürün satırı', cokUrun, '>A ×');
  icerir('varyantlı ürün satırı', cokUrun, '>B <span');
  icerir('renk · beden birlikte', cokUrun, 'Siyah · M');
}

console.log(`\n${passed} test geçti, ${failed} test başarısız.\n`);
process.exitCode = failed ? 1 : 0;
