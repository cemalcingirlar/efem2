#!/usr/bin/env node
/* =========================================
   Ödeme kütüphanesi birim testleri (bağımlılıksız)
   =========================================
   Ağ/gerçek iyzico çağrısı yapmaz. Doğruladıkları:
   - IYZWSv2 imza üretimi ve yanıt imzası hesabı (iyzico SDK'sının
     dokümante ettiği algoritmayla birebir)
   - JSON kök seviye ham değer okuyucu (imza doğrulaması buna dayanır)
   - Fiyat biçimi ve sunucu tarafı sepet fiyatlaması (fiyat manipülasyonu)
   - Webhook X-IYZ-SIGNATURE-V3 doğrulaması
   - Sipariş erişim jetonu

   Çalıştırma: npm run test:payment                                        */

import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

process.env.IYZICO_API_KEY    ||= 'sandbox-test-api-key';
process.env.IYZICO_SECRET_KEY ||= 'sandbox-test-secret-key';
process.env.ORDER_TOKEN_SECRET ||= 'unit-test-order-secret';

const iyzico = require('../api/_lib/iyzico.js');
const orders = require('../api/_lib/orders.js');

let passed = 0;
let failed = 0;

function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passed++; console.log(`  ok   ${name}`); }
  else    { failed++; console.error(`  FAIL ${name}\n       beklenen: ${JSON.stringify(expected)}\n       gelen   : ${JSON.stringify(actual)}`); }
}

function truthy(name, value) {
  check(name, Boolean(value), true);
}

console.log('\nformatPriceFromKurus');
check('7499,00 ₺', iyzico.formatPriceFromKurus(749900), '7499.0');
check('12,50 ₺',   iyzico.formatPriceFromKurus(1250),   '12.5');
check('10,00 ₺',   iyzico.formatPriceFromKurus(1000),   '10.0');
check('0,05 ₺',    iyzico.formatPriceFromKurus(5),      '0.05');

console.log('\ntopLevelRawScalars — iç içe alanlar imzayı bozmamalı');
{
  const body = JSON.stringify({
    status: 'success', paymentStatus: 'SUCCESS', paymentId: '21234567', currency: 'TRY'
  }).replace('"paymentId":"21234567"', '"paymentId":"21234567","price":7499.0,"paidPrice":7499.0')
    + '';
  const withNested = body.slice(0, -1) + ',"itemTransactions":[{"price":100.0,"paidPrice":100.0}]}';
  const raw = iyzico.topLevelRawScalars(withNested);
  check('kök price', raw.price, '7499.0');
  check('kök paidPrice', raw.paidPrice, '7499.0');
  check('kök paymentStatus', raw.paymentStatus, 'SUCCESS');
}

console.log('\ncalculateSignature — SDK ile aynı sonuç');
{
  const secret = 'secret';
  const params = ['SUCCESS', '123', 'TRY', 'B1', 'C1', '1.2', '1.2', 'tok'];
  const expected = crypto.createHmac('sha256', secret).update(params.join(':')).digest('hex');
  check('imza', iyzico.calculateSignature(params, secret), expected);
}

console.log('\nwebhook X-IYZ-SIGNATURE-V3');
{
  const secret = 's3cr3t';
  const payload = {
    iyziEventType: 'CHECKOUTFORM_AUTH',
    iyziPaymentId: '9988776',
    token: 'tok123',
    paymentConversationId: 'EFM260816-ABCDEF',
    status: 'SUCCESS'
  };
  const hpp = crypto.createHmac('sha256', secret)
    .update(`${secret}${payload.iyziEventType}${payload.iyziPaymentId}${payload.token}${payload.paymentConversationId}${payload.status}`)
    .digest('hex');
  truthy('geçerli HPP imzası kabul edilir', iyzico.verifyWebhookSignatureV3(payload, hpp, secret));
  check('bozuk imza reddedilir', iyzico.verifyWebhookSignatureV3(payload, hpp.replace(/.$/, '0'), secret), false);
  check('boş imza reddedilir', iyzico.verifyWebhookSignatureV3(payload, '', secret), false);

  const direct = { ...payload, token: '' };
  const directSig = crypto.createHmac('sha256', secret)
    .update(`${secret}${direct.iyziEventType}${direct.iyziPaymentId}${direct.paymentConversationId}${direct.status}`)
    .digest('hex');
  truthy('doğrudan biçim imzası kabul edilir', iyzico.verifyWebhookSignatureV3(direct, directSig, secret));
}

