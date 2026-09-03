/* Taksit tablosu — çıktı okuma ve gruplama testleri
   ==================================================
   js/paytr-installments.js PayTR'nin ham çıktısını okuyup yeniden çiziyor:
   yalnız 3/6/9/12 taksit gösteriliyor ve oranları birebir aynı olan kart
   programları tek grupta toplanıyor. Bu dosya o mantığı sınar.

   Sınanan asıl risk: gruplama, gerçekten AYNI olmayan satırları birleştirip
   müşteriye yanlış oran göstermemeli. */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const kok = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

let passed = 0, failed = 0;
function check(ad, gercek, beklenen) {
  const ok = JSON.stringify(gercek) === JSON.stringify(beklenen);
  if (ok) { passed++; console.log('  ok   ' + ad); }
  else { failed++; console.log('  HATA ' + ad + `\n       beklenen: ${JSON.stringify(beklenen)}\n       gelen:    ${JSON.stringify(gercek)}`); }
}

/* ─── Betiği yükle ───
   Klasik betik (module değil). Tarayıcı globalleri olmadan da çalışsın diye
   yalnız ihtiyaç duyduğu kadarı taklit ediliyor; test edilen işlev
   paytrCiktiyiOku, DOM'dan sadece querySelectorAll/textContent/getAttribute
   kullanıyor. */
const kaynak = fs.readFileSync(path.join(kok, 'js', 'paytr-installments.js'), 'utf8');
const kutu = {
  fetch: () => Promise.resolve(null),
  document: { getElementById: () => null, createElement: () => ({ append(){}, appendChild(){}, setAttribute(){}, classList:{ contains(){} } }) },
  console,
  setTimeout,
  clearTimeout
};
vm.createContext(kutu);
vm.runInContext(kaynak + '\n;globalThis.__test = { paytrCiktiyiOku, PAYTR_GOSTERILEN };', kutu);
const { paytrCiktiyiOku, PAYTR_GOSTERILEN } = kutu.__test;

/* ─── Sahte DOM ───
   PayTR'nin ürettiği yapı:
     .taksit-tablosu-wrapper > .taksit-logo img
                             > .taksit-tutar-wrapper > .taksit-tutari x2 */
function satir(metinSol, metinSag) {
  const hucreler = [{ textContent: metinSol }, { textContent: metinSag }];
  return { querySelectorAll: () => hucreler };
}
function kart(logoAdi, taksitler) {
  const satirlar = taksitler.map(t => satir(`${t.adet} x ${t.aylik}`, t.toplam));
  return {
    querySelectorAll: (sec) => (sec === '.taksit-tutar-wrapper' ? satirlar : []),
    querySelector: (sec) => (sec === '.taksit-logo img'
      ? { getAttribute: (a) => (a === 'src' ? `https://www.paytr.com/img/odeme_sayfasi/${logoAdi}.png` : logoAdi) }
      : null)
  };
}
function sahteKutu(kartlar) {
  return { querySelectorAll: () => kartlar };
}

const TAM = [
  { adet: 2,  aylik: '12.192,83 TL', toplam: '24.385,65 TL' },
  { adet: 3,  aylik: '8.289,69 TL',  toplam: '24.869,08 TL' },
  { adet: 4,  aylik: '6.343,01 TL',  toplam: '25.372,05 TL' },
  { adet: 5,  aylik: '5.179,16 TL',  toplam: '25.895,79 TL' },
  { adet: 6,  aylik: '4.406,44 TL',  toplam: '26.438,63 TL' },
  { adet: 7,  aylik: '3.859,15 TL',  toplam: '27.014,05 TL' },
  { adet: 8,  aylik: '3.453,51 TL',  toplam: '27.628,08 TL' },
  { adet: 9,  aylik: '3.141,19 TL',  toplam: '28.270,67 TL' },
  { adet: 10, aylik: '2.894,39 TL',  toplam: '28.943,86 TL' },
  { adet: 11, aylik: '2.695,45 TL',  toplam: '29.649,90 TL' },
  { adet: 12, aylik: '2.532,93 TL',  toplam: '30.395,18 TL' }
];

console.log('\n1) yalnız 3/6/9/12 gösterilir');
{
  const g = paytrCiktiyiOku(sahteKutu([kart('bonus', TAM)]), 0);
  check('gösterilen adetler', PAYTR_GOSTERILEN, [3, 6, 9, 12]);
  check('tek grup', g.length, 1);
  check('4 seçenek kaldı', g[0].secenekler.map(s => s.adet), [3, 6, 9, 12]);
  check('tutar PayTR metninden alındı', g[0].secenekler[3].aylik, '2.532,93 TL');
  check('toplam PayTR metninden alındı', g[0].secenekler[3].toplam, '30.395,18 TL');
}

