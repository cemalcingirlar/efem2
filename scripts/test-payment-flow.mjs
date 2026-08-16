#!/usr/bin/env node
/* =========================================
   Ödeme akışı entegrasyon testi (sahte iyzico + sahte sipariş defteri)
   =========================================
   Gerçek iyzico'ya İSTEK ATMAZ. Yerelde iyzico gibi davranan küçük bir HTTP
   sunucusu ve bellekte bir sipariş defteri kullanarak şunları doğrular:

     1) initialize: tutarı sunucu hesaplar, siparişi açar, imzayı doğrular
     2) callback  : sonucu retrieve ile sorgular, siparişi `paid` yapar
     3) replay    : aynı callback tekrar gelince ikinci kez işlenmez
     4) tutar oynaması: iyzico farklı tutar döndürürse sipariş `pending_review`
     5) imza hatası : yanlış imzada sipariş `paid` olmaz
     6) başarısız ödeme: `failed`, yan etki yok

   Çalıştırma: node scripts/test-payment-flow.mjs                            */

import http from 'node:http';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const API_KEY    = 'sandbox-api-key';
const SECRET_KEY = 'sandbox-secret-key';

let passed = 0, failed = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passed++; console.log(`  ok   ${name}`); }
  else    { failed++; console.error(`  FAIL ${name}\n       beklenen: ${JSON.stringify(expected)}\n       gelen   : ${JSON.stringify(actual)}`); }
}

/* ─── Sahte iyzico ─── */
const fakeIyzico = {
  paidPriceOverride: null,
  paymentStatus: 'SUCCESS',
  breakSignature: false,       // retrieve yanıtının imzasını boz
  breakInitSignature: false,   // initialize yanıtının imzasını boz
  lastInitializeBody: null
};

function sign(params) {
  return crypto.createHmac('sha256', SECRET_KEY).update(params.join(':')).digest('hex');
}

const gateway = http.createServer((req, res) => {
  let body = '';
  req.on('data', c => { body += c; });
  req.on('end', () => {
    const payload = JSON.parse(body || '{}');
    res.setHeader('Content-Type', 'application/json');

    // IYZWSv2 başlığı gerçekten üretiliyor mu?
    const auth = String(req.headers.authorization || '');
    if (!auth.startsWith('IYZWSv2 ') || !req.headers['x-iyzi-rnd']) {
      res.statusCode = 401;
      res.end(JSON.stringify({ status: 'failure', errorCode: 'auth' }));
      return;
    }
    const decoded = Buffer.from(auth.slice(8), 'base64').toString('utf8');
    const rnd = req.headers['x-iyzi-rnd'];
    const expected = crypto.createHmac('sha256', SECRET_KEY)
      .update(rnd + req.url + body).digest('hex');
    if (!decoded.includes(`apiKey:${API_KEY}`) || !decoded.includes(`signature:${expected}`)) {
      res.statusCode = 401;
      res.end(JSON.stringify({ status: 'failure', errorCode: 'bad_signature' }));
      return;
    }

    if (req.url.includes('checkoutform/initialize')) {
      fakeIyzico.lastInitializeBody = payload;
      const token = 'tok-' + payload.conversationId;
      res.end(JSON.stringify({
        status: 'success',
        conversationId: payload.conversationId,
        token,
        tokenExpireTime: 1800,
        paymentPageUrl: `https://sandbox-cpp.iyzipay.com/${token}`,
        signature: fakeIyzico.breakInitSignature ? 'f'.repeat(64) : sign([payload.conversationId, token])
      }));
      return;
    }

    if (req.url.includes('checkoutform/auth/ecom/detail')) {
      const conversationId = payload.token.replace(/^tok-/, '');
      const price = fakeIyzico.paidPriceOverride ?? EXPECTED_PRICE;
      const fields = {
        paymentStatus: fakeIyzico.paymentStatus,
        paymentId: '99887766',
        currency: 'TRY',
        basketId: conversationId,
        conversationId,
        paidPrice: price,
        price,
        token: payload.token
      };
      const signature = fakeIyzico.breakSignature
        ? 'f'.repeat(64)
        : sign(Object.values(fields));
      res.end(JSON.stringify({
        status: 'success',
        ...fields,
        fraudStatus: 1,
        installment: 1,
        cardAssociation: 'MASTER_CARD',
        binNumber: '552879',
        lastFourDigits: '0008',
        itemTransactions: [{ paymentTransactionId: '12345', price: 1, paidPrice: 1 }],
        signature
      }));
      return;
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ status: 'failure', errorCode: 'unknown_path' }));
  });
});