console.log('\npriceBasket — sunucu otoritesi');
{
  const ok = orders.priceBasket([{ id: 1, qty: 2 }]);
  check('bilinen ürün fiyatlanır', ok.totalKurus, 749900 * 2);

  // İstemcinin gönderdiği fiyat alanı YOK SAYILIR (TC-PRICE-TAMPER)
  const tampered = orders.priceBasket([{ id: 1, qty: 1, price: 1, total: 1 }]);
  check('istemci fiyatı yok sayılır', tampered.totalKurus, 749900);

  truthy('bilinmeyen ürün reddedilir', orders.priceBasket([{ id: 999999, qty: 1 }]).error);
  truthy('sıfır adet reddedilir',      orders.priceBasket([{ id: 1, qty: 0 }]).error);
  truthy('negatif adet reddedilir',    orders.priceBasket([{ id: 1, qty: -3 }]).error);
  truthy('aşırı adet reddedilir',      orders.priceBasket([{ id: 1, qty: 999 }]).error);
  truthy('yinelenen satır reddedilir', orders.priceBasket([{ id: 1, qty: 1 }, { id: 1, qty: 1 }]).error);
  truthy('boş sepet reddedilir',       orders.priceBasket([]).error);
}

console.log('\nsepet toplamı = iyzico basketItems toplamı');
{
  const basket = orders.priceBasket([{ id: 1, qty: 2 }, { id: 2, qty: 1 }]);
  const itemsSum = basket.lines.reduce((sum, l) => sum + Number(iyzico.formatPriceFromKurus(l.totalKurus)) * 100, 0);
  check('toplamlar eşit', Math.round(itemsSum), basket.subtotalKurus);
}

console.log('\nalıcı doğrulama');
{
  truthy('geçersiz e-posta reddedilir', orders.validateBuyer({ ad: 'Ali', soyad: 'Veli', email: 'ali@', telefon: '05001112233' }).error);
  truthy('geçersiz telefon reddedilir', orders.validateBuyer({ ad: 'Ali', soyad: 'Veli', email: 'a@b.com', telefon: '1234' }).error);
  check('geçerli alıcı', orders.validateBuyer({ ad: 'Ali', soyad: 'Veli', email: 'A@B.com', telefon: '0500 111 22 33' }).buyer.email, 'a@b.com');
  check('gsm normalizasyonu (0 ile)',   orders.toGsmNumber('05434402525'),   '+905434402525');
  check('gsm normalizasyonu (90 ile)',  orders.toGsmNumber('905434402525'),  '+905434402525');
  check('gsm normalizasyonu (+90 ile)', orders.toGsmNumber('+90 543 440 25 25'), '+905434402525');
}

console.log('\nsipariş kimliği ve erişim jetonu');
{
  const id = orders.newOrderId();
  truthy('id biçimi geçerli', orders.isValidOrderId(id));
  check('uydurma id reddedilir', orders.isValidOrderId('EFM123456'), false);
  const token = orders.orderAccessToken(id);
  truthy('doğru jeton kabul edilir', orders.verifyOrderAccessToken(id, token));
  check('yanlış jeton reddedilir', orders.verifyOrderAccessToken(id, 'a'.repeat(32)), false);
  check('başka siparişin jetonu reddedilir', orders.verifyOrderAccessToken(orders.newOrderId(), token), false);
}

console.log('\nmetin temizleme');
{
  check('kontrol karakterleri ayıklanır', orders.clean('a\u0000b\u001fc'), 'a b c');
  check('uzunluk sınırlanır', orders.clean('x'.repeat(500), 10).length, 10);
}

console.log(`\n${passed} test geçti, ${failed} test başarısız.\n`);
process.exit(failed ? 1 : 0);
