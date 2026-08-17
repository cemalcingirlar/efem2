#!/usr/bin/env node
/* =========================================
   Katalog denetim raporu (salt okunur)
   =========================================
   js/data.js içindeki BASE_PRODUCTS'ı okur ve her ürün için şunları çıkarır:
   - varyantlar (renk/beden), görsel dosyaları, dosya boyutu ve piksel ölçüsü
   - eksik/çok küçük görseller, tek görselli ürünler
   - açıklama uzunluğu, teknik özellik anahtarları

   Amaç: "hangi ürün eksik/şüpheli?" sorusunu ölçülebilir hale getirmek.
   Hiçbir dosyayı DEĞİŞTİRMEZ.

   Kullanım:
     node scripts/catalog-audit.mjs            # özet tablo
     node scripts/catalog-audit.mjs --json     # makine okunur çıktı
     node scripts/catalog-audit.mjs --id 3     # tek ürün ayrıntısı            */

import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function loadProducts() {
  const source = readFileSync(join(ROOT, 'js', 'data.js'), 'utf8');
  const marker = 'const BASE_PRODUCTS = [';
  const start = source.indexOf(marker);
  if (start < 0) throw new Error('BASE_PRODUCTS bulunamadı');

  let i = start + marker.length - 1;
  let depth = 0, inString = null, inLine = false, inBlock = false;

  for (; i < source.length; i++) {
    const ch = source[i], next = source[i + 1];
    if (inLine)  { if (ch === '\n') inLine = false; continue; }
    if (inBlock) { if (ch === '*' && next === '/') { inBlock = false; i++; } continue; }
    if (inString) {
      if (ch === '\\') { i++; continue; }
      if (ch === inString) inString = null;
      continue;
    }
    if (ch === '/' && next === '/') { inLine = true; i++; continue; }
    if (ch === '/' && next === '*') { inBlock = true; i++; continue; }
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
  throw new Error('BASE_PRODUCTS sonu bulunamadı');
}

/* ─── Görsel ölçüsü (bağımlılıksız PNG/JPEG/WEBP başlık okuyucu) ─── */
export function imageSize(file) {
  const buf = readFileSync(file);

  // PNG
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), type: 'png' };
  }
  // JPEG
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let o = 2;
    while (o < buf.length) {
      if (buf[o] !== 0xff) { o++; continue; }
      const marker = buf[o + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { o += 2; continue; }
      const len = buf.readUInt16BE(o + 2);
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return { h: buf.readUInt16BE(o + 5), w: buf.readUInt16BE(o + 7), type: 'jpeg' };
      }
      o += 2 + len;
    }
  }
  // WEBP
  if (buf.length > 30 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const fmt = buf.toString('ascii', 12, 16);
    if (fmt === 'VP8X') return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3), type: 'webp' };
    if (fmt === 'VP8 ') return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff, type: 'webp' };
    if (fmt === 'VP8L') {
      const b = buf.readUInt32LE(21);
      return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1, type: 'webp' };
    }
  }
  if (buf.toString('ascii', 0, 5) === '<?xml' || buf.toString('ascii', 0, 4) === '<svg') {
    return { w: null, h: null, type: 'svg' };
  }
  return { w: null, h: null, type: 'bilinmiyor' };
}

export function auditProduct(p) {
  // Galeri = ürün görselleri + renk (varyant) görselleri — ürün sayfası da
  // ikisini birleştirip gösteriyor, sayım da aynı olmalı.
  const allImages = [...new Set([...(p.images || []), ...Object.values(p.colorImages || {})])];

  const images = allImages.map(rel => {
    const file = join(ROOT, rel);
    if (!existsSync(file)) return { rel, ok: false, reason: 'dosya yok' };
    const { size } = statSync(file);
    let dim = { w: null, h: null, type: '?' };
    try { dim = imageSize(file); } catch { /* okunamadı */ }
    return { rel, ok: true, kb: Math.round(size / 1024), ...dim };
  });

  const missing = images.filter(i => !i.ok);
  const small   = images.filter(i => i.ok && i.w && i.w < 600);
  const flags = [];
  if (missing.length)            flags.push(`${missing.length} eksik dosya`);
  if (small.length)              flags.push(`${small.length} düşük çözünürlük`);
  if (images.length <= 1)        flags.push('tek görsel');
  if (images.some(i => i.type === 'svg')) flags.push('placeholder svg');
  if (!p.desc || p.desc.length < 60) flags.push('açıklama zayıf');
  if (!Array.isArray(p.specs) || p.specs.length < 4) flags.push('özellik az');

  const colors = [...new Set((p.variants || []).map(v => v.color).filter(Boolean))];
  const sizes  = [...new Set((p.variants || []).map(v => v.size).filter(Boolean))];

  return {
    id: p.id,
    name: p.name,
    brand: p.brand,
    category: p.categoryLabel,
    price: p.price,
    colors,
    sizes,
    variantCount: (p.variants || []).length,
    imageCount: images.length,
    images,
    specKeys: (p.specs || []).map(s => s.key),
    descLength: (p.desc || '').length,
    flags
  };
}

/* Bu dosya hem CLI hem de yardımcı modül olarak kullanılıyor; tablo yalnızca
   doğrudan çalıştırıldığında basılır. */
const isCli = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('scripts/catalog-audit.mjs');
if (!isCli) {
  // modül olarak import edildi: sadece fonksiyonlar dışa aktarılır
} else {

const products = loadProducts();
const audits = products.map(auditProduct);

const args = process.argv.slice(2);

if (args.includes('--json')) {
  console.log(JSON.stringify(audits, null, 2));
} else if (args.includes('--id')) {
  const id = Number(args[args.indexOf('--id') + 1]);
  const one = audits.find(a => a.id === id);
  console.log(JSON.stringify(one, null, 2));
} else {
  console.log(`${products.length} ürün\n`);
  console.log('id  | ürün                                          | görsel | renkler                      | sorun');
  console.log('-'.repeat(140));
  for (const a of audits) {
    console.log(
      String(a.id).padEnd(3),
      '|', a.name.slice(0, 44).padEnd(44),
      '|', String(a.imageCount).padStart(3), '   ',
      '|', a.colors.join(', ').slice(0, 28).padEnd(28),
      '|', a.flags.join('; ')
    );
  }
  const totals = {
    'tek görsel':          audits.filter(a => a.imageCount <= 1).length,
    'eksik dosya':         audits.filter(a => a.flags.some(f => f.includes('eksik'))).length,
    'düşük çözünürlük':    audits.filter(a => a.flags.some(f => f.includes('düşük'))).length,
    'placeholder svg':     audits.filter(a => a.flags.includes('placeholder svg')).length,
    'açıklama zayıf':      audits.filter(a => a.flags.includes('açıklama zayıf')).length,
    'özellik az':          audits.filter(a => a.flags.includes('özellik az')).length
  };
  console.log('\nÖzet:', JSON.stringify(totals));
  console.log('Toplam görsel:', audits.reduce((s, a) => s + a.imageCount, 0));
}

}