await new Promise(resolve => gateway.listen(0, resolve));
const gatewayUrl = `http://127.0.0.1:${gateway.address().port}`;

process.env.IYZICO_API_KEY     = API_KEY;
process.env.IYZICO_SECRET_KEY  = SECRET_KEY;
process.env.IYZICO_MODE        = 'sandbox';
process.env.IYZICO_BASE_URL    = gatewayUrl;
process.env.SITE_BASE_URL      = 'https://example.test';
process.env.ORDER_TOKEN_SECRET = 'flow-test-secret';
process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({
  project_id: 'test', client_email: 'test@test.iam.gserviceaccount.com', private_key: 'x'
});

/* ─── Sahte sipariş defteri (firebase-admin yerine) ─── */
const db = new Map();
const events = new Set();
const sideEffects = { mails: [], profileWrites: [] };

const fakeStore = {
  getStore: () => ({}),
  isStoreConfigured: () => true,
  verifyIdToken: async () => null,
  createOrder: async (id, data) => {
    if (db.has(id)) throw Object.assign(new Error('exists'), { code: 6 });
    db.set(id, { ...data });
  },
  getOrder: async (id) => (db.has(id) ? { ...db.get(id) } : null),
  findOrderByCheckoutToken: async (token) =>
    [...db.values()].find(o => o.checkoutToken === token) || null,
  updateOrder: async (id, data) => { db.set(id, { ...db.get(id), ...data }); },
  transitionOrder: async (id, decide) => {
    const current = db.get(id);
    if (!current) return { applied: false, reason: 'not_found', order: null };
    const patch = decide(current);
    if (!patch) return { applied: false, reason: 'no_change', order: current };
    db.set(id, { ...current, ...patch });
    return { applied: true, order: db.get(id) };
  },
  recordEventOnce: async (id) => (events.has(id) ? false : (events.add(id), true)),
  appendOrderToUserProfile: async (uid, order) => { sideEffects.profileWrites.push(order.id); },
  queueMail: async (to, subject) => { sideEffects.mails.push({ to, subject }); }
};

require.cache[require.resolve('../api/_lib/store.js')] = {
  id: require.resolve('../api/_lib/store.js'),
  filename: require.resolve('../api/_lib/store.js'),
  loaded: true,
  exports: fakeStore
};

const initialize = require('../api/_lib/../payment/initialize.js');
const callback   = require('../api/payment/callback.js');
const { priceBasket } = require('../api/_lib/orders.js');
const catalog = require('../api/_lib/catalog.json');
const P1 = catalog.products[0];
const SKU1 = P1.variants[0].sku;
const SKU1B = P1.variants[1].sku;

const EXPECTED_TOTAL_KURUS = priceBasket([{ id: P1.id, sku: SKU1, qty: 2 }, { id: P1.id, sku: SKU1B, qty: 1 }]).totalKurus;
const EXPECTED_PRICE = Number((EXPECTED_TOTAL_KURUS / 100).toFixed(2));

/* ─── Handler çağırma yardımcıları ─── */
function makeRes() {
  const res = {
    statusCode: 200, headers: {}, body: null, ended: false,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    status(code) { this.statusCode = code; return this; },
    send(payload) { this.body = payload; this.ended = true; return this; },
    end(payload) { if (payload !== undefined) this.body = payload; this.ended = true; return this; }
  };
  return res;
}

/* Her çağrı varsayılan olarak FARKLI bir IP'den gelir: initialize'daki hız
   sınırı (5 dakikada 8 deneme) testleri kilitlemesin. Hız sınırının kendisi
   ayrıca test ediliyor (bölüm 8). */
let ipCounter = 0;

