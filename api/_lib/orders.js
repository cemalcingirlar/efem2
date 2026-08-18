'use strict';

/* =========================================
   Sipariş alanı: doğrulama, fiyatlama, kimlikler
   =========================================
   Buradaki hesaplar sunucu-otoritatiftir. İstemciden gelen tutar/fiyat
   ASLA kullanılmaz; yalnızca ürün id'si ve adet kabul edilir
   (rapor: TC-PRICE-TAMPER, "Checkout fiyat bütünlüğü"). */

const crypto = require('crypto');
const { orderTokenSecret } = require('./env');
const { loadCatalog } = require('./catalog-store');
const { applyCoupon } = require('./coupons');

const MAX_DISTINCT_ITEMS = 20;
const MAX_ITEM_QTY       = 10;
const MAX_ORDER_KURUS    = 50000000; // 500.000 ₺ üzeri sipariş manuel incelemeye düşer

/* ─── Metin temizleme ───
   PayTR'ye ve Firestore'a giden tüm serbest metinler kırpılır: kontrol
   karakterleri ayıklanır, uzunluk sınırlanır. */
function clean(value, maxLength = 120) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function formatTry(kurus) {
  return (kurus / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
}

/* ─── Varyant etiketi (renk · beden) ───
   Renk/beden bilgisi istemciden DEĞİL, sunucudaki katalogdan okunur;
   müşteri yalnız hangi sku'yu seçtiğini bildirir. */
function variantLabel(line) {
  return [line.color, line.size].filter(Boolean).join(' · ');
}

/* Sipariş satırının müşteriye ve PayTR sepetine gösterilen tam adı. */
function lineTitle(line) {
  const label = variantLabel(line);
  return label ? `${line.name} (${label})` : line.name;
}

/* ─── Sepeti sunucu fiyatlarıyla yeniden hesapla ───
   Sepet satırları ürün id'si + varyant sku'su ile ayrışır: aynı ürünün iki
   farklı rengi iki ayrı satırdır (js/cart.js → cartLineKey ile aynı mantık).

   Fiyatlar Firestore + statik katalogdan gelir (api/_lib/catalog-store.js);
   kupon indirimi de burada, sunucudaki tanıma göre hesaplanır. İstemciden
   gelen fiyat/indirim değerleri kullanılmaz. */
async function priceBasket(rawItems, { couponCode = null } = {}) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { error: 'Sepetiniz boş görünüyor.' };
  }
  if (rawItems.length > MAX_DISTINCT_ITEMS) {
    return { error: `Tek siparişte en fazla ${MAX_DISTINCT_ITEMS} farklı ürün bulunabilir.` };
  }

  const { products: PRODUCTS } = await loadCatalog();
  const lines = [];
  const seen = new Set();

  for (const raw of rawItems) {
    const id  = Number(raw && raw.id);
    const qty = Number(raw && raw.qty);
    const sku = raw && raw.sku ? String(raw.sku).trim() : '';

    if (!Number.isInteger(id) || !PRODUCTS.has(id)) {
      return { error: 'Sepetinizde artık satışta olmayan bir ürün var. Lütfen sepetinizi yenileyin.' };
    }
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_ITEM_QTY) {
      return { error: `Ürün adedi 1 ile ${MAX_ITEM_QTY} arasında olmalıdır.` };
    }

    const product = PRODUCTS.get(id);
    const variants = product.variants || [];
    let variant = null;

    if (variants.length) {
      if (!sku) {
        return { error: 'Sepetinizdeki bir ürünün renk/beden seçimi eksik. Lütfen sepetinizi yenileyin.' };
      }
      variant = variants.find(v => v.sku === sku) || null;
      if (!variant) {
        return { error: 'Sepetinizde artık satışta olmayan bir seçenek var. Lütfen sepetinizi yenileyin.' };
      }
    }

    const key = `${id}::${variant ? variant.sku : ''}`;
    if (seen.has(key)) {
      return { error: 'Sepette aynı ürün birden fazla satırda görünüyor. Lütfen sepetinizi yenileyin.' };
    }
    seen.add(key);

    lines.push({
      id,
      sku:        variant ? variant.sku : null,
      color:      variant ? variant.color : '',
      size:       variant ? variant.size : '',
      name:       product.name,
      category:   product.category,
      itemType:   product.itemType,
      qty,
      unitKurus:  product.priceKurus,
      totalKurus: product.priceKurus * qty
    });
  }

  const subtotalKurus = lines.reduce((sum, l) => sum + l.totalKurus, 0);
  const shippingKurus = 0;                       // tüm siparişlerde ücretsiz kargo

  /* Kupon: indirim tutarı istemciden alınmaz, koddan hesaplanır. */
  const couponResult = await applyCoupon(couponCode, subtotalKurus);
  if (couponResult.error) return { error: couponResult.error };

  const discountKurus = couponResult.discountKurus || 0;
  const totalKurus    = subtotalKurus + shippingKurus - discountKurus;

  /* İndirim sepetin tamamını yiyorsa sipariş oluşturulamaz: ödeme
     sağlayıcısı 0 ₺ tahsil edemez. Sebebi müşteriye açıkça söylüyoruz. */
  if (totalKurus <= 0 && discountKurus > 0) {
    return { error: 'Bu kupon sepet tutarının tamamını karşılıyor; sipariş tutarı sıfır olamaz.' };
  }
  if (totalKurus <= 0)               return { error: 'Sipariş tutarı hesaplanamadı.' };
  if (totalKurus > MAX_ORDER_KURUS)  return { error: 'Bu tutardaki siparişler için lütfen bizimle iletişime geçin.' };

  return {
    lines,
    subtotalKurus,
    shippingKurus,
    discountKurus,
    coupon: couponResult.coupon ? { code: couponResult.coupon.code, label: couponResult.coupon.label } : null,
    totalKurus
  };
}

