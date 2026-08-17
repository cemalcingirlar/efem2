/* =========================================
   efemiletisim.com – Ürün Veritabanı
   ========================================= */

/* ─── ESKİ admin deposu (yalnız okuma) ───
   Ürün yönetimi Firestore'a taşındı (bkz. api/admin/products.js). Bu iki
   anahtar artık YAZILMIYOR; yalnızca eski panelden bu tarayıcıda kalmış
   kayıtlar kaybolmasın diye okunuyor. Sunucudan gelen katalog bunların
   üzerine biner. İleride bir sürümde tamamen kaldırılabilir. */
const ADMIN_PRODUCTS_KEY = 'efemi_admin_products';

function getAdminProducts() {
  try { return JSON.parse(localStorage.getItem(ADMIN_PRODUCTS_KEY)) || []; }
  catch { return []; }
}

const PRODUCT_OVERRIDES_KEY = 'efemi_product_overrides';

function getProductOverrides() {
  try { return JSON.parse(localStorage.getItem(PRODUCT_OVERRIDES_KEY)) || {}; }
  catch { return {}; }
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

/* ─── Kategoriler: tek kaynak ───
   Yeni kategori eklerken buraya ekleyin; urunler.html filtreleri, ürün detay
   breadcrumb'ı ve admin paneli bu haritadan beslenir. Navbar/footer linkleri
   HTML içinde sabittir, oraları da güncellemeyi unutmayın. */
const CATEGORY_LABELS = {
  saat:     'Akıllı Saatler',
  kulaklik: 'Kulaklıklar',
  aksesuar: 'Aksesuarlar',
  ses:      'Ses & Diğer'
};

/* ─── BASE_PRODUCTS: Sabit ürün listesi ───
   Kaynak: "stok bilgisi.xlsx" (114 satır). Aynı modelin renk/beden çeşitleri
   tek üründe toplandı; her Excel satırı `variants[]` içinde bir varyant olarak
   duruyor ({ sku, color, size? }) — sku, listedeki Malzeme kodudur.
   Müşteri ürün detayında renk (ve varsa beden) seçer, sepete o varyant gider.
   ÖNEMLİ: Her renk × beden kombinasyonu mevcut değildir; sadece Excel'de satırı
   olan kombinasyonlar satılabilir, seçicide diğerleri pasif gösterilir.
   `stock` varyant başınadır. Fiyatlar KDV dahildir; originalPrice kampanya
   gösterimi içindir. */
const BASE_PRODUCTS = [

  // ══════════════════════════════════════════
  // ⌚ AKILLI SAATLER
  // ══════════════════════════════════════════

  // ── Apple ──
  {
    id: 1,
    variants: [
      { sku: "1422880", color: "Jet Siyah", size: "S/M" },
      { sku: "1422884", color: "Roze Altın", size: "S/M" },
      { sku: "1422885", color: "Roze Altın", size: "M/L" },
      { sku: "1422882", color: "Uzay Grisi", size: "S/M" },
      { sku: "1422887", color: "Gümüş", size: "M/L" }
    ],
    sizeLabel: "Kordon Bedeni",
    name: "Apple Watch Series 11 42mm GPS",
    category: "saat",
    categoryLabel: "Akıllı Saatler",
    price: 23459,
    originalPrice: 26999,
    rating: 0,
    reviewCount: 0,
    badge: "bestseller",
    badgeLabel: "Çok Satan",
    stock: 10,
    images: ["assets/images/products/apple-watch-11-42-1.png", "assets/images/products/apple-watch-11-42-2.jpg", "assets/images/products/apple-watch-11-42-3.jpg"],
    /* Renk seçilince galeride o rengin görseli gösterilir (Apple resmi görselleri). */
    colorImages: {
      "Jet Siyah": "assets/images/products/apple-watch-11-42-renk-jet-siyah.png",
      "Roze Altın": "assets/images/products/apple-watch-11-42-renk-roze-altin.png",
      "Uzay Grisi": "assets/images/products/apple-watch-11-42-renk-uzay-grisi.png",
      "Gümüş": "assets/images/products/apple-watch-11-42-renk-gumus.png"
    },
    desc: "Apple Watch Series 11, geniş açılı Always-On OLED ekranı ve tüm gün süren bataryasıyla sağlığınızı kesintisiz takip eder. Hipertansiyon bildirimleri ve Uyku Skoru ile günlük sağlık verilerinizi anlamlandırır.",
    specs: [
      { key: "Ekran",      value: "42mm geniş açılı LTPO3 Hep Açık Retina OLED, 2000 nit" },
      { key: "İşlemci",    value: "Apple S10 SiP (64 bit çift çekirdek, 4 çekirdekli Neural Engine)" },
      { key: "Batarya",    value: "24 saate kadar, Düşük Güç Modu'nda 38 saate kadar" },
      { key: "Dayanıklılık", value: "50 m suya dayanıklılık (ISO 22810) + IP6X toz direnci" },
      { key: "Sağlık",     value: "Hipertansiyon bildirimleri, Uyku Skoru, uyku apnesi, EKG, kanda oksijen" },
      { key: "Bağlantı",   value: "L1 GPS (GLONASS, Galileo, QZSS, BeiDou), Wi-Fi 4 (2,4 ve 5 GHz), Bluetooth 5.3" },
      { key: "Kayış",      value: "Sport Band (S/M ve M/L)" }
    ],
    brand: "Apple",
    featured: true
  },
  {
    id: 2,
    variants: [
      { sku: "1422888", color: "Jet Siyah", size: "S/M" },
      { sku: "1422889", color: "Jet Siyah", size: "M/L" },
      { sku: "1422893", color: "Roze Altın", size: "M/L" },
      { sku: "1422891", color: "Uzay Grisi", size: "M/L" }
    ],
    sizeLabel: "Kordon Bedeni",
    name: "Apple Watch Series 11 46mm GPS",
    category: "saat",
    categoryLabel: "Akıllı Saatler",
    price: 24925,
    originalPrice: null,
    rating: 0,
    reviewCount: 0,
    badge: "new",
    badgeLabel: "Yeni",
    stock: 10,
    images: ["assets/images/products/apple-watch-11-46-1.png", "assets/images/products/apple-watch-11-46-2.jpg", "assets/images/products/apple-watch-11-46-3.jpg"],
    /* Renk seçilince galeride o rengin görseli gösterilir (Apple resmi görselleri). */
    colorImages: {
      "Jet Siyah": "assets/images/products/apple-watch-11-46-renk-jet-siyah.png",
      "Roze Altın": "assets/images/products/apple-watch-11-46-renk-roze-altin.png",
      "Uzay Grisi": "assets/images/products/apple-watch-11-46-renk-uzay-grisi.png"
    },
    desc: "Series 11'in 46mm gövdesi, daha geniş ekran alanı ve daha büyük bataryayla gelir. Antrenmandan uykuya kadar tüm gününüzü tek şarjla takip edin.",
    specs: [
      { key: "Ekran",      value: "46mm geniş açılı LTPO3 Hep Açık Retina OLED, 2000 nit" },
      { key: "İşlemci",    value: "Apple S10 SiP (64 bit çift çekirdek, 4 çekirdekli Neural Engine)" },
      { key: "Batarya",    value: "24 saate kadar, Düşük Güç Modu'nda 38 saate kadar" },
      { key: "Dayanıklılık", value: "50 m suya dayanıklılık (ISO 22810) + IP6X toz direnci" },
      { key: "Sağlık",     value: "Hipertansiyon bildirimleri, Uyku Skoru, uyku apnesi, EKG, kanda oksijen" },
      { key: "Bağlantı",   value: "L1 GPS (GLONASS, Galileo, QZSS, BeiDou), Wi-Fi 4 (2,4 ve 5 GHz), Bluetooth 5.3" },
      { key: "Ağırlık",    value: "37,8 gram (alüminyum kasa)" },
      { key: "Kayış",      value: "Sport Band (S/M ve M/L)" }
    ],
    brand: "Apple",
    featured: true
  },
  {
    id: 3,
    variants: [
      { sku: "1422860", color: "Gece Yarısı", size: "S/M" },
      { sku: "1422861", color: "Gece Yarısı", size: "M/L" },
      { sku: "1422858", color: "Yıldız Işığı", size: "S/M" },
      { sku: "1422859", color: "Yıldız Işığı", size: "M/L" }
    ],
    sizeLabel: "Kordon Bedeni",
    name: "Apple Watch SE 3 40mm GPS",
    category: "saat",
    categoryLabel: "Akıllı Saatler",
    price: 15151,
    originalPrice: 17499,
    rating: 0,
    reviewCount: 0,
    badge: "bestseller",
    badgeLabel: "Çok Satan",
    stock: 10,
    images: ["assets/images/products/apple-watch-se3-40-1.jpg", "assets/images/products/apple-watch-se3-40-2.png", "assets/images/products/apple-watch-se3-40-3.jpg"],
    /* Renk seçilince galeride o rengin görseli gösterilir (Apple resmi görselleri). */
    colorImages: {
      "Gece Yarısı": "assets/images/products/apple-watch-se3-40-renk-gece-yarisi.png",
      "Yıldız Işığı": "assets/images/products/apple-watch-se3-40-renk-yildiz-isigi.png"
    },
    desc: "Apple Watch SE 3, Always-On ekranı ve hızlı şarj desteğiyle Apple Watch deneyimini en erişilebilir haliyle sunar. Düşme algılama, Acil SOS ve uyku apnesi bildirimleriyle her an güvende.",
    specs: [
      { key: "Ekran",      value: "40mm LTPO OLED Hep Açık Retina (324 × 394 piksel)" },
      { key: "İşlemci",    value: "Apple S10 SiP (64 bit çift çekirdek, 4 çekirdekli Neural Engine)" },
      { key: "Batarya",    value: "18 saate kadar, Düşük Güç Modu'nda 32 saate kadar" },
      { key: "Şarj",       value: "Hızlı şarj: yaklaşık 45 dakikada %80" },
      { key: "Dayanıklılık", value: "50 m suya dayanıklılık (ISO 22810), Ion-X ön cam" },
      { key: "Sağlık",     value: "Uyku apnesi bildirimleri, uyku evreleri, bilekten sıcaklık, düşme ve çarpışma algılama" },
      { key: "Bağlantı",   value: "L1 GPS (GLONASS, Galileo, QZSS, BeiDou), Wi-Fi 4 (2,4 GHz), Bluetooth 5.3" },
      { key: "Kayış",      value: "Sport Band (S/M ve M/L)" }
    ],
    brand: "Apple",
    featured: true
  },
  {
    id: 4,
    variants: [
      { sku: "1422864", color: "Gece Yarısı", size: "S/M" },
      { sku: "1422865", color: "Gece Yarısı", size: "M/L" },
      { sku: "1422862", color: "Yıldız Işığı", size: "S/M" },
      { sku: "1422863", color: "Yıldız Işığı", size: "M/L" }
    ],
    sizeLabel: "Kordon Bedeni",
    name: "Apple Watch SE 3 44mm GPS",
    category: "saat",
    categoryLabel: "Akıllı Saatler",
    price: 16617,
    originalPrice: 18999,
    rating: 0,
    reviewCount: 0,
    badge: null,
    badgeLabel: null,
    stock: 10,
    images: ["assets/images/products/apple-watch-se3-44-1.png", "assets/images/products/apple-watch-se3-44-2.jpg", "assets/images/products/apple-watch-se3-44-3.png"],
    /* Renk seçilince galeride o rengin görseli gösterilir (Apple resmi görselleri). */
    colorImages: {
      "Gece Yarısı": "assets/images/products/apple-watch-se3-44-renk-gece-yarisi.png",
      "Yıldız Işığı": "assets/images/products/apple-watch-se3-44-renk-yildiz-isigi.png"
    },
    desc: "SE 3'ün 44mm gövdesi, daha geniş ekran ve daha uzun batarya ömrü isteyenler için. Tüm sağlık ve güvenlik özellikleri aynı, ekran alanı daha büyük.",
    specs: [
      { key: "Ekran",      value: "44mm LTPO OLED Hep Açık Retina (368 × 448 piksel)" },
      { key: "İşlemci",    value: "Apple S10 SiP (64 bit çift çekirdek, 4 çekirdekli Neural Engine)" },
      { key: "Batarya",    value: "18 saate kadar, Düşük Güç Modu'nda 32 saate kadar" },
      { key: "Şarj",       value: "Hızlı şarj: yaklaşık 45 dakikada %80" },
      { key: "Dayanıklılık", value: "50 m suya dayanıklılık (ISO 22810), Ion-X ön cam" },
      { key: "Sağlık",     value: "Uyku apnesi bildirimleri, uyku evreleri, bilekten sıcaklık, düşme ve çarpışma algılama" },
      { key: "Bağlantı",   value: "L1 GPS (GLONASS, Galileo, QZSS, BeiDou), Wi-Fi 4 (2,4 GHz), Bluetooth 5.3" },
      { key: "Kayış",      value: "Sport Band (S/M ve M/L)" }
    ],
    brand: "Apple",
    featured: false
  },
  {
    id: 5,
    variants: [
      { sku: "1411754", color: "Jet Siyah", size: "S/M" }
    ],
    sizeLabel: "Kordon Bedeni",
    name: "Apple Watch Series 10 46mm Alüminyum Cellular",
    category: "saat",
    categoryLabel: "Akıllı Saatler",
    price: 36654,
    originalPrice: 42499,
    rating: 0,
    reviewCount: 0,
    badge: null,
    badgeLabel: null,
    stock: 10,
    images: ["assets/images/products/apple-watch-s10-46-alu-1.jpg", "assets/images/products/apple-watch-s10-46-alu-2.png", "assets/images/products/apple-watch-s10-46-alu-3.png"],
    /* Renk seçilince galeride o rengin görseli gösterilir (Apple resmi görselleri). */
    colorImages: {
      "Jet Siyah": "assets/images/products/apple-watch-s10-46-alu-renk-jet-siyah.png"
    },
    desc: "Apple Watch Series 10, şimdiye kadarki en ince Apple Watch. Geniş açılı OLED ekranı sayesinde bileğinizi kaldırmadan saate göz atabilirsiniz. Cellular modeli ile telefonunuz yanınızda olmadan da bağlantıda kalın.",
    specs: [
      { key: "Ekran",      value: "46mm geniş açılı LTPO3 Hep Açık Retina OLED, 2000 nit" },
      { key: "İşlemci",    value: "Apple S10 SiP (64 bit çift çekirdek, 4 çekirdekli Neural Engine)" },
      { key: "Kasa",       value: "Jet Black alüminyum, Ion-X ön cam" },
      { key: "Batarya",    value: "18 saate kadar, Düşük Güç Modu'nda 36 saate kadar; yaklaşık 30 dakikada %80 şarj" },
      { key: "Dayanıklılık", value: "50 m suya dayanıklılık + IP6X, derinlik ölçer ve su sıcaklığı sensörü" },
      { key: "Sağlık",     value: "EKG, kanda oksijen, uyku apnesi bildirimleri, bilekten sıcaklık" },
      { key: "Bağlantı",   value: "LTE/UMTS, L1 GPS, Wi-Fi 4 (802.11n), Bluetooth 5.3, 2. nesil Ultra Wideband" },
      { key: "Ağırlık",    value: "35,3 gram (alüminyum, GPS + Cellular)" },
      { key: "Kayış",      value: "Sport Band S/M" }
    ],
    brand: "Apple",
    featured: false
  },
  {
    id: 6,
    variants: [
      { sku: "1411772", color: "Altın", size: "M/L" },
      { sku: "1411769", color: "Gümüş", size: "M/L" }
    ],
    sizeLabel: "Kordon Bedeni",
    name: "Apple Watch Series 10 42mm Titanyum Cellular",
    category: "saat",
    categoryLabel: "Akıllı Saatler",
    price: 47556,
    originalPrice: null,
    rating: 0,
    reviewCount: 0,
    badge: "new",
    badgeLabel: "Yeni",
    stock: 10,
    images: ["assets/images/products/apple-watch-s10-42-ti-1.jpg", "assets/images/products/apple-watch-s10-42-ti-2.webp", "assets/images/products/apple-watch-s10-42-ti-3.webp"],
    desc: "Cilalı titanyum kasa, safir kristal ekran ve Milano Loop kayış. Series 10'un en prestijli hali, 42mm gövdede.",
    specs: [
      { key: "Ekran",      value: "42mm geniş açılı LTPO3 Hep Açık Retina OLED, 2000 nit, safir kristal" },
      { key: "İşlemci",    value: "Apple S10 SiP (64 bit çift çekirdek, 4 çekirdekli Neural Engine)" },
      { key: "Kasa",       value: "Cilalı titanyum" },
      { key: "Batarya",    value: "18 saate kadar, Düşük Güç Modu'nda 36 saate kadar; yaklaşık 30 dakikada %80 şarj" },
      { key: "Dayanıklılık", value: "50 m suya dayanıklılık + IP6X, derinlik ölçer ve su sıcaklığı sensörü" },
      { key: "Sağlık",     value: "EKG, kanda oksijen, uyku apnesi bildirimleri, bilekten sıcaklık" },
      { key: "Bağlantı",   value: "LTE/UMTS, L1 GPS, Wi-Fi 4 (802.11n), Bluetooth 5.3, 2. nesil Ultra Wideband" },
      { key: "Ağırlık",    value: "34,4 gram (titanyum kasa)" },
      { key: "Kayış",      value: "Milano Loop (M/L)" }
    ],
    brand: "Apple",
    featured: false
  },
  {
    id: 7,
    variants: [
      { sku: "1411775", color: "Altın", size: "S/M" },
      { sku: "1411768", color: "Altın", size: "M/L" },
      { sku: "1411773", color: "Natürel Titanyum", size: "S/M" },
      { sku: "1411774", color: "Gümüş", size: "S/M" }
    ],
    sizeLabel: "Kordon Bedeni",
    name: "Apple Watch Series 10 46mm Titanyum Cellular",
    category: "saat",
    categoryLabel: "Akıllı Saatler",
    price: 49865,
    originalPrice: 56999,
    rating: 0,
    reviewCount: 0,
    badge: null,
    badgeLabel: null,
    stock: 10,
    images: ["assets/images/products/apple-watch-s10-46-ti-1.jpg", "assets/images/products/apple-watch-s10-46-ti-2.jpg", "assets/images/products/apple-watch-s10-46-ti-3.jpg"],
    desc: "Series 10 titanyum serisinin 46mm gövdesi; Natural, Gold ve Silver seçenekleriyle. Safir kristal ekran ve Milano Loop kayış standart.",
    specs: [
      { key: "Ekran",      value: "46mm geniş açılı LTPO3 Hep Açık Retina OLED, 2000 nit, safir kristal" },
      { key: "İşlemci",    value: "Apple S10 SiP (64 bit çift çekirdek, 4 çekirdekli Neural Engine)" },
      { key: "Kasa",       value: "Cilalı titanyum" },
      { key: "Batarya",    value: "18 saate kadar, Düşük Güç Modu'nda 36 saate kadar; yaklaşık 30 dakikada %80 şarj" },
      { key: "Dayanıklılık", value: "50 m suya dayanıklılık + IP6X, derinlik ölçer ve su sıcaklığı sensörü" },
      { key: "Sağlık",     value: "EKG, kanda oksijen, uyku apnesi bildirimleri, bilekten sıcaklık" },
      { key: "Bağlantı",   value: "LTE/UMTS, L1 GPS, Wi-Fi 4 (802.11n), Bluetooth 5.3, 2. nesil Ultra Wideband" },
      { key: "Ağırlık",    value: "41,7 gram (titanyum kasa)" },
      { key: "Kayış",      value: "Milano Loop (S/M ve M/L)" }
    ],
    brand: "Apple",
    featured: false
  },
  {
    id: 8,
    variants: [
      { sku: "1401236", color: "Kırmızı", size: "S/M" },
      { sku: "1401237", color: "Kırmızı", size: "M/L" },
      { sku: "1401173", color: "Pembe" }
    ],
    sizeLabel: "Kordon Bedeni",
    name: "Apple Watch Series 9 41mm GPS",
    category: "saat",
    categoryLabel: "Akıllı Saatler",
    price: 17106,
    originalPrice: 20999,
    rating: 0,
    reviewCount: 0,
    badge: "sale",
    badgeLabel: "%19 İndirim",
    stock: 10,
    images: ["assets/images/products/apple-watch-s9-41-1.png", "assets/images/products/apple-watch-s9-41-2.jpg", "assets/images/products/apple-watch-s9-41-3.jpg"],
    /* Renk seçilince galeride o rengin görseli gösterilir (Apple resmi görselleri). */
    colorImages: {
      "Kırmızı": "assets/images/products/apple-watch-s9-41-renk-kirmizi.png",
      "Pembe": "assets/images/products/apple-watch-s9-41-renk-pembe.png"
    },
    desc: "Apple Watch Series 9, Double Tap hareketi ve 2000 nit'e çıkan Always-On Retina ekranıyla tek elle kullanım kolaylığı sunar. Kırmızı ve pembe renk seçenekleriyle.",
    specs: [
      { key: "Ekran",      value: "41mm LTPO OLED Hep Açık Retina, 2000 nit" },
      { key: "İşlemci",    value: "Apple S9 SiP (64 bit çift çekirdek, 4 çekirdekli Neural Engine)" },
      { key: "Özellik",    value: "Double Tap hareketi, çarpışma algılama, cihaz üstü Siri" },
      { key: "Batarya",    value: "18 saate kadar, Düşük Güç Modu'nda 36 saate kadar; yaklaşık 45 dakikada %80 şarj" },
      { key: "Dayanıklılık", value: "50 m suya dayanıklılık + IP6X, Ion-X ön cam" },
      { key: "Sağlık",     value: "EKG, 3. nesil optik kalp sensörü, bilekten sıcaklık, düzensiz ritim bildirimleri" },
      { key: "Bağlantı",   value: "L1 GPS, Wi-Fi 4 (802.11n), Bluetooth 5.3, 2. nesil Ultra Wideband" },
      { key: "Ağırlık",    value: "31,9 gram (alüminyum, GPS)" },
      { key: "Kayış",      value: "Sport Band / Sport Loop (S/M ve M/L)" }
    ],
    brand: "Apple",
    featured: false
  },

  // ── Huawei ──
  {
    id: 9,
    variants: [
      { sku: "1424338", color: "Siyah" }
    ],
    name: "Huawei Watch GT 5 Pro 46mm",
    category: "saat",
    categoryLabel: "Akıllı Saatler",
    price: 11961,
    originalPrice: 14499,
    rating: 0,
    reviewCount: 0,
    badge: "sale",
    badgeLabel: "%18 İndirim",
    stock: 10,
    images: ["assets/images/products/huawei-watch-gt5-pro-1.png", "assets/images/products/huawei-watch-gt5-pro-2.jpg", "assets/images/products/huawei-watch-gt5-pro-3.jpg"],
    desc: "Watch GT 5 Pro, titanyum kasası ve safir kristal ekranıyla premium bir tasarım sunar. TruSense sistemi ve EKG desteğiyle sağlık takibini üst seviyeye taşır.",
    specs: [
      { key: "Ekran",      value: "1,43 inç AMOLED, 466 × 466 piksel (326 PPI), safir cam" },
      { key: "Kasa",       value: "Ön kasa titanyum alaşım, arka kasa nanokristal seramik" },
      { key: "Batarya",    value: "Maksimum kullanımda 14 gün; düzenli kullanımda 9 gün, AOD açıkken 5 gün" },
      { key: "Dayanıklılık", value: "5 ATM suya dayanıklılık (ISO 22810) + IP69K" },
      { key: "Sağlık",     value: "TruSense sistemi: EKG, SpO2, nabız, stres, sıcaklık, derinlik sensörü" },
      { key: "Bağlantı",   value: "Çift bantlı GNSS (L1 + L5), Bluetooth 5.2" },
      { key: "Ağırlık",    value: "Yaklaşık 53 gram (kayış hariç)" },
    ],
    brand: "Huawei",
    featured: true
  },
  {
    id: 10,
    variants: [
      { sku: "1424736", color: "Mor" }
    ],
    name: "Huawei Watch GT 6 41mm",
    category: "saat",
    categoryLabel: "Akıllı Saatler",
    price: 10120.99,
    originalPrice: 11999,
    rating: 0,
    reviewCount: 0,
    badge: null,
    badgeLabel: null,
    stock: 10,
    images: ["assets/images/products/huawei-watch-gt6-41-1.png", "assets/images/products/huawei-watch-gt6-41-2.png", "assets/images/products/huawei-watch-gt6-41-3.png"],
    desc: "Watch GT 6'nın 41mm gövdesi, ince ve hafif tasarımıyla her bileğe uyar. Yüksek yoğunluklu bataryası sayesinde günlerce şarj derdi olmadan kullanın.",
    specs: [
      { key: "Ekran",      value: "1,32 inç AMOLED, 466 × 466 piksel (352 PPI)" },
      { key: "Kasa",       value: "Paslanmaz çelik, 41,3 × 41,3 × 9,99 mm" },
      { key: "Batarya",    value: "En fazla 14 gün; tipik kullanımda 7 gün, AOD açıkken 5 gün" },
      { key: "Dayanıklılık", value: "5 ATM suya dayanıklılık (ISO 22810) + IP69" },
      { key: "Sağlık",     value: "TruSense sistemi: SpO2, nabız, uyku, stres" },
      { key: "Bağlantı",   value: "Çift bantlı GNSS (L1 + L5), Bluetooth 6.0" },
      { key: "Ağırlık",    value: "Yaklaşık 37,5 gram (kayış hariç)" },
    ],
    brand: "Huawei",
    featured: false
  },
  {
    id: 11,
    variants: [
      { sku: "1424734", color: "Altın" }
    ],
    name: "Huawei Watch GT 6 41mm Altın",
    category: "saat",
    categoryLabel: "Akıllı Saatler",
    price: 11961,
    originalPrice: null,
    rating: 0,
    reviewCount: 0,
    badge: "new",
    badgeLabel: "Yeni",
    stock: 10,
    images: ["assets/images/products/huawei-watch-gt6-41-gold-1.png", "assets/images/products/huawei-watch-gt6-41-gold-2.png", "assets/images/products/huawei-watch-gt6-41-gold-3.png"],
    desc: "Watch GT 6 41mm'in altın rengi versiyonu; şık kayış seçeneğiyle günlük kullanımdan özel davetlere kadar uyum sağlar.",
    specs: [
      { key: "Ekran",      value: "1,32 inç AMOLED, 466 × 466 piksel (352 PPI)" },
      { key: "Kasa",       value: "Paslanmaz çelik, 41,3 × 41,3 × 9,99 mm" },
      { key: "Batarya",    value: "En fazla 14 gün; tipik kullanımda 7 gün, AOD açıkken 5 gün" },
      { key: "Dayanıklılık", value: "5 ATM suya dayanıklılık (ISO 22810) + IP69" },
      { key: "Sağlık",     value: "TruSense sistemi: SpO2, nabız, uyku, stres" },
      { key: "Bağlantı",   value: "Çift bantlı GNSS (L1 + L5), Bluetooth 6.0" },
      { key: "Ağırlık",    value: "Yaklaşık 37,5 gram (kayış hariç)" },
    ],
    brand: "Huawei",
    featured: false
  },
  {
    id: 12,
    variants: [
      { sku: "1424728", color: "Siyah" },
      { sku: "1424730", color: "Yeşil" }
    ],
    name: "Huawei Watch GT 6 46mm",
    category: "saat",
    categoryLabel: "Akıllı Saatler",
    price: 11041.01,
    originalPrice: 12999,
    rating: 0,
    reviewCount: 0,
    badge: null,
    badgeLabel: null,
    stock: 10,
    images: ["assets/images/products/huawei-watch-gt6-46-1.png", "assets/images/products/huawei-watch-gt6-46-2.png", "assets/images/products/huawei-watch-gt6-46-3.jpg"],
    desc: "Watch GT 6 46mm, geniş AMOLED ekranı ve olağanüstü batarya ömrüyle uzun süreli aktiviteler için tasarlandı. Bisiklet gücü ölçümü ve çift bantlı konumlandırma sporcular için ideal.",
    specs: [
      { key: "Ekran",      value: "1,47 inç AMOLED, 466 × 466 piksel (317 PPI)" },
      { key: "Kasa",       value: "Paslanmaz çelik, 46 × 46 × 10,95 mm" },
      { key: "Batarya",    value: "En fazla 21 gün; tipik kullanımda 12 gün, açık hava spor modunda 40 saat" },
      { key: "Dayanıklılık", value: "5 ATM suya dayanıklılık (ISO 22810) + IP69" },
      { key: "Sağlık",     value: "TruSense sistemi: SpO2, nabız, uyku, stres" },
      { key: "Bağlantı",   value: "Çift bantlı GNSS (L1 + L5), Bluetooth 6.0" },
      { key: "Ağırlık",    value: "Yaklaşık 51,3 gram (kayış hariç)" },
    ],
    brand: "Huawei",
    featured: true
  },
  {
    id: 13,
    variants: [
      { sku: "1424731", color: "Siyah" },
      { sku: "1424733", color: "Kahverengi" }
    ],
    name: "Huawei Watch GT 6 Pro 46mm",
    category: "saat",
    categoryLabel: "Akıllı Saatler",
    price: 15641,
    originalPrice: null,
    rating: 0,
    reviewCount: 0,
    badge: "new",
    badgeLabel: "Yeni",
    stock: 10,
    images: ["assets/images/products/huawei-watch-gt6-pro-1.jpg", "assets/images/products/huawei-watch-gt6-pro-2.png", "assets/images/products/huawei-watch-gt6-pro-3.png"],
    desc: "Watch GT 6 Pro, safir kristal ekranı ve titanyum detaylarıyla dayanıklılığı zarafetle birleştirir. EKG desteği ve gelişmiş sağlık sensörleriyle profesyonel takip.",
    specs: [
      { key: "Ekran",      value: "1,47 inç AMOLED, 466 × 466 piksel (317 PPI), safir cam" },
      { key: "Kasa",       value: "Havacılık sınıfı titanyum alaşım, 45,6 × 45,6 × 11,25 mm" },
      { key: "Batarya",    value: "En fazla 21 gün; tipik kullanımda 12 gün, açık hava spor modunda 40 saat" },
      { key: "Dayanıklılık", value: "5 ATM + IP69; EN13319 uyumlu, 40 metreye kadar serbest dalış" },
      { key: "Sağlık",     value: "TruSense sistemi: EKG, SpO2, nabız, stres, sıcaklık, derinlik sensörü" },
      { key: "Bağlantı",   value: "Çift bantlı GNSS (L1 + L5), Bluetooth 6.0" },
      { key: "Ağırlık",    value: "Yaklaşık 54,7 gram (kayış hariç)" }
    ],
    brand: "Huawei",
    featured: true
  },
  {
    id: 14,
    variants: [
      { sku: "1424732", color: "Titanyum" }
    ],
    name: "Huawei Watch GT 6 Pro 46mm Titanyum",
    category: "saat",
    categoryLabel: "Akıllı Saatler",
    price: 20241,
    originalPrice: 23499,
    rating: 0,
    reviewCount: 0,
    badge: null,
    badgeLabel: null,
    stock: 10,
    images: ["assets/images/products/huawei-watch-gt6-pro-ti-1.png", "assets/images/products/huawei-watch-gt6-pro-ti-2.jpg", "assets/images/products/huawei-watch-gt6-pro-ti-3.png"],
    desc: "GT 6 Pro'nun titanyum kayışlı üst versiyonu. Hafif, dayanıklı ve tamamen titanyum bir gövde-kayış bütünlüğü sunar.",
    specs: [
      { key: "Ekran",      value: "1,47 inç AMOLED, 466 × 466 piksel (317 PPI), safir cam" },
      { key: "Kasa & Kayış", value: "Havacılık sınıfı titanyum alaşım kasa + titanyum kayış" },
      { key: "Batarya",    value: "En fazla 21 gün; tipik kullanımda 12 gün, açık hava spor modunda 40 saat" },
      { key: "Dayanıklılık", value: "5 ATM + IP69; EN13319 uyumlu, 40 metreye kadar serbest dalış" },
      { key: "Sağlık",     value: "TruSense sistemi: EKG, SpO2, nabız, stres, sıcaklık, derinlik sensörü" },
      { key: "Bağlantı",   value: "Çift bantlı GNSS (L1 + L5), Bluetooth 6.0" },
      { key: "Ağırlık",    value: "Yaklaşık 54,7 gram (kayış hariç)" }
    ],
    brand: "Huawei",
    featured: false
  },
  {
    id: 15,
    variants: [
      { sku: "1423710", color: "Siyah" },
      { sku: "1423707", color: "Mor" },
      { sku: "1423699", color: "Beyaz" }
    ],
    name: "Huawei Watch Fit 4",
    category: "saat",
    categoryLabel: "Akıllı Saatler",
    price: 6055,
    originalPrice: 7299,
    rating: 0,
    reviewCount: 0,
    badge: "bestseller",
    badgeLabel: "Çok Satan",
    stock: 10,
    images: ["assets/images/products/huawei-watch-fit4-1.jpg", "assets/images/products/huawei-watch-fit4-2.jpg", "assets/images/products/huawei-watch-fit4-3.jpg"],
    desc: "Watch Fit 4, alüminyum gövdesi ve ince yapısıyla gün boyu rahat kullanım sunar. Geniş AMOLED ekranı ve çift bantlı GPS'iyle koşu, bisiklet ve outdoor aktiviteler için ideal.",
    specs: [
      { key: "Ekran",      value: "1,82 inç AMOLED, 480 × 408 piksel (347 PPI), 2000 nit" },
      { key: "Kasa",       value: "Alüminyum alaşım" },
      { key: "Batarya",    value: "Maksimum kullanımda 10 gün" },
      { key: "Dayanıklılık", value: "5 ATM suya dayanıklılık (ISO 22810)" },
      { key: "Sağlık",     value: "Optik kalp atış hızı, uyku takibi, Duygusal Zindelik (stres); barometre" },
      { key: "Bağlantı",   value: "Çift bantlı GNSS (L1 + L5), Bluetooth 5.2" },
      { key: "Ağırlık",    value: "Yaklaşık 27 gram (kayış hariç)" },
    ],
    brand: "Huawei",
    featured: true
  },

  // ── Samsung ──
  {
    id: 16,
    variants: [
      { sku: "1424310", color: "Beyaz" }
    ],
    name: "Samsung Galaxy Watch8 Classic 46mm",
    category: "saat",
    categoryLabel: "Akıllı Saatler",
    price: 18183,
    originalPrice: 21999,
    rating: 0,
    reviewCount: 0,
    badge: null,
    badgeLabel: null,
    stock: 10,
    images: ["assets/images/products/samsung-watch8-classic-1.jpg", "assets/images/products/samsung-watch8-classic-2.jpg", "assets/images/products/samsung-watch8-classic-3.png"],
    desc: "Galaxy Watch8 Classic, geri dönen fiziksel döner çerçevesiyle klasik saat hissini akıllı saat teknolojisiyle buluşturur. BioActive sensör ve Antioksidan İndeksi ile kapsamlı sağlık takibi.",
    specs: [
      { key: "Ekran",      value: "1,3 inç (34 mm) Super AMOLED, 438 × 438 piksel" },
      { key: "İşlemci",    value: "Exynos W1000, 1,6 GHz; 64 GB depolama" },
      { key: "Batarya",    value: "445 mAh; AOD kapalıyken 40 saate kadar, açıkken 30 saate kadar" },
      { key: "Sağlık",     value: "BioActive sensör: optik nabız, EKG, biyoelektrik empedans, kızılötesi sıcaklık" },
      { key: "Dayanıklılık", value: "5 ATM + IP68" },
      { key: "Bağlantı",   value: "GPS/Glonass/Beidou/Galileo, Wi-Fi 2,4 + 5 GHz, Bluetooth 5.3, NFC" },
      { key: "Boyut",      value: "46,0 × 46,4 × 10,6 mm · 63,5 gram" },
      { key: "Özellik",    value: "Fiziksel döner çerçeve, Wear OS Powered by Samsung" },
    ],
    brand: "Samsung",
    featured: false
  },
  {
    id: 17,
    variants: [
      { sku: "1434606", color: "Siyah" },
      { sku: "1434605", color: "Bej" }
    ],
    name: "Samsung Galaxy Watch9 40mm",
    category: "saat",
    categoryLabel: "Akıllı Saatler",
    price: 18183,
    originalPrice: null,
    rating: 0,
    reviewCount: 0,
    badge: "new",
    badgeLabel: "Yeni",
    stock: 10,
    images: ["assets/images/products/samsung-watch9-40-1.png"],
    desc: "Galaxy Watch9, Samsung'un yeni nesil akıllı saati. Super AMOLED ekranı, BioActive sensörü ve Wear OS deneyimiyle sağlık ve verimliliği bileğinize taşır.",
    specs: [
      { key: "Ekran",      value: "1,3 inç (34 mm) Super AMOLED, 480 × 480, safir kristal, 3000 nite kadar" },
      { key: "İşlemci",    value: "Snapdragon Wear Elite, Penta-Core 2,1 GHz; 2 GB RAM, 32 GB depolama" },
      { key: "Batarya",    value: "390 mAh" },
      { key: "Platform",   value: "Wear OS Powered by Samsung" },
      { key: "Sağlık",     value: "BioActive sensör: optik nabız, EKG, biyoelektrik empedans (vücut analizi), sıcaklık" },
      { key: "Dayanıklılık", value: "5 ATM + MIL-STD-810H" },
      { key: "Bağlantı",   value: "GPS/Glonass/Beidou/Galileo/QZSS, Wi-Fi 2,4 + 5 GHz, Bluetooth 6.0, NFC" },
      { key: "Boyut",      value: "42,7 × 40,4 × 8,6 mm · 31,5 gram" },
    ],
    brand: "Samsung",
    featured: true
  },
  {
    id: 18,
    variants: [
      { sku: "1434610", color: "Siyah" },
      { sku: "1434612", color: "Gümüş" }
    ],
    name: "Samsung Galaxy Watch9 44mm",
    category: "saat",
    categoryLabel: "Akıllı Saatler",
    price: 19092,
    originalPrice: 22499,
    rating: 0,
    reviewCount: 0,
    badge: null,
    badgeLabel: null,
    stock: 10,
    images: ["assets/images/products/samsung-watch9-44-1.png"],
    desc: "Galaxy Watch9'un 44mm gövdesi; daha geniş ekran, daha büyük batarya. Samsung Pay, çağrı ve bildirim yönetimiyle telefonunuzu cebinizde bırakın.",
    specs: [
      { key: "Ekran",      value: "1,5 inç (37,3 mm) Super AMOLED, 480 × 480, safir kristal, 3000 nite kadar" },
      { key: "İşlemci",    value: "Snapdragon Wear Elite, Penta-Core 2,1 GHz; 2 GB RAM, 32 GB depolama" },
      { key: "Batarya",    value: "445 mAh; AOD kapalıyken 40 saate kadar, açıkken 30 saate kadar" },
      { key: "Platform",   value: "Wear OS Powered by Samsung" },
      { key: "Sağlık",     value: "BioActive sensör: optik nabız, EKG, biyoelektrik empedans (vücut analizi), sıcaklık" },
      { key: "Dayanıklılık", value: "5 ATM + MIL-STD-810H" },
      { key: "Bağlantı",   value: "GPS/Glonass/Beidou/Galileo/QZSS, Wi-Fi 2,4 + 5 GHz, Bluetooth 6.0, NFC" },
      { key: "Boyut",      value: "46,0 × 43,7 × 8,6 mm · 34 gram" },
    ],
    brand: "Samsung",
    featured: false
  },

  // ── Xiaomi ──
  {
    id: 19,
    variants: [
      { sku: "1424506", color: "Gece Siyahı" },
      { sku: "1424505", color: "Mat Gümüş" }
    ],
    name: "Xiaomi Redmi Watch 5 Active",
    category: "saat",
    categoryLabel: "Akıllı Saatler",
    price: 2248,
    originalPrice: 2699,
    rating: 0,
    reviewCount: 0,
    badge: null,
    badgeLabel: null,
    stock: 10,
    images: ["assets/images/products/xiaomi-redmi-watch5-active-1.jpg", "assets/images/products/xiaomi-redmi-watch5-active-2.png", "assets/images/products/xiaomi-redmi-watch5-active-3.webp"],
    desc: "Redmi Watch 5 Active, geniş ekranı ve Bluetooth arama desteğiyle bütçe dostu bir akıllı saat. 18 güne varan batarya ömrüyle şarj derdini unutun.",
    specs: [
      { key: "Ekran",      value: "2.0 inç TFT LCD" },
      { key: "Batarya",    value: "18 güne kadar (tipik kullanım)" },
      { key: "Dayanıklılık", value: "5ATM" },
      { key: "Özellik",    value: "Bluetooth arama, 140+ spor modu" },
      { key: "Sağlık",     value: "SpO2, nabız, uyku takibi" },
    ],
    brand: "Xiaomi",
    featured: false
  },
  {
    id: 20,
    variants: [
      { sku: "1424507", color: "Siyah" },
      { sku: "1424508", color: "Açık Altın" }
    ],
    name: "Xiaomi Redmi Watch 5 Lite",
    category: "saat",
    categoryLabel: "Akıllı Saatler",
    price: 3280,
    originalPrice: 3899,
    rating: 0,
    reviewCount: 0,
    badge: null,
    badgeLabel: null,
    stock: 10,
    images: ["assets/images/products/xiaomi-redmi-watch5-lite-1.jpg", "assets/images/products/xiaomi-redmi-watch5-lite-2.png", "assets/images/products/xiaomi-redmi-watch5-lite-3.webp"],
    desc: "Redmi Watch 5 Lite, AMOLED ekranı ve dahili GPS'iyle spor takibini bir üst seviyeye taşır. Metal gövdesiyle fiyatının üzerinde bir his sunar.",
    specs: [
      { key: "Ekran",      value: "1.96 inç AMOLED" },
      { key: "Batarya",    value: "18 güne kadar (tipik kullanım)" },
      { key: "Dayanıklılık", value: "5ATM" },
      { key: "Bağlantı",   value: "Dahili GPS + Bluetooth arama" },
      { key: "Sağlık",     value: "SpO2, nabız, uyku, stres" },
    ],
    brand: "Xiaomi",
    featured: false
  },
  {
    id: 21,
    variants: [
      { sku: "1434008", color: "Buzul Mavisi" }
    ],
    name: "Xiaomi Redmi Watch 6",
    category: "saat",
    categoryLabel: "Akıllı Saatler",
    price: 6472,
    originalPrice: null,
    rating: 0,
    reviewCount: 0,
    badge: "new",
    badgeLabel: "Yeni",
    stock: 10,
    images: ["assets/images/products/xiaomi-redmi-watch6-1.jpg"],
    desc: "Redmi Watch 6, yeni nesil AMOLED ekranı ve gelişmiş sağlık sensörleriyle Redmi akıllı saat serisinin en donanımlı üyesi.",
    specs: [
      { key: "Ekran",      value: "2,07 inç kare AMOLED, 432 × 514 piksel (324 PPI), 60 Hz, tepe parlaklık 2000 nit" },
      { key: "Kasa",       value: "Alüminyum alaşım çerçeve, 46,45 × 40,03 × 9,94 mm, ~31 gram" },
      { key: "Batarya",    value: "Hafif kullanımda 24 gün, normal kullanımda 12 gün" },
      { key: "Dayanıklılık", value: "5 ATM suya dayanıklılık" },
      { key: "Bağlantı",   value: "Dahili GNSS (GPS, Galileo, Glonass, BeiDou, QZSS), Bluetooth 5.4, Bluetooth arama" },
      { key: "Sağlık",     value: "Kalp atış hızı ve kanda oksijen sensörü, uyku ve stres takibi" },
    ],
    brand: "Xiaomi",
    featured: true
  },
  {
    id: 22,
    variants: [
      { sku: "1424503", color: "Gri" }
    ],
    name: "Xiaomi Redmi Watch 3 Active",
    category: "saat",
    categoryLabel: "Akıllı Saatler",
    price: 1806,
    originalPrice: 2299,
    rating: 0,
    reviewCount: 0,
    badge: "sale",
    badgeLabel: "%21 İndirim",
    stock: 10,
    images: ["assets/images/products/xiaomi-redmi-watch3-active-1.jpg", "assets/images/products/xiaomi-redmi-watch3-active-2.jpg", "assets/images/products/xiaomi-redmi-watch3-active-3.png"],
    desc: "Redmi Watch 3 Active, akıllı saate ilk adım için ideal. Bluetooth arama, 100+ spor modu ve 12 güne varan batarya ömrünü uygun fiyata sunar.",
    specs: [
      { key: "Ekran",      value: "1.83 inç LCD" },
      { key: "Batarya",    value: "12 güne kadar (tipik kullanım)" },
      { key: "Dayanıklılık", value: "5ATM" },
      { key: "Özellik",    value: "Bluetooth arama, 100+ spor modu" },
      { key: "Sağlık",     value: "SpO2, nabız, uyku takibi" },
    ],
    brand: "Xiaomi",
    featured: false
  },

  // ══════════════════════════════════════════
  // 🎧 KULAKLIKLAR
  // ══════════════════════════════════════════

  // ── Apple ──
  {
    id: 23,
    variants: [
      { sku: "1424419", color: "Beyaz" }
    ],
    name: "Apple AirPods 4",
    category: "kulaklik",
    categoryLabel: "Kulaklıklar",
    price: 8655,
    originalPrice: 9999,
    rating: 0,
    reviewCount: 0,
    badge: "bestseller",
    badgeLabel: "Çok Satan",
    stock: 10,
    images: ["assets/images/products/apple-airpods-4-1.png", "assets/images/products/apple-airpods-4-2.png", "assets/images/products/apple-airpods-4-3.jpg"],
    desc: "AirPods 4, yeniden tasarlanan açık kulak yapısıyla şimdiye kadarki en rahat AirPods. H2 çipi ve Kişiselleştirilmiş Uzamsal Ses ile sesi tam size göre şekillendirir.",
    specs: [
      { key: "Çip",        value: "Apple H2 kulaklık çipi" },
      { key: "Ses",        value: "Kişiselleştirilmiş Uzamsal Ses, Uyarlanabilir EQ, Ses İzleme" },
      { key: "Batarya",    value: "Tek şarjla 5 saate kadar dinleme; şarj kutusuyla 30 saate kadar" },
      { key: "Şarj",       value: "USB-C; kutuda 5 dakika şarj ile yaklaşık 1 saat dinleme" },
      { key: "Bağlantı",   value: "Bluetooth 5.3" },
      { key: "Dayanıklılık", value: "Toza, tere ve suya dayanıklılık (IP54) — kulaklık ve kutu" },
      { key: "Ağırlık",    value: "4,3 gram (her bir kulaklık), 32,3 gram (şarj kutusu)" },
    ],
    brand: "Apple",
    featured: true
  },
  {
    id: 24,
    variants: [
      { sku: "1424422", color: "Beyaz" }
    ],
    name: "Apple AirPods 4 (Aktif Gürültü Engelleme)",
    category: "kulaklik",
    categoryLabel: "Kulaklıklar",
    price: 11506,
    originalPrice: 13499,
    rating: 0,
    reviewCount: 0,
    badge: null,
    badgeLabel: null,
    stock: 10,
    images: ["assets/images/products/apple-airpods-4-anc-1.jpg", "assets/images/products/apple-airpods-4-anc-2.jpg", "assets/images/products/apple-airpods-4-anc-3.jpg"],
    desc: "AirPods 4'ün Aktif Gürültü Engellemeli versiyonu. Açık kulak tasarımında ANC, Şeffaflık modu, Uyarlanabilir Ses ve Konuşma Farkındalığı bir arada.",
    specs: [
      { key: "Çip",        value: "Apple H2 kulaklık çipi" },
      { key: "Gürültü Engelleme", value: "Aktif Gürültü Engelleme, Şeffaflık modu, Uyarlanabilir Ses" },
      { key: "Batarya",    value: "ANC açıkken 4 saate kadar (kapalıyken 5 saat); kutuyla 20 saate kadar" },
      { key: "Özellik",    value: "Sohbet Farkındalığı, Kişiselleştirilmiş Uzamsal Ses" },
      { key: "Şarj",       value: "Hoparlörlü şarj kutusu; USB-C, Qi sertifikalı ve Apple Watch şarj aygıtı uyumlu" },
      { key: "Bağlantı",   value: "Bluetooth 5.3" },
      { key: "Dayanıklılık", value: "Toza, tere ve suya dayanıklılık (IP54) — kulaklık ve kutu" },
    ],
    brand: "Apple",
    featured: true
  },
  {
    id: 25,
    variants: [
      { sku: "1425176", color: "Beyaz" }
    ],
    name: "Apple AirPods Pro 3",
    category: "kulaklik",
    categoryLabel: "Kulaklıklar",
    price: 14832,
    originalPrice: null,
    rating: 0,
    reviewCount: 0,
    badge: "new",
    badgeLabel: "Yeni",
    stock: 10,
    images: ["assets/images/products/apple-airpods-pro-3-1.png", "assets/images/products/apple-airpods-pro-3-2.jpg", "assets/images/products/apple-airpods-pro-3-3.png"],
    desc: "AirPods Pro 3, Aktif Gürültü Engelleme ve Şeffaflık moduyla bulunduğunuz ortama uyum sağlar. Antrenmanlarda kalp atış hızınızı ölçer, beş farklı boy silikon uçla kulağınıza tam oturur; kulaklık da şarj kutusu da IP57 dayanıklıdır.",
    specs: [
      { key: "Çip",        value: "Apple H2 kulaklık çipi; MagSafe kutuda 2. nesil Ultra Geniş Bant çipi" },
      { key: "Gürültü Engelleme", value: "Aktif Gürültü Engelleme, Şeffaflık modu, Uyarlanabilir Ses" },
      { key: "Batarya",    value: "ANC açıkken 8 saate kadar; MagSafe kutuyla 24 saate kadar" },
      { key: "Sağlık",     value: "Antrenmanlarda kalp atış hızı sensörü (kalp atışı ölçümüyle 6,5 saate kadar)" },
      { key: "Dayanıklılık", value: "Toza, tere ve suya dayanıklılık (IP57) — kulaklık ve kutu" },
      { key: "Kulaklık Uçları", value: "Beş boy silikon uç (XXS, XS, S, M, L)" },
      { key: "Şarj",       value: "MagSafe, Apple Watch şarj aygıtı, Qi sertifikalı şarj veya USB-C" },
      { key: "Bağlantı",   value: "Bluetooth 5.3" }
    ],
    brand: "Apple",
    featured: true
  },

  // ── Huawei ──
  {
    id: 26,
    variants: [
      { sku: "1424324", color: "Siyah" },
      { sku: "1424323", color: "Bej" }
    ],
    name: "Huawei FreeBuds SE 3",
    category: "kulaklik",
    categoryLabel: "Kulaklıklar",
    price: 1749,
    originalPrice: 2099,
    rating: 0,
    reviewCount: 0,
    badge: null,
    badgeLabel: null,
    stock: 10,
    images: ["assets/images/products/huawei-freebuds-se3-1.jpg", "assets/images/products/huawei-freebuds-se3-2.jpg", "assets/images/products/huawei-freebuds-se3-3.jpg"],
    desc: "FreeBuds SE 3, hafif yapısı ve uzun batarya ömrüyle günlük kullanım için tasarlandı. Net çağrı kalitesi ve rahat kulak içi oturuşuyla gün boyu konfor.",
    specs: [
      { key: "Tip",        value: "Kulak içi TWS" },
      { key: "Sürücü",     value: "10 mm dinamik sürücü" },
      { key: "Batarya",    value: "Tek şarjla 9 saat müzik; şarj kutusuyla 42 saate kadar" },
      { key: "Şarj",       value: "Kulaklık 41 mAh, şarj kutusu 510 mAh" },
      { key: "Bağlantı",   value: "Bluetooth 5.4" },
      { key: "Dayanıklılık", value: "IP54 (yalnız kulaklıklar; şarj kutusu suya dayanıklı değildir)" },
      { key: "Ağırlık",    value: "3,8 gram (her kulaklık), 33 gram (şarj kutusu)" },
    ],
    brand: "Huawei",
    featured: false
  },

  // ── JBL ──
  {
    id: 27,
    variants: [
      { sku: "1400813", color: "Siyah" },
      { sku: "1400810", color: "Mavi" },
      { sku: "1400812", color: "Mor" }
    ],
    name: "JBL Tune 520BT Kablosuz Kulaklık",
    category: "kulaklik",
    categoryLabel: "Kulaklıklar",
    price: 2466,
    originalPrice: 2999,
    rating: 0,
    reviewCount: 0,
    badge: "bestseller",
    badgeLabel: "Çok Satan",
    stock: 10,
    images: ["assets/images/products/jbl-tune-520bt-1.jpg", "assets/images/products/jbl-tune-520bt-2.jpg", "assets/images/products/jbl-tune-520bt-3.jpg"],
    desc: "JBL Tune 520BT, JBL Pure Bass sesi ve 57 saate varan batarya ömrüyle uzun yolculukların kulaklığı. Katlanabilir tasarımı ve çoklu cihaz bağlantısıyla pratik.",
    specs: [
      { key: "Tip",        value: "Kulak üstü (on-ear) kablosuz" },
      { key: "Ses",        value: "JBL Pure Bass" },
      { key: "Batarya",    value: "57 saate kadar" },
      { key: "Bağlantı",   value: "Bluetooth 5.3 + Multipoint" },
      { key: "Şarj",       value: "USB-C hızlı şarj" },
    ],
    brand: "JBL",
    featured: true
  },
  {
    id: 28,
    variants: [
      { sku: "1430503", color: "Siyah" },
      { sku: "1430501", color: "Beyaz" },
      { sku: "1430500", color: "Bej" },
      { sku: "1430502", color: "Mavi" },
      { sku: "1430504", color: "Lavanta" }
    ],
    name: "JBL Tune 530BT Kablosuz Kulaklık",
    category: "kulaklik",
    categoryLabel: "Kulaklıklar",
    price: 2523,
    originalPrice: 2999,
    rating: 0,
    reviewCount: 0,
    badge: null,
    badgeLabel: null,
    stock: 10,
    images: ["assets/images/products/jbl-tune-530bt-1.png", "assets/images/products/jbl-tune-530bt-2.png", "assets/images/products/jbl-tune-530bt-3.png"],
    desc: "Tune 530BT, 5 farklı renk seçeneği ve JBL Pure Bass sesiyle tarzınıza uyum sağlar. Çoklu cihaz bağlantısı sayesinde telefon ve bilgisayar arasında kesintisiz geçiş.",
    specs: [
      { key: "Tip",        value: "Kulak üstü (on-ear) kablosuz" },
      { key: "Ses",        value: "JBL Pure Bass" },
      { key: "Batarya",    value: "57 saate kadar" },
      { key: "Bağlantı",   value: "Bluetooth 5.3 + Multipoint" },
      { key: "Şarj",       value: "USB-C hızlı şarj" },
    ],
    brand: "JBL",
    featured: false
  },
  {
    id: 29,
    variants: [
      { sku: "1430508", color: "Siyah" }
    ],
    name: "JBL Tune 680BT NC Kablosuz Kulaklık",
    category: "kulaklik",
    categoryLabel: "Kulaklıklar",
    price: 3448,
    originalPrice: 4199,
    rating: 0,
    reviewCount: 0,
    badge: "sale",
    badgeLabel: "%18 İndirim",
    stock: 10,
    images: ["assets/images/products/jbl-tune-680btnc-1.jpg"],
    desc: "Tune 680BT NC, aktif gürültü engellemeyi kulak üstü konforla birleştirir. Kalabalık ortamlarda müziğe odaklanın, katlanabilir tasarımıyla çantanıza kolayca sığdırın.",
    specs: [
      { key: "Tip",        value: "Kulak üstü (on-ear) kablosuz" },
      { key: "Gürültü Engelleme", value: "Aktif ANC" },
      { key: "Ses",        value: "JBL Pure Bass" },
      { key: "Batarya",    value: "Uzun ömürlü (ANC kapalıyken daha uzun)" },
      { key: "Bağlantı",   value: "Bluetooth 5.3 + Multipoint" },
    ],
    brand: "JBL",
    featured: false
  },
  {
    id: 30,
    variants: [
      { sku: "1430515", color: "Siyah" },
      { sku: "1430510", color: "Beyaz" },
      { sku: "1430509", color: "Bej" },
      { sku: "1430514", color: "Mavi" }
    ],
    name: "JBL Tune 730BT Kablosuz Kulaklık",
    category: "kulaklik",
    categoryLabel: "Kulaklıklar",
    price: 3583.99,
    originalPrice: 4299,
    rating: 0,
    reviewCount: 0,
    badge: "sale",
    badgeLabel: "%17 İndirim",
    stock: 10,
    images: ["assets/images/products/jbl-tune-730bt-1.png", "assets/images/products/jbl-tune-730bt-2.jpg", "assets/images/products/jbl-tune-730bt-3.jpg"],
    desc: "Tune 730BT, kulak çevreleyen tasarımı ve aktif gürültü engellemesiyle sizi sesin içine alır. Uzun batarya ömrü ve hızlı şarj desteğiyle gün boyu müzik.",
    specs: [
      { key: "Tip",        value: "Kulak çevreleyen (over-ear) kablosuz" },
      { key: "Gürültü Engelleme", value: "Aktif ANC" },
      { key: "Ses",        value: "JBL Pure Bass" },
      { key: "Batarya",    value: "70 saate kadar (ANC kapalı)" },
      { key: "Bağlantı",   value: "Bluetooth 5.3 + Multipoint + 3.5mm" },
    ],
    brand: "JBL",
    featured: false
  },
  {
    id: 31,
    variants: [
      { sku: "1424125", color: "Siyah" },
      { sku: "1424100", color: "Ghost Mor" },
      { sku: "1424089", color: "Turkuaz" }
    ],
    name: "JBL Tune Beam 2 TWS Kulaklık",
    category: "kulaklik",
    categoryLabel: "Kulaklıklar",
    price: 4729.99,
    originalPrice: null,
    rating: 0,
    reviewCount: 0,
    badge: "new",
    badgeLabel: "Yeni",
    stock: 10,
    images: ["assets/images/products/jbl-tune-beam2-1.png", "assets/images/products/jbl-tune-beam2-2.png", "assets/images/products/jbl-tune-beam2-3.png"],
    desc: "Tune Beam 2, kişiselleştirilebilir ses profili ve gelişmiş gürültü engellemesiyle günlük kullanımın standardını yükseltir. Ghost serisi şeffaf tasarım seçenekleriyle.",
    specs: [
      { key: "Tip",        value: "Kulak içi TWS (stick tasarım)" },
      { key: "Gürültü Engelleme", value: "Aktif ANC + Smart Ambient" },
      { key: "Ses",        value: "JBL Spatial Sound, Personi-Fi" },
      { key: "Batarya",    value: "12 saat + 36 saat (kılıf)" },
      { key: "Dayanıklılık", value: "IP54" },
    ],
    brand: "JBL",
    featured: true
  },
  {
    id: 32,
    variants: [
      { sku: "1424112", color: "Siyah" },
      { sku: "1424111", color: "Beyaz" },
      { sku: "1424127", color: "Ghost Siyah" },
      { sku: "1424090", color: "Ghost Bej" },
      { sku: "1424113", color: "Ghost Mor" },
      { sku: "1424126", color: "Turkuaz" }
    ],
    name: "JBL Tune Flex 2 TWS Kulaklık",
    category: "kulaklik",
    categoryLabel: "Kulaklıklar",
    price: 5679,
    originalPrice: 6799,
    rating: 0,
    reviewCount: 0,
    badge: null,
    badgeLabel: null,
    stock: 10,
    images: ["assets/images/products/jbl-tune-flex2-1.png", "assets/images/products/jbl-tune-flex2-2.png", "assets/images/products/jbl-tune-flex2-3.png"],
    desc: "Tune Flex 2, değiştirilebilir kulak uçlarıyla hem açık hem kapalı kullanım sunar. 6 renk seçeneğiyle JBL'in en çok yönlü TWS kulaklığı.",
    specs: [
      { key: "Tip",        value: "Kulak içi TWS, değiştirilebilir uçlar" },
      { key: "Gürültü Engelleme", value: "Aktif ANC + Smart Ambient" },
      { key: "Ses",        value: "JBL Spatial Sound, Personi-Fi" },
      { key: "Batarya",    value: "12 saat + 36 saat (kılıf)" },
      { key: "Dayanıklılık", value: "IP54" },
    ],
    brand: "JBL",
    featured: true
  },
  {
    id: 33,
    variants: [
      { sku: "1424122", color: "Siyah" },
      { sku: "1424121", color: "Beyaz" },
      { sku: "1424101", color: "Mavi" },
      { sku: "1424087", color: "Pembe" }
    ],
    name: "JBL Wave Beam 2 TWS Kulaklık",
    category: "kulaklik",
    categoryLabel: "Kulaklıklar",
    price: 3855,
    originalPrice: 4599,
    rating: 0,
    reviewCount: 0,
    badge: null,
    badgeLabel: null,
    stock: 10,
    images: ["assets/images/products/jbl-wave-beam2-1.png", "assets/images/products/jbl-wave-beam2-2.jpg", "assets/images/products/jbl-wave-beam2-3.jpg"],
    desc: "Wave Beam 2, JBL Deep Bass sesi ve kompakt kılıfıyla her gün yanınızda. Su ve toz direnciyle spor sırasında da güvenle kullanın.",
    specs: [
      { key: "Tip",        value: "Kulak içi TWS" },
      { key: "Gürültü Engelleme", value: "Aktif ANC" },
      { key: "Ses",        value: "JBL Deep Bass" },
      { key: "Batarya",    value: "10 saat + 30 saat (kılıf)" },
      { key: "Dayanıklılık", value: "IP54" },
    ],
    brand: "JBL",
    featured: false
  },
  {
    id: 34,
    variants: [
      { sku: "1424099", color: "Siyah" },
      { sku: "1424079", color: "Beyaz" }
    ],
    name: "JBL Wave Buds 2 TWS Kulaklık",
    category: "kulaklik",
    categoryLabel: "Kulaklıklar",
    price: 3454.99,
    originalPrice: 4199,
    rating: 0,
    reviewCount: 0,
    badge: "sale",
    badgeLabel: "%18 İndirim",
    stock: 10,
    images: ["assets/images/products/jbl-wave-buds2-1.png", "assets/images/products/jbl-wave-buds2-2.jpg", "assets/images/products/jbl-wave-buds2-3.png"],
    desc: "Wave Buds 2, kompakt yapısı ve güçlü basıyla günlük kullanımın pratik çözümü. Tek kulaklıkla kullanım desteği sayesinde çağrılarda özgür kalın.",
    specs: [
      { key: "Tip",        value: "Kulak içi TWS" },
      { key: "Gürültü Engelleme", value: "Aktif ANC" },
      { key: "Ses",        value: "JBL Deep Bass" },
      { key: "Batarya",    value: "10 saat + 30 saat (kılıf)" },
      { key: "Dayanıklılık", value: "IP54" },
    ],
    brand: "JBL",
    featured: false
  },

  // ── Samsung ──
  {
    id: 35,
    variants: [
      { sku: "1367269", color: "Siyah" },
      { sku: "1367271", color: "Beyaz" }
    ],
    name: "Samsung EO-IC100B Type-C Kulaklık",
    category: "kulaklik",
    categoryLabel: "Kulaklıklar",
    price: 1054,
    originalPrice: 1299,
    rating: 0,
    reviewCount: 0,
    badge: "sale",
    badgeLabel: "%19 İndirim",
    stock: 10,
    images: ["assets/images/products/samsung-eo-ic100b-1.png", "assets/images/products/samsung-eo-ic100b-2.jpg", "assets/images/products/samsung-eo-ic100b-3.webp"],
    desc: "AKG tarafından akort edilen Samsung EO-IC100B, USB Type-C bağlantısıyla gecikmesiz ve net ses sunar. Dahili mikrofon ve kumandasıyla çağrılarda pratik kullanım.",
    specs: [
      { key: "Tip",        value: "Kulak içi kablolu" },
      { key: "Bağlantı",   value: "USB Type-C" },
      { key: "Ses",        value: "AKG akordu" },
      { key: "Özellik",    value: "Dahili mikrofon + ses kumandası" },
    ],
    brand: "Samsung",
    featured: false
  },
  {
    id: 36,
    variants: [
      { sku: "1424745", color: "Siyah" }
    ],
    name: "Samsung Galaxy Buds3 FE",
    category: "kulaklik",
    categoryLabel: "Kulaklıklar",
    price: 4998,
    originalPrice: 5999,
    rating: 0,
    reviewCount: 0,
    badge: "bestseller",
    badgeLabel: "Çok Satan",
    stock: 10,
    images: ["assets/images/products/samsung-buds3-fe-1.png", "assets/images/products/samsung-buds3-fe-2.jpg", "assets/images/products/samsung-buds3-fe-3.jpg"],
    desc: "Galaxy Buds3 FE, ikonik blade tasarımı ve aktif gürültü engellemesiyle Galaxy deneyimini erişilebilir fiyata taşır. Galaxy AI çeviri desteğiyle dil engelini kaldırın.",
    specs: [
      { key: "Tip",        value: "Kulak içi TWS (blade tasarım)" },
      { key: "Gürültü Engelleme", value: "Aktif ANC" },
      { key: "Sürücü",     value: "12mm" },
      { key: "Batarya",    value: "6 saat (ANC açık) + 30 saat (kılıf)" },
      { key: "Bağlantı",   value: "Bluetooth 5.4" },
      { key: "Dayanıklılık", value: "IP54" },
    ],
    brand: "Samsung",
    featured: true
  },
  {
    id: 37,
    variants: [
      { sku: "1430043", color: "Siyah" }
    ],
    name: "Samsung Galaxy Buds4",
    category: "kulaklik",
    categoryLabel: "Kulaklıklar",
    price: 8177,
    originalPrice: null,
    rating: 0,
    reviewCount: 0,
    badge: "new",
    badgeLabel: "Yeni",
    stock: 10,
    images: ["assets/images/products/samsung-buds4-1.jpg", "assets/images/products/samsung-buds4-2.jpg", "assets/images/products/samsung-buds4-3.jpg"],
    desc: "Galaxy Buds4, Samsung'un yeni nesil kablosuz kulaklığı. Gelişmiş ses işleme ve Galaxy ekosistemiyle sorunsuz entegrasyon sunar.",
    specs: [
      { key: "Tip",        value: "Kulak içi TWS" },
      { key: "Gürültü Engelleme", value: "Adaptif Aktif Gürültü Engelleme, Adaptif EQ, ortam sesi modu" },
      { key: "Ses",        value: "360 Ses; SSC-UHQ ile 24 bit / 96 kHz aktarım" },
      { key: "Kodek",      value: "AAC, SBC, SSC, SSC-UHQ, LC3 (LE Audio)" },
      { key: "Batarya",    value: "ANC açıkken 5 saat müzik; kutuyla toplam 24 saate kadar" },
      { key: "Mikrofon",   value: "6 mikrofon + ses algılama ünitesi (VPU)" },
      { key: "Bağlantı",   value: "Bluetooth 6.1, otomatik cihaz geçişi (Auto Switch)" },
      { key: "Dayanıklılık", value: "IP54" },
      { key: "Ağırlık",    value: "4,6 gram (her kulaklık)" },
    ],
    brand: "Samsung",
    featured: true
  },
  {
    id: 38,
    variants: [
      { sku: "1430045", color: "Siyah" },
      { sku: "1430046", color: "Beyaz" }
    ],
    name: "Samsung Galaxy Buds4 Pro",
    category: "kulaklik",
    categoryLabel: "Kulaklıklar",
    price: 11357,
    originalPrice: 13499,
    rating: 0,
    reviewCount: 0,
    badge: null,
    badgeLabel: null,
    stock: 10,
    images: ["assets/images/products/samsung-buds4-pro-1.jpg", "assets/images/products/samsung-buds4-pro-2.jpg", "assets/images/products/samsung-buds4-pro-3.jpg"],
    desc: "Galaxy Buds4 Pro, Samsung'un amiral gemisi kulaklığı. Hi-Fi ses, güçlü gürültü engelleme ve 360 Audio ile sürükleyici bir dinleme deneyimi.",
    specs: [
      { key: "Tip",        value: "Kulak içi TWS" },
      { key: "Gürültü Engelleme", value: "Adaptif Aktif Gürültü Engelleme, Adaptif EQ, ortam sesi modu" },
      { key: "Ses",        value: "360 Audio; SSC-UHQ ile 24 bit / 96 kHz aktarım" },
      { key: "Kodek",      value: "AAC, SBC, SSC, SSC-UHQ, LC3" },
      { key: "Batarya",    value: "ANC açıkken 6 saat müzik; kutuyla toplam 26 saate kadar (kulaklık 61 mAh, kutu 530 mAh)" },
      { key: "Mikrofon",   value: "6 mikrofon + ses algılama ünitesi (VPU)" },
      { key: "Bağlantı",   value: "Bluetooth 6.1" },
      { key: "Dayanıklılık", value: "IP57" },
      { key: "Ağırlık",    value: "5,1 gram (her kulaklık), 44,3 gram (şarj kutusu)" },
    ],
    brand: "Samsung",
    featured: false
  },

  // ── Xiaomi ──
  {
    id: 39,
    variants: [
      { sku: "1424254", color: "Siyah" },
      { sku: "1418684", color: "Beyaz" },
      { sku: "1418685", color: "Mavi" }
    ],
    name: "Xiaomi Redmi Buds 6 Play",
    category: "kulaklik",
    categoryLabel: "Kulaklıklar",
    price: 771,
    originalPrice: 949,
    rating: 0,
    reviewCount: 0,
    badge: "bestseller",
    badgeLabel: "Çok Satan",
    stock: 10,
    images: ["assets/images/products/xiaomi-redmi-buds6-play-1.jpg", "assets/images/products/xiaomi-redmi-buds6-play-2.jpg", "assets/images/products/xiaomi-redmi-buds6-play-3.png"],
    desc: "Redmi Buds 6 Play, uygun fiyatına rağmen güçlü bası ve uzun batarya ömrü sunar. Kablosuz kulaklığa ilk adım için en pratik seçenek.",
    specs: [
      { key: "Tip",        value: "Kulak içi TWS" },
      { key: "Sürücü",     value: "10mm dinamik" },
      { key: "Batarya",    value: "Kılıfla 36 saate kadar" },
      { key: "Bağlantı",   value: "Bluetooth 5.4" },
      { key: "Dayanıklılık", value: "IPX4" },
    ],
    brand: "Xiaomi",
    featured: false
  },
  {
    id: 40,
    variants: [
      { sku: "1434004", color: "Siyah" },
      { sku: "1434006", color: "Beyaz" },
      { sku: "1434007", color: "Yeşil" }
    ],
    name: "Xiaomi Redmi Buds 8",
    category: "kulaklik",
    categoryLabel: "Kulaklıklar",
    price: 3868,
    originalPrice: null,
    rating: 0,
    reviewCount: 0,
    badge: "new",
    badgeLabel: "Yeni",
    stock: 10,
    images: ["assets/images/products/xiaomi-redmi-buds8-1.jpg", "assets/images/products/xiaomi-redmi-buds8-2.jpg"],
    desc: "Redmi Buds 8, yeni nesil sürücüsü ve aktif gürültü engellemesiyle Redmi kulaklık ailesinin standart modelini bir üst seviyeye taşıyor.",
    specs: [
      { key: "Tip",        value: "Yarı kulak içi (semi-in-ear) TWS" },
      { key: "Gürültü Engelleme", value: "Aktif Gürültü Engelleme (ANC)" },
      { key: "Batarya",    value: "ANC açıkken 6,5 saat / kutuyla 28 saat; ANC kapalıyken 11 saat / kutuyla 44 saat" },
      { key: "Şarj",       value: "Kulaklık 54 mAh, kutu 475 mAh; Type-C" },
      { key: "Bağlantı",   value: "Bluetooth 5.4; SBC, AAC, LHDC" },
      { key: "Dayanıklılık", value: "IP54 (kulaklıklar)" },
      { key: "Ağırlık",    value: "5,0 gram (her kulaklık), toplam 44,5 gram" },
    ],
    brand: "Xiaomi",
    featured: false
  },
  {
    id: 41,
    variants: [
      { sku: "1431551", color: "Siyah" },
      { sku: "1431552", color: "Beyaz" },
      { sku: "1431550", color: "Mavi" }
    ],
    name: "Xiaomi Redmi Buds 8 Active",
    category: "kulaklik",
    categoryLabel: "Kulaklıklar",
    price: 1595,
    originalPrice: 1899,
    rating: 0,
    reviewCount: 0,
    badge: null,
    badgeLabel: null,
    stock: 10,
    images: ["assets/images/products/xiaomi-redmi-buds8-active-1.png", "assets/images/products/xiaomi-redmi-buds8-active-2.png", "assets/images/products/xiaomi-redmi-buds8-active-3.jpg"],
    desc: "Redmi Buds 8 Active, hafif yapısı ve dengeli sesiyle günlük kullanım için ideal. Düşük gecikme modu sayesinde oyunlarda ses–görüntü uyumu korunur.",
    specs: [
      { key: "Tip",        value: "Kulak içi TWS" },
      { key: "Batarya",    value: "Tek şarjla 7 saat; şarj kutusuyla 37 saate kadar" },
      { key: "Şarj",       value: "Kulaklık 37 mAh, kutu 475 mAh; Type-C" },
      { key: "Ses",        value: "20 Hz – 20 kHz frekans aralığı, 32 Ω" },
      { key: "Bağlantı",   value: "Bluetooth 5.4 (LE Audio, HFP, A2DP, AVRCP)" },
      { key: "Ağırlık",    value: "3,8 gram (her kulaklık), 28 gram (şarj kutusu)" },
    ],
    brand: "Xiaomi",
    featured: false
  },
  {
    id: 42,
    variants: [
      { sku: "1429167", color: "Siyah" },
      { sku: "1429169", color: "Beyaz" }
    ],
    name: "Xiaomi Redmi Buds 8 Lite",
    category: "kulaklik",
    categoryLabel: "Kulaklıklar",
    price: 1892,
    originalPrice: 2299,
    rating: 0,
    reviewCount: 0,
    badge: "sale",
    badgeLabel: "%18 İndirim",
    stock: 10,
    images: ["assets/images/products/xiaomi-redmi-buds8-lite-1.jpg", "assets/images/products/xiaomi-redmi-buds8-lite-2.png", "assets/images/products/xiaomi-redmi-buds8-lite-3.jpg"],
    desc: "Redmi Buds 8 Lite, kompakt kılıfı ve rahat oturuşuyla gün boyu taşımaya uygun. Net çağrı kalitesi ve hızlı eşleşme özelliğiyle pratik.",
    specs: [
      { key: "Tip",        value: "Kulak içi TWS" },
      { key: "Batarya",    value: "Tek şarjla 8 saat; şarj kutusuyla 36 saate kadar" },
      { key: "Şarj",       value: "Kulaklık 45 mAh, kutu 475 mAh; Type-C" },
      { key: "Ses",        value: "20 Hz – 20 kHz frekans aralığı, 32 Ω" },
      { key: "Bağlantı",   value: "Bluetooth 5.4 (LE Audio, HFP, A2DP, AVRCP)" },
      { key: "Ağırlık",    value: "4,5 gram (her kulaklık), 35,2 gram (şarj kutusu)" },
    ],
    brand: "Xiaomi",
    featured: false
  },
  {
    id: 43,
    variants: [
      { sku: "1431549", color: "Obsidyen Siyah" },
      { sku: "1431547", color: "Bulut Beyazı" },
      { sku: "1431548", color: "Buzul Mavisi" }
    ],
    name: "Xiaomi Redmi Buds 8 Pro",
    category: "kulaklik",
    categoryLabel: "Kulaklıklar",
    price: 5173,
    originalPrice: 6199,
    rating: 0,
    reviewCount: 0,
    badge: "sale",
    badgeLabel: "%17 İndirim",
    stock: 10,
    images: ["assets/images/products/xiaomi-redmi-buds8-pro-1.jpg", "assets/images/products/xiaomi-redmi-buds8-pro-2.jpg", "assets/images/products/xiaomi-redmi-buds8-pro-3.jpg"],
    desc: "Redmi Buds 8 Pro, 55dB'ye varan aktif gürültü engellemesi ve 3 mikrofonlu yapay zekâ destekli çağrı filtresiyle serinin amiral gemisi. Kılıfla birlikte 33 saate varan kullanım.",
    specs: [
      { key: "Tip",        value: "Kulak içi TWS" },
      { key: "Gürültü Engelleme", value: "Adaptif Aktif Gürültü Engelleme" },
      { key: "Şarj",       value: "Kulaklık 54 mAh, kutu 480 mAh; Type-C" },
      { key: "Bağlantı",   value: "Bluetooth 5.4; iki cihaza aynı anda bağlanma" },
      { key: "Kulaklık Uçları", value: "S / M / L silikon uç (M takılı gelir)" },
      { key: "Ağırlık",    value: "5,3 gram (her kulaklık), 36,3 gram (şarj kutusu)" },
    ],
    brand: "Xiaomi",
    featured: true
  },

  // ══════════════════════════════════════════
  // 🔌 AKSESUARLAR
  // ══════════════════════════════════════════

  {
    id: 44,
    variants: [
      { sku: "1424409", color: "Beyaz" }
    ],
    name: "Apple 20W USB-C Güç Adaptörü",
    category: "aksesuar",
    categoryLabel: "Aksesuarlar",
    price: 1048.99,
    originalPrice: 1249,
    rating: 0,
    reviewCount: 0,
    badge: "bestseller",
    badgeLabel: "Çok Satan",
    stock: 10,
    images: ["assets/images/products/apple-20w-adapter-1.jpg", "assets/images/products/apple-20w-adapter-2.jpg", "assets/images/products/apple-20w-adapter-3.png"],
    desc: "Apple 20W USB-C Güç Adaptörü, iPhone ve iPad'inizi hızlı ve güvenli şekilde şarj eder. Kompakt yapısıyla evde, ofiste ve seyahatte pratik.",
    specs: [
      { key: "Güç",        value: "20W" },
      { key: "Çıkış",      value: "1× USB-C" },
      { key: "Uyumluluk",  value: "iPhone, iPad, AirPods" },
      { key: "Kutu İçeriği", value: "Güç adaptörü (şarj kablosu ayrı satılır)" },
    ],
    brand: "Apple",
    featured: false
  },
  {
    id: 45,
    variants: [
      { sku: "1426785", color: "Beyaz" }
    ],
    name: "Apple 35W Çift USB-C Portlu Güç Adaptörü",
    category: "aksesuar",
    categoryLabel: "Aksesuarlar",
    price: 3128,
    originalPrice: null,
    rating: 0,
    reviewCount: 0,
    badge: "new",
    badgeLabel: "Yeni",
    stock: 10,
    images: ["assets/images/products/apple-35w-dual-adapter-1.png", "assets/images/products/apple-35w-dual-adapter-2.png", "assets/images/products/apple-35w-dual-adapter-3.jpg"],
    desc: "İki USB-C portuyla iPhone ve Apple Watch'ınızı aynı anda şarj edin. Tek adaptörle iki cihaz, tek prizle daha az kablo karmaşası.",
    specs: [
      { key: "Güç",        value: "35W (iki port toplamı)" },
      { key: "Çıkış",      value: "2× USB-C" },
      { key: "Kullanım",   value: "İki cihazı aynı anda şarj eder" },
      { key: "Uyumluluk",  value: "iPhone, iPad, Apple Watch, Mac" },
      { key: "Kutu İçeriği", value: "Güç adaptörü (şarj kablosu ayrı satılır)" }
    ],
    brand: "Apple",
    featured: false
  },
  {
    id: 46,
    variants: [
      { sku: "1430850", color: "Bright Guava" }
    ],
    name: "Apple Crossbody Strap – Bright Guava",
    category: "aksesuar",
    categoryLabel: "Aksesuarlar",
    price: 3464.02,
    originalPrice: null,
    rating: 0,
    reviewCount: 0,
    badge: "new",
    badgeLabel: "Yeni",
    stock: 10,
    images: ["assets/images/products/apple-crossbody-strap-1.jpg", "assets/images/products/apple-crossbody-strap-2.jpg", "assets/images/products/apple-crossbody-strap-3.webp"],
    desc: "Apple Crossbody Strap, iPhone kılıfınıza manyetik olarak takılır ve telefonunuzu omzunuzda taşımanızı sağlar. Dokuma yapısı ve ayarlanabilir uzunluğuyla gün boyu konfor.",
    specs: [
      { key: "Tip",        value: "Çapraz askı (crossbody)" },
      { key: "Malzeme",    value: "%100 geri dönüştürülmüş PET ipliğinden dokuma" },
      { key: "Bağlantı",   value: "Gömülü esnek mıknatıslar; uyumlu Apple kılıflarına takılır" },
      { key: "Ayar",       value: "Paslanmaz çelik kaydırma mekanizmasıyla ayarlanabilir uzunluk" },
      { key: "Renk",       value: "Bright Guava" }
    ],
    brand: "Apple",
    featured: false
  },
  {
    id: 47,
    variants: [
      { sku: "1424405", color: "Beyaz" }
    ],
    name: "Apple Watch Manyetik Hızlı Şarj Kablosu (USB-C, 1m)",
    category: "aksesuar",
    categoryLabel: "Aksesuarlar",
    price: 1230,
    originalPrice: 1449,
    rating: 0,
    reviewCount: 0,
    badge: null,
    badgeLabel: null,
    stock: 10,
    images: ["assets/images/products/apple-watch-charge-cable-1.webp", "assets/images/products/apple-watch-charge-cable-2.jpg", "assets/images/products/apple-watch-charge-cable-3.jpg"],
    desc: "Apple Watch'unuzu hızlı şarj edin. Manyetik şarj ucu saatinize kendiliğinden hizalanır; 1 metrelik USB-C kablo ile pratik kullanım.",
    specs: [
      { key: "Tip",        value: "Manyetik hızlı şarj kablosu" },
      { key: "Bağlantı",   value: "USB-C" },
      { key: "Uzunluk",    value: "1 metre" },
      { key: "Uyumluluk",  value: "Apple Watch (hızlı şarj destekli modeller)" },
    ],
    brand: "Apple",
    featured: false
  },
  {
    id: 48,
    variants: [
      { sku: "1400929", color: "Siyah" },
      { sku: "1400928", color: "Beyaz" }
    ],
    name: "Samsung 25W USB-C Hızlı Şarj Adaptörü",
    category: "aksesuar",
    categoryLabel: "Aksesuarlar",
    price: 991.01,
    originalPrice: 1199,
    rating: 0,
    reviewCount: 0,
    badge: "sale",
    badgeLabel: "%17 İndirim",
    stock: 10,
    images: ["assets/images/products/samsung-25w-adapter-1.jpg", "assets/images/products/samsung-25w-adapter-2.jpg", "assets/images/products/samsung-25w-adapter-3.png"],
    desc: "Samsung 25W Süper Hızlı Şarj adaptörü, uyumlu Galaxy cihazlarınızı kısa sürede şarj eder. PPS desteğiyle akıllı güç yönetimi sağlar.",
    specs: [
      { key: "Güç",        value: "25W" },
      { key: "Çıkış",      value: "1× USB-C" },
      { key: "Teknoloji",  value: "USB PD 3.0 + PPS" },
      { key: "Uyumluluk",  value: "Galaxy telefon, tablet ve diğer USB-C cihazlar" },
    ],
    brand: "Samsung",
    featured: false
  },
  {
    id: 49,
    variants: [
      { sku: "1422348", color: "Siyah" }
    ],
    name: "Samsung EP-T4511 45W USB-C Şarj Adaptörü",
    category: "aksesuar",
    categoryLabel: "Aksesuarlar",
    price: 1830,
    originalPrice: 2199,
    rating: 0,
    reviewCount: 0,
    badge: null,
    badgeLabel: null,
    stock: 10,
    images: ["assets/images/products/samsung-45w-adapter-1.jpg", "assets/images/products/samsung-45w-adapter-2.png", "assets/images/products/samsung-45w-adapter-3.jpg"],
    desc: "45W Süper Hızlı Şarj 2.0 desteğiyle Galaxy S ve Tab serisi cihazlarınızı en yüksek hızda şarj edin. Dizüstü bilgisayarlar için de yeterli güç.",
    specs: [
      { key: "Güç",        value: "45W" },
      { key: "Çıkış",      value: "1× USB-C" },
      { key: "Teknoloji",  value: "Süper Hızlı Şarj 2.0, USB PD + PPS" },
      { key: "Uyumluluk",  value: "Galaxy S/Tab serisi, USB-C dizüstü" },
    ],
    brand: "Samsung",
    featured: false
  },
  {
    id: 50,
    variants: [
      { sku: "1387575", color: "Siyah" }
    ],
    name: "Samsung EP-T6530N Üçlü Şarj Adaptörü",
    category: "aksesuar",
    categoryLabel: "Aksesuarlar",
    price: 2803,
    originalPrice: 3399,
    rating: 0,
    reviewCount: 0,
    badge: "sale",
    badgeLabel: "%18 İndirim",
    stock: 10,
    images: ["assets/images/products/samsung-trio-adapter-1.jpg", "assets/images/products/samsung-trio-adapter-2.webp", "assets/images/products/samsung-trio-adapter-3.png"],
    desc: "Üç portlu 65W adaptörle telefon, tablet ve dizüstü bilgisayarınızı aynı anda şarj edin. Seyahatte tek adaptör yeterli.",
    specs: [
      { key: "Güç",        value: "65W (toplam)" },
      { key: "Çıkış",      value: "2× USB-C + 1× USB-A" },
      { key: "Teknoloji",  value: "Süper Hızlı Şarj, USB PD + PPS" },
      { key: "Özellik",    value: "3 cihaz aynı anda" },
    ],
    brand: "Samsung",
    featured: false
  },

  // ══════════════════════════════════════════
  // 🔊 SES & DİĞER
  // ══════════════════════════════════════════

  {
    id: 51,
    variants: [
      { sku: "1432160", color: "Siyah" }
    ],
    name: "Huawei WiFi Mesh X3 Pro",
    category: "ses",
    categoryLabel: "Ses & Diğer",
    price: 8196,
    originalPrice: 9799,
    rating: 0,
    reviewCount: 0,
    badge: "sale",
    badgeLabel: "%16 İndirim",
    stock: 10,
    images: ["assets/images/products/huawei-mesh-x3-pro-1.jpg", "assets/images/products/huawei-mesh-x3-pro-2.jpg", "assets/images/products/huawei-mesh-x3-pro-3.jpg"],
    desc: "Huawei WiFi Mesh X3 Pro, Wi-Fi 7 desteğiyle evinizin her köşesine kesintisiz kapsama sağlar. Ana ünite ve genişletici birlikte çalışır; odalar arasında geçerken bağlantınız kopmaz.",
    specs: [
      { key: "Standart",   value: "Wi-Fi 7 (IEEE 802.11be/ax/ac/n/a), 2 × 2 MIMO" },
      { key: "Hız",        value: "2,4 GHz 688 Mbps + 5 GHz 2882 Mbps (teorik toplam 3570 Mbps)" },
      { key: "Yapı",       value: "Mesh: ana ünite + genişletici, çoklu ünite desteği" },
      { key: "Bağlantı Noktası", value: "10/100/1000/2500 Mbps uyarlanabilir ethernet" },
      { key: "Model",      value: "GAEA2-PLM21" },
      { key: "Özellik",    value: "2 × 2 MU-MIMO, WPA3, ebeveyn kontrolü" },
    ],
    brand: "Huawei",
    featured: false
  },
  {
    id: 52,
    variants: [
      { sku: "1433138", color: "Mavi" }
    ],
    name: "JBL Go 5 Bluetooth Hoparlör",
    category: "ses",
    categoryLabel: "Ses & Diğer",
    price: 2909,
    originalPrice: 3499,
    rating: 0,
    reviewCount: 0,
    badge: "sale",
    badgeLabel: "%17 İndirim",
    stock: 10,
    images: ["assets/images/products/jbl-go5-1.webp", "assets/images/products/jbl-go5-2.webp"],
    desc: "JBL Go 5, avuç içi boyutunda ama JBL Pro Sound gücünde. IP67 su ve toz direnciyle plajda, havuzda ve doğada gönül rahatlığıyla kullanın.",
    specs: [
      { key: "Tip",        value: "Taşınabilir Bluetooth hoparlör" },
      { key: "Ses",        value: "JBL Pro Sound" },
      { key: "Dayanıklılık", value: "IP67 su ve toz direnci" },
      { key: "Bağlantı",   value: "Bluetooth" },
      { key: "Şarj",       value: "USB-C" },
    ],
    brand: "JBL",
    featured: true
  },
  {
    id: 53,
    variants: [
      { sku: "1433141", color: "Siyah" }
    ],
    name: "JBL PartyBox Club 120 Bluetooth Hoparlör",
    category: "ses",
    categoryLabel: "Ses & Diğer",
    price: 24015,
    originalPrice: null,
    rating: 0,
    reviewCount: 0,
    badge: "new",
    badgeLabel: "Yeni",
    stock: 10,
    images: ["assets/images/products/jbl-partybox-club120-1.png", "assets/images/products/jbl-partybox-club120-2.png", "assets/images/products/jbl-partybox-club120-3.png"],
    desc: "PartyBox Club 120, güçlü bası ve senkronize ışık şovuyla partinin merkezine yerleşir. Taşıma kolu ve dahili bataryasıyla eğlenceyi istediğiniz yere götürün.",
    specs: [
      { key: "Tip",        value: "Taşınabilir parti hoparlörü" },
      { key: "Ses",        value: "JBL Pro Sound, güçlü bas" },
      { key: "Özellik",    value: "Senkronize ışık şovu, mikrofon/gitar girişi" },
      { key: "Dayanıklılık", value: "IPX4 su sıçramasına dayanıklı" },
      { key: "Bağlantı",   value: "Bluetooth + Auracast" },
    ],
    brand: "JBL",
    featured: true
  },
  {
    id: 54,
    variants: [
      { sku: "1433821", color: "Gri" }
    ],
    name: "Xiaomi Smart Projector L1",
    category: "ses",
    categoryLabel: "Ses & Diğer",
    price: 13998.96,
    originalPrice: 16999,
    rating: 0,
    reviewCount: 0,
    badge: "sale",
    badgeLabel: "%18 İndirim",
    stock: 10,
    images: ["assets/images/products/xiaomi-projector-l1-1.jpg", "assets/images/products/xiaomi-projector-l1-2.jpg", "assets/images/products/xiaomi-projector-l1-3.webp"],
    desc: "Xiaomi Smart Projector L1, Full HD çözünürlüğü ve dahili akıllı TV platformuyla evinizi sinema salonuna çevirir. Otomatik odak ve keystone düzeltmesiyle kurulumu saniyeler sürer.",
    specs: [
      { key: "Çözünürlük", value: "Full HD 1080p" },
      { key: "Platform",   value: "Dahili akıllı TV sistemi" },
      { key: "Kurulum",    value: "Otomatik odak + keystone düzeltme" },
      { key: "Ses",        value: "Dahili hoparlör" },
      { key: "Bağlantı",   value: "HDMI, USB, Wi-Fi, Bluetooth" },
    ],
    brand: "Xiaomi",
    featured: true
  }
];

/* ═════════════════════════════════════════
   SUNUCU KATALOĞU (Firestore → /api/catalog)
   ═════════════════════════════════════════
   Admin panelinden eklenen/düzenlenen ürünler artık tarayıcının
   localStorage'ında değil, Firestore'da durur — böylece tek bir tarayıcıya
   bağlı kalmaz, her ziyaretçi aynı katalogu görür.

   Katmanlar (soldan sağa öncelik artar):
     BASE_PRODUCTS  →  localStorage (eski panelden kalan)  →  Firestore

   Ağ yavaşsa/kapalıysa site statik listeyle çalışmaya devam eder; ilk
   boyamayı hızlandırmak için son başarılı yanıt kısa süre önbelleklenir. */

const CATALOG_API       = '/api/catalog';
const CATALOG_CACHE_KEY = 'efemi_catalog_cache';
const CATALOG_CACHE_TTL = 5 * 60 * 1000;

let SERVER_PRODUCTS = readCatalogCache();

function readCatalogCache() {
  try {
    const raw = JSON.parse(sessionStorage.getItem(CATALOG_CACHE_KEY));
    if (!raw || !Array.isArray(raw.products)) return [];
    if (Date.now() - raw.savedAt > CATALOG_CACHE_TTL) return [];
    return raw.products;
  } catch { return []; }
}

function writeCatalogCache(products) {
  try {
    sessionStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), products }));
  } catch { /* özel mod / kota: önbellek olmadan da çalışır */ }
}

