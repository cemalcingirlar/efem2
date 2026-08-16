'use strict';

/* GET /api/payment/config
   Checkout sayfası kart ödemesini AÇMADAN ÖNCE burayı sorar. Yapılandırma
   eksikse kart sekmesi hiç gösterilmez; müşteri EFT/havale ile devam eder.
   Sır veya yapılandırma detayı dönmez, yalnızca yetenek bilgisi. */

const { methodNotAllowed, json } = require('../_lib/http');
const { isCardPaymentEnabled, iyzicoMode, enabledInstallments } = require('../_lib/env');
const { isStoreConfigured } = require('../_lib/store');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

  const cardEnabled = isCardPaymentEnabled();

  json(res, 200, {
    ok: true,
    cardEnabled,
    // Sandbox uyarısı checkout'ta gösterilir: müşteri gerçek para
    // geçmediğini bilmelidir.
    mode: cardEnabled ? iyzicoMode() : null,
    installments: cardEnabled ? enabledInstallments() : [],
    // Sunucu tarafı sipariş defteri açık mı? Kapalıysa EFT siparişi eski
    // istemci akışıyla oluşturulur (bkz. js/payment.js).
    orderApiEnabled: isStoreConfigured(),
    provider: 'iyzico'
  });
};
