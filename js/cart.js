/* =========================================
   efemiletisim.com – Sepet Yönetimi
   ========================================= */

const CART_KEY    = 'efemi_cart';
const FREE_SHIP   = 0; // Tüm ürünlerde ücretsiz kargo

/* ─── Sepeti oku ─── */
function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch { return []; }
}

/* ─── Sepeti kaydet ───
   Sepet her değiştiğinde uygulanan kupon düşürülür: kupon minimum sepet
   tutarına bağlı olabilir, eski indirim yeni sepette geçersiz olabilir.
   Müşteri kodu yeniden girer, sunucu yeniden doğrular. */
function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  clearAppliedCoupon();
  updateCartBadge();
  dispatchCartEvent(cart);
}

/* ─── Sepet satırı anahtarı ───
   Aynı ürünün farklı renk/bedeni ayrı satır olmalı; bu yüzden sepet
   satırları ürün id'si değil, varyantın Malzeme kodu (sku) ile ayrışır.
   Varyantsız/eski kayıtlar için id'ye düşer. */
function cartLineKey(productId, sku) {
  return sku ? `${productId}::${sku}` : String(productId);
}

function findCartLine(cart, key) {
  return cart.findIndex(item => cartLineKey(item.id, item.sku) === key);
}

/* ─── Ürün ekle ───
   variant: { sku, color, size? } — ürün detayında seçilen varyant.
   Verilmezse tek varyantlı üründe otomatik seçilir. */
function addToCart(productId, quantity = 1, variant = null) {
  const product = getProductById(productId);
  if (!product) return false;

  const secili = variant || defaultVariant(product);

  // Birden fazla seçenek varsa seçim yapılmadan sepete eklenemez
  if (!variant && hasVariantChoice(product)) {
    showToast('Lütfen renk ve beden seçin.', 'warning');
    return false;
  }

  const cart = getCart();
  const key  = cartLineKey(product.id, secili?.sku);
  const idx  = findCartLine(cart, key);

  if (idx >= 0) {
    cart[idx].qty = Math.min(cart[idx].qty + quantity, product.stock);
  } else {
    cart.push({
      id:       product.id,
      name:     product.name,
      category: product.categoryLabel,
      price:    product.price,
      image:    product.images[0],
      qty:      Math.min(quantity, product.stock),
      stock:    product.stock,
      sku:      secili?.sku  || null,
      color:    secili?.color || null,
      size:     secili?.size  || null
    });
  }

  saveCart(cart);
  const ek = secili && variantLabel(secili) ? ` (${variantLabel(secili)})` : '';
  showToast(`"${product.name}"${ek} sepete eklendi!`, 'success');
  return true;
}

/* ─── Ürün çıkar ─── */
function removeFromCart(key) {
  const cart = getCart().filter(item => cartLineKey(item.id, item.sku) !== String(key));
  saveCart(cart);
  showToast('Ürün sepetten çıkarıldı.', 'warning');
}

/* ─── Miktar güncelle ─── */
function updateCartQty(key, newQty) {
  const cart = getCart();
  const idx  = findCartLine(cart, String(key));
  if (idx < 0) return;

  if (newQty <= 0) {
    removeFromCart(key);
    return;
  }

  cart[idx].qty = Math.min(newQty, cart[idx].stock);
  saveCart(cart);
}

/* ─── Sepeti temizle ─── */
function clearCart() {
  saveCart([]);
}

/* ─── Sepet satırlarını güncel katalogla tazele ───
   Sepet satırı eklendiği andaki fiyatı/adı saklar. Ürün yönetimi Firestore'a
   taşındığından fiyat, sepet açıkken de değişebilir. Sunucu siparişi HER
   ZAMAN kendi kataloğundan fiyatladığı için burada güncellememek tahsil
   edilen tutarı değiştirmez — ama müşteriye eski tutarı gösterirdi. Bu yüzden
   katalog yüklendiğinde satırlar sessizce tazelenir.

   Satılmayan hâle gelen ürün sepetten düşürülür; aksi hâlde ödeme adımında
   "artık satışta olmayan bir ürün var" hatasıyla karşılaşırdı. */
