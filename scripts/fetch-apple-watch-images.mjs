#!/usr/bin/env node
/* =========================================
   Apple Watch varyant görsellerini indir
   =========================================
   Apple'ın kendi görsel CDN'inden (store.storeimages.cdn-apple.com) her RENK
   için 1200 × 1200 şeffaf arka planlı ürün render'ı indirir. Amaç: müşteri
   "Roze Altın" seçtiğinde galeride siyah saat görmemesi.

   Dosya adı: assets/images/products/<slug>-renk-<renkkodu>.png

   Kullanım:  node scripts/fetch-apple-watch-images.mjs [--force]
   Not: Zaten indirilmiş dosyalar atlanır (--force ile yeniden indirilir).   */

import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'assets', 'images', 'products');
const FORCE = process.argv.includes('--force');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36';

/* Apple'ın görsel adlandırması: watch-case-<boyut>-<malzeme>-<renk>-<nc|cell>-<seri>
   `nc` = cellular olmayan (GPS), `cell` = GPS + Cellular. Hangi son ekin geçerli
   olduğu modele göre değiştiği için ikisi de denenir. */
const JOBS = [
  { slug: 'apple-watch-11-42', size: 42, material: 'aluminum', series: 's11', colors: {
    'jet-siyah': 'jetblack', 'roze-altin': 'rosegold', 'uzay-grisi': 'spacegray', 'gumus': 'silver' } },
  { slug: 'apple-watch-11-46', size: 46, material: 'aluminum', series: 's11', colors: {
    'jet-siyah': 'jetblack', 'roze-altin': 'rosegold', 'uzay-grisi': 'spacegray' } },
  { slug: 'apple-watch-se3-40', size: 40, material: 'aluminum', series: 'se3', colors: {
    'gece-yarisi': 'midnight', 'yildiz-isigi': 'starlight' } },
  { slug: 'apple-watch-se3-44', size: 44, material: 'aluminum', series: 'se3', colors: {
    'gece-yarisi': 'midnight', 'yildiz-isigi': 'starlight' } },
  { slug: 'apple-watch-s10-46-alu', size: 46, material: 'aluminum', series: 's10', colors: {
    'jet-siyah': 'jetblack' } },
  { slug: 'apple-watch-s9-41', size: 41, material: 'aluminum', series: 's9', colors: {
    'kirmizi': 'red', 'pembe': 'pink' } }
];

function candidates(job, appleColor) {
  const base = 'https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is';
  const query = '?wid=1200&hei=1200&fmt=png-alpha';
  const names = [
    `watch-case-${job.size}-${job.material}-${appleColor}-nc-${job.series}_VW_34FR`,
    `watch-case-${job.size}-${job.material}-${appleColor}-cell-${job.series}_VW_34FR`,
    `watch-case-${job.size}-${job.material}-${appleColor}-${job.series}_VW_34FR`
  ];
  return names.map(n => `${base}/${n}${query}`);
}

/* Apple bilinmeyen görsel adlarında da 200 + küçük bir "yer tutucu" dönebiliyor;
   bu yüzden boyut eşiği ile gerçek render ayırt edilir. */
const MIN_BYTES = 20000;

async function download(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < MIN_BYTES) return null;
  if (!(buf[0] === 0x89 && buf[1] === 0x50)) return null; // PNG imzası
  return buf;
}

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

let ok = 0, skipped = 0, failed = [];

for (const job of JOBS) {
  for (const [trColor, appleColor] of Object.entries(job.colors)) {
    const file = join(OUT_DIR, `${job.slug}-renk-${trColor}.png`);
    const rel = `assets/images/products/${job.slug}-renk-${trColor}.png`;

    if (existsSync(file) && !FORCE) { skipped++; console.log(`atlandı  ${rel}`); continue; }

    let saved = false;
    for (const url of candidates(job, appleColor)) {
      try {
        const buf = await download(url);
        if (!buf) continue;
        writeFileSync(file, buf);
        console.log(`indirildi ${rel}  (${Math.round(buf.length / 1024)} KB)`);
        ok++; saved = true;
        break;
      } catch (err) {
        // sıradaki adayı dene
      }
    }
    if (!saved) { failed.push(rel); console.error(`BULUNAMADI ${rel}`); }
  }
}

console.log(`\n${ok} indirildi, ${skipped} atlandı, ${failed.length} bulunamadı`);
if (failed.length) console.log('bulunamayanlar:\n  ' + failed.join('\n  '));