/* ─── Alıcı / adres doğrulama (istemci doğrulaması bir kontrol değildir) ─── */
const PHONE_RE = /^(\+90|0)?5\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validateBuyer(raw) {
  const buyer = {
    ad:      clean(raw && raw.ad, 60),
    soyad:   clean(raw && raw.soyad, 60),
    email:   clean(raw && raw.email, 120).toLowerCase(),
    telefon: clean(raw && raw.telefon, 25).replace(/\s/g, '')
  };

  if (buyer.ad.length    < 2) return { error: 'Ad alanı zorunludur.' };
  if (buyer.soyad.length < 2) return { error: 'Soyad alanı zorunludur.' };
  if (!EMAIL_RE.test(buyer.email)) return { error: 'Geçerli bir e-posta adresi girin.' };
  if (!PHONE_RE.test(buyer.telefon)) return { error: 'Geçerli bir Türkiye cep telefonu numarası girin.' };

  return { buyer };
}

function validateAddress(raw, delivery) {
  if (delivery === 'magaza') return { address: null };

  const address = {
    adres: clean(raw && raw.adres, 300),
    sehir: clean(raw && raw.sehir, 40),
    ilce:  clean(raw && raw.ilce, 60),
    posta: clean(raw && raw.posta, 10)
  };

  if (address.adres.length < 10) return { error: 'Teslimat adresi eksik görünüyor.' };
  if (!address.sehir)            return { error: 'Şehir seçilmedi.' };
  if (!address.ilce)             return { error: 'İlçe alanı zorunludur.' };

  return { address };
}

function normalizeInvoice(raw, buyer, address) {
  const tip = raw && raw.tip === 'kurumsal' ? 'kurumsal' : 'bireysel';
  return {
    tip,
    unvan:        clean(raw && raw.unvan, 160) || `${buyer.ad} ${buyer.soyad}`,
    tcknVergiNo:  clean(raw && raw.tcknVergiNo, 11).replace(/\D/g, ''),
    vergiDairesi: tip === 'kurumsal' ? clean(raw && raw.vergiDairesi, 80) : '',
    adres:        clean(raw && raw.adres, 300) || (address ? address.adres : '')
  };
}

