'use strict';

/* =========================================
   POST /api/coupon/validate — sepette kupon uygula
   =========================================
   Sepet ekranı kuponu burada doğrular. İstemci yalnız kupon KODUNU ve
   sepetteki {id, sku, qty} satırlarını gönderir; ara toplam ve indirim
   sunucudaki fiyat/kupon tanımlarından hesaplanır.

   Bu uç sadece GÖSTERİM içindir — asıl indirim ödeme başlatılırken
   (api/payment/initialize.js, api/order/eft.js) aynı fonksiyonla yeniden
   hesaplanır. Burada dönen tutarın istemcide değiştirilmesi siparişin
   tutarını değiştirmez.

   Kupon kodu tahmin edilebilir olduğu için kaba kuvvet denemesi frenlenir. */

const { methodNotAllowed, json, fail, parseBody, rateLimit, clientIp } = require('../_lib/http');
const { priceBasket, formatTry } = require('../_lib/orders');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  const limit = rateLimit(`coupon:${clientIp(req)}`, { limit: 20, windowMs: 5 * 60 * 1000 });
  if (!limit.allowed) {
    return fail(res, 429, 'rate_limited', 'Çok fazla kupon denemesi yapıldı. Lütfen birkaç dakika sonra tekrar deneyin.');
  }

  const body = parseBody(req);
  const code = String(body.code || '').trim();
  if (!code) return fail(res, 400, 'code_required', 'Lütfen bir kupon kodu girin.');

  const basket = await priceBasket(body.items, { couponCode: code });
  if (basket.error) return fail(res, 400, 'coupon_invalid', basket.error);

  if (!basket.coupon || basket.discountKurus <= 0) {
    return fail(res, 400, 'coupon_invalid', 'Bu kupon sepetinize uygulanamadı.');
  }

  return json(res, 200, {
    ok: true,
    code:          basket.coupon.code,
    label:         basket.coupon.label,
    subtotalKurus: basket.subtotalKurus,
    discountKurus: basket.discountKurus,
    totalKurus:    basket.totalKurus,
    discountText:  formatTry(basket.discountKurus),
    totalText:     formatTry(basket.totalKurus)
  });
};