function buildProducts() {
  const merged = new Map();
  for (const p of applyProductOverrides([...BASE_PRODUCTS, ...getAdminProducts()])) merged.set(p.id, p);
  for (const p of SERVER_PRODUCTS) {
    const id = Number(p.id);
    if (!Number.isInteger(id)) continue;
    // Firestore kaydı eksiksizdir; statik kaydın üzerine tamamen biner.
    merged.set(id, { ...merged.get(id), ...p, id });
  }
  return [...merged.values()];
}

/* ─── PRODUCTS: Statik + Admin ürünlerini birleştir, düzenlemeleri uygula ─── */
let PRODUCTS = buildProducts();

/* ─── PRODUCTS'ı yenile (admin değişikliklerinden sonra) ─── */
function refreshProducts() {
  PRODUCTS = buildProducts();
}

/* Sunucu katalogunu çeker. Hata durumunda sessizce statik listede kalır —
   katalog servisi düşse bile site gezilebilir olmalı. */
const productsReady = (async function loadServerCatalog() {
  if (typeof fetch !== 'function') return PRODUCTS;
  try {
    const res  = await fetch(CATALOG_API, { headers: { Accept: 'application/json' } });
    if (!res.ok) return PRODUCTS;
    const data = await res.json();
    if (!data || !Array.isArray(data.products)) return PRODUCTS;

    SERVER_PRODUCTS = data.products;
    writeCatalogCache(data.products);
    refreshProducts();
    document.dispatchEvent(new CustomEvent('products:updated', { detail: { count: data.products.length } }));
  } catch (err) {
    console.warn('[katalog] sunucu katalogu okunamadı, statik liste kullanılıyor:', err.message);
  }
  return PRODUCTS;
})();

