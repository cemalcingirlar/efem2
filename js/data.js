/* =========================================
   efemiletisim.com – Ürün Veritabanı
   ========================================= */

/* ─── Admin: localStorage'dan özel ürünleri yükle ─── */
const ADMIN_PRODUCTS_KEY = 'efemi_admin_products';

function getAdminProducts() {
  try { return JSON.parse(localStorage.getItem(ADMIN_PRODUCTS_KEY)) || []; }
  catch { return []; }
}

function saveAdminProducts(products) {
  localStorage.setItem(ADMIN_PRODUCTS_KEY, JSON.stringify(products));
}

/* ─── Admin: sabit (BASE_PRODUCTS) ürünler üzerinde yapılan düzenlemeler ───
   BASE_PRODUCTS kod içinde sabit olduğu için doğrudan değiştirilemez;
   admin panelinden bir sabit ürün düzenlenince buraya id bazlı bir
   "override" objesi yazılır, PRODUCTS oluşturulurken üstüne uygulanır. */
const PRODUCT_OVERRIDES_KEY = 'efemi_product_overrides';

function getProductOverrides() {
  try { return JSON.parse(localStorage.getItem(PRODUCT_OVERRIDES_KEY)) || {}; }
  catch { return {}; }
}

function saveProductOverrides(overrides) {
  localStorage.setItem(PRODUCT_OVERRIDES_KEY, JSON.stringify(overrides));
}

function applyProductOverrides(products) {
  const overrides = getProductOverrides();
  return products.map(p => overrides[p.id] ? { ...p, ...overrides[p.id] } : p);
}

/* ─── Sipariş defteri (localStorage) ───
   Gerçek çoklu-cihaz sipariş yönetimi Firestore backend gerektirir (bkz.
   docs/ARKADAS-YAPILACAKLAR.md — Prompt 3). Bu, o backend'e geçene kadar
   admin panelinin AYNI TARAYICIDA verilen (üye + misafir) siparişleri
   görüp durumunu güncelleyebilmesi için yerel bir defter. */
const ORDERS_KEY = 'efemi_all_orders';

function getAllOrders() {
  try { return JSON.parse(localStorage.getItem(ORDERS_KEY)) || []; }
  catch { return []; }
}

function saveAllOrders(orders) {
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
}

/* order: saveOrderToFirestore/guest dalından dönen {id,date,status,...} nesnesi
   meta: { source: 'member'|'guest', userId, customerName, customerEmail } */
function addOrderToLedger(order, meta) {
  const orders = getAllOrders();
  orders.unshift({ ...order, ...meta });
  saveAllOrders(orders);
}

function updateOrderStatus(orderId, status, statusLabel) {
  const orders = getAllOrders();
  const idx = orders.findIndex(o => o.id === orderId);
  if (idx >= 0) {
    orders[idx].status = status;
    orders[idx].statusLabel = statusLabel;
    saveAllOrders(orders);
  }
}

function updateOrderTrackingNumber(orderId, trackingNumber) {
  const orders = getAllOrders();
  const idx = orders.findIndex(o => o.id === orderId);
  if (idx >= 0) {
    orders[idx].trackingNumber = trackingNumber;
    saveAllOrders(orders);
  }
}

