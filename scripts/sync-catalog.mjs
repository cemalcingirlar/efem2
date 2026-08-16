#!/usr/bin/env node
/* =========================================
   js/data.js → api/_lib/catalog.json senkronu
   =========================================
   Ödeme tutarı ARTIK sunucuda hesaplanıyor; sunucunun fiyat kaynağı bu
   dosyadır. Vitrin kataloğu (js/data.js → BASE_PRODUCTS) tek doğruluk
   kaynağı olmaya devam eder, bu script ondan türetir.

   Kullanım:
     npm run sync-catalog     # catalog.json'u yeniden üret
     npm run check-catalog    # fark varsa hata ile çık (CI/commit öncesi)

   Fiyatlar kuruş (integer) olarak yazılır: para hesabında float kullanılmaz. */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'js', 'data.js');
const TARGET = join(ROOT, 'api', '_lib', 'catalog.json');

/* data.js tarayıcı için yazılmıştır (localStorage'a dokunan üst seviye
   satırlar içerir); bu yüzden dosyanın tamamı değil, yalnızca
   BASE_PRODUCTS dizi literali ayıklanıp değerlendirilir. */
function extractBaseProducts(source) {
  const marker = 'const BASE_PRODUCTS = [';
  const start = source.indexOf(marker);
  if (start < 0) throw new Error('js/data.js içinde BASE_PRODUCTS bulunamadı.');

  let i = start + marker.length - 1; // '[' karakterinin üzerinde
  let depth = 0;
  let inString = null;
  let inLineComment = false;
  let inBlockComment = false;

  for (; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];

    if (inLineComment) { if (ch === '\n') inLineComment = false; continue; }
    if (inBlockComment) { if (ch === '*' && next === '/') { inBlockComment = false; i++; } continue; }
    if (inString) {
      if (ch === '\\') { i++; continue; }
      if (ch === inString) inString = null;
      continue;
    }
    if (ch === '/' && next === '/') { inLineComment = true; i++; continue; }
    if (ch === '/' && next === '*') { inBlockComment = true; i++; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { inString = ch; continue; }
    if (ch === '[' || ch === '{') depth++;
    if (ch === ']' || ch === '}') {
      depth--;
      if (depth === 0) {
        const literal = source.slice(start + marker.length - 1, i + 1);
        return Function(`"use strict"; return (${literal});`)();
      }
    }
  }
  throw new Error('BASE_PRODUCTS dizisinin sonu bulunamadı.');
}

function toKurus(price) {
  if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) {
    throw new Error(`Geçersiz fiyat: ${price}`);
  }
  return Math.round(price * 100);
}

function buildCatalog(products) {
  const items = products.map(p => {
    if (!Number.isInteger(p.id)) throw new Error(`Geçersiz ürün id: ${p.id}`);
    return {
      id:            p.id,
      name:          String(p.name),
      category:      String(p.categoryLabel || p.category || 'Aksesuar'),
      brand:         String(p.brand || ''),
      priceKurus:    toKurus(p.price),
      itemType:      'PHYSICAL'
    };
  });

  const ids = new Set();
  for (const item of items) {
    if (ids.has(item.id)) throw new Error(`Yinelenen ürün id: ${item.id}`);
    ids.add(item.id);
  }

  return {
    _comment: 'OTOMATİK ÜRETİLDİ — elle düzenlemeyin. Kaynak: js/data.js (npm run sync-catalog).',
    currency: 'TRY',
    vatIncluded: true,
    products: items.sort((a, b) => a.id - b.id)
  };
}

const source = readFileSync(SOURCE, 'utf8');
const catalog = buildCatalog(extractBaseProducts(source));
const json = JSON.stringify(catalog, null, 2) + '\n';

if (process.argv.includes('--check')) {
  let current = '';
  try { current = readFileSync(TARGET, 'utf8'); } catch { /* yok */ }
  if (current !== json) {
    console.error('HATA: api/_lib/catalog.json, js/data.js ile uyumsuz. `npm run sync-catalog` çalıştırın.');
    process.exit(1);
  }
  console.log(`catalog.json güncel (${catalog.products.length} ürün).`);
} else {
  writeFileSync(TARGET, json, 'utf8');
  console.log(`catalog.json yazıldı: ${catalog.products.length} ürün.`);
}