/* ─── Kimlikler ───
   PayTR `merchant_oid` alanını EN FAZLA 64 karakter ve ALFANUMERİK olarak
   şart koşar (tire/boşluk kabul edilmez). Bu yüzden sipariş numarası
   EFM + yymmdd + 6 hex biçiminde, ayraçsız üretilir: EFM260817A5973E */
function newOrderId() {
  const now = new Date();
  const stamp = [
    String(now.getUTCFullYear()).slice(2),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
    String(now.getUTCDate()).padStart(2, '0')
  ].join('');
  const rand = crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6);
  return `EFM${stamp}${rand}`;
}

/* Misafir siparişinin sonuç sayfasını okuyabilmesi için kısa ömürlü
   olmayan ama tahmin edilemez bir erişim jetonu. Sipariş id'si tek
   başına yeterli sayılmaz (IDOR koruması). */
function orderAccessToken(orderId) {
  const secret = orderTokenSecret();
  if (!secret) return null;
  return crypto.createHmac('sha256', secret).update(`order:${orderId}`).digest('hex').slice(0, 32);
}

function verifyOrderAccessToken(orderId, token) {
  const expected = orderAccessToken(orderId);
  if (!expected || typeof token !== 'string' || token.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}

/* Yeni (PayTR uyumlu, ayraçsız) ve eski (tireli, iyzico döneminden kalan)
   biçim birlikte kabul edilir; eski siparişlerin durumu da okunabilsin. */
const ORDER_ID_RE        = /^EFM\d{6}[0-9A-F]{6}$/;
const LEGACY_ORDER_ID_RE = /^EFM\d{6}-[0-9A-F]{6}$/;

function isValidOrderId(value) {
  return typeof value === 'string' && (ORDER_ID_RE.test(value) || LEGACY_ORDER_ID_RE.test(value));
}

/* ─── İstemciye dönen sipariş görünümü ───
   Ödeme sağlayıcısına ait ham yanıt, imza, e-posta gibi alanlar dışarı
   verilmez. */
function publicOrderView(order) {
  if (!order) return null;
  return {
    id:            order.id,
    status:        order.status,
    statusLabel:   order.statusLabel,
    paymentMethod: order.paymentMethod,
    delivery:      order.delivery,
    totalKurus:    order.totalKurus,
    totalText:     formatTry(order.totalKurus),
    items:         (order.items || []).map(i => ({
      name: i.name, color: i.color || '', size: i.size || '', qty: i.qty, totalKurus: i.totalKurus
    })),
    date:          order.date,
    errorMessage:  order.customerMessage || null
  };
}

/* ─── profil.html / admin.html'in beklediği sipariş özeti ─── */
function legacyOrderSummary(order) {
  return {
    id:             order.id,
    date:           order.date,
    status:         order.status,
    statusLabel:    order.statusLabel,
    items:          (order.items || []).map(i => ({
      id: i.id, name: i.name, qty: i.qty, price: i.unitKurus / 100, category: i.category,
      // profil.html ve admin.html renk/bedeni bu alanlardan okuyor
      sku: i.sku || null, color: i.color || null, size: i.size || null
    })),
    total:          order.totalKurus / 100,
    address:        order.address || null,
    invoice:        order.invoice || null,
    delivery:       order.delivery || 'kargo',
    paymentMethod:  order.paymentMethod || 'kart',
    paymentId:      order.paymentId || null,
    eftReceiptNo:   order.eftReceiptNo || null,
    trackingNumber: null
  };
}

module.exports = {
  MAX_DISTINCT_ITEMS,
  MAX_ITEM_QTY,
  clean,
  formatTry,
  variantLabel,
  lineTitle,
  priceBasket,
  validateBuyer,
  validateAddress,
  normalizeInvoice,
  newOrderId,
  orderAccessToken,
  verifyOrderAccessToken,
  isValidOrderId,
  publicOrderView,
  legacyOrderSummary
};