/* ─── BASE_PRODUCTS: Sabit ürün listesi ─── */
const BASE_PRODUCTS = [

  // ══════════════════════════════════════════
  // ⌚ AKILLI SAATLER — Apple · Huawei · Samsung
  // ══════════════════════════════════════════

  // ── Apple ──
  {
    id: 1,
    name: "Apple Watch SE (2. Nesil) 40mm",
    category: "saat",
    categoryLabel: "Akıllı Saatler",
    price: 7499,
    originalPrice: 8999,
    rating: 4.8,
    reviewCount: 312,
    badge: "bestseller",
    badgeLabel: "Çok Satan",
    stock: 15,
    images: ["assets/images/products/apple-watch-se.jpg", "assets/images/products/apple-watch-se-2.jpg", "assets/images/products/apple-watch-se-3.jpg", "assets/images/products/apple-watch-se-4.jpg", "assets/images/products/apple-watch-se-5.jpg"],
    desc: "Apple Watch SE, sağlık ve güvenlik özelliklerini uygun fiyata sunar. Düşme algılama, acil SOS ve kalp ritmi bildirimleri ile her an güvende hissedin.",
    specs: [
      { key: "Ekran",      value: "1.78 inç LTPO OLED" },
      { key: "İşlemci",    value: "Apple S8 SiP" },
      { key: "Su Direnci", value: "50 metre" },
      { key: "Batarya",    value: "18 saat" },
      { key: "Bağlantı",  value: "GPS + Bluetooth 5.3" },
      { key: "Renk",       value: "Gece Yarısı / Yıldız Işığı / Gümüş" }
    ],
    brand: "Apple",
    featured: true
  },
  {
    id: 2,
    name: "Apple Watch Series 9 41mm GPS",
    category: "saat",
    categoryLabel: "Akıllı Saatler",
    price: 13999,
    originalPrice: 15999,
    rating: 4.9,
    reviewCount: 528,
    badge: "new",
    badgeLabel: "Yeni",
    stock: 12,
    images: ["assets/images/products/apple-watch-series9.jpg", "assets/images/products/apple-watch-series9-2.jpg", "assets/images/products/apple-watch-series9-3.jpg", "assets/images/products/apple-watch-series9-4.jpg", "assets/images/products/apple-watch-series9-5.jpg"],
    desc: "Apple Watch Series 9, Double Tap özelliği ve parlaklığı iki katına çıkan Always-On Retina ekranıyla şimdiye kadarki en gelişmiş Apple Watch deneyimini sunar.",
    specs: [
      { key: "Ekran",      value: "1.69 inç Always-On Retina" },
      { key: "İşlemci",    value: "Apple S9 SiP (4 çekirdek)" },
      { key: "Su Direnci", value: "50 metre" },
      { key: "Batarya",    value: "18 saat" },
      { key: "Özellik",    value: "Double Tap, Crash Detection" },
      { key: "Renk",       value: "Gece Yarısı / Pembe / Kırmızı / Yıldız Işığı" }
    ],
    brand: "Apple",
    featured: true
  },

  // ── Huawei ──
  {
    id: 3,
    name: "Huawei Watch GT4 46mm",
    category: "saat",
    categoryLabel: "Akıllı Saatler",
    price: 4999,
    originalPrice: 5999,
    rating: 4.6,
    reviewCount: 198,
    badge: null,
    badgeLabel: null,
    stock: 22,
    images: ["assets/images/products/huawei-watch-gt4.jpg", "assets/images/products/huawei-watch-gt4-2.jpg", "assets/images/products/huawei-watch-gt4-3.jpg", "assets/images/products/huawei-watch-gt4-4.jpg", "assets/images/products/huawei-watch-gt4-5.jpg"],
    desc: "Huawei Watch GT4, 2 haftalık batarya ömrü, 100+ spor modu ve şık tasarımıyla günlük kullanım için mükemmel bir akıllı saat. Kadran değiştirme özelliği ile kişiselleştirin.",
    specs: [
      { key: "Ekran",      value: "1.43 inç AMOLED 466×466" },
      { key: "Batarya",    value: "14 gün (tipik kullanım)" },
      { key: "Su Direnci", value: "5ATM" },
      { key: "Spor Modu",  value: "100+ mod" },
      { key: "Bağlantı",  value: "GPS + Bluetooth 5.2" },
      { key: "Renk",       value: "Siyah / Altın / Kahverengi" }
    ],
    brand: "Huawei",
    featured: true
  },
  {
    id: 4,
    name: "Huawei Watch Fit 3",
    category: "saat",
    categoryLabel: "Akıllı Saatler",
    price: 2799,
    originalPrice: 3499,
    rating: 4.5,
    reviewCount: 143,
    badge: "sale",
    badgeLabel: "%20 İndirim",
    stock: 35,
    images: ["assets/images/products/huawei-watch-fit3.jpg", "assets/images/products/huawei-watch-fit3-2.jpg", "assets/images/products/huawei-watch-fit3-3.jpg", "assets/images/products/huawei-watch-fit3-4.jpg", "assets/images/products/huawei-watch-fit3-5.jpg"],
    desc: "Huawei Watch Fit 3, ince tasarımı, AMOLED ekranı ve 10 günlük batarya ömrüyle sağlık takibini şık bir çerçevede sunan ideal bir günlük saat.",
    specs: [
      { key: "Ekran",      value: "1.82 inç AMOLED" },
      { key: "Batarya",    value: "10 gün" },
      { key: "Su Direnci", value: "5ATM" },
      { key: "Sensörler",  value: "SpO2, Kalp Atışı, Stres" },
      { key: "Bağlantı",  value: "GPS + Bluetooth 5.0" },
      { key: "Renk",       value: "Siyah / Beyaz / Pembe" }
    ],
    brand: "Huawei",
    featured: false
  },

  // ── Samsung ──
  {
    id: 5,
    name: "Samsung Galaxy Watch6 Classic 47mm",
    category: "saat",
    categoryLabel: "Akıllı Saatler",
    price: 8499,
    originalPrice: 9999,
    rating: 4.7,
    reviewCount: 241,
    badge: "bestseller",
    badgeLabel: "Çok Satan",
    stock: 18,
    images: ["assets/images/products/galaxy-watch6-classic.jpg", "assets/images/products/galaxy-watch6-classic-2.jpg", "assets/images/products/galaxy-watch6-classic-3.jpg", "assets/images/products/galaxy-watch6-classic-4.jpg", "assets/images/products/galaxy-watch6-classic-5.jpg"],
    desc: "Galaxy Watch6 Classic, döner çerçevesi ve gelişmiş vücut bileşimi analizi ile premium akıllı saat deneyimi sunar. Galaxy AI özellikleriyle sağlığınızı akıllıca takip edin.",
    specs: [
      { key: "Ekran",      value: "1.47 inç Super AMOLED 480×480" },
      { key: "İşlemci",    value: "Exynos W930 Dual Core" },
      { key: "Su Direnci", value: "5ATM + IP68" },
      { key: "Batarya",    value: "425mAh / 40 saat" },
      { key: "Bağlantı",  value: "GPS + Bluetooth 5.3" },
      { key: "Renk",       value: "Siyah / Gümüş" }
    ],
    brand: "Samsung",
    featured: false
  },
  {
    id: 6,
    name: "Samsung Galaxy Watch FE 40mm",
    category: "saat",
    categoryLabel: "Akıllı Saatler",
    price: 4299,
    originalPrice: null,
    rating: 4.4,
    reviewCount: 87,
    badge: "new",
    badgeLabel: "Yeni",
    stock: 28,
    images: ["assets/images/products/galaxy-watch-fe.jpg", "assets/images/products/galaxy-watch-fe-2.jpg", "assets/images/products/galaxy-watch-fe-3.jpg", "assets/images/products/galaxy-watch-fe-4.jpg", "assets/images/products/galaxy-watch-fe-5.jpg"],
    desc: "Galaxy Watch FE, Samsung'un sağlık teknolojisini erişilebilir fiyatla sunan akıllı saat. Kalp atış izleme, uyku analizi ve Samsung Pay desteği ile donanımlı.",
    specs: [
      { key: "Ekran",      value: "1.2 inç Super AMOLED" },
      { key: "İşlemci",    value: "Exynos W920" },
      { key: "Su Direnci", value: "5ATM + IP68" },
      { key: "Batarya",    value: "247mAh / 30 saat" },
      { key: "Bağlantı",  value: "GPS + Bluetooth 5.0" },
      { key: "Renk",       value: "Grafite / Altın / Pembe Altın" }
    ],
    brand: "Samsung",
    featured: false
  },

  // ══════════════════════════════════════════
  // 🎧 KULAKLIKLAR — Apple · Samsung · JBL · Anker
  // ══════════════════════════════════════════

  // ── Apple ──
  {
    id: 7,
    name: "Apple AirPods Pro (2. Nesil) MagSafe",
    category: "kulaklik",
    categoryLabel: "Kulaklıklar",
    price: 5999,
    originalPrice: 7299,
    rating: 4.9,
    reviewCount: 621,
    badge: "bestseller",
    badgeLabel: "Çok Satan",
    stock: 27,
    images: ["assets/images/products/airpods-pro.png", "assets/images/products/airpods-pro-2.jpg", "assets/images/products/airpods-pro-3.jpg", "assets/images/products/airpods-pro-4.jpg", "assets/images/products/airpods-pro-5.jpg"],
    desc: "AirPods Pro 2. Nesil; Apple H2 çipi, aktif gürültü engelleme ve Uyarlanabilir Ses Geçirgenliği ile yeni nesil ses deneyimi sunar. MagSafe ile kablosuz şarj.",
    specs: [
      { key: "Gürültü Engelleme", value: "Aktif ANC – H2 çipi" },
      { key: "Batarya",           value: "6 saat + 30 saat (kılıf)" },
      { key: "Bağlantı",         value: "Bluetooth 5.3" },
      { key: "Dayanıklılık",      value: "IP54 (kulaklık) / IP54 (kılıf)" },
      { key: "Şarj",             value: "MagSafe / Lightning / Qi" },
      { key: "Ses",              value: "Spatial Audio, Head Tracking" }
    ],
    brand: "Apple",
    featured: true
  },
  {
    id: 8,
    name: "Apple AirPods (3. Nesil) Lightning",
    category: "kulaklik",
    categoryLabel: "Kulaklıklar",
    price: 3299,
    originalPrice: 3999,
    rating: 4.7,
    reviewCount: 384,
    badge: "sale",
    badgeLabel: "%18 İndirim",
    stock: 41,
    images: ["assets/images/products/airpods-3.jpg", "assets/images/products/airpods-3-2.jpg", "assets/images/products/airpods-3-3.jpg", "assets/images/products/airpods-3-4.jpg", "assets/images/products/airpods-3-5.jpg"],
    desc: "AirPods 3. Nesil, Spatial Audio ve Adaptive EQ ile sesi tam kulağınıza göre optimize eder. Su ve ter direnci ile sporda da yanınızda.",
    specs: [
      { key: "Ses",          value: "Spatial Audio, Adaptive EQ" },
      { key: "Batarya",      value: "6 saat + 24 saat (kılıf)" },
      { key: "Bağlantı",    value: "Bluetooth 5.0" },
      { key: "Dayanıklılık", value: "IPX4" },
      { key: "Şarj",        value: "Lightning / MagSafe" },
      { key: "Kontrol",      value: "Force Sensor (basınç)" }
    ],
    brand: "Apple",
    featured: false
  },

  // ── Samsung ──
  {
    id: 9,
    name: "Samsung Galaxy Buds3 Pro",
    category: "kulaklik",
    categoryLabel: "Kulaklıklar",
    price: 4499,
    originalPrice: 5499,
    rating: 4.7,
    reviewCount: 189,
    badge: "new",
    badgeLabel: "Yeni",
    stock: 33,
    images: ["assets/images/products/galaxy-buds3-pro.jpg", "assets/images/products/galaxy-buds3-pro-2.jpg", "assets/images/products/galaxy-buds3-pro-3.jpg", "assets/images/products/galaxy-buds3-pro-4.jpg", "assets/images/products/galaxy-buds3-pro-5.jpg"],
    desc: "Galaxy Buds3 Pro, Intelligent ANC ve 360 Audio ile sürükleyici ses sunar. Galaxy AI destekli Real-Time tercüme özelliğiyle iletişimi kolaylaştırır.",
    specs: [
      { key: "Gürültü Engelleme", value: "Intelligent ANC" },
      { key: "Ses",               value: "360 Audio, Hi-Fi 24bit" },
      { key: "Batarya",           value: "6 saat + 30 saat (kılıf)" },
      { key: "Bağlantı",         value: "Bluetooth 5.4 / Multipoint" },
      { key: "Dayanıklılık",      value: "IPX7" },
      { key: "Renk",             value: "Gümüş / Siyah" }
    ],
    brand: "Samsung",
    featured: true
  },
  {
    id: 10,
    name: "Samsung Galaxy Buds2 Pro",
    category: "kulaklik",
    categoryLabel: "Kulaklıklar",
    price: 2999,
    originalPrice: 3799,
    rating: 4.5,
    reviewCount: 276,
    badge: "sale",
    badgeLabel: "%21 İndirim",
    stock: 44,
    images: ["assets/images/products/galaxy-buds2-pro.jpg", "assets/images/products/galaxy-buds2-pro-2.jpg", "assets/images/products/galaxy-buds2-pro-3.jpg", "assets/images/products/galaxy-buds2-pro-4.jpg", "assets/images/products/galaxy-buds2-pro-5.jpg"],
    desc: "Galaxy Buds2 Pro, 360° Audio ve Hi-Fi kaliteli ses çıkışıyla premium kulaklık deneyimini uygun fiyata sunar. Küçük ve hafif tasarımı ile uzun süreli konfor.",
    specs: [
      { key: "Ses",               value: "360° Audio, 24bit Hi-Fi" },
      { key: "Gürültü Engelleme", value: "ANC (3 mikrofon)" },
      { key: "Batarya",           value: "5 saat + 18 saat (kılıf)" },
      { key: "Bağlantı",         value: "Bluetooth 5.3" },
      { key: "Dayanıklılık",      value: "IPX7" },
      { key: "Renk",             value: "Grafit / Beyaz / Bora Mor" }
    ],
    brand: "Samsung",
    featured: false
  },

  // ── JBL ──
  {
    id: 11,
    name: "JBL Tune 770NC Kablosuz Kulaklık",
    category: "kulaklik",
    categoryLabel: "Kulaklıklar",
    price: 2499,
    originalPrice: 2999,
    rating: 4.5,
    reviewCount: 267,
    badge: null,
    badgeLabel: null,
    stock: 52,
    images: ["assets/images/products/jbl-tune770nc.jpg", "assets/images/products/jbl-tune770nc-2.jpg", "assets/images/products/jbl-tune770nc-3.jpg", "assets/images/products/jbl-tune770nc-4.jpg", "assets/images/products/jbl-tune770nc-5.jpg"],
    desc: "JBL Tune 770NC, Adaptif ANC ve JBL Pure Bass Sound ile 70 saate kadar pil ömrü sunan over-ear kulaklık. Katlanabilir tasarımı ile taşıması kolay.",
    specs: [
      { key: "Gürültü Engelleme", value: "Adaptif ANC" },
      { key: "Sürücü",           value: "40mm" },
      { key: "Batarya",           value: "70 saat (ANC kapalı)" },
      { key: "Bağlantı",         value: "Bluetooth 5.3 / 3.5mm" },
      { key: "Ağırlık",          value: "207g" },
      { key: "Renk",             value: "Siyah / Beyaz / Mavi / Bej" }
    ],
    brand: "JBL",
    featured: true
  },
  {
    id: 12,
    name: "JBL Live 660NC Kablosuz Kulaklık",
    category: "kulaklik",
    categoryLabel: "Kulaklıklar",
    price: 1899,
    originalPrice: 2499,
    rating: 4.4,
    reviewCount: 198,
    badge: "sale",
    badgeLabel: "%24 İndirim",
    stock: 38,
    images: ["assets/images/products/jbl-live660nc.jpg", "assets/images/products/jbl-live660nc-2.jpg", "assets/images/products/jbl-live660nc-3.jpg", "assets/images/products/jbl-live660nc-4.jpg", "assets/images/products/jbl-live660nc-5.jpg"],
    desc: "JBL Live 660NC, gerçek Adaptif ANC ve 50 saatlik pil ömrüyle müzik keyfini en üst düzeye taşır. Hızlı şarj özelliği ile 5 dakikada 1 saat kullanım.",
    specs: [
      { key: "Gürültü Engelleme", value: "True Adaptive ANC" },
      { key: "Batarya",           value: "50 saat" },
      { key: "Hızlı Şarj",       value: "5 dk → 1 saat" },
      { key: "Bağlantı",         value: "Bluetooth 5.0" },
      { key: "Ağırlık",          value: "253g" },
      { key: "Renk",             value: "Siyah / Beyaz / Mavi" }
    ],
    brand: "JBL",
    featured: false
  },

  // ── Anker ──
  {
    id: 13,
    name: "Anker Soundcore Q45 ANC Kulaklık",
    category: "kulaklik",
    categoryLabel: "Kulaklıklar",
    price: 1299,
    originalPrice: 1699,
    rating: 4.4,
    reviewCount: 431,
    badge: "bestseller",
    badgeLabel: "Çok Satan",
    stock: 65,
    images: ["assets/images/products/soundcore-q45.png", "assets/images/products/soundcore-q45-2.jpg", "assets/images/products/soundcore-q45-3.jpg", "assets/images/products/soundcore-q45-4.jpg", "assets/images/products/soundcore-q45-5.jpg"],
    desc: "Soundcore Q45, LDAC hi-res ses ve Adaptif ANC ile premium ses kalitesini bütçe dostu fiyata sunar. 50 saatlik batarya ile uzun süreli kullanım.",
    specs: [
      { key: "Ses",               value: "LDAC Hi-Res Audio" },
      { key: "Gürültü Engelleme", value: "Adaptif ANC" },
      { key: "Batarya",           value: "50 saat" },
      { key: "Bağlantı",         value: "Bluetooth 5.3" },
      { key: "Şarj",             value: "USB-C, 5 dk → 3 saat" },
      { key: "Renk",             value: "Beyaz / Siyah" }
    ],
    brand: "Anker",
    featured: false
  },
  {
    id: 14,
    name: "Anker Soundcore Liberty 4 NC TWS",
    category: "kulaklik",
    categoryLabel: "Kulaklıklar",
    price: 1599,
    originalPrice: 1999,
    rating: 4.6,
    reviewCount: 312,
    badge: "sale",
    badgeLabel: "%20 İndirim",
    stock: 47,
    images: ["assets/images/products/soundcore-liberty4nc.png", "assets/images/products/soundcore-liberty4nc-2.jpg", "assets/images/products/soundcore-liberty4nc-3.jpg", "assets/images/products/soundcore-liberty4nc-4.jpg", "assets/images/products/soundcore-liberty4nc-5.jpg"],
    desc: "Liberty 4 NC, 98.5 dB gürültü engelleme ve LDAC destekli hi-res ses ile gerçek kablosuz kulaklıklarda liderdir. 10 saatlik tek şarj pil ömrü.",
    specs: [
      { key: "ANC",              value: "98.5 dB gürültü engelleme" },
      { key: "Ses",              value: "LDAC + aptX Adaptive" },
      { key: "Batarya",          value: "10 saat + 28 saat (kılıf)" },
      { key: "Bağlantı",        value: "Bluetooth 5.3 / Multipoint" },
      { key: "Dayanıklılık",     value: "IPX4" },
      { key: "Renk",            value: "Siyah / Beyaz / Yeşil / Mor" }
    ],
    brand: "Anker",
    featured: true
  },

  // ══════════════════════════════════════════
  // 📱 TABLETLER — Casper · Apple · Samsung
  // ══════════════════════════════════════════

  // ── Casper ──
  {
    id: 15,
    name: "Casper Via L30 10.1\" 4GB/64GB",
    category: "tablet",
    categoryLabel: "Tabletler",
    price: 3499,
    originalPrice: 4299,
    rating: 4.2,
    reviewCount: 156,
    badge: "sale",
    badgeLabel: "%19 İndirim",
    stock: 30,
    images: ["assets/images/products/casper-via-l30.webp", "assets/images/products/casper-via-l30-2.webp", "assets/images/products/casper-via-l30-3.webp", "assets/images/products/casper-via-l30-4.webp", "assets/images/products/casper-via-l30-5.webp"],
    desc: "Casper Via L30, geniş 10.1 inç ekranı ve Android 13 ile günlük kullanım, eğlence ve eğitim için ideal yerli tablettir. Dört hoparlör ile zengin ses deneyimi.",
    specs: [
      { key: "Ekran",     value: "10.1 inç IPS FHD" },
      { key: "İşlemci",   value: "Unisoc T618 Octa-Core" },
      { key: "RAM / Depo", value: "4GB / 64GB + 256GB SD" },
      { key: "Kamera",    value: "8MP Arka / 5MP Ön" },
      { key: "Batarya",   value: "6000mAh" },
      { key: "OS",        value: "Android 13" }
    ],
    brand: "Casper",
    featured: false
  },
  {
    id: 16,
    name: "Casper Via S40 10.4\" 6GB/128GB LTE",
    category: "tablet",
    categoryLabel: "Tabletler",
    price: 5299,
    originalPrice: 6199,
    rating: 4.3,
    reviewCount: 89,
    badge: null,
    badgeLabel: null,
    stock: 20,
    images: ["assets/images/products/casper-via-s40.webp", "assets/images/products/casper-via-s40-2.webp", "assets/images/products/casper-via-s40-3.webp", "assets/images/products/casper-via-s40-4.webp", "assets/images/products/casper-via-s40-5.webp"],
    desc: "Casper Via S40, 4G LTE desteği, 6GB RAM ve 128GB depolama ile güçlü performansını her yerde sunar. Kalem desteği ile not alma ve çizim imkânı.",
    specs: [
      { key: "Ekran",     value: "10.4 inç 2K IPS" },
      { key: "İşlemci",   value: "Unisoc T820 Octa-Core" },
      { key: "RAM / Depo", value: "6GB / 128GB + SD kart" },
      { key: "Bağlantı",  value: "4G LTE + Wi-Fi 6" },
      { key: "Batarya",   value: "7000mAh 18W" },
      { key: "Ekstra",    value: "Kalem Desteği (dahil değil)" }
    ],
    brand: "Casper",
    featured: false
  },

  // ── Apple ──
  {
    id: 17,
    name: "Apple iPad Mini (6. Nesil) 256GB Wi-Fi",
    category: "tablet",
    categoryLabel: "Tabletler",
    price: 14999,
    originalPrice: 16999,
    rating: 4.9,
    reviewCount: 403,
    badge: "bestseller",
    badgeLabel: "Çok Satan",
    stock: 9,
    images: ["assets/images/products/ipad-mini.png", "assets/images/products/ipad-mini-2.png", "assets/images/products/ipad-mini-3.png", "assets/images/products/ipad-mini-4.png", "assets/images/products/ipad-mini-5.png"],
    desc: "iPad Mini 6, A15 Bionic çipi ile konsol kalitesinde oyun ve ultra hızlı performans sunar. Apple Pencil 2 desteği ile not alma ve yaratıcılık için mükemmel.",
    specs: [
      { key: "Ekran",    value: "8.3 inç Liquid Retina" },
      { key: "İşlemci",  value: "Apple A15 Bionic" },
      { key: "Depolama", value: "256GB" },
      { key: "Kamera",   value: "12MP / 12MP FaceTime Center Stage" },
      { key: "Bağlantı", value: "Wi-Fi 6 / USB-C" },
      { key: "Renk",     value: "Uzay Grisi / Pembe / Sarı / Mor" }
    ],
    brand: "Apple",
    featured: true
  },
  {
    id: 18,
    name: "Apple iPad (10. Nesil) 64GB Wi-Fi",
    category: "tablet",
    categoryLabel: "Tabletler",
    price: 10999,
    originalPrice: 12999,
    rating: 4.8,
    reviewCount: 287,
    badge: "sale",
    badgeLabel: "%15 İndirim",
    stock: 14,
    images: ["assets/images/products/ipad-10.png", "assets/images/products/ipad-10-2.jpg", "assets/images/products/ipad-10-3.jpg", "assets/images/products/ipad-10-4.jpg", "assets/images/products/ipad-10-5.jpg"],
    desc: "iPad 10. Nesil, A14 Bionic çipi ve tamamen yenilenen tasarımıyla daha büyük Liquid Retina ekran ve USB-C bağlantı noktası sunar. Her şeyi yapabileceğiniz bir tablet.",
    specs: [
      { key: "Ekran",    value: "10.9 inç Liquid Retina" },
      { key: "İşlemci",  value: "Apple A14 Bionic" },
      { key: "Depolama", value: "64GB" },
      { key: "Kamera",   value: "12MP Geniş Açı / 12MP Ön" },
      { key: "Bağlantı", value: "Wi-Fi 6 / USB-C" },
      { key: "Renk",     value: "Mavi / Pembe / Sarı / Gümüş" }
    ],
    brand: "Apple",
    featured: true
  },

  // ── Samsung ──
  {
    id: 19,
    name: "Samsung Galaxy Tab A8 10.5\" LTE 4GB/64GB",
    category: "tablet",
    categoryLabel: "Tabletler",
    price: 5999,
    originalPrice: 7499,
    rating: 4.4,
    reviewCount: 317,
    badge: "sale",
    badgeLabel: "%20 İndirim",
    stock: 26,
    images: ["assets/images/products/galaxy-tab-a8.jpg", "assets/images/products/galaxy-tab-a8-2.jpg", "assets/images/products/galaxy-tab-a8-3.jpg", "assets/images/products/galaxy-tab-a8-4.jpg", "assets/images/products/galaxy-tab-a8-5.jpg"],
    desc: "Galaxy Tab A8, geniş 10.5 inç ekranı ve 4G LTE desteğiyle eğlence ve verimlilik için ideal bütçe dostu Samsung tablettir. Dört hoparlör ile zengin ses.",
    specs: [
      { key: "Ekran",     value: "10.5 inç TFT LCD FHD" },
      { key: "İşlemci",   value: "Unisoc Tiger T618" },
      { key: "RAM / Depo", value: "4GB / 64GB + 1TB SD" },
      { key: "Kamera",    value: "8MP Arka / 5MP Ön" },
      { key: "Bağlantı",  value: "4G LTE + Wi-Fi 5" },
      { key: "Renk",      value: "Gümüş / Gri / Pembe Altın" }
    ],
    brand: "Samsung",
    featured: false
  },
  {
    id: 20,
    name: "Samsung Galaxy Tab S9 FE 10.9\" Wi-Fi S Pen",
    category: "tablet",
    categoryLabel: "Tabletler",
    price: 11999,
    originalPrice: 13999,
    rating: 4.8,
    reviewCount: 241,
    badge: "new",
    badgeLabel: "Yeni",
    stock: 11,
    images: ["assets/images/products/galaxy-tab-s9-fe.jpg", "assets/images/products/galaxy-tab-s9-fe-2.jpg", "assets/images/products/galaxy-tab-s9-fe-3.jpg", "assets/images/products/galaxy-tab-s9-fe-4.jpg", "assets/images/products/galaxy-tab-s9-fe-5.jpg"],
    desc: "Galaxy Tab S9 FE, S Pen dahil ve IP68 su direnci ile Galaxy ailesinin en erişilebilir premium tableti. Galaxy AI özellikleri ile akıllı not alma ve içerik üretimi.",
    specs: [
      { key: "Ekran",     value: "10.9 inç 90Hz TFT LCD" },
      { key: "İşlemci",   value: "Exynos 1380" },
      { key: "RAM / Depo", value: "8GB / 256GB" },
      { key: "Su Direnci", value: "IP68" },
      { key: "Kalem",     value: "S Pen Dahil" },
      { key: "Renk",      value: "Gri / Yeşil / Lavanta / Gümüş" }
    ],
    brand: "Samsung",
    featured: true
  }
];

