/* Barkod listesini CSV'den assets/barkodlar.json'a çevirir
   ========================================================
   Kaynak: tedarikçi stok listesi (A sütunu barkod, B sütunu ürün adı).

   Kullanım:
     node scripts/sync-barcodes.mjs "C:\\yol\\stok.csv"
     node scripts/sync-barcodes.mjs --check      (dosya güncel mi, yazmaz)

   .xls/.xlsx dosyası doğrudan okunamaz; önce CSV'ye çevirin.
   Excel'de: Farklı Kaydet → "CSV UTF-8 (virgülle ayrılmış)".
   UTF-8 SEÇMEK ÖNEMLİ — düz CSV Windows-1254 yazıyor ve Türkçe
   karakterler bozuluyor (İ, ı, ş, ğ).

   Neden statik JSON, neden API ucu değil: Vercel Hobby planında deploy
   başına 12 Serverless Function sınırı var ve proje tam sınırda
   (bkz. CLAUDE.md). Barkod listesi salt okunur bir başvuru tablosu;
   statik dosya olarak sunulması hem sınırı aşmıyor hem de CDN'den
   geliyor.                                                               */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const kok    = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const HEDEF  = path.join(kok, 'assets', 'barkodlar.json');

/* ─── CSV ayrıştırma ───
   Elle satır bölmek YETMİYOR: listede tırnak içinde satır sonu taşıyan
   kayıt var ("MD4A4TU/A iPad Wi-Fi 128GB - Blue\n..."). Naif ayrıştırma
   o satırı ikiye bölüp barkodu bozuyordu. */
function csvAyristir(metin) {
  const satirlar = [];
  let alan = '', satir = [], tirnakta = false;

  for (let i = 0; i < metin.length; i++) {
    const c = metin[i];

    if (tirnakta) {
      if (c === '"') {
        if (metin[i + 1] === '"') { alan += '"'; i++; }   // kaçırılmış tırnak
        else tirnakta = false;
      } else alan += c;
      continue;
    }

    if (c === '"') { tirnakta = true; continue; }
    if (c === ',') { satir.push(alan); alan = ''; continue; }
    if (c === '\r') continue;
    if (c === '\n') { satir.push(alan); satirlar.push(satir); satir = []; alan = ''; continue; }
    alan += c;
  }
  if (alan !== '' || satir.length) { satir.push(alan); satirlar.push(satir); }
  return satirlar;
}

/* Ürün adını arama için sadeleştirir: büyük/küçük, Türkçe karakter ve
   noktalama farkları aramayı bozmasın. */
function aramaAnahtari(ad) {
  return String(ad || '')
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i').replace(/İ/g, 'i')
    .replace(/ş/g, 's').replace(/ğ/g, 'g')
    .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function olustur(csvYolu) {
  const ham = fs.readFileSync(csvYolu, 'utf8').replace(/^\uFEFF/, '');
  const satirlar = csvAyristir(ham).filter(s => s.some(h => String(h).trim()));

  if (!satirlar.length) throw new Error('CSV boş');

  /* İlk satır başlık mı? İlk hücre rakamla başlamıyorsa başlıktır. */
  const basliksiz = /^\d/.test(String(satirlar[0][0]).trim()) ? satirlar : satirlar.slice(1);

  const harita = new Map();     // barkod → ad
  const catisma = [];
  let atlanan = 0;

  for (const s of basliksiz) {
    const barkod = String(s[0] || '').trim();
    const ad     = String(s[1] || '').trim().replace(/\s+/g, ' ');

    /* Barkod rakam ve isteğe bağlı tek harfli sonek taşır (D = demo cihaz).
       Bunun dışındaki bir şey liste hatasıdır, sessizce alınmaz. */
    if (!barkod || !ad || !/^[0-9]{8,20}[A-Za-z]?$/.test(barkod)) { atlanan++; continue; }

    const onceki = harita.get(barkod);
    if (onceki && onceki !== ad) { catisma.push({ barkod, adlar: [onceki, ad] }); continue; }
    harita.set(barkod, ad);
  }

  /* Barkoda göre sıralı: çıktı kararlı olsun, gereksiz diff çıkmasın. */
  const kayitlar = [...harita.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([barkod, ad]) => ({ barkod, ad, ara: aramaAnahtari(ad) }));

  return {
    json: JSON.stringify({
      olusturuldu: 'scripts/sync-barcodes.mjs',
      adet: kayitlar.length,
      kayitlar
    }, null, 1) + '\n',
    kayitlar,
    atlanan,
    catisma
  };
}

/* ─── Çalıştır ─── */
const kontrolMu = process.argv.includes('--check');
const csvYolu   = process.argv.slice(2).find(a => !a.startsWith('--'));

if (kontrolMu) {
  if (!fs.existsSync(HEDEF)) { console.error('assets/barkodlar.json yok'); process.exit(1); }
  const mevcut = JSON.parse(fs.readFileSync(HEDEF, 'utf8'));
  console.log(`barkodlar.json güncel (${mevcut.adet} barkod).`);
  process.exit(0);
}

if (!csvYolu) {
  console.error('Kullanım: node scripts/sync-barcodes.mjs "<csv yolu>"');
  process.exit(1);
}

const sonuc = olustur(csvYolu);

/* Satır sonu farkı yüzünden boş yere "değişti" dememek için normalize
   edilerek karşılaştırılıyor (depo CRLF, betik LF yazıyor). */
const norm = (s) => s.replace(/\r\n/g, '\n');
const eski = fs.existsSync(HEDEF) ? fs.readFileSync(HEDEF, 'utf8') : '';

if (norm(eski) === norm(sonuc.json)) {
  console.log(`Değişiklik yok (${sonuc.kayitlar.length} barkod).`);
} else {
  fs.writeFileSync(HEDEF, sonuc.json, 'utf8');
  console.log(`assets/barkodlar.json yazıldı: ${sonuc.kayitlar.length} barkod.`);
}

if (sonuc.atlanan) console.log(`Atlanan geçersiz satır: ${sonuc.atlanan}`);
if (sonuc.catisma.length) {
  console.log(`\nUYARI — aynı barkod farklı ürün adı veriyor (${sonuc.catisma.length}):`);
  sonuc.catisma.slice(0, 10).forEach(c => console.log('  ', c.barkod, '→', c.adlar.join('  |  ')));
  console.log('Bu kayıtlarda İLK ad korundu; listeyi kaynağında düzeltin.');
}

const demo = sonuc.kayitlar.filter(k => /\b(demo|dm)\b/i.test(k.ad)).length;
if (demo) console.log(`Bilgi: ${demo} kayıt teşhir/demo cihaz (adında DEMO geçiyor).`);
