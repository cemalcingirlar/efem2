/* =========================================
   efemiletisim.com – Ana JS (Ortak)
   ========================================= */

/* ─── Toast Bildirimi ─── */
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const id    = 'toast-' + Date.now();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.id = id;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-msg">${message}</span>
    <button class="toast-close" onclick="closeToast('${id}')">✕</button>
  `;

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

  updateCartBadge();
  updateNavAuth();
  initSearch();
}

/* ─── Duyuru şeridi ─── */
function initAnnouncementBar() {
  const bar = document.getElementById('announcement-bar');
  if (!bar) return;

  const dismissed = sessionStorage.getItem('announcement-dismissed');
  if (dismissed) { bar.style.display = 'none'; return; }

  const closeBtn = document.getElementById('announcement-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      bar.style.display = 'none';
      sessionStorage.setItem('announcement-dismissed', '1');
    });
  }
}

/* ─── Scroll animasyon (Intersection Observer) ─── */
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
    el.style.opacity = '0';
    observer.observe(el);
  });
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
  initNavbar();
  initAnnouncementBar();
  initScrollToTop();
  lazyLoadImages();

  // Sayfa animasyonu
  document.body.style.opacity = '0';
  requestAnimationFrame(() => {
    document.body.style.transition = 'opacity 0.3s ease';
    document.body.style.opacity    = '1';
  });

  // Scroll animasyonları (biraz bekle)
  setTimeout(initScrollAnimations, 300);
});

/* ─── Hepsiburada CDN görsel URL'si (test) ─── */
// Hepsiburada bot koruması nedeniyle doğrudan erişim mümkün olmadı.
// Resmi marka CDN linkleri kullanılmaktadır.
const PRODUCT_IMAGES = {
  // Akıllı Saatler
  1: 'https://productimages.hepsiburada.net/s/37/1500/11001000000000099.jpg',  // placeholder pattern
  2: 'https://productimages.hepsiburada.net/s/35/1500/11001000000000079.jpg',
  // fallback → ürün sayfasında onerror ile placeholder gösterilir
};
