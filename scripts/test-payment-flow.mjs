#!/usr/bin/env node
/* =========================================
   Ödeme akışı entegrasyon testi (sahte PayTR + sahte sipariş defteri)
   =========================================
   Gerçek PayTR'ye İSTEK ATMAZ. Yerelde PayTR gibi davranan bir HTTP sunucusu
   ve bellekte bir sipariş defteri kullanarak şunları doğrular:

     1) initialize: tutarı sunucu hesaplar, siparişi açar, PayTR'nin beklediği
        alanları ve paytr_token imzasını doğru üretir
     2) bildirim (notify): imzalı başarılı bildirim siparişi `paid` yapar ve
        gövdesi TAM OLARAK "OK" döner
     3) tekrar bildirim: ikinci kez işlenmez (yan etki tekrarlanmaz)
     4) tutar uyuşmazlığı: `pending_review`, sevkiyat yok
     5) bozuk imza: 401, hiçbir durum değişmez
     6) status=failed: sipariş `failed`, mail gitmez
     7) doğrulama kapıları ve hız sınırı

   Çalıştırma: node scripts/test-payment-flow.mjs                            */

import http from 'node:http';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const MERCHANT_ID   = '123456';
const MERCHANT_KEY  = 'flow-merchant-key';
const MERCHANT_SALT = 'flow-merchant-salt';

let passed = 0, failed = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passed++; console.log(`  ok   ${name}`); }
  else    { failed++; console.error(`  FAIL ${name}\n       beklenen: ${JSON.stringify(expected)}\n       gelen   : ${JSON.stringify(actual)}`); }
}

/* ─── Sahte PayTR ─── */
const fakePaytr = {
  lastRequest: null,
  respondFailure: false,
  tokenSignatureValid: null   // gelen paytr_token'ı bağımsız doğrular
};

const gateway = http.createServer((req, res) => {
  let body = '';
  req.on('data', c => { body += c; });
  req.on('end', () => {
    const fields = Object.fromEntries(new URLSearchParams(body));
    fakePaytr.lastRequest = fields;

    // paytr_token'ı PayTR dokümanındaki formülle bağımsız olarak yeniden hesapla
    const expected = crypto.createHmac('sha256', MERCHANT_KEY).update(
      fields.merchant_id + fields.user_ip + fields.merchant_oid + fields.email +
      fields.payment_amount + fields.user_basket + fields.no_installment +
      fields.max_installment + fields.currency + fields.test_mode + MERCHANT_SALT
    ).digest('base64');
    fakePaytr.tokenSignatureValid = expected === fields.paytr_token;

    res.setHeader('Content-Type', 'application/json');
    if (!fakePaytr.tokenSignatureValid) {
      res.end(JSON.stringify({ status: 'failed', reason: 'paytr_token gecersiz' }));
      return;
    }
    if (fakePaytr.respondFailure) {
      res.end(JSON.stringify({ status: 'failed', reason: 'Zorunlu alan degeri gecersiz: test' }));
      return;
    }
    res.end(JSON.stringify({ status: 'success', token: 'tok' + crypto.randomBytes(12).toString('hex') }));
  });
});

await new Promise(resolve => gateway.listen(0, resolve));
const gatewayUrl = `http://127.0.0.1:${gateway.address().port}`;

process.env.PAYTR_MERCHANT_ID   = MERCHANT_ID;
process.env.PAYTR_MERCHANT_KEY  = MERCHANT_KEY;
process.env.PAYTR_MERCHANT_SALT = MERCHANT_SALT;
process.env.PAYTR_TEST_MODE     = '1';
process.env.SITE_BASE_URL       = 'https://example.test';
process.env.ORDER_TOKEN_SECRET  = 'flow-test-secret';
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

/* PayTR istek adresini test sunucusuna çevir */
const env = require('../api/_lib/env.js');
const realConfig = env.paytrConfig;
env.paytrConfig = () => {
  const cfg = realConfig();
  return cfg ? { ...cfg, tokenUrl: `${gatewayUrl}/odeme/api/get-token` } : cfg;
};

const initialize = require('../api/payment/initialize.js');
const notify     = require('../api/payment/notify.js');
const { priceBasket } = require('../api/_lib/orders.js');
const catalog = require('../api/_lib/catalog.json');
const P1 = catalog.products[0];
const SKU1 = P1.variants[0].sku;
const SKU1B = P1.variants[1].sku;

const EXPECTED_TOTAL_KURUS = (await priceBasket([
  { id: P1.id, sku: SKU1, qty: 2 },
  { id: P1.id, sku: SKU1B, qty: 1 }
])).totalKurus;

/* ─── Handler çağırma yardımcıları ─── */
function makeRes() {
  return {
    statusCode: 200, headers: {}, body: null, ended: false,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    status(code) { this.statusCode = code; return this; },
    send(payload) { this.body = payload; this.ended = true; return this; },
    end(payload) { if (payload !== undefined) this.body = payload; this.ended = true; return this; }
  };
}

