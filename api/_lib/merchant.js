'use strict';

/* =========================================
   Satıcı künyesi (sunucu kopyası)
   =========================================
   Tek doğruluk kaynağı js/site-config.js'tir; bu dosya yalnızca sunucu
   tarafında gereken alanların kopyasıdır (mağazadan teslim adresi,
   e-posta imzası). js/site-config.js değişirse burası da güncellenmelidir. */

const MERCHANT = {
  tradeName: 'EFEM İLETİŞİM SİNEMA VE TELEVİZYON PROGRAMCILIĞI PRODÜKSİYON ELEKTRONİK BİLİŞİM TİCARET LTD. ŞTİ.',
  brandName: 'efem iletişim',
  email:     'info@efemiletisim.com',
  supportEmail: 'destek@efemiletisim.com',
  phone:     '0542 840 08 88',
  address: {
    line:    'Yeni Mahalle 87071 Sokak No:5 Z32 M1 Avm',
    district:'Seyhan',
    city:    'Adana',
    country: 'Türkiye',
    zipCode: '01150'
  }
};

MERCHANT.address.full = `${MERCHANT.address.line}, ${MERCHANT.address.district} / ${MERCHANT.address.city}`;

module.exports = { MERCHANT };