async function call(handler, { method = 'POST', body = {}, query = {}, headers = {}, ip = null } = {}) {
  const clientIp = ip || `10.0.0.${++ipCounter % 250}`;
  headers = { 'x-forwarded-for': clientIp, ...headers };
  const req = { method, body, query, headers, socket: { remoteAddress: clientIp } };
  const res = makeRes();
  await handler(req, res);
  let json = null;
  try { json = JSON.parse(res.body); } catch { /* yönlendirme gövdesizdir */ }
  return { res, json };
}

const ORDER_INPUT = {
  // price ve color BİLEREK yanlış gönderiliyor: sunucu ikisini de yok saymalı
  items: [
    { id: P1.id, sku: SKU1,  qty: 2, price: 1 },
    { id: P1.id, sku: SKU1B, qty: 1, color: "Altın Sarısı" }
  ],
  buyer: { ad: 'Ali', soyad: 'Veli', email: 'ali@example.com', telefon: '05001112233' },
  address: { adres: 'Yeni Mahalle 87071 Sokak No:5', sehir: 'Adana', ilce: 'Seyhan', posta: '01150' },
  invoice: { tip: 'bireysel' },
  delivery: 'kargo',
  agreements: { distanceSales: true, preInfo: true }
};

console.log('\n1) initialize');
const init = await call(initialize, { body: ORDER_INPUT });
check('HTTP 200', init.res.statusCode, 200);
check('sipariş numarası döndü', /^EFM\d{6}-[0-9A-F]{6}$/.test(init.json?.orderId || ''), true);
check('tutar sunucudan', init.json?.totalKurus, EXPECTED_TOTAL_KURUS);
check('iyzico\'ya giden fiyat', fakeIyzico.lastInitializeBody?.paidPrice, String(EXPECTED_PRICE) + (String(EXPECTED_PRICE).includes('.') ? '' : '.0'));
check('basket item sayısı (iki varyant = iki satır)', fakeIyzico.lastInitializeBody?.basketItems?.length, 2);
check('basket item kimliği sku', fakeIyzico.lastInitializeBody?.basketItems?.[0]?.id, SKU1);
check('basket item adında varyant var',
  fakeIyzico.lastInitializeBody?.basketItems?.[0]?.name.includes(P1.variants[0].color), true);
check('istemcinin uydurduğu renk kullanılmadı',
  fakeIyzico.lastInitializeBody?.basketItems?.[1]?.name.includes('Altın Sarısı'), false);
check('basket item toplamı = paidPrice',
  fakeIyzico.lastInitializeBody?.basketItems?.reduce((s, i) => s + Math.round(Number(i.price) * 100), 0),
  EXPECTED_TOTAL_KURUS);
check('siparişte sku saklandı', db.get(init.json.orderId)?.items?.[0]?.sku, SKU1);
check('gsm normalize', fakeIyzico.lastInitializeBody?.buyer?.gsmNumber, '+905001112233');
check('callback adresi', fakeIyzico.lastInitializeBody?.callbackUrl, 'https://example.test/api/payment/callback');
check('sipariş awaiting_payment', db.get(init.json.orderId)?.status, 'awaiting_payment');
check('sözleşme onayı kaydedildi', db.get(init.json.orderId)?.agreements?.distanceSales, true);

const orderId = init.json.orderId;
const token = `tok-${orderId}`;

console.log('\n2) callback — başarılı ödeme');
const cb1 = await call(callback, { body: { token }, query: { order: orderId } });
check('303 yönlendirme', cb1.res.statusCode, 303);
check('sonuç sayfasına gidiyor', cb1.res.headers.location.startsWith('https://example.test/odeme-sonuc.html?order=' + orderId), true);
check('sipariş paid', db.get(orderId).status, 'paid');
check('paymentId yazıldı', db.get(orderId).paymentId, '99887766');
check('doğrulama sorunu yok', db.get(orderId).payment.problems, []);
check('sipariş maili kuyruğa girdi', sideEffects.mails.length, 1);