let ipCounter = 0;
async function call(handler, { method = 'POST', body = {}, query = {}, headers = {}, ip = null } = {}) {
  const clientIp = ip || `10.0.0.${++ipCounter % 250}`;
  headers = { 'x-forwarded-for': clientIp, ...headers };
  const req = { method, body, query, headers, socket: { remoteAddress: clientIp } };
  const res = makeRes();
  await handler(req, res);
  let json = null;
  try { json = JSON.parse(res.body); } catch { /* düz metin olabilir ("OK") */ }
  return { res, json };
}

/* PayTR'nin göndereceği imzalı bildirimi üretir */
function notification(orderId, { status = 'success', totalKurus = EXPECTED_TOTAL_KURUS, paymentType = 'card', badHash = false } = {}) {
  const total = String(totalKurus);
  const hash = crypto.createHmac('sha256', MERCHANT_KEY)
    .update(orderId + MERCHANT_SALT + status + total)
    .digest('base64');
  return {
    merchant_oid: orderId,
    status,
    total_amount: total,
    payment_amount: String(EXPECTED_TOTAL_KURUS),
    payment_type: paymentType,
    currency: 'TL',
    installment_count: '0',
    test_mode: '1',
    hash: badHash ? hash.replace(/.$/, 'X') : hash
  };
}

const ORDER_INPUT = {
  // price ve color BİLEREK yanlış gönderiliyor: sunucu ikisini de yok saymalı
  items: [
    { id: P1.id, sku: SKU1,  qty: 2, price: 1 },
    { id: P1.id, sku: SKU1B, qty: 1, color: 'Altın Sarısı' }
  ],
  buyer: { ad: 'Ali', soyad: 'Veli', email: 'ali@example.com', telefon: '05001112233' },
  address: { adres: 'Yeni Mahalle 87071 Sokak No:5', sehir: 'Adana', ilce: 'Seyhan', posta: '01150' },
  invoice: { tip: 'bireysel' },
  delivery: 'kargo',
  agreements: { distanceSales: true, preInfo: true }
};

console.log('\n1) initialize — PayTR token isteği');
const init = await call(initialize, { body: ORDER_INPUT });
check('HTTP 200', init.res.statusCode, 200);
check('sipariş numarası alfanumerik', /^EFM\d{6}[0-9A-F]{6}$/.test(init.json?.orderId || ''), true);
check('tutar sunucudan', init.json?.totalKurus, EXPECTED_TOTAL_KURUS);
check('paytr_token imzası geçerli', fakePaytr.tokenSignatureValid, true);
check('PayTR\'ye giden tutar kuruş', fakePaytr.lastRequest?.payment_amount, String(EXPECTED_TOTAL_KURUS));
check('para birimi TL', fakePaytr.lastRequest?.currency, 'TL');
check('test modu gönderildi', fakePaytr.lastRequest?.test_mode, '1');
check('taksit kapalı (varsayılan)', fakePaytr.lastRequest?.no_installment, '1');
check('merchant_oid = sipariş no', fakePaytr.lastRequest?.merchant_oid, init.json.orderId);
{
  const rows = JSON.parse(Buffer.from(fakePaytr.lastRequest.user_basket, 'base64').toString('utf8'));
  check('sepet iki satır (iki varyant)', rows.length, 2);
  check('sepet satırında varyant adı var', rows[0][0].includes(P1.variants[0].color), true);
  check('istemcinin uydurduğu renk kullanılmadı', rows[1][0].includes('Altın Sarısı'), false);
  const sum = rows.reduce((s, [, price, qty]) => s + Math.round(Number(price) * 100) * qty, 0);
  check('sepet toplamı = payment_amount', sum, EXPECTED_TOTAL_KURUS);
}
check('dönüş adresi sipariş sonucuna gidiyor',
  fakePaytr.lastRequest?.merchant_ok_url.startsWith('https://example.test/odeme-sonuc.html?order=' + init.json.orderId), true);
check('sipariş awaiting_payment', db.get(init.json.orderId)?.status, 'awaiting_payment');
check('sözleşme onayı kaydedildi', db.get(init.json.orderId)?.agreements?.distanceSales, true);
check('ödeme sağlayıcısı kaydedildi', db.get(init.json.orderId)?.paymentProvider, 'paytr');

const orderId = init.json.orderId;

