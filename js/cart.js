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

/* ─── Sepeti kaydet ─── */
function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartBadge();
  dispatchCartEvent(cart);
}

/* ─── Ürün ekle ─── */
function addToCart(productId, quantity = 1) {
  const product = getProductById(productId);
  if (!product) return false;

  const cart = getCart();
  const existingIndex = cart.findIndex(item => item.id === productId);

  if (existingIndex >= 0) {
    cart[existingIndex].qty = Math.min(
      cart[existingIndex].qty + quantity,
      product.stock
    );
  } else {
    cart.push({
      id:       product.id,
      name:     product.name,
      category: product.categoryLabel,
      price:    product.price,
      image:    product.images[0],
      qty:      Math.min(quantity, product.stock),
      stock:    product.stock
    });
  }

  saveCart(cart);
  showToast(`"${product.name}" sepete eklendi!`, 'success');
  return true;
}

/* ─── Ürün çıkar ─── */
function removeFromCart(productId) {
  const cart = getCart().filter(item => item.id !== productId);
  saveCart(cart);
  showToast('Ürün sepetten çıkarıldı.', 'warning');
}

/* ─── Miktar güncelle ─── */
function updateCartQty(productId, newQty) {
  const cart = getCart();
  const idx  = cart.findIndex(item => item.id === productId);
  if (idx < 0) return;

  if (newQty <= 0) {
    removeFromCart(productId);
    return;
  }

  cart[idx].qty = Math.min(newQty, cart[idx].stock);
  saveCart(cart);
}

/* ─── Sepeti temizle ─── */
function clearCart() {
  saveCart([]);
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

/* ─── Kupon ─── */
const COUPONS = {
  'EFEMI10':   { type: 'percent', value: 10,   label: '%10 İndirim' },
  'EFEMI50':   { type: 'fixed',   value: 50,   label: '50₺ İndirim' },
  'HOSGELDIN': { type: 'percent', value: 15,   label: '%15 Hoş Geldin İndirimi' }
};

function applyCoupon(code) {
  const coupon = COUPONS[code.trim().toUpperCase()];
  if (!coupon) return { valid: false, msg: 'Geçersiz kupon kodu.' };
  const subtotal = getCartSubtotal();
  const discount = coupon.type === 'percent'
    ? Math.round(subtotal * coupon.value / 100)
    : coupon.value;
  return { valid: true, coupon, discount, msg: coupon.label + ' uygulandı!' };
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

/* ─── Sepet HTML oluştur ─── */
function renderCartItem(item) {
  return `
    <div class="cart-item" data-id="${item.id}">
      <img class="cart-item-img" src="${item.image}" alt="${item.name}"
           onerror="this.src='assets/images/placeholder.jpg'">
      <div class="cart-item-info">
        <div class="name">${item.name}</div>
        <div class="cat">${item.category}</div>
        <div style="margin-top:8px; font-weight:700; color:var(--primary)">
          ${formatPrice(item.price)}
        </div>
      </div>
      <div class="qty-control">
        <button class="qty-btn" onclick="changeQty(${item.id}, -1)">−</button>
        <span class="qty-num">${item.qty}</span>
        <button class="qty-btn" onclick="changeQty(${item.id}, 1)">+</button>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
        <div style="font-weight:700;font-size:1.125rem">
          ${formatPrice(item.price * item.qty)}
        </div>
        <button class="btn btn-ghost btn-sm" onclick="removeItem(${item.id})"
                style="color:var(--error);border-color:var(--error)">
          🗑 Kaldır
        </button>
      </div>
    </div>
  `;
}

/* ─── Miktar değiştir (sepet sayfasında) ─── */
function changeQty(productId, delta) {
  const cart = getCart();
  const item = cart.find(i => i.id === productId);
  if (!item) return;
  updateCartQty(productId, item.qty + delta);
  if (typeof renderCartPage === 'function') renderCartPage();
}

/* ─── Sil (sepet sayfasında) ─── */
function removeItem(productId) {
  removeFromCart(productId);
  if (typeof renderCartPage === 'function') renderCartPage();
}
