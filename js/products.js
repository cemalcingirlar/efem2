/* =========================================
   efemiletisim.com – Ürün Bileşenleri
   ========================================= */

/* ─── Ürün Kartı HTML ─── */
function createProductCard(product) {
  const discount = discountPercent(product.originalPrice, product.price);
  const badgeHTML = product.badge ? `
    <div class="product-badges">
      <span class="product-badge badge-${product.badge}">${product.badgeLabel}</span>
    </div>` : '';

  const originalPriceHTML = product.originalPrice ? `
    <span class="price-original">${formatPrice(product.originalPrice)}</span>
    <span class="price-discount">%${discount}</span>` : '';

  // Kartta renk seçeneklerini göster (en fazla 5 nokta, fazlası "+N")
  const renkler = getVariantColors(product);
  const swatchesHTML = renkler.length > 1 ? `
    <div class="product-swatches" title="${renkler.join(' · ')}">
      ${renkler.slice(0, 5).map(c => `
        <span class="product-swatch" style="background:${colorSwatch(c)}"></span>`).join('')}
      ${renkler.length > 5 ? `<span class="product-swatch-more">+${renkler.length - 5}</span>` : ''}
    </div>` : '';

  const hasGallery = product.images.length > 1;
  const dotsHTML = hasGallery ? `
    <div class="product-img-dots">
      ${product.images.map((_, i) => `<span class="dot ${i === 0 ? 'active' : ''}"></span>`).join('')}
    </div>` : '';

  return `
    <div class="product-card" onclick="window.location='urun-detay.html?id=${product.id}'">
      <div class="product-img-wrap"
           ${hasGallery ? `onmouseenter="startCardImageCycle(this, ${product.id})" onmouseleave="stopCardImageCycle(this, ${product.id})"` : ''}>
        <img src="${product.images[0]}"
             alt="${product.name}"
             loading="lazy"
             onerror="this.src='assets/images/products/placeholder-product.svg'">
        ${dotsHTML}
        ${badgeHTML}
        <button class="product-fav ${isFavorite(product.id) ? 'active' : ''}"
                onclick="event.stopPropagation(); toggleFavorite(${product.id}, this)"
                title="Favorilere ekle">
          <svg class="icon" viewBox="0 0 24 24" ${isFavorite(product.id) ? 'fill="currentColor"' : ''}><path d="M12 21s7-6.5 7-11a7 7 0 1 0-14 0c0 4.5 7 11 7 11Z"/></svg>
        </button>
        <span class="product-quick-view"
              onclick="event.stopPropagation(); window.location='urun-detay.html?id=${product.id}'">
          <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg> Hızlı İncele
        </span>
      </div>
      <div class="product-body">
        <div class="product-category">${product.categoryLabel}</div>
        <div class="product-name">${product.name}</div>
        ${product.reviewCount > 0 ? `
        <div class="product-rating">
          <span class="stars">${'★'.repeat(Math.floor(product.rating))}${'☆'.repeat(5 - Math.floor(product.rating))}</span>
          <span style="font-weight:600;color:var(--text-primary)">${product.rating}</span>
          <span class="rating-count">(${product.reviewCount})</span>
        </div>` : `
        <div class="product-rating">
          <span class="rating-count">Henüz değerlendirilmedi</span>
        </div>`}
        ${swatchesHTML}
        <div class="product-price-row">
          <span class="price-current">${formatPrice(product.price)}</span>
          ${originalPriceHTML}
        </div>
        ${hasVariantChoice(product) ? `
        <button class="product-add-btn"
                onclick="event.stopPropagation(); window.location='urun-detay.html?id=${product.id}'">
          <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></svg> Seçenekleri Gör
        </button>` : `
        <button class="product-add-btn"
                onclick="event.stopPropagation(); handleAddToCart(${product.id}, this)">
          <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M6 8h12l-1 12H7L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg> Sepete Ekle
        </button>`}
      </div>
    </div>
  `;
}

/* ─── Ürün kartı: hover'da görsel galerisi geçişi ─── */
const cardCycleTimers = new WeakMap();

function startCardImageCycle(wrapEl, productId) {
  const product = PRODUCTS.find(p => p.id === productId);
  if (!product || product.images.length <= 1) return;

  const img  = wrapEl.querySelector('img');
  const dots = wrapEl.querySelectorAll('.product-img-dots .dot');
  let idx = 0;

  const timer = setInterval(() => {
    idx = (idx + 1) % product.images.length;
    img.src = product.images[idx];
    dots.forEach((d, i) => d.classList.toggle('active', i === idx));
  }, 3000);

  cardCycleTimers.set(wrapEl, timer);
}

function stopCardImageCycle(wrapEl, productId) {
  const timer = cardCycleTimers.get(wrapEl);
  if (timer) { clearInterval(timer); cardCycleTimers.delete(wrapEl); }

  const product = PRODUCTS.find(p => p.id === productId);
  if (!product) return;

  const img  = wrapEl.querySelector('img');
  const dots = wrapEl.querySelectorAll('.product-img-dots .dot');
  img.src = product.images[0];
  dots.forEach((d, i) => d.classList.toggle('active', i === 0));
}