console.log('\n2) üst sınır uygulanır');
{
  const g = paytrCiktiyiOku(sahteKutu([kart('bonus', TAM)]), 6);
  check('sınır 6 → yalnız 3 ve 6', g[0].secenekler.map(s => s.adet), [3, 6]);
  const g3 = paytrCiktiyiOku(sahteKutu([kart('bonus', TAM)]), 3);
  check('sınır 3 → yalnız 3', g3[0].secenekler.map(s => s.adet), [3]);
  const g0 = paytrCiktiyiOku(sahteKutu([kart('bonus', TAM)]), 0);
  check('sınır 0 → sınırsız', g0[0].secenekler.map(s => s.adet), [3, 6, 9, 12]);
}

console.log('\n3) aynı oranlı kartlar tek grupta toplanır');
{
  const kartlar = ['advantage', 'axess', 'bonus', 'world'].map(ad => kart(ad, TAM));
  const g = paytrCiktiyiOku(sahteKutu(kartlar), 12);
  check('4 kart → 1 grup', g.length, 1);
  check('grubun logoları', g[0].kartlar.map(k => k.ad), ['advantage', 'axess', 'bonus', 'world']);
  check('seçenekler tekrarlanmıyor', g[0].secenekler.length, 4);
}

console.log('\n4) oranlar farklıysa BİRLEŞTİRİLMEZ');
{
  /* Kritik durum: mağaza bir banka için özel kampanya tanımlarsa oranlar
     ayrışır. O satırlar birleştirilirse müşteriye yanlış tutar gösterilir. */
  const kampanyali = TAM.map(t => (t.adet === 12 ? { ...t, aylik: '2.100,00 TL', toplam: '25.200,00 TL' } : t));
  const g = paytrCiktiyiOku(sahteKutu([kart('bonus', TAM), kart('world', kampanyali)]), 12);
  check('farklı oran → 2 grup', g.length, 2);
  check('birinci grup bonus', g[0].kartlar.map(k => k.ad), ['bonus']);
  check('ikinci grup world', g[1].kartlar.map(k => k.ad), ['world']);
  check('world 12 taksit kampanyalı', g[1].secenekler.find(s => s.adet === 12).aylik, '2.100,00 TL');
  check('bonus 12 taksit normal', g[0].secenekler.find(s => s.adet === 12).aylik, '2.532,93 TL');
}

console.log('\n5) sıra ve eksik veri');
{
  const karisik = [
    { adet: 12, aylik: '2.532,93 TL', toplam: '30.395,18 TL' },
    { adet: 3,  aylik: '8.289,69 TL', toplam: '24.869,08 TL' },
    { adet: 9,  aylik: '3.141,19 TL', toplam: '28.270,67 TL' }
  ];
  const g = paytrCiktiyiOku(sahteKutu([kart('paraf', karisik)]), 12);
  check('artan sıraya konur', g[0].secenekler.map(s => s.adet), [3, 9, 12]);

  const sadece2 = [{ adet: 2, aylik: '12.192,83 TL', toplam: '24.385,65 TL' }];
  const g2 = paytrCiktiyiOku(sahteKutu([kart('maximum', sadece2)]), 12);
  check('gösterilecek taksidi olmayan kart atlanır', g2.length, 0);

  check('boş çıktı boş sonuç verir', paytrCiktiyiOku(sahteKutu([]), 12).length, 0);
}

console.log('\n6) beklenmedik metin çökertmez');
{
  const bozuk = {
    querySelectorAll: (sec) => (sec === '.taksit-tutar-wrapper'
      ? [satir('taksit yok', ''), satir('3 x 8.289,69 TL', '24.869,08 TL')]
      : []),
    querySelector: () => null   // logosuz kart
  };
  const g = paytrCiktiyiOku(sahteKutu([bozuk]), 12);
  check('okunamayan satır atlanır', g[0].secenekler.map(s => s.adet), [3]);
  check('logosuz kart grubu kart listesi boş', g[0].kartlar, []);
}

console.log(`\n${passed} test geçti, ${failed} test başarısız.\n`);
process.exitCode = failed ? 1 : 0;
