'use strict';

/* =========================================
   Kargo bildirimi (HepsiJET)
   =========================================
   Yönetici panelden kargo takip numarasını kaydettiğinde müşteriye
   "kargoya verildi + takip linki" e-postası bu modülden gönderilir.

   Neden ayrı modül: takip numarası yazma işlemi (store.setOrderTracking)
   ile müşteriye haber verme birbirinden bağımsız olmalı. E-posta kuyruğu
   hata verse bile numara siparişe yazılmış kalır; numara yazılamazsa da
   yanlışlıkla e-posta gitmez.

   E-posta YALNIZ numara gerçekten değiştiğinde gönderilir — yönetici aynı
   numarayı tekrar kaydedince müşteriye ikinci bir bildirim gitmez. */

const { MERCHANT } = require('./merchant');

/* HepsiJET gönderi takip adresi. Doğrulandı: hepsijet.com bu yolu
   `coklu-gonderi-takibi/[id]` dinamik rotasıyla karşılıyor. */
const HEPSIJET_TAKIP_BASE = 'https://hepsijet.com/coklu-gonderi-takibi/';
const HEPSIJET_SORGU      = 'https://hepsijet.com/gonderi-takibi';

function trackingUrl(trackingNumber) {
  const no = String(trackingNumber || '').trim();
  if (!no) return HEPSIJET_SORGU;
  return HEPSIJET_TAKIP_BASE + encodeURIComponent(no);
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatTry(kurus) {
  const n = Number(kurus);
  if (!Number.isFinite(n)) return '';
  return (n / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
}

/* Sipariş kaleminin müşteriye gösterilecek adı: renk/beden varsa eklenir,
   böylece müşteri hangi seçeneğin yola çıktığını görür. */
function lineTitle(item) {
  const varyant = [item.color, item.size].filter(Boolean).join(' · ');
  return varyant ? `${item.name} (${varyant})` : item.name;
}

function shipmentMailSubject(order) {
  return `Siparişiniz kargoya verildi – ${order.id}`;
}

function shipmentMailHtml(order) {
  const no  = String(order.trackingNumber || '').trim();
  const url = trackingUrl(no);
  const ad  = (order.buyer && order.buyer.ad) || order.customerName || '';

  const satirlar = (order.items || [])
    .map(i => `<li>${escapeHtml(lineTitle(i))} × ${i.qty}</li>`)
    .join('');

  const adres = order.address || {};
  const adresMetni = [adres.adres, adres.mahalle, adres.ilce, adres.il]
    .filter(Boolean).map(escapeHtml).join(', ');

  return `<p>Merhaba ${escapeHtml(ad)},</p>
    <p><strong>${escapeHtml(order.id)}</strong> numaralı siparişiniz hazırlandı ve
       <strong>HepsiJET</strong> ile kargoya verildi.</p>

    <p style="font-size:16px">
      Takip numaranız: <strong>${escapeHtml(no)}</strong>
    </p>

    <p>
      <a href="${escapeHtml(url)}"
         style="display:inline-block;padding:12px 22px;background:#2563EB;color:#ffffff;
                text-decoration:none;border-radius:8px;font-weight:600">
        Kargomu Takip Et
      </a>
    </p>

    <p style="font-size:13px;color:#64748B">
      Buton çalışmazsa bu adresi tarayıcınıza yapıştırabilirsiniz:<br>
      <a href="${escapeHtml(url)}">${escapeHtml(url)}</a>
    </p>

    ${satirlar ? `<p><strong>Gönderi içeriği:</strong></p><ul>${satirlar}</ul>` : ''}
    ${adresMetni ? `<p><strong>Teslimat adresi:</strong><br>${adresMetni}</p>` : ''}

    <p style="font-size:13px;color:#64748B">
      Kargo hareketleri taşıyıcı sistemine işlendikçe görünür; ilk kayıt birkaç saat
      sürebilir.
    </p>

    <p>Sorularınız için: ${escapeHtml(MERCHANT.supportEmail)}<br>
       ${escapeHtml(MERCHANT.brandName)}</p>`;
}

module.exports = { trackingUrl, shipmentMailSubject, shipmentMailHtml, lineTitle, HEPSIJET_SORGU };
