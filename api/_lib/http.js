'use strict';

/* =========================================
   HTTP yardımcıları
   =========================================
   Kural: kullanıcıya gösterilen hata mesajı asla sağlayıcı ham hatası,
   stack trace veya yapılandırma detayı içermez; teşhis bilgisi yalnızca
   sunucu loguna yazılır (rapor: "Error handling", "Logging"). */

function json(res, status, payload) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).send(JSON.stringify(payload));
}

function fail(res, status, code, message) {
  json(res, status, { ok: false, code, message });
}

function methodNotAllowed(res, allowed) {
  res.setHeader('Allow', allowed.join(', '));
  fail(res, 405, 'method_not_allowed', 'Bu adres bu istek türünü kabul etmiyor.');
}

/* Vercel gövdeyi çoğu durumda çözer; string/Buffer geldiğinde de çalışsın. */
function parseBody(req) {
  const body = req.body;
  if (!body) return {};
  if (typeof body === 'object' && !Buffer.isBuffer(body)) return body;

  const text = Buffer.isBuffer(body) ? body.toString('utf8') : String(body);
  const type = String(req.headers['content-type'] || '');

  try {
    if (type.includes('application/x-www-form-urlencoded')) {
      return Object.fromEntries(new URLSearchParams(text));
    }
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '');
  const first = forwarded.split(',')[0].trim();
  const ip = first || req.socket?.remoteAddress || '';
  // PayTR user_ip alanı geçerli bir IP bekler; boşsa güvenli bir varsayılan verilir.
  return /^[0-9a-fA-F:.]{3,45}$/.test(ip) ? ip : '85.34.78.112';
}

/* ─── Basit hız sınırı (kart deneme/enumeration frenleme) ───
   Serverless'ta bellek örnek başına olduğu için bu tam bir koruma değil,
   ucuz bir ilk frendir; kalıcı koruma için WAF/rate-limit servisi önerilir
   (bkz. docs/PAYTR-ENTEGRASYON.md → Fraud/hız sınırı). */
const buckets = new Map();

function rateLimit(key, { limit = 10, windowMs = 60000 } = {}) {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) if (now > v.resetAt) buckets.delete(k);
    }
    return { allowed: true, remaining: limit - 1 };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return { allowed: false, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  return { allowed: true, remaining: limit - bucket.count };
}

/* ─── Ödeme olayı logu ───
   PAN/CVV/secret ASLA loglanmaz; yalnızca korelasyon kimlikleri ve sonuç. */
function logPaymentEvent(fields) {
  const safe = {
    ts: new Date().toISOString(),
    ...fields
  };
  console.log('[payment] %s', JSON.stringify(safe));
}

module.exports = { json, fail, methodNotAllowed, parseBody, clientIp, rateLimit, logPaymentEvent };