console.log('\n3) callback replay — ikinci kez işlenmemeli');
await call(callback, { body: { token }, query: { order: orderId } });
await call(callback, { body: { token }, query: { order: orderId } });
check('durum hâlâ paid', db.get(orderId).status, 'paid');
check('ikinci mail gönderilmedi', sideEffects.mails.length, 1);

console.log('\n4) tutar uyuşmazlığı → pending_review');
fakeIyzico.paidPriceOverride = 1;
const init2 = await call(initialize, { body: ORDER_INPUT });
await call(callback, { body: { token: `tok-${init2.json.orderId}` }, query: { order: init2.json.orderId } });
check('sipariş paid DEĞİL', db.get(init2.json.orderId).status, 'pending_review');
check('sorun kaydedildi', db.get(init2.json.orderId).payment.problems, ['amount_mismatch']);
check('mail gönderilmedi', sideEffects.mails.length, 1);
fakeIyzico.paidPriceOverride = null;

console.log('\n5) yanıt imzası geçersiz');
fakeIyzico.breakInitSignature = true;
const init3 = await call(initialize, { body: ORDER_INPUT });
check('initialize imzası bozuksa ödeme sayfası açılmaz', init3.res.statusCode, 502);
check('kullanıcıya sağlayıcı detayı sızmaz', init3.json.message.includes('çekim yapılmadı'), true);
fakeIyzico.breakInitSignature = false;

fakeIyzico.breakSignature = true;
const init3b = await call(initialize, { body: ORDER_INPUT });
await call(callback, { body: { token: `tok-${init3b.json.orderId}` }, query: { order: init3b.json.orderId } });
check('retrieve imzası bozuksa paid olmaz', db.get(init3b.json.orderId).status, 'pending_review');
check('sorun kaydedildi', db.get(init3b.json.orderId).payment.problems, ['signature_invalid']);
fakeIyzico.breakSignature = false;

console.log('\n6) başarısız ödeme → failed');
fakeIyzico.paymentStatus = 'FAILURE';
const init4 = await call(initialize, { body: ORDER_INPUT });
await call(callback, { body: { token: `tok-${init4.json.orderId}` }, query: { order: init4.json.orderId } });
check('sipariş failed', db.get(init4.json.orderId).status, 'failed');
check('mail gönderilmedi', sideEffects.mails.length, 1);
fakeIyzico.paymentStatus = 'SUCCESS';

console.log('\n7) doğrulama kapıları');
const noAgreement = await call(initialize, { body: { ...ORDER_INPUT, agreements: {} } });
check('sözleşme onayı yoksa 400', noAgreement.res.statusCode, 400);
const badItem = await call(initialize, { body: { ...ORDER_INPUT, items: [{ id: 999999, sku: SKU1, qty: 1 }] } });
check('olmayan ürün 400', badItem.res.statusCode, 400);
const noSku = await call(initialize, { body: { ...ORDER_INPUT, items: [{ id: P1.id, qty: 1 }] } });
check('varyant seçimi eksikse 400', noSku.res.statusCode, 400);
const fakeSku = await call(initialize, { body: { ...ORDER_INPUT, items: [{ id: P1.id, sku: 'YOK-1', qty: 1 }] } });
check('sahte sku 400', fakeSku.res.statusCode, 400);
const badBuyer = await call(initialize, { body: { ...ORDER_INPUT, buyer: { ad: 'A', soyad: 'B', email: 'x', telefon: '1' } } });
check('geçersiz alıcı 400', badBuyer.res.statusCode, 400);
const noToken = await call(callback, { body: {} });
check('token\'sız callback hata sayfasına gider', noToken.res.headers.location.includes('durum=hata'), true);

console.log('\n8) hız sınırı (kart deneme freni)');
{
  const attacker = '203.0.113.77';
  let lastStatus = 0;
  for (let i = 0; i < 10; i++) {
    const r = await call(initialize, { body: ORDER_INPUT, ip: attacker });
    lastStatus = r.res.statusCode;
  }
  check('aynı IP\'den ardışık denemeler 429 ile durur', lastStatus, 429);
}

await new Promise(resolve => gateway.close(resolve));
console.log(`\n${passed} test geçti, ${failed} test başarısız.\n`);
process.exitCode = failed ? 1 : 0;
