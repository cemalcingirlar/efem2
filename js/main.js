/* =========================================
   efemiletisim.com – Ana JS (Ortak)
   ========================================= */

/* ─── Toast Bildirimi ─── */
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = {
    success: '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9"/></svg>',
    error:   '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></svg>',
    warning: '<svg class="icon" viewBox="0 0 24 24"><path d="M12 3l10 18H2L12 3Z"/><path d="M12 9v5"/><circle cx="12" cy="17.3" r="0.3" fill="currentColor" stroke="none"/></svg>',
    info:    '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/></svg>'
  };
  const id = 'toast-' + Date.now();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.id = id;
  /* Kapatma düğmesi inline onclick yerine addEventListener ile bağlanır:
     inline handler'lar sıkı CSP altında (script-src'de 'unsafe-inline' yokken)
     sessizce çalışmaz. Ödeme sayfası bu sıkı politikayla servis ediliyor. */
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-msg">${message}</span>
    <button class="toast-close" type="button" aria-label="Bildirimi kapat"><svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
  `;
  toast.querySelector('.toast-close').addEventListener('click', () => closeToast(id));

  container.appendChild(toast);
  setTimeout(() => closeToast(id), 3500);
}

function closeToast(id) {
  const toast = document.getElementById(id);
  if (toast) {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }
}

/* ─── Navbar scroll efekti ─── */
function initNavbar() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;

  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 20);
  }, { passive: true });

  // Hamburger menu
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobile-menu');

  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('open');
      mobileMenu.classList.toggle('open');
    });
  }

  // Aktif link
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link').forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });

  // Navbar oturum durumunu js/auth.js modülü kendisi yönetir.
  updateCartBadge();

  // Arama kutusu her sayfada bulunmaz; varsa products.js yüklenmiş olmalıdır.
  if (document.getElementById('search-input')) {
    if (typeof initSearch !== 'function') {
      throw new Error('initNavbar: sayfada arama kutusu var ancak js/products.js yüklenmemiş.');
    }
    initSearch();
  }
}

/* ─── Görünür alanda mı? (above-the-fold elemanları IntersectionObserver'ın
   ilk kontrolünü beklemeden hemen göstermek için) ─── */
function isInViewport(el, thresholdRatio = 0) {
  const rect = el.getBoundingClientRect();
  const vh = window.innerHeight || document.documentElement.clientHeight;
  const visible = Math.min(rect.bottom, vh) - Math.max(rect.top, 0);
  return visible > rect.height * thresholdRatio;
}

/* ─── Scroll animasyon (Intersection Observer) ───
   Sayfa ilk yüklendiğinde zaten görünür alanda olan elemanlar (above-the-fold)
   observer'ın ilk callback'ini beklemeden hemen animasyona başlar; aksi halde
   yavaş bağlantılarda/yeniden çizimlerde kullanıcı scroll edene kadar soluk kalabiliyor. */
function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-fade-in');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.product-card, .category-card, .feature-item').forEach(el => {
    // Above-the-fold: zaten görünür, giriş animasyonuna gerek yok — dokunma.
    if (isInViewport(el, 0.1)) return;
    el.style.opacity = '0';
    observer.observe(el);
  });
}

/* ─── Magnetic buton (imleç yönünde hafif çekim) ─── */
function initMagneticButtons() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.matchMedia('(pointer: fine)').matches) return;

  const MAX_OFFSET = 10;
  const STRENGTH = 0.35;

  document.querySelectorAll('.hero-actions .btn').forEach(el => {
    el.addEventListener('mouseenter', () => { el.style.transition = 'transform 200ms var(--ease-spring)'; });
    el.addEventListener('mousemove', (e) => {
      const rect = el.getBoundingClientRect();
      const dx = (e.clientX - rect.left - rect.width / 2) * STRENGTH;
      const dy = (e.clientY - rect.top - rect.height / 2) * STRENGTH;
      const clampedX = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, dx));
      const clampedY = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, dy));
      el.style.transition = 'transform 60ms linear';
      el.style.transform = `translate(${clampedX}px, ${clampedY - 2}px)`;
    });
    el.addEventListener('mouseleave', () => {
      el.style.transition = 'transform 500ms var(--ease-spring)';
      el.style.transform = '';
    });
  });
}

/* ─── Sayaç animasyonu (hero istatistikleri) ─── */
function initStatCounters() {
  const nums = document.querySelectorAll('.hero-stat .num');
  if (!nums.length) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const animate = (el) => {
    const text = el.textContent;
    const match = text.match(/\d+/);
    if (!match || match[0] === '0') return;
    const target = parseInt(match[0], 10);
    const before = text.slice(0, match.index);
    const after = text.slice(match.index + match[0].length);
    const duration = 1100;
    const start = performance.now();

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = before + Math.round(target * eased) + after;
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animate(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  nums.forEach(el => {
    if (isInViewport(el, 0.5)) { animate(el); return; }
    observer.observe(el);
  });
}

/* ─── Karanlık / Aydınlık Mod ───
   Tema tercihi <head> içindeki inline script ile sayfa çizilmeden önce
   uygulanır (flaş önleme); burada sadece toggle butonu bağlanır. */
const THEME_KEY = 'efemi_theme';

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
  document.querySelectorAll('.theme-toggle').forEach(btn => {
    btn.setAttribute('aria-label', theme === 'dark' ? 'Aydınlık moda geç' : 'Karanlık moda geç');
  });
}

function initThemeToggle() {
  document.querySelectorAll('.theme-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      applyTheme(current === 'dark' ? 'light' : 'dark');
    });
  });
}

/* ─── site-config.js'ten link ve metin doldurma ─── */
function initSiteLinks() {
  if (typeof SITE === 'undefined') {
    throw new Error('initSiteLinks: site-config.js yüklenmemiş. HTML içinde js/site-config.js, js/main.js dosyasından önce çağrılmalıdır.');
  }

  const linkResolvers = {
    whatsapp:  () => whatsappLink(),
    instagram: () => instagramLink(),
    phone:     () => phoneLink(),
    email:     () => `mailto:${SITE.contact.email}`
  };

  document.querySelectorAll('[data-link]').forEach(el => {
    const key = el.dataset.link;
    const resolve = linkResolvers[key];
    if (!resolve) {
      throw new Error(`initSiteLinks: bilinmeyen data-link değeri "${key}"`);
    }
    el.href = resolve();
    if (key === 'whatsapp' || key === 'instagram') {
      el.target = '_blank';
      el.rel    = 'noopener';
    }
  });

  const textResolvers = {
    phone:     () => SITE.contact.phone,
    email:     () => SITE.contact.email,
    address:   () => SITE.contact.address.full,
    hours:     () => SITE.contact.hours.text,
    tradeName: () => SITE.legal.tradeName,
    taxNumber: () => SITE.legal.taxNumber,
    taxOffice: () => SITE.legal.taxOffice || '[Vergi dairesi bilgisi eklenecek]',
    mersisNo:  () => SITE.legal.mersisNo,
    registryNo:() => SITE.legal.registryNo,
    kepAddress:() => SITE.legal.kepAddress || '[KEP adresi eklenecek]',
    iban:      () => SITE.legal.iban || '[IBAN eklenecek]',
    returnDays:() => SITE.commerce.returnDays,
    year:      () => new Date().getFullYear()
  };

  document.querySelectorAll('[data-text]').forEach(el => {
    const key = el.dataset.text;
    const resolve = textResolvers[key];
    if (!resolve) {
      throw new Error(`initSiteLinks: bilinmeyen data-text değeri "${key}"`);
    }
    el.textContent = resolve();
  });
}

/* ─── Organization/LocalBusiness JSON-LD (site-config.js'ten üretilir) ─── */
function injectOrganizationSchema() {
  if (typeof SITE === 'undefined') {
    throw new Error('injectOrganizationSchema: site-config.js yüklenmemiş.');
  }
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'ElectronicsStore',
    name: SITE.legal.tradeName,
    alternateName: SITE.brand.fullName,
    url: SITE.brand.url,
    logo: `${SITE.brand.url}/assets/logos/icon-square.png`,
    image: `${SITE.brand.url}/assets/logos/og-image.jpg`,
    description: SITE.brand.description,
    telephone: SITE.contact.phoneHref,
    email: SITE.contact.email,
    priceRange: '₺₺',
    address: {
      '@type': 'PostalAddress',
      streetAddress: `${SITE.contact.address.line1}, ${SITE.contact.address.line2}`,
      addressLocality: SITE.contact.address.district,
      addressRegion: SITE.contact.address.city,
      addressCountry: 'TR'
    },
    openingHoursSpecification: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],
      opens: SITE.contact.hours.open,
      closes: SITE.contact.hours.close
    },
    sameAs: [
      `https://instagram.com/${SITE.social.instagram}`
    ].filter(Boolean)
  };

  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(schema);
  document.head.appendChild(script);
}

