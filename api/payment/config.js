'use strict';

/* GET /api/payment/config
   Checkout sayfası kart ödemesini AÇMADAN ÖNCE burayı sorar. Yapılandırma
   eksikse kart sekmesi hiç gösterilmez; müşteri EFT/havale ile devam eder.
   Sır veya yapılandırma detayı dönmez, yalnızca yetenek bilgisi. */

const { methodNotAllowed, json } = require('../_lib/http');
const { isCardPaymentEnabled, paytrMode, installmentSettings, serviceAccountDiagnostics } = require('../_lib/env');
const { isStoreConfigured } = require('../_lib/store');
const { adminEmailsDiagnostics } = require('../_lib/admin-auth');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

  const cardEnabled = isCardPaymentEnabled();
  const { noInstallment, maxInstallment } = installmentSettings();

  json(res, 200, {
    ok: true,
    cardEnabled,
    // Test modu uyarısı checkout'ta gösterilir: müşteri gerçek para
    // geçmediğini bilmelidir.
    mode: cardEnabled ? paytrMode() : null,
    installmentsEnabled: cardEnabled ? noInstallment === 0 : false,
    maxInstallment: cardEnabled && noInstallment === 0 ? maxInstallment : 0,
    // Sunucu tarafı sipariş defteri açık mı? Kapalıysa EFT siparişi eski
    // istemci akışıyla oluşturulur (bkz. js/payment.js).
    orderApiEnabled: isStoreConfigured(),
    // Kurulum teşhisi: anahtarın içeriği DEĞİL, yalnız durumu.
    serviceAccount: serviceAccountDiagnostics(),
    adminEmails:    adminEmailsDiagnostics(),
    provider: 'paytr'
  });
};