/* ─── PRODUCTS: Statik + Admin ürünlerini birleştir, düzenlemeleri uygula ─── */
let PRODUCTS = applyProductOverrides([...BASE_PRODUCTS, ...getAdminProducts()]);

/* ─── PRODUCTS'ı yenile (admin değişikliklerinden sonra) ─── */
function refreshProducts() {
  PRODUCTS = applyProductOverrides([...BASE_PRODUCTS, ...getAdminProducts()]);
}

/* ─── Yardımcı: ID ile ürün bul ─── */
function getProductById(id) {
  return PRODUCTS.find(p => p.id === parseInt(id));
}

/* ─── Kategoriye göre filtrele ─── */
function getProductsByCategory(category) {
  if (!category || category === 'all') return PRODUCTS;
  return PRODUCTS.filter(p => p.category === category);
}

/* ─── Öne çıkan ürünler ─── */
function getFeaturedProducts() {
  return PRODUCTS.filter(p => p.featured);
}

/* ─── Benzersiz markalar ─── */
function getUniqueBrands() {
  return [...new Set(PRODUCTS.map(p => p.brand))].sort();
}

/* ─── Arama ─── */
function searchProducts(query) {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return PRODUCTS.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.brand.toLowerCase().includes(q) ||
    p.categoryLabel.toLowerCase().includes(q)
  ).slice(0, 6);
}

/* ─── Fiyat formatla ─── */
function formatPrice(price) {
  return price.toLocaleString('tr-TR') + ' ₺';
}

/* ─── İndirim yüzdesi ─── */
function discountPercent(original, current) {
  if (!original) return 0;
  return Math.round((1 - current / original) * 100);
}

/* ─── Yıldız HTML ─── */
function renderStars(rating) {
  const full  = Math.floor(rating);
  const half  = rating % 1 >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
}
