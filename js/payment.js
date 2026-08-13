/* =========================================
   efemiletisim.com – Ödeme (İyzico Simülasyon)
   ========================================= */

/* ─── İyzico Test Modu ─── */
const IYZICO_CONFIG = {
  mode:        'sandbox',
  currency:    'TRY',
  locale:      'tr',
  apiKey:      'sandbox-TEST_KEY',
  baseUrl:     'https://sandbox-api.iyzipay.com'
};

/* ─── Ödeme durumları ─── */
const PAYMENT_STATUS = {
  PENDING:   'pending',
  SUCCESS:   'success',
  FAILED:    'failed',
  CANCELLED: 'cancelled'
};

/* ─── Simüle ödeme işlemi ─── */
function processPayment(cardData, amount, callback) {
  // Loading göster
  const btn = document.getElementById('pay-btn');
  if (btn) {
    btn.classList.add('loading');
    btn.disabled = true;
    btn.textContent = 'İşleniyor...';
  }

  // 1.5 sn simülasyon gecikmesi
  setTimeout(() => {
    const result = simulatePaymentResult(cardData, amount);
    if (btn) {
      btn.classList.remove('loading');
      btn.disabled = false;
    }
    callback(result);
  }, 1500);
}

/* ─── Ödeme sonucu simüle et ─── */
function simulatePaymentResult(cardData, amount) {
  // Test kartları
  const testCards = {
    '4111111111111111': 'success',
    '5526080000000006': 'success',
    '4000000000000002': 'failed',
    '4000000000000077': 'failed'
  };

  const cleanNumber = cardData.number.replace(/\s/g, '');
  const status = testCards[cleanNumber] || 'success'; // Bilinmeyen kart → başarılı

  if (status === 'success') {
    return {
      status: PAYMENT_STATUS.SUCCESS,
      conversationId: 'EFEMI' + Date.now(),
      paymentId:      'PAY' + Math.random().toString(36).slice(2, 10).toUpperCase(),
      amount,
      currency: 'TRY',
      paidPrice: amount
    };
  } else {
    return {
      status: PAYMENT_STATUS.FAILED,
      errorCode:    '10051',
      errorMessage: 'Kart limitiniz yetersiz. Lütfen başka bir kart deneyin.'
    };
  }
}

/* ─── Kart numarası formatla (XXXX XXXX XXXX XXXX) ─── */
function formatCardNumber(value) {
  return value.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ');
}

/* ─── Son kullanma tarihi formatla (MM/YY) ─── */
function formatExpiry(value) {
  return value.replace(/\D/g, '').slice(0, 4).replace(/(\d{2})(?=\d)/, '$1/');
}

/* ─── Kart tipi algıla ─── */
function detectCardType(number) {
  const n = number.replace(/\s/g, '');
  if (/^4/.test(n)) return 'visa';
  if (/^5[1-5]/.test(n) || /^2[2-7]/.test(n)) return 'mastercard';
  if (/^3[47]/.test(n)) return 'amex';
  return 'unknown';
}

/* ─── Kart input event dinleyicileri ─── */
function initPaymentForm() {
  const cardNumberInput = document.getElementById('card-number');
  const cardExpiryInput = document.getElementById('card-expiry');
  const cardCvcInput    = document.getElementById('card-cvc');
  const cardNameInput   = document.getElementById('card-name');

  if (cardNumberInput) {
    cardNumberInput.addEventListener('input', (e) => {
      e.target.value = formatCardNumber(e.target.value);
      const type = detectCardType(e.target.value);
      updateCardTypeDisplay(type);
    });
  }

  if (cardExpiryInput) {
    cardExpiryInput.addEventListener('input', (e) => {
      e.target.value = formatExpiry(e.target.value);
    });
  }

  if (cardCvcInput) {
    cardCvcInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
    });
  }

  // Kart önizleme güncelle
  [cardNumberInput, cardExpiryInput, cardCvcInput, cardNameInput].forEach(input => {
    if (input) input.addEventListener('input', updateCardPreview);
  });
}

