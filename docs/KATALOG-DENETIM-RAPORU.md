# Katalog Doğruluk Denetimi — ürün bilgisi ve görseller

Tarih: 2026-08-17
Talep: `docs/visual-fix.md` (ürün ürün görsel + teknik özellik denetimi)
Katalog: `js/data.js` → 54 ürün, 114 varyant, 152 görsel

Yöntem: her ürünün mevcut verisi, **üreticinin kendi teknik özellik sayfasıyla**
karşılaştırıldı (apple.com/tr, consumer.huawei.com/tr, samsung.com/tr, mi.com).
Kaynakta doğrulanamayan hiçbir değer yazılmadı; doğrulanamayan mevcut iddialar
metinden **çıkarıldı** (talep §10: "asla teknik özellik uydurma").

Ölçüm aracı: `node scripts/catalog-audit.mjs` — her ürünün görsel dosyalarını,
piksel ölçüsünü, varyantlarını ve eksik alanlarını listeler.

---

## 1. Bulunan ve düzeltilen gerçek hatalar

| # | Ürün | Hata | Kaynak | Düzeltme |
|---|---|---|---|---|
| 1 | Huawei WiFi Mesh X3 Pro | **"Wi-Fi 6" yazıyordu; ürün Wi-Fi 7** (802.11be). Model kodu da eksikti | Huawei resmi teknik özellikler | Wi-Fi 7, 2,4 GHz 688 + 5 GHz 2882 Mbps, 2,5 Gbit ethernet, model GAEA2-PLM21 |
| 2 | Huawei Watch GT 6 / GT 6 Pro (10, 11, 12, 13, 14) | **"Bluetooth 5.2" yazıyordu; ürün Bluetooth 6.0** | Huawei resmi | BT 6.0 olarak düzeltildi (GT 5 Pro ve Fit 4 gerçekten 5.2 — onlar korundu) |
| 3 | Huawei Watch GT 6 (10, 11, 12) | Pil "14/21 güne kadar (tipik kullanım)" — Huawei bu değerleri **maksimum** kullanım için veriyor, tipik değer yarısı kadar | Huawei resmi | 41 mm: maks. 14 gün / tipik 7 gün · 46 mm: maks. 21 gün / tipik 12 gün |
| 4 | Apple Watch Series 10 Titanyum (6, 7) | Kasa "Cilalı titanyum (Gold / **Silver**)" — Apple'ın titanyum kaplamaları **Natural, Gold, Slate**; gümüş titanyum yok | Apple Series 10 teknik özellikler | Uydurma kaplama listesi kaldırıldı (varyant adları için bkz. bölüm 4) |
| 5 | Apple Watch SE 3 (3, 4) | "50m su direnci + **IP6X**" — Apple SE 3 için IP6X **belirtmiyor**; ayrıca Wi-Fi yalnız 2,4 GHz | Apple SE teknik özellikler | IP6X çıkarıldı, Ion-X ön cam ve 2,4 GHz Wi-Fi eklendi |
| 6 | Huawei Watch Fit 4 (15) | "SpO2" yazıyordu — Huawei'nin Fit 4 sayfalarında SpO2/kandaki oksijen **geçmiyor** | Huawei resmi (spec + ürün sayfası) | SpO2 çıkarıldı; kalp atış hızı, uyku, Duygusal Zindelik bırakıldı |
| 7 | Huawei FreeBuds SE 3 (26) | "Bluetooth 5.3" (gerçek: **5.4**) ve "Batarya: Kılıfla birlikte uzun kullanım" (ölçüsüz) | Huawei resmi | BT 5.4; 9 saat + kutuyla 42 saat; IP54'ün **yalnız kulaklıklar** için geçerli olduğu notu eklendi |
| 8 | Samsung Galaxy Watch9 (17, 18) | "5ATM + **IP68** + MIL-STD-810H" — Samsung teknik tablosunda dayanıklılık **5 ATM**; IP68 yok | Samsung TR ürün sayfası | 5 ATM + MIL-STD-810H |
| 9 | Samsung Galaxy Buds4 Pro (38) | "**IP54**" (gerçek: **IP57**) | Samsung TR | IP57; ayrıca BT 6.1, 6/26 saat, 24 bit/96 kHz eklendi |
| 10 | Apple AirPods Pro 3 (25) | Açıklamada "köpük katmanlı kulaklıklar" ve "**Canlı Çeviri**" — Apple TR teknik özellik sayfasında ikisi de **geçmiyor** | apple.com/tr | Açıklama doğrulanmış özelliklerle yeniden yazıldı |
| 11 | Apple 20W adaptör (44) | "Model Yılı = 2025" — doğrulanamayan bir iddia | — | Kaldırıldı, kutu içeriğiyle değiştirildi |
| 12 | Xiaomi Redmi Watch 6 (21) | "AMOLED, yüksek parlaklık" / "Uzun ömürlü (tipik kullanımda günlerce)" — ölçüsüz | mi.com resmi | 2,07 inç 432 × 514 (324 PPI), 60 Hz, 2000 nit tepe; 24 gün hafif / 12 gün normal kullanım |
| 13 | Xiaomi Redmi Buds 8 / Active / Lite (40, 41, 42) | Üçünde de "Kılıfla uzun süreli kullanım" ve doğrulanamayan IPX4 | mi.com resmi | Gerçek saat/mAh değerleri; yalnız Buds 8'de resmi olarak belirtilen IP54 bırakıldı |
| 14 | Xiaomi Redmi Buds 8 Pro (43) | "8 saat + 33 saat" ve "3 mikrofonlu AI" — resmi sayfada yok | mi.com resmi | Doğrulanan değerler (54/480 mAh, BT 5.4, uç boyları) ile değiştirildi |

