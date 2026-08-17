'use strict';

/* =========================================
   İşletmeye sipariş bildirimi
   =========================================
   Yeni bir sipariş oluştuğunda işletmenin kendi kutusuna (destek@) özet
   gönderir. Daha önce böyle bir bildirim HİÇ yoktu: sipariş yalnızca
   müşterinin tarayıcısındaki yerel deftere ve (yapılandırılmışsa) Firestore'a
   yazılıyordu; işletmenin siparişten haberi olmuyordu.

   Mail gönderimi Firestore `mail` koleksiyonuna yazılır; gerçek gönderimi
   "Trigger Email from Firestore" extension'ı yapar (bkz. docs/EMAIL-KURULUMU.md).
   Extension kurulu değilse doküman birikir ama mail çıkmaz.                  */

const { MERCHANT } = require('./merchant');
const { formatTry, lineTitle } = require('./orders');

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function addressBlock(order) {
  if (order.delivery === 'magaza') return 'Mağazadan teslim alınacak';
  const a = order.address || {};
  return escapeHtml([a.adres, a.ilce, a.sehir, a.posta].filter(Boolean).join(', '));
}

function paymentLabel(order) {
  if (order.paymentMethod === 'eft') return 'EFT / havale';
  const p = order.payment || {};
  const parts = ['Kart (PayTR)'];
  if (p.installmentCount > 1) parts.push(`${p.installmentCount} taksit`);
  if (p.testMode) parts.push('TEST İŞLEMİ');
  return parts.join(' · ');
}

/* order: store'daki sipariş kaydı (buyer, items, totalKurus, status …) */
function buildMerchantMail(order) {
  const rows = (order.items || []).map(i => `
    <tr>
      <td style="padding:4px 8px;border-bottom:1px solid #eee">${escapeHtml(lineTitle(i))}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:center">${i.qty}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right">${formatTry(i.totalKurus)}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #eee;color:#666">${escapeHtml(i.sku || '-')}</td>
    </tr>`).join('');

  const buyer = order.buyer || {};
  const invoice = order.invoice || {};

  const subject = order.status === 'paid'
    ? `Yeni sipariş (ÖDENDİ) – ${order.id} – ${formatTry(order.totalKurus)}`
    : `Yeni sipariş (${order.statusLabel || order.status}) – ${order.id} – ${formatTry(order.totalKurus)}`;

  const html = `
    <p><strong>${escapeHtml(order.id)}</strong> numaralı yeni sipariş.</p>
    <table style="border-collapse:collapse;font-size:14px">
      <tr><td style="padding:2px 8px;color:#666">Durum</td><td style="padding:2px 8px"><strong>${escapeHtml(order.statusLabel || order.status)}</strong></td></tr>
      <tr><td style="padding:2px 8px;color:#666">Ödeme</td><td style="padding:2px 8px">${escapeHtml(paymentLabel(order))}</td></tr>
      <tr><td style="padding:2px 8px;color:#666">Tutar</td><td style="padding:2px 8px"><strong>${formatTry(order.totalKurus)}</strong> (KDV dahil)</td></tr>
      <tr><td style="padding:2px 8px;color:#666">Müşteri</td><td style="padding:2px 8px">${escapeHtml(buyer.ad || '')} ${escapeHtml(buyer.soyad || '')}${order.guest ? ' (misafir)' : ' (üye)'}</td></tr>
      <tr><td style="padding:2px 8px;color:#666">E-posta</td><td style="padding:2px 8px">${escapeHtml(buyer.email || '-')}</td></tr>
      <tr><td style="padding:2px 8px;color:#666">Telefon</td><td style="padding:2px 8px">${escapeHtml(buyer.telefon || '-')}</td></tr>
      <tr><td style="padding:2px 8px;color:#666">Teslimat</td><td style="padding:2px 8px">${addressBlock(order)}</td></tr>
      <tr><td style="padding:2px 8px;color:#666">Fatura</td><td style="padding:2px 8px">${escapeHtml(invoice.unvan || '-')}${invoice.tcknVergiNo ? ' · ' + escapeHtml(invoice.tcknVergiNo) : ''}${invoice.vergiDairesi ? ' · ' + escapeHtml(invoice.vergiDairesi) : ''}</td></tr>
      ${order.eftReceiptNo ? `<tr><td style="padding:2px 8px;color:#666">Dekont No</td><td style="padding:2px 8px">${escapeHtml(order.eftReceiptNo)}</td></tr>` : ''}
    </table>
    <h3 style="font-size:14px;margin:16px 0 4px">Ürünler</h3>
    <table style="border-collapse:collapse;font-size:14px">
      <tr>
        <th style="padding:4px 8px;text-align:left;border-bottom:2px solid #ddd">Ürün</th>
        <th style="padding:4px 8px;border-bottom:2px solid #ddd">Adet</th>
        <th style="padding:4px 8px;text-align:right;border-bottom:2px solid #ddd">Tutar</th>
        <th style="padding:4px 8px;text-align:left;border-bottom:2px solid #ddd">SKU</th>
      </tr>
      ${rows}
    </table>
    <p style="color:#666;font-size:12px;margin-top:16px">
      Bu bildirim ${escapeHtml(MERCHANT.brandName)} sipariş sistemi tarafından otomatik gönderildi.
    </p>`;

  return { to: MERCHANT.supportEmail, subject, html };
}

module.exports = { buildMerchantMail };