function syncCartWithCatalog() {
  const cart = getCart();
  if (!cart.length) return { changed: false, removed: 0, repriced: 0 };

  let repriced = 0;
  const next = [];

  for (const item of cart) {
    const product = getProductById(item.id);
    if (!product) continue;                       // katalogdan kalkmış

    // Varyantlı üründe sepetteki sku hâlâ satılıyor olmalı
    const variants = getVariants(product);
    if (variants.length && item.sku && !variants.some(v => v.sku === item.sku)) continue;

    if (item.price !== product.price || item.name !== product.name) repriced++;
    next.push({ ...item, name: product.name, price: product.price, image: product.images[0] });
  }

  const removed = cart.length - next.length;
  if (!removed && !repriced) return { changed: false, removed: 0, repriced: 0 };

  /* saveCart() kuponu düşürür — fiyat değiştiyse kuponun yeniden
     doğrulanması zaten doğru davranış. */
  saveCart(next);
  return { changed: true, removed, repriced };
}

/* ─── Toplam ürün sayısı (badge için) ─── */
function getCartCount() {
  return getCart().reduce((sum, item) => sum + item.qty, 0);
}

/* ─── Ara toplam ─── */
function getCartSubtotal() {
  return getCart().reduce((sum, item) => sum + item.price * item.qty, 0);
}

/* ─── Kargo hesapla ─── */
function getShippingCost() {
  return FREE_SHIP; // Tüm ürünlerde ücretsiz
}

/* ═════════════════════════════════════════
   KUPON
   ═════════════════════════════════════════
   Kupon tanımları artık kodun içinde DEĞİL, Firestore'da (`coupons`
   koleksiyonu) durur ve admin panelinden yönetilir. Tarayıcı kupon
   listesini hiç görmez; yalnız girilen kodu sunucuya sorar.

   Buradaki indirim SADECE GÖSTERİM içindir. Siparişin gerçek tutarı
   ödeme başlatılırken sunucuda yeniden hesaplanır (api/_lib/coupons.js);
   bu değişkenlerle oynamak ödenecek tutarı değiştirmez.

   Sepet değişince kupon düşürülür: ürün çıkarıp minimum tutarın altına
   inen bir sepette eski indirimin gösterilmeye devam etmesi, müşteriye
   ödeme adımında sürpriz yapardı.                                        */

const COUPON_API = '/api/coupon/validate';
const COUPON_KEY = 'efemi_coupon';

function cartLinesForServer() {
  return getCart().map(item => ({ id: item.id, sku: item.sku || null, qty: item.qty }));
}

/* Ödeme adımının okuduğu tek alan: uygulanan kupon KODU. */
function getAppliedCouponCode() {
  try { return sessionStorage.getItem(COUPON_KEY) || ''; }
  catch { return ''; }
}

function setAppliedCouponCode(code) {
  try {
    if (code) sessionStorage.setItem(COUPON_KEY, code);
    else sessionStorage.removeItem(COUPON_KEY);
  } catch { /* özel mod: kupon oturum boyunca hatırlanmaz */ }
}

function clearAppliedCoupon() {
  setAppliedCouponCode('');
}

/* Dönüş: { valid: true, code, label, discount, msg } | { valid: false, msg } */
async function applyCoupon(code) {
  const key = String(code || '').trim().toUpperCase();
  if (!key) return { valid: false, msg: 'Lütfen bir kupon kodu girin.' };

  const items = cartLinesForServer();
  if (!items.length) return { valid: false, msg: 'Sepetiniz boş.' };

  let res, data;
  try {
    res = await fetch(COUPON_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: key, items })
    });
    data = await res.json();
  } catch {
    return { valid: false, msg: 'Kupon doğrulanamadı. Lütfen bağlantınızı kontrol edip tekrar deneyin.' };
  }

  if (!res.ok || !data || !data.ok) {
    clearAppliedCoupon();
    return { valid: false, msg: (data && data.message) || 'Kupon uygulanamadı.' };
  }

  setAppliedCouponCode(data.code);
  return {
    valid:    true,
    code:     data.code,
    label:    data.label,
    discount: data.discountKurus / 100,
    msg:      `${data.label} uygulandı!`
  };
}