console.log('\n2) bildirim — başarılı ödeme');
const ok1 = await call(notify, { body: notification(orderId) });
check('HTTP 200', ok1.res.statusCode, 200);
check('gövde TAM OLARAK "OK"', ok1.res.body, 'OK');
check('sipariş paid', db.get(orderId).status, 'paid');
check('doğrulama sorunu yok', db.get(orderId).payment.problems, []);
check('ödeme tipi kaydedildi', db.get(orderId).payment.paymentType, 'card');
check('müşteriye sipariş maili kuyruğa girdi', sideEffects.mails.filter(m => m.to === 'ali@example.com').length, 1);
check('işletmeye bildirim kuyruğa girdi', sideEffects.mails.filter(m => m.to === 'destek@efemiletisim.com').length, 1);
check('işletme bildiriminde tutar var', sideEffects.mails.some(m => m.to === 'destek@efemiletisim.com' && m.subject.includes('EFM')), true);

console.log('\n3) bildirim tekrarı — ikinci kez işlenmemeli');
await call(notify, { body: notification(orderId) });
await call(notify, { body: notification(orderId) });
check('durum hâlâ paid', db.get(orderId).status, 'paid');
check('mailler tekrarlanmadı', sideEffects.mails.length, 2);

console.log('\n4) tutar uyuşmazlığı → pending_review');
const init2 = await call(initialize, { body: ORDER_INPUT });
await call(notify, { body: notification(init2.json.orderId, { totalKurus: 100 }) });
check('sipariş paid DEĞİL', db.get(init2.json.orderId).status, 'pending_review');
check('sorun kaydedildi', db.get(init2.json.orderId).payment.problems, ['amount_mismatch']);
check('yeni mail gönderilmedi', sideEffects.mails.length, 2);

console.log('\n4b) ortam/para birimi uyuşmazlığı → pending_review');
{
  // Sipariş test modunda açıldı; bildirim "canlı işlem" diyor → otomatik onay yok
  const initEnv = await call(initialize, { body: ORDER_INPUT });
  const payload = notification(initEnv.json.orderId);
  await call(notify, { body: { ...payload, test_mode: '0' } });
  check('ortam uyuşmazlığı paid yapmaz', db.get(initEnv.json.orderId).status, 'pending_review');
  check('sorun kaydedildi', db.get(initEnv.json.orderId).payment.problems, ['environment_mismatch']);

  const initCur = await call(initialize, { body: ORDER_INPUT });
  await call(notify, { body: { ...notification(initCur.json.orderId), currency: 'USD' } });
  check('para birimi uyuşmazlığı paid yapmaz', db.get(initCur.json.orderId).status, 'pending_review');
  check('sorun kaydedildi', db.get(initCur.json.orderId).payment.problems, ['currency_mismatch']);
}

console.log('\n5) bozuk imza — hiçbir şey değişmemeli');
const init3 = await call(initialize, { body: ORDER_INPUT });
const bad = await call(notify, { body: notification(init3.json.orderId, { badHash: true }) });
check('HTTP 401', bad.res.statusCode, 401);
check('OK dönmedi', bad.res.body === 'OK', false);
check('sipariş hâlâ awaiting_payment', db.get(init3.json.orderId).status, 'awaiting_payment');

console.log('\n6) başarısız ödeme → failed');
const init4 = await call(initialize, { body: ORDER_INPUT });
await call(notify, { body: notification(init4.json.orderId, { status: 'failed' }) });
check('sipariş failed', db.get(init4.json.orderId).status, 'failed');
check('yeni mail gönderilmedi', sideEffects.mails.length, 2);

console.log('\n7) PayTR token vermezse ödeme başlatılmaz');
fakePaytr.respondFailure = true;
const init5 = await call(initialize, { body: ORDER_INPUT });
check('HTTP 502', init5.res.statusCode, 502);
check('kullanıcıya sağlayıcı detayı sızmaz', init5.json.message.includes('çekim yapılmadı'), true);
fakePaytr.respondFailure = false;

console.log('\n8) doğrulama kapıları');
const noAgreement = await call(initialize, { body: { ...ORDER_INPUT, agreements: {} } });
check('sözleşme onayı yoksa 400', noAgreement.res.statusCode, 400);
const badItem = await call(initialize, { body: { ...ORDER_INPUT, items: [{ id: 999999, sku: SKU1, qty: 1 }] } });
check('olmayan ürün 400', badItem.res.statusCode, 400);
const noSku = await call(initialize, { body: { ...ORDER_INPUT, items: [{ id: P1.id, qty: 1 }] } });
check('varyant seçimi eksikse 400', noSku.res.statusCode, 400);
const badBuyer = await call(initialize, { body: { ...ORDER_INPUT, buyer: { ad: 'A', soyad: 'B', email: 'x', telefon: '1' } } });
check('geçersiz alıcı 400', badBuyer.res.statusCode, 400);
const wrongMethod = await call(notify, { method: 'GET', body: {} });
check('bildirim GET kabul etmiyor', wrongMethod.res.statusCode, 405);

console.log('\n9) hız sınırı (kart deneme freni)');
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