/* Admin paneli bir ürünü kaydettikten sonra listeyi elindeki taze veriyle
   günceller; ayrı bir tur atmaya gerek kalmaz. */
function setServerProducts(list) {
  SERVER_PRODUCTS = Array.isArray(list) ? list : [];
  writeCatalogCache(SERVER_PRODUCTS);
  refreshProducts();
}

/* Sayfa kodu hem DOM'u hem katalogu bekler.
   Kullanım:  whenCatalogReady(() => { ...çizim... });                      */
function whenCatalogReady(fn) {
  const domReady = document.readyState === 'loading'
    ? new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve))
    : Promise.resolve();

  Promise.all([domReady, productsReady]).then(() => fn());
}

/* ─── Yardımcı: ID ile ürün bul ─── */
function getProductById(id) {
  return PRODUCTS.find(p => p.id === parseInt(id));
}

/* ═════════════════════════════════════════
   VARYANTLAR (renk / beden)
   ═════════════════════════════════════════ */

/* Renk adı → swatch rengi. Eşleşmeyen renk için nötr gri döner. */
const COLOR_SWATCHES = {
  'Siyah': '#1C1C1E', 'Jet Siyah': '#0B0B0D', 'Gece Siyahı': '#141418',
  'Obsidyen Siyah': '#16161A', 'Ghost Siyah': '#2B2B30', 'Gece Yarısı': '#1F2937',
  'Beyaz': '#F5F5F7', 'Bulut Beyazı': '#FAFAFA', 'Yıldız Işığı': '#F0E6D8',
  'Gri': '#8E8E93', 'Uzay Grisi': '#4A4A4F', 'Gümüş': '#D6D6DB', 'Mat Gümüş': '#C9CBD1',
  'Titanyum': '#9A9A9F', 'Natürel Titanyum': '#BFB9AE',
  'Altın': '#D4AF6A', 'Açık Altın': '#E5CFA3', 'Roze Altın': '#E0B2A6',
  'Bej': '#DCCDB4', 'Ghost Bej': '#D8CBB6', 'Kahverengi': '#7A5844',
  'Mavi': '#2563EB', 'Buzul Mavisi': '#A8CBE0', 'Turkuaz': '#2FBFBF',
  'Yeşil': '#3F7D52', 'Mor': '#7C4DBE', 'Ghost Mor': '#9A7BC8', 'Lavanta': '#C7B6E6',
  'Pembe': '#F2B8C6', 'Kırmızı': '#C8102E', 'Bright Guava': '#F4526B'
};