/* ─── Toplam (kupon dahil) ─── */
function getCartTotal(discount = 0) {
  return Math.max(0, getCartSubtotal() + getShippingCost() - discount);
}

/* ─── Badge güncelle ─── */
function updateCartBadge() {
  const count = getCartCount();
  document.querySelectorAll('.cart-badge').forEach(badge => {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
    if (count > 0) {
      badge.style.animation = 'none';
      badge.offsetHeight; // reflow
      badge.style.animation = 'badgePop 0.3s ease';
    }
  });
  document.querySelectorAll('.cart-count-text').forEach(el => {
    el.textContent = count;
  });
}

/* ─── Cart event ─── */
function dispatchCartEvent(cart) {
  window.dispatchEvent(new CustomEvent('cartUpdated', { detail: { cart } }));
}

/* ─── Seçilen varyantı rozet olarak göster (renk noktası + beden) ─── */
function cartVariantBadge(item) {
  if (!item.color && !item.size) return '';
  const nokta = item.color
    ? `<span style="display:inline-block;width:11px;height:11px;border-radius:50%;
         background:${colorSwatch(item.color)};border:1px solid var(--border);
         vertical-align:-1px;margin-right:5px"></span>`
    : '';
  const metin = [item.color, item.size].filter(Boolean).join(' · ');
  return `<div class="cart-item-variant" style="margin-top:4px;font-size:0.8125rem;color:var(--text-muted)">
            ${nokta}${metin}
          </div>`;
}

/* ─── Sepet HTML oluştur ─── */
function renderCartItem(item) {
  const key = cartLineKey(item.id, item.sku);
  return `
    <div class="cart-item" data-key="${key}">
      <img class="cart-item-img" src="${item.image}" alt="${item.name}"
           onerror="this.src='assets/images/products/placeholder-product.svg'"
           onclick="window.location='urun-detay.html?id=${item.id}'" style="cursor:pointer">
      <div class="cart-item-info" onclick="window.location='urun-detay.html?id=${item.id}'" style="cursor:pointer">
        <div class="name">${item.name}</div>
        <div class="cat">${item.category}</div>
        ${cartVariantBadge(item)}
        <div style="margin-top:8px; font-weight:700; color:var(--primary)">
          ${formatPrice(item.price)}
        </div>
      </div>
      <div class="qty-control">
        <button class="qty-btn" onclick="changeQty('${key}', -1)">−</button>
        <span class="qty-num">${item.qty}</span>
        <button class="qty-btn" onclick="changeQty('${key}', 1)">+</button>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
        <div style="font-weight:700;font-size:1.125rem">
          ${formatPrice(item.price * item.qty)}
        </div>
        <button class="btn btn-ghost btn-sm" onclick="removeItem('${key}')"
                style="color:var(--error);border-color:var(--error)">
          <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/><path d="M10 11v6M14 11v6"/></svg> Kaldır
        </button>
      </div>
    </div>
  `;
}

/* ─── Miktar değiştir (sepet sayfasında) ─── */
function changeQty(key, delta) {
  const cart = getCart();
  const item = cart[findCartLine(cart, String(key))];
  if (!item) return;
  updateCartQty(key, item.qty + delta);
  if (typeof renderCartPage === 'function') renderCartPage();
}

/* ─── Sil (sepet sayfasında) ─── */
function removeItem(key) {
  removeFromCart(key);
  if (typeof renderCartPage === 'function') renderCartPage();
}