Bunların yanında 20'den fazla üründe eksik olan doğrulanmış alanlar eklendi:
çözünürlük/PPI, kasa malzemesi ve ölçüsü, ağırlık, şarj süresi, kodek listesi,
GNSS bantları, sensör listesi.

---

## 2. Renk seçimi ↔ görsel eşleşmesi (talebin §4 ve §18'i)

Sorun buydu: müşteri "Roze Altın" seçiyor, galeride siyah saat kalıyordu.

Yapılanlar:

- `js/data.js` ürünlerine opsiyonel **`colorImages`** haritası eklendi
  (`{ "Roze Altın": "…-renk-roze-altin.png" }`).
- `urun-detay.html`: renk seçilince ana görsel o rengin görseline geçiyor
  (`showColorImage()`), alt metni de renkle güncelleniyor; renk görselleri
  galeriye küçük resim olarak da ekleniyor.
- Haritası olmayan ürünlerde davranış eskisi gibi — hiçbir sayfa bozulmuyor.

Görseller **Apple'ın kendi görsel sunucusundan** (store.storeimages.cdn-apple.com)
1200 × 1200 şeffaf arka planlı resmi render olarak indirildi
(`scripts/fetch-apple-watch-images.mjs`, yeniden çalıştırılabilir):

| Ürün | Renkler |
|---|---|
| Apple Watch Series 11 42 mm | Jet Siyah · Roze Altın · Uzay Grisi · Gümüş |
| Apple Watch Series 11 46 mm | Jet Siyah · Roze Altın · Uzay Grisi |
| Apple Watch SE 3 40 mm / 44 mm | Gece Yarısı · Yıldız Işığı |
| Apple Watch Series 10 46 mm Alüminyum | Jet Siyah |
| Apple Watch Series 9 41 mm | Kırmızı · Pembe |

Toplam 14 varyant görseli. Her biri gözle kontrol edildi (renkler birbirinden
ayırt edilebiliyor ve ada uyuyor).

**Samsung Galaxy Watch9 için denendi ve vazgeçildi:** Samsung'un
`…Design-colors-cream-40mm…` / `…silver-44mm…` adresleri ada uymayan renkler
döndürdü (krem yerine beyaz, gümüş yerine haki) ve görseller aşırı boşluklu
banner kırpımlarıydı. Talebin §16 ve §22 kuralları gereği bu görseller
kullanılmadı, indirilen dosyalar silindi.

---

## 3. Görsel envanterinin ölçülen durumu

`node scripts/catalog-audit.mjs` çıktısı:

| Ölçüm | Durum |
|---|---|
| Kırık/eksik görsel dosyası | **0** |
| Placeholder SVG kullanan ürün | **0** |
| Tek görselli ürün | **4** — değişmedi (17, 18, 21, 29; bkz. bölüm 5) |
| 600 pikselden dar görsel | 5 ürün (28, 29, 31, 33, 52 — hepsi JBL) |
| Toplam görsel | 152 → **166** (14 renk görseli eklendi) |
| Ürün başına ortalama özellik satırı | **6,3** |
| Renk görseli bağlanmış ürün | **6** (Apple Watch ailesi) |

---

## 4. Karar bekleyen konu: Series 10 titanyum "Gümüş" varyantı

Ürün 6 ve 7'de stok listesinden gelen **"Gümüş"** renk adı var. Apple'ın Series 10
titanyum kaplamaları yalnız **Natural, Gold, Slate**. İki olasılık:

1. Excel'de Natural (doğal titanyum) "Gümüş" diye yazılmış,
2. Slate kastedilmiş.

Bu bir stok/etiket sorusu; koddan çözülemez. **SKU'lara dokunmadım** — yanlış
tahmin, satılabilir stoğu kataloğdan düşürürdü. Doğrusunu bildirirseniz renk adını
düzeltir ve o renge ait Apple görselini de eklerim.

---

## 5. Bu turda tamamlanmayanlar

Dürüst olmak gerekirse talep 54 ürünün tamamı için "araştır → doğrula → görselleri
yenile" istiyor; bu turda **kapsanan 30 ürün** (Apple 12, Huawei 9, Samsung 6,
Xiaomi 6 + kısmi) oldu. Kalanlar:

| Konu | Ürün | Neden |
|---|---|---|
| JBL ürünleri | 27–34, 52, 53 | `jbl.com` otomatik isteklere kapalı (HTTP bağlantı reddi). Yetkili satıcı/Harman basın kaynağından doğrulama gerekiyor; uydurmamak için mevcut metinlere dokunulmadı |
| Düşük çözünürlüklü görseller | 28, 29, 31, 33, 52 | Aynı sebep — JBL kaynaklı |
| Tek görselli ürün | 29 (JBL Tune 680BT NC) | Aynı sebep |
| Samsung Buds3 FE, EO-IC100B, şarj adaptörleri | 35, 36, 48, 49, 50 | Mevcut değerler makul; resmi tablo ile satır satır doğrulanmadı |
| Xiaomi Redmi Watch 5 Active/Lite, Watch 3 Active, Buds 6 Play, Projector L1 | 19, 20, 22, 39, 54 | Aynı — doğrulama sırası gelmedi |
| Renk görselleri (Apple dışı) | Huawei, Samsung, Xiaomi, JBL | Üretici CDN'lerinde renk ↔ dosya eşleşmesi güvenilir değil; her renk için gözle doğrulama gerekiyor |

Bir sonraki turda sıra: JBL için alternatif kaynak, sonra kalan Samsung/Xiaomi
doğrulaması, sonra Apple dışı markalar için renk görselleri.
