# Instagram açılış planı — @efemelektronik

Tam sunum: https://claude.ai/code/artifact/c34b243a-12f1-4aac-bea1-b7b48796b9ab
Hazırlık tarihi: 16 Ağustos 2026 · Hesap durumu: 85 takipçi, 0 gönderi

Bu dosya, panoya kopyalanacak metinleri ve sitede yapılacak işleri tutar. Gerekçeler ve
gönderi metinlerinin tamamı yukarıdaki bağlantıda.

## Sitede yapılacaklar (Instagram trafiği buraya iniyor)

- [ ] **Ürün sayfası meta etiketleri dinamikleşsin.** `urun-detay.html:13` canonical ve
      `og:*` etiketleri sabit ("Ürün Detayı – efemiletisim.com"). Instagram/WhatsApp/Google
      bu etiketleri JS çalışmadan okuduğu için paylaşılan ürün linkinde ad, görsel ve fiyat
      çıkmıyor; `sitemap.xml` içindeki 54 `?id=` adresi de tek sayfaya kanonikleşiyor.
      Çözüm sunucu tarafında (Vercel rewrite/edge) id'ye göre etiket yazmak.
- [ ] **JSON-LD ekle.** Hiçbir sayfada yok. Ana sayfa `Store` (adres/telefon/saat + `sameAs`
      ile Instagram), ürün sayfası `Product` + `Offer`, listeler `BreadcrumbList`.
      Künye zaten `js/site-config.js` içinde, tek kaynaktan üretilebilir.
- [ ] **Hero rakamlarını düzelt** (`index.html:156-168`): "18+ Ürün" → 54+ (katalogda 54 ürün);
      "5⭐ Müşteri Puanı" kaldırılsın (tüm ürünlerde "Henüz değerlendirilmedi" yazıyor);
      `hakkimizda.html` içindeki "100% Müşteri Memnuniyeti" de aynı sebeple.
- [ ] **Marka adını tekleştir.** Site "efem iletişim", Instagram "Efem Elektronik",
      fatura "EFEM İLETİŞİM ... LTD. ŞTİ." → görünen ad her yerde **Efem İletişim**.
- [ ] **Bio'daki "Tablet" ile site uyuşmuyor.** Kategoriler: Akıllı Saat 22, Kulaklık 21,
      Aksesuar 7, Ses & Diğer 4. Ya kategori açılsın ya bio'dan çıksın (aşağıdaki bio çıkardı).
- [ ] **Kategori bazlı `og-image`** (4 adet, 1200×630). Şu an tüm sayfalar
      `assets/logos/og-image.jpg` kullanıyor.
- [ ] **Değerlendirme toplama.** Teslimattan 3 gün sonra WhatsApp'tan tek cümlelik yorum isteği.

## Profil künyesi

| Alan | Değer |
|---|---|
| Hesap türü | Profesyonel → İşletme, kategori "Elektronik Mağazası" |
| Görünen ad | `Efem İletişim | Adana` |
| Kullanıcı adı | `@efemelektronik` (korunabilir; değişecekse 85 takipçiyle şimdi en ucuz an) |
| Profil fotoğrafı | `assets/logos/icon-square.png`, 320×320 üstü, kenarlarda %12 boşluk |
| Telefon | 0542 840 08 88 |
| E-posta | destek@efemiletisim.com |
| Adres | Yeni Mahalle 87071 Sokak No:5 Z32, M1 AVM — Seyhan / Adana |

Bağlantılar (Instagram 5 tanesine izin veriyor), her birine `?utm_source=instagram` ekle:

```
https://efemiletisim.com/urunler.html?utm_source=instagram          → Tüm Ürünler
https://efemiletisim.com/urunler.html?kat=saat&utm_source=instagram → Akıllı Saatler
https://efemiletisim.com/urunler.html?kat=kulaklik&utm_source=instagram → Kulaklıklar
https://wa.me/905428400888                                          → WhatsApp
(Google Haritalar mağaza konumu)                                    → Yol Tarifi
```

### Bio (146 karakter — olduğu gibi yapıştır)

```
Akıllı saat · Kulaklık · Aksesuar
Orijinal, faturalı, Türkiye garantili
Ücretsiz kargo · 1-3 iş günü teslimat
M1 AVM Seyhan / Adana · Her gün 10-22
```

> "Aynı gün gönderim" yazmıyoruz: sitede kargo süresi 1-3 iş günü olarak tanımlı
> (`js/site-config.js` → `commerce.shippingDays`). Tutulamayacak söz verilmiyor.

## Öne çıkanlar (6 balon, ortak kapak: #2563EB zemin + beyaz ikon, yazısız)

Mağaza · Akıllı Saat · Kulaklık · Kargo · İade & Garanti · Yorumlar

## İlk 9 gönderi (paylaşım sırası, 2 haftaya yayılır — günde birden fazla yükleme yok)

1. Tanıtım — "Biz kimiz" (karusel 2)
2. Apple Watch Series 11 42mm (karusel 3)
3. Watch SE 3 vs Series 11 karşılaştırma (karusel 4)
4. AirPods Pro 3 (karusel 3)
5. "Neden bizden?" 5 madde (karusel 6)
6. JBL PartyBox Club 120 (karusel 3)
7. Vodafone İş Ortağı + mağaza konumu (konum etiketli)
8. Huawei Watch GT 6 kampanya (karusel 2)
9. Sık sorulanlar (karusel 5) — **profilde sabitle**

**Görseller hazır:** `docs/instagram/gorseller/` altında 29 kare (1080×1080 PNG).
Metin + hashtag + alternatif metin: [instagram/GONDERILER.md](instagram/GONDERILER.md).
Yeniden üretmek için `powershell -ExecutionPolicy Bypass -File docs/instagram/build.ps1`
(metinler `docs/instagram/spec.json` içinde).

Hiçbir gönderi fotoğraf ya da video çekimi gerektirmiyor: kapaklar katalog ürün
görsellerinden kuruldu, reels planlanan iki gönderi karusele çevrildi.

## Ritim

Pazartesi ürün karuseli · Çarşamba karşılaştırma veya "nasıl seçilir" karuseli ·
Cuma kampanya/yorum · her gün 1-2 hikaye · ayda bir öne çıkanları güncelle.

Video çekilemediği sürece reels yok; karusel tek başına yeterli. Erişim düşerse
telefonla çekilmiş 10 saniyelik tek bir ürün videosu bile açığı kapatır.

## Kaçınılacaklar

- "Türkiye'nin en ucuzu" gibi ispatlanamaz üstünlük iddiaları
- Kalıcı gönderide süresiz fiyat (fiyat hikayede, gönderide site linki)
- DM'den kart bilgisi / kimlik istemek — ödeme yalnız site üzerinden
- Rakip fiyatı üzerinden karşılaştırma
- Başka mağazanın logolu ürün görseli
