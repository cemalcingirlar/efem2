#!/usr/bin/env node
/* =========================================
   sitemap.xml üretici
   =========================================
   Ürün sayfaları katalogdan (api/_lib/catalog.json) türetilir. Elle yazılan
   sitemap katalog büyüyünce geride kalıyordu: 54 ürünlük katalogda yalnız
   ilk 20 ürün listeleniyordu, kalan 34'ü arama motorlarına hiç bildirilmiyordu.

   Çalıştırma: npm run sync-sitemap     (kontrol: --check)                   */

import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const katalog = require('../api/_lib/catalog.json');

const BASE = 'https://efemiletisim.com';
const SABIT = [
  ['/',                              'daily',   '1.0'],
  ['/urunler.html',                  'daily',   '0.9'],
  ['/hakkimizda.html',               'monthly', '0.6'],
  ['/gizlilik-kvkk.html',            'yearly',  '0.3'],
  ['/on-bilgilendirme-formu.html',   'yearly',  '0.3'],
  ['/mesafeli-satis-sozlesmesi.html','yearly',  '0.3'],
  ['/iptal-iade.html',               'yearly',  '0.3']
];

/* Satıştan kaldırılan ürün sitemap'e girmez. */
const urunler = katalog.products
  .filter(p => p.active !== false)
  .map(p => p.id)
  .sort((a, b) => a - b);

const girdi = (loc, freq, pri) =>
  `  <url>\n    <loc>${BASE}${loc}</loc>\n    <changefreq>${freq}</changefreq>\n    <priority>${pri}</priority>\n  </url>`;

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...SABIT.map(([l, f, p]) => girdi(l, f, p)),
  ...urunler.map(id => girdi(`/urun-detay.html?id=${id}`, 'weekly', '0.8')),
  '</urlset>',
  ''
].join('\n');

const HEDEF = 'sitemap.xml';
if (process.argv.includes('--check')) {
  const mevcut = fs.readFileSync(HEDEF, 'utf8');
  if (mevcut.replace(/\r\n/g, '\n') !== xml) {
    console.error(`sitemap.xml güncel değil. "npm run sync-sitemap" çalıştırın.`);
    process.exit(1);
  }
  console.log(`sitemap.xml güncel (${SABIT.length} sabit sayfa, ${urunler.length} ürün).`);
} else {
  fs.writeFileSync(HEDEF, xml, 'utf8');
  console.log(`sitemap.xml yazıldı: ${SABIT.length} sabit sayfa, ${urunler.length} ürün.`);
}
