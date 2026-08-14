/* =========================================
   efemiletisim.com – Site Yapılandırması
   =========================================
   TÜM kurumsal bilgiler, iletişim kanalları ve yasal künye
   bu dosyadan beslenir. Sayfa HTML'lerinde bilgi tekrarı yapılmaz.

   ⚠️ TODO işaretli alanlar işletme sahibi tarafından doldurulmalıdır.
   ========================================= */

const SITE = {
  /* ─── Marka ─── */
  brand: {
    name:        'efem',
    nameSuffix:  'iletişim',
    fullName:    'efem iletişim',
    domain:      'efemiletisim.com',
    url:         'https://efemiletisim.com',
    tagline:     'Teknoloji aksesuarlarında güvenilir adres',
    description: 'Apple, Samsung, Huawei, JBL ve Anker akıllı saat, kulaklık ve tablet ürünleri. Orijinal, garantili, ücretsiz kargo.',
    foundedYear: 2015
  },

  /* ─── Yasal künye (Mesafeli Satış Sözleşmesi ve iyzico başvurusu için zorunlu) ─── */
  legal: {
    tradeName:      'EFEM İLETİŞİM SİNEMA VE TELEVİZYON PROGRAMCILIĞI PRODÜKSİYON ELEKTRONİK BİLİŞİM TİCARET LTD. ŞTİ.',
    tradeNameTodo:  false,
    registryNo:     '70140',
    mersisNo:       '0325058015600016',
    taxNumber:      '3250560156',
    taxOffice:      'Seyhan VD',
    kepAddress:     'efeiletisim.s921087@hs03.kep.tr',
    iban:           'TR15 0001 0000 1376 4216 5250 03',
    ibanBankName:   ''
  },

  /* ─── İletişim ─── */
  contact: {
    phone:        '0543 440 25 25',
    phoneTodo:    false,
    phoneHref:    '+905434402525',
    email:        'info@efemiletisim.com',
    address: {
      line1:    'Yeni Mahalle 87071 Sokak No:5 Z32',
      line2:    'M1 Avm',
      district: 'Seyhan',
      city:     'Adana',
      country:  'Türkiye',
      full:     'Yeni Mahalle 87071 Sokak No:5 Z32 M1 Avm, Seyhan / Adana'
    },
    hours: {
      label: 'Her Gün',
      open:  '10:00',
      close: '22:00',
      text:  'Her Gün 10:00 – 22:00'
    }
  },

  /* ─── Sosyal medya & mesajlaşma ─── */
  social: {
    whatsapp:        '905434402525',
    whatsappTodo:    false,
    whatsappMessage: 'Merhaba, efemiletisim.com üzerinden yazıyorum.',
    instagram:       'efemelektronik',
    instagramTodo:   false,
    facebook:        '',
    youtube:         ''
  },

  /* ─── Ticari koşullar ─── */
  commerce: {
    currency:        'TRY',
    currencySymbol:  '₺',
    vatIncluded:     true,
    vatRate:         20,
    freeShipping:    true,
    freeShippingText:'Tüm siparişlerde ücretsiz kargo',
    returnDays:      14,
    shippingDays:    '1-3 iş günü',
    shippingCompany: 'Yurtiçi Kargo'
  },

  /* ─── İş ortaklıkları ─── */
  partners: {
    primary: {
      name: 'Vodafone',
      role: 'Vodafone İş Ortağı',
      logo: 'assets/logos/vodafone.svg'
    },
    distributors: [
      { name: 'Datagate',    logo: 'assets/logos/datagate.svg' },
      { name: 'İndeks',      logo: 'assets/logos/indeks.svg' },
      { name: 'Genpa',       logo: 'assets/logos/genpa.svg' },
      { name: 'KVK',         logo: 'assets/logos/kvk.svg' },
      { name: 'Başarı',      logo: 'assets/logos/basari.svg' },
      { name: 'Ouno Servis', logo: 'assets/logos/ouno.svg' }
    ]
  }
};

/* ─── WhatsApp sohbet linki ─── */
function whatsappLink(message) {
  const text = encodeURIComponent(message || SITE.social.whatsappMessage);
  return `https://wa.me/${SITE.social.whatsapp}?text=${text}`;
}

/* ─── Instagram profil linki ─── */
function instagramLink() {
  return `https://instagram.com/${SITE.social.instagram}`;
}

/* ─── Telefon arama linki ─── */
function phoneLink() {
  return `tel:${SITE.contact.phoneHref}`;
}