/* ─── Ürün detay sayfası Product JSON-LD ─── */
function injectProductSchema(p) {
  if (typeof SITE === 'undefined') {
    throw new Error('injectProductSchema: site-config.js yüklenmemiş.');
  }
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: p.desc,
    image: p.images.map(img => `${SITE.brand.url}/${img}`),
    sku: String(p.id),
    aggregateRating: p.reviewCount > 0 ? {
      '@type': 'AggregateRating',
      ratingValue: p.rating,
      reviewCount: p.reviewCount
    } : undefined,
    offers: {
      '@type': 'Offer',
      url: `${SITE.brand.url}/urun-detay.html?id=${p.id}`,
      priceCurrency: SITE.commerce.currency,
      price: p.price,
      availability: p.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition'
    }
  };

  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(schema);
  document.head.appendChild(script);
}

/* ─── URL Parametresi ─── */
function getUrlParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

/* ─── Sayfa başına scroll ─── */
function initScrollToTop() {
  const btn = document.getElementById('scroll-top-btn');
  if (!btn) return;

  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 400);
  }, { passive: true });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

/* ─── Lazy load görsel ─── */
function lazyLoadImages() {
  const images = document.querySelectorAll('img[loading="lazy"]');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            observer.unobserve(img);
          }
        }
      });
    });
    images.forEach(img => observer.observe(img));
  }
}

/* ─── Sayfa init ─── */
document.addEventListener('DOMContentLoaded', () => {
  initSiteLinks();
  initNavbar();
  initThemeToggle();
  initScrollToTop();
  lazyLoadImages();
  initMagneticButtons();
  initStatCounters();

  // Sayfa animasyonu
  document.body.style.opacity = '0';
  requestAnimationFrame(() => {
    document.body.style.transition = 'opacity 0.3s ease';
    document.body.style.opacity    = '1';
  });

  // Scroll animasyonları (biraz bekle)
  setTimeout(initScrollAnimations, 300);
});
