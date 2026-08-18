'use strict';

/* =========================================
   POST /api/admin/upload — ürün görseli yükle (Firebase Storage)
   =========================================
   Gövde: { fileName, contentType, data }  (data = base64, data: URI da olur)
   Yanıt: { url }  → doğrudan ürünün images[] alanına yazılabilir.

   Yükleme neden sunucudan yapılıyor?
   Storage'a istemciye yazma izni verilseydi, kuralların tek dayanağı
   tarayıcının taşıdığı token olurdu. Burada yükleme Admin SDK ile yapılır;
   storage.rules istemci yazmasını tamamen kapatabilir (herkes okur, kimse
   yazamaz). Böylece yetkisiz dosya yükleme yüzeyi ortadan kalkar.

   Kabul edilen tipler yalnız görsel; boyut sınırı 3 MB. Dosya adı
   sunucuda yeniden üretilir — istemciden gelen ad yol olarak kullanılmaz
   (path traversal ve üzerine yazma riski).                                 */

const crypto = require('crypto');
const { methodNotAllowed, json, fail, parseBody, rateLimit, clientIp } = require('../_lib/http');
const { adminGate } = require('../_lib/admin-auth');
const store = require('../_lib/store');

/* 3 MB: base64'e çevrilince ~4 MB eder ve Vercel'in 4,5 MB'lık istek gövdesi
   sınırının altında kalır. Daha büyük görseller zaten vitrin için gereksiz. */
const MAX_BYTES = 3 * 1024 * 1024;

const EXT = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif':  'gif'
};

/* Uzantı, gönderilen contentType'a değil dosyanın İLK BAYTLARINA göre
   belirlenir: "image/png" diyip HTML yükleyen bir istek kabul edilmemeli. */
function sniffType(buffer) {
  if (buffer.length < 12) return null;
  const hex = buffer.subarray(0, 12).toString('hex');

  if (hex.startsWith('ffd8ff'))                       return 'image/jpeg';
  if (hex.startsWith('89504e470d0a1a0a'))             return 'image/png';
  if (hex.startsWith('47494638'))                     return 'image/gif';
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF'
      && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (buffer.subarray(4, 8).toString('ascii') === 'ftyp'
      && buffer.subarray(8, 12).toString('ascii').startsWith('avif')) return 'image/avif';

  return null;
}

function decodeBase64(raw) {
  const text = String(raw || '');
  const match = /^data:([^;,]+);base64,(.*)$/s.exec(text.trim());
  const payload = match ? match[2] : text;
  const cleaned = payload.replace(/\s+/g, '');
  if (!cleaned) return null;
  try {
    return Buffer.from(cleaned, 'base64');
  } catch {
    return null;
  }
}

/* Yalnız slug'a indirgenmiş bir "ipucu" korunur; gerçek ad rastgele üretilir. */
function slugHint(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'gorsel';
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  const limit = rateLimit(`admin-upload:${clientIp(req)}`, { limit: 40, windowMs: 10 * 60 * 1000 });
  if (!limit.allowed) return fail(res, 429, 'rate_limited', 'Çok fazla yükleme yapıldı. Lütfen birkaç dakika sonra tekrar deneyin.');

  const admin = await adminGate(req, res);
  if (!admin) return;

  const body = parseBody(req);
  const buffer = decodeBase64(body.data);

  if (!buffer || !buffer.length) return fail(res, 400, 'file_missing', 'Yüklenecek dosya okunamadı.');
  if (buffer.length > MAX_BYTES)  return fail(res, 413, 'file_too_large', 'Görsel en fazla 3 MB olabilir.');

  const detected = sniffType(buffer);
  if (!detected || !EXT[detected]) {
    return fail(res, 415, 'unsupported_type', 'Yalnız JPG, PNG, WEBP, AVIF ve GIF görseller yüklenebilir.');
  }

  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const path = `products/${stamp}/${slugHint(body.fileName)}-${crypto.randomBytes(6).toString('hex')}.${EXT[detected]}`;

  let url;
  try {
    url = await store.uploadImage(path, buffer, detected);
  } catch (err) {
    console.error('[admin/upload] görsel yüklenemedi (%s): %s', path, err.message);
    return fail(res, 503, 'upload_failed',
      'Görsel yüklenemedi. Firebase Storage kovasının açık olduğundan emin olun.');
  }

  console.log('[admin] görsel yüklendi: %s (%d bayt) by=%s', path, buffer.length, admin.email);
  return json(res, 201, { ok: true, url, path, contentType: detected, bytes: buffer.length });
};