function colorSwatch(name) {
  return COLOR_SWATCHES[name] || '#9CA3AF';
}

/* Ürünün varyantları var mı (her ürüne en az 1 varyant yazıldı) */
function getVariants(product) {
  return Array.isArray(product?.variants) ? product.variants : [];
}

/* Seçim gerektiren ürün: birden fazla renk veya beden seçeneği varsa */
function hasVariantChoice(product) {
  const v = getVariants(product);
  return getVariantColors(product).length > 1 || getVariantSizes(product).length > 1;
}

function getVariantColors(product) {
  return [...new Set(getVariants(product).map(v => v.color).filter(Boolean))];
}

function getVariantSizes(product) {
  return [...new Set(getVariants(product).map(v => v.size).filter(Boolean))];
}

/* Bir renk için gerçekten stokta olan bedenler (her kombinasyon mevcut değil) */
function getSizesForColor(product, color) {
  return [...new Set(
    getVariants(product).filter(v => v.color === color).map(v => v.size).filter(Boolean)
  )];
}

/* Renk + beden → varyant. Beden yoksa sadece renge göre eşleşir. */
function findVariant(product, color, size) {
  return getVariants(product).find(v =>
    (!color || v.color === color) && ((!size && !v.size) || v.size === size)
  ) || null;
}

/* Varyantın müşteriye gösterilecek etiketi: "Siyah · S/M" */
function variantLabel(variant, product) {
  if (!variant) return '';
  const parcalar = [];
  if (variant.color) parcalar.push(variant.color);
  if (variant.size)  parcalar.push(variant.size);
  return parcalar.join(' · ');
}

/* Tek seçenekli ürünlerde otomatik seçilecek varyant */
function defaultVariant(product) {
  const v = getVariants(product);
  return v.length ? v[0] : null;
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