/* ─── Sepete ekle + animasyon ─── */
function handleAddToCart(productId, btn) {
  const success = addToCart(productId);
  if (success && btn) {
    btn.classList.add('added');
    btn.innerHTML = '<svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M4 12.5l5 5L20 6"/></svg> Eklendi';
    setTimeout(() => {
      btn.classList.remove('added');
      btn.innerHTML = '<svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M6 8h12l-1 12H7L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg> Sepete Ekle';
    }, 1500);
  }
}

/* ─── Favoriler (localStorage) ─── */
const FAV_KEY = 'efemi_favorites';

function getFavorites() {
  try { return JSON.parse(localStorage.getItem(FAV_KEY)) || []; }
  catch { return []; }
}

function isFavorite(productId) {
  return getFavorites().includes(productId);
}

function toggleFavorite(productId, btn) {
  const favs = getFavorites();
  const idx  = favs.indexOf(productId);
  const heartSvg = fill => `<svg class="icon" viewBox="0 0 24 24" ${fill ? 'fill="currentColor"' : ''}><path d="M12 21s7-6.5 7-11a7 7 0 1 0-14 0c0 4.5 7 11 7 11Z"/></svg>`;
  if (idx >= 0) {
    favs.splice(idx, 1);
    if (btn) { btn.innerHTML = heartSvg(false); btn.classList.remove('active'); }
    showToast('Favorilerden kaldırıldı.', 'warning');
  } else {
    favs.push(productId);
    if (btn) { btn.innerHTML = heartSvg(true); btn.classList.add('active'); }
    showToast('Favorilere eklendi!', 'success');
  }
  localStorage.setItem(FAV_KEY, JSON.stringify(favs));
}

/* ─── Ürün Listesi Render ─── */
function renderProductGrid(products, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (products.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="icon"><svg class="icon" viewBox="0 0 24 24" style="width:3rem;height:3rem"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg></div>
        <h3>Ürün bulunamadı</h3>
        <p>Farklı filtreler deneyebilirsiniz.</p>
      </div>`;
    return;
  }

  container.innerHTML = products.map(createProductCard).join('');
}

/* ─── Filtreleme & Sıralama ─── */
let currentFilters = {
  category:  'all',
  brand:     'all',
  minPrice:  0,
  maxPrice:  Infinity,
  minRating: 0,
  sort:      'featured'
};

function applyFilters(filtersUpdate) {
  Object.assign(currentFilters, filtersUpdate);

  let filtered = [...PRODUCTS];

  // Kategori
  if (currentFilters.category !== 'all') {
    filtered = filtered.filter(p => p.category === currentFilters.category);
  }

  // Marka
  if (currentFilters.brand !== 'all') {
    filtered = filtered.filter(p => p.brand === currentFilters.brand);
  }

  // Fiyat aralığı
  filtered = filtered.filter(p =>
    p.price >= currentFilters.minPrice && p.price <= currentFilters.maxPrice
  );

  // Puan
  filtered = filtered.filter(p => p.rating >= currentFilters.minRating);

  // Sıralama
  switch (currentFilters.sort) {
    case 'price-asc':  filtered.sort((a,b) => a.price - b.price); break;
    case 'price-desc': filtered.sort((a,b) => b.price - a.price); break;
    case 'rating':     filtered.sort((a,b) => b.rating - a.rating); break;
    case 'newest':     filtered.sort((a,b) => b.id - a.id); break;
    case 'featured':   filtered.sort((a,b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0)); break;
  }

  return filtered;
}

/* ─── Anlık arama (navbar) ─── */
function initSearch() {
  const input    = document.getElementById('search-input');
  const dropdown = document.getElementById('search-dropdown');
  if (!input || !dropdown) return;

  let timeout;
  input.addEventListener('input', () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      const results = searchProducts(input.value);
      renderSearchDropdown(results, dropdown, input.value);
    }, 200);
  });

  input.addEventListener('focus', () => {
    if (input.value.trim()) dropdown.classList.add('active');
  });

  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.remove('active');
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && input.value.trim()) {
      dropdown.classList.remove('active');
      window.location.href = `urunler.html?q=${encodeURIComponent(input.value.trim())}`;
    }
  });
}

function renderSearchDropdown(results, dropdown, query) {
  if (!query.trim()) { dropdown.classList.remove('active'); return; }

  dropdown.classList.add('active');

  if (results.length === 0) {
    dropdown.innerHTML = `<div class="search-no-result">"${query}" için sonuç bulunamadı</div>`;
    return;
  }

  dropdown.innerHTML = results.map(p => `
    <a class="search-result-item" href="urun-detay.html?id=${p.id}">
      <img class="search-result-img" src="${p.images[0]}" alt="${p.name}"
           onerror="this.src='assets/images/products/placeholder-product.svg'">
      <div class="search-result-info">
        <div class="name">${p.name}</div>
        <div class="price">${formatPrice(p.price)}</div>
      </div>
    </a>
  `).join('');
}

/* ─── Tüm Markalar ─── */
function getUniqueBrands(category = 'all') {
  const products = category === 'all' ? PRODUCTS : PRODUCTS.filter(p => p.category === category);
  return [...new Set(products.map(p => p.brand))].sort();
}
