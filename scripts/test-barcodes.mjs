/* Barkod listesi ve seçici testleri
   =================================
   İki taraf sınanıyor:
     1) scripts/sync-barcodes.mjs — CSV ayrıştırma ve temizleme
     2) admin.html içindeki arama işlevleri

   Aramanın iki tarafta AYNI kuralları uygulaması kritik: ayrışırlarsa
   panelde yazılan "İ" listedeki "i" ile eşleşmez ve barkod bulunamaz. */

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

/* ─── Üretilmiş liste ─── */
console.log('\n1) assets/barkodlar.json');
const veriYolu = path.join(kok, 'assets', 'barkodlar.json');
check('dosya var', fs.existsSync(veriYolu), true);

const veri = JSON.parse(fs.readFileSync(veriYolu, 'utf8'));
check('kayıt dizisi', Array.isArray(veri.kayitlar), true);
check('adet alanı tutuyor', veri.adet, veri.kayitlar.length);

{
  const barkodlar = veri.kayitlar.map(k => k.barkod);
  check('barkodlar benzersiz', barkodlar.length, new Set(barkodlar).size);
  check('hepsi geçerli biçimde', barkodlar.every(b => /^[0-9]{8,20}[A-Za-z]?$/.test(b)), true);
  check('hepsinin adı var', veri.kayitlar.every(k => k.ad && k.ad.trim().length > 0), true);
  check('hepsinin arama anahtarı var', veri.kayitlar.every(k => typeof k.ara === 'string'), true);

  /* Sıralı olmalı: aksi hâlde listeyi her yenilediğimizde gereksiz diff çıkar. */
  const sirali = [...barkodlar].sort((a, b) => a.localeCompare(b));
  check('barkoda göre sıralı', barkodlar, sirali);

  /* Arama anahtarında Türkçe karakter veya büyük harf KALMAMALI. */
  check('arama anahtarı sadeleşmiş', veri.kayitlar.every(k => /^[a-z0-9 ]*$/.test(k.ara)), true);
}

/* ─── Panel tarafındaki arama ─── */
console.log('\n2) admin.html arama işlevleri');
const adminKaynak = fs.readFileSync(path.join(kok, 'admin.html'), 'utf8');

function islevAl(ad) {
  const bas = adminKaynak.indexOf(`function ${ad}(`);
  if (bas < 0) throw new Error(`admin.html içinde ${ad}() bulunamadı`);
  let i = adminKaynak.indexOf('{', bas), derinlik = 0;
  for (; i < adminKaynak.length; i++) {
    if (adminKaynak[i] === '{') derinlik++;
    else if (adminKaynak[i] === '}') { derinlik--; if (derinlik === 0) break; }
  }
  return adminKaynak.slice(bas, i + 1);
}

const kutu = { barkodListesi: veri.kayitlar };
vm.createContext(kutu);
vm.runInContext(
  [islevAl('barkodAramaAnahtari'), islevAl('barkodAra'), islevAl('escapeHtmlAdmin')].join('\n') +
  '\n;globalThis.__b = { barkodAramaAnahtari, barkodAra, escapeHtmlAdmin };',
  kutu
);
const B = kutu.__b;

{
  /* Panel ile üretim betiği aynı sadeleştirmeyi yapmalı. Ayrışırlarsa
     "MAVİ" kaydı "mavi" aramasında bulunamaz. */
  const ornekler = ['MAVİ', 'Kulaklık', 'ŞARJ', 'GÜÇ', 'Çanta', 'IPHONE 15'];
  const panelden = ornekler.map(o => B.barkodAramaAnahtari(o));
  check('panel sadeleştirmesi', panelden,
    ['mavi', 'kulaklik', 'sarj', 'guc', 'canta', 'iphone 15']);

  /* Aynı kural üretim betiğinde de var mı — kayıtlardan doğrula. */
  const mavi = veri.kayitlar.find(k => /MAVİ/.test(k.ad));
  check('üretimde de aynı sadeleştirme', mavi ? mavi.ara.includes('mavi') : 'MAVİ içeren kayıt yok', true);
}

console.log('\n3) arama davranışı');
{
  check('2 karakterden kısa sorgu boş döner', B.barkodAra('a').length, 0);
  check('boş sorgu boş döner', B.barkodAra('').length, 0);

  const ilk = veri.kayitlar[0];
  check('tam barkodla bulunur', B.barkodAra(ilk.barkod).some(k => k.barkod === ilk.barkod), true);
  check('barkod parçasıyla bulunur', B.barkodAra(ilk.barkod.slice(0, 8)).length > 0, true);

  /* Kelime sırası önemsiz olmalı: mağazacı "mavi jbl" de yazabilir. */
  const a = B.barkodAra('jbl mavi').map(k => k.barkod).sort();
  const b = B.barkodAra('mavi jbl').map(k => k.barkod).sort();
  check('kelime sırası sonucu değiştirmez', a, b);
  check('çok kelimeli arama sonuç veriyor', a.length > 0, true);

  /* Kelimelerin HEPSİ geçmeli; biri geçmiyorsa kayıt gelmemeli. */
  const yok = B.barkodAra('jbl zzzzyyyx');
  check('eşleşmeyen kelime sonucu eler', yok.length, 0);

  /* Türkçe yazım farkı aramayı bozmamalı. */
  check('İ/ı farkı sorun değil',
    B.barkodAra('kulaklik').length > 0 && B.barkodAra('kulaklık').length > 0, true);

  /* Liste büyük; ekranı kilitlememek için sonuç sınırlı. */
  check('sonuç sayısı sınırlı', B.barkodAra('a e').length <= 40, true);
}

console.log('\n4) HTML kaçışı');
{
  /* Ürün adları tedarikçi dosyasından geliyor ve innerHTML'e basılıyor. */
  check('temel karakterler', B.escapeHtmlAdmin(`<>&"'`), '&lt;&gt;&amp;&quot;&#39;');
  check('null güvenli', B.escapeHtmlAdmin(null), '');
  check('script etiketi kaçırılır',
    B.escapeHtmlAdmin('<script>alert(1)</script>').includes('<script>'), false);
}

console.log('\n5) panel bağlantıları');
{
  /* Seçicinin gerçekten çağrıldığı yerler duruyor mu — biri silinirse
     özellik sessizce kullanılamaz hâle gelir. */
  check('ürün barkod alanında düğme var', adminKaynak.includes("barkodSeciciAc('p-barcode')"), true);
  check('varyant satırında düğme var', adminKaynak.includes('barkodSeciciAc(this.previousElementSibling)'), true);
  check('modal tanımlı', adminKaynak.includes('id="barkod-modal"'), true);

  /* Satır içi onclick KULLANILMAMALI: barkod değeri JSON.stringify ile
     yazıldığında çift tırnak özniteliği bozuyor ve tıklama çalışmıyordu. */
  check('sonuç satırında inline onclick yok',
    adminKaynak.includes('class="barkod-satir" onclick='), false);
  check('data-barkod kullanılıyor', adminKaynak.includes('data-barkod="'), true);
}

console.log(`\n${passed} test geçti, ${failed} test başarısız.\n`);
process.exitCode = failed ? 1 : 0;