function updateCardTypeDisplay(type) {
  const icons = document.getElementById('card-type-icons');
  if (!icons) return;
  const map = { visa: '💳 VISA', mastercard: '💳 MC', amex: '💳 AMEX', unknown: '💳' };
  icons.textContent = map[type] || '💳';
}

function updateCardPreview() {
  const num  = document.getElementById('card-number')?.value  || '';
  const exp  = document.getElementById('card-expiry')?.value  || '';
  const name = document.getElementById('card-name')?.value    || '';

  const previewNum  = document.getElementById('preview-number');
  const previewExp  = document.getElementById('preview-expiry');
  const previewName = document.getElementById('preview-name');

  if (previewNum)  previewNum.textContent  = num  || '•••• •••• •••• ••••';
  if (previewExp)  previewExp.textContent  = exp  || 'AA/YY';
  if (previewName) previewName.textContent = name || 'KART SAHİBİ';
}

/* ─── Ödeme form validasyonu ─── */
function validatePaymentForm(data) {
  const errors = [];

  if (!data.number || data.number.replace(/\s/g, '').length < 16) {
    errors.push({ field: 'card-number', msg: 'Geçerli bir kart numarası girin.' });
  }

  if (!data.name || data.name.trim().length < 3) {
    errors.push({ field: 'card-name', msg: 'Kart üzerindeki adı girin.' });
  }

  const expParts = (data.expiry || '').split('/');
  if (expParts.length !== 2 || expParts[0].length !== 2 || expParts[1].length !== 2) {
    errors.push({ field: 'card-expiry', msg: 'Geçerli bir son kullanma tarihi girin (AA/YY).' });
  }

  if (!data.cvc || data.cvc.length < 3) {
    errors.push({ field: 'card-cvc', msg: 'Geçerli bir CVV/CVC girin.' });
  }

  return errors;
}

/* ─── Adres form validasyonu ─── */
function validateAddressForm(data) {
  const errors = [];
  const required = ['ad', 'soyad', 'telefon', 'adres', 'sehir', 'ilce', 'posta'];

  required.forEach(field => {
    if (!data[field] || !data[field].toString().trim()) {
      errors.push({ field: `addr-${field}`, msg: 'Bu alan zorunludur.' });
    }
  });

  if (data.telefon && !/^(\+90|0)?[5][0-9]{9}$/.test(data.telefon.replace(/\s/g, ''))) {
    errors.push({ field: 'addr-telefon', msg: 'Geçerli bir Türkiye telefon numarası girin.' });
  }

  return errors;
}

/* ─── Hata mesajlarını göster ─── */
function showFormErrors(errors) {
  // Önceki hataları temizle
  document.querySelectorAll('.form-error').forEach(el => el.textContent = '');
  document.querySelectorAll('.form-input.error, .form-select.error').forEach(el => el.classList.remove('error'));

  errors.forEach(({ field, msg }) => {
    const input = document.getElementById(field);
    const errorEl = document.getElementById(`${field}-error`);
    if (input)   input.classList.add('error');
    if (errorEl) errorEl.textContent = msg;
  });
}

/* ─── Test kartları göster ─── */
function showTestCards() {
  return `
    <div style="background:var(--surface-2);border-radius:var(--radius-md);padding:var(--space-4);font-size:0.8125rem;margin-top:var(--space-4)">
      <div style="font-weight:700;margin-bottom:var(--space-2);color:var(--primary)">🧪 Test Kartları (Sandbox Modu)</div>
      <div style="display:grid;gap:var(--space-2)">
        <div>✅ <code style="background:var(--surface);padding:2px 6px;border-radius:4px">4111 1111 1111 1111</code> → Başarılı ödeme</div>
        <div>✅ <code style="background:var(--surface);padding:2px 6px;border-radius:4px">5526 0800 0000 0006</code> → Başarılı ödeme</div>
        <div>❌ <code style="background:var(--surface);padding:2px 6px;border-radius:4px">4000 0000 0000 0002</code> → Başarısız ödeme</div>
      </div>
      <div style="margin-top:var(--space-2);color:var(--text-muted)">Son Tarih: herhangi / CVV: herhangi 3 hane</div>
    </div>
  `;
}
