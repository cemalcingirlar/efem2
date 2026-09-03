# PayTR Entegrasyonu — Kurulum, Test ve İşletim Rehberi

Bu dosya, ödeme altyapısının **nasıl çalıştığını** ve **canlıya nasıl alınacağını** anlatır.
Ödeme sağlayıcısı 2026-08-17 itibarıyla iyzico'dan **PayTR**'ye taşınmıştır.

---

## 0. Şu anki durum (önemli)

Ödeme kodu hazır ama **kart ödemesi kapalı**. Ortam değişkenleri girilmediği sürece:

- `/api/payment/config` → `cardEnabled: false` döner,
- checkout'ta kart sekmesi devre dışı görünür, müşteri EFT/havale ile devam eder,
- hiçbir koşulda "ödeme başarılı" taklidi yapılmaz.

Yani bu haliyle deploy etmek **güvenlidir**; aşağıdaki adımlar tamamlandığında kart
ödemesi kendiliğinden açılır.

---

## 1. Akış ve mimari

PayTR **iFrame API** kullanılır. İki adımlıdır ve **asenkrondur**:

```
Tarayıcı ──(id + sku + adet + adres + onay)──► /api/payment/initialize
                                                  │ tutarı sunucu hesaplar
                                                  │ siparişi "awaiting_payment" yazar
                                                  ▼
                                        PayTR get-token  (paytr_token imzalı)
                                                  │
Tarayıcı ◄──────── ödeme token'ı ─────────────────┘
   │
   └─► odeme-guvenli.html → iframe: https://www.paytr.com/odeme/guvenli/<token>
             │  (kart no + CVV + 3D Secure YALNIZ burada, PayTR tarafında)
             │
             ├── PayTR ──POST──► /api/payment/notify   ← SONUCUN TEK KAYNAĞI
             │                     hash doğrulanır → sipariş durumu yazılır → "OK"
             │
             └── müşteri ───────► odeme-sonuc.html  (merchant_ok_url)
                                    durumu /api/order/status'tan okur
```

| Parça | Dosya | Görev |
|---|---|---|
| Yetenek sorgusu | `api/payment/config.js` | Kart ödemesi açık mı? |
| Ödeme başlatma | `api/payment/initialize.js` | Sepeti sunucu fiyatlarıyla hesaplar, siparişi açar, PayTR token'ı alır |
| **Bildirim** | `api/payment/notify.js` | PayTR'nin sunucudan sunucuya bildirimi — sonucun tek yetkili kaynağı |
| Sonuçlandırma | `api/_lib/settle.js` | Durum geçişleri (idempotent, transaction içinde) |
| PayTR istemcisi | `api/_lib/paytr.js` | `paytr_token` üretimi, bildirim `hash` doğrulaması, sepet/tutar biçimi |
| Sipariş defteri | `api/_lib/store.js` | Firestore (Firebase Admin) |
| Fiyat otoritesi | `api/_lib/orders.js` + `api/_lib/catalog.json` | Sepet fiyatlaması, varyant doğrulaması, sipariş kimlikleri |
| EFT siparişi | `api/order/eft.js` | Kartsız sipariş |
| Sipariş durumu | `api/order/status.js` | Sonuç sayfasının okuduğu uç |
| Checkout | `odeme.html`, `js/payment.js` | Kart verisi **toplamaz** |
| Ödeme formu | `odeme-guvenli.html` | Yalnız PayTR iframe'ini barındırır |
| Sonuç | `odeme-sonuc.html` | Durumu sunucudan okur |

**Temel ilke:** müşterinin döndüğü sayfa "ödeme başarılı" kanıtı değildir.
Bir sipariş ancak imzası doğrulanmış bildirim geldiğinde ve tutar tuttuğunda `paid` olur.

### Sipariş durumları

| Durum | Anlamı | Sevkiyat |
|---|---|---|
| `awaiting_payment` | Ödeme formuna yönlendirildi, bildirim bekleniyor | Hayır |
| `awaiting_transfer` | EFT/havale bekleniyor | Hayır |
| `paid` | PayTR bildirimi doğrulandı; tutar, para birimi ve ortam tuttu | Evet |
| `pending_review` | Bildirim geldi ama tutar / para birimi / test-canlı ortamı uyuşmuyor | **Hayır — önce inceleyin** |
| `failed` | Ödeme alınamadı | Hayır |

---

## 2. Kurulum

### 2.1 PayTR mağaza bilgileri

PayTR Mağaza Paneli → **Bilgi → API Entegrasyon Bilgileri**:
`merchant_id`, `merchant_key`, `merchant_salt`. Üçü de sunucu tarafı sırdır;
repoya, istemci koduna veya loga **girmez**.

### 2.2 Bildirim URL'sini panele tanımlayın

PayTR Mağaza Paneli → **Ayarlar → Bildirim URL**:

```
https://efemiletisim.com/api/payment/notify
```

Bu adım atlanırsa ödemeler tahsil edilir ama **siparişler `awaiting_payment`'ta kalır**.

### 2.3 Firebase servis hesabı

Firebase Console → ⚙️ **Proje Ayarları → Servis Hesapları → Yeni özel anahtar üret**.
İnen JSON'un içeriğinin tamamı `FIREBASE_SERVICE_ACCOUNT` değeri olur.

### 2.4 Vercel ortam değişkenleri

```
PAYTR_MERCHANT_ID=...
PAYTR_MERCHANT_KEY=...
PAYTR_MERCHANT_SALT=...
PAYTR_TEST_MODE=1
SITE_BASE_URL=https://efemiletisim.com
ORDER_TOKEN_SECRET=<openssl rand -hex 32 çıktısı>
FIREBASE_SERVICE_ACCOUNT={"type":"service_account", ... }
```

Şablon: `.env.example`. Değişiklikten sonra **yeniden deploy** gerekir.

### 2.5 Firestore kuralları

```bash
firebase deploy --only firestore:rules
```

---

## 3. Yerel test

```bash
npm install
```

```bash
npm run test:payment
```

```bash
node dev-server.js
```

`dev-server.js`, `/api/*` isteklerini Vercel Functions ile aynı imzayla çalıştırır ve
varsa `.env.local` dosyasını yükler.

**Katalog değiştiğinde** (fiyat, yeni ürün, yeni renk/beden):

```bash
npm run sync-catalog
```

Tarayıcının sunucuya gönderdiği tek sepet bilgisi `{ id, sku, qty }`'dir;
fiyat, toplam, renk ve beden metni gönderilmez.

---

## 4. PayTR kabul testleri (canlıya geçmeden önce)

`PAYTR_TEST_MODE=1` iken aşağıdakiler koşulmadan production'a geçilmemelidir.
Test kartları PayTR panelindeki dokümantasyondadır (kod içine gömülmemiştir).

| # | Test | Beklenen |
|---|---|---|
| 1 | Başarılı ödeme | Bildirim gelir, `orders/{id}.status = paid`, tutar sepetle aynı, sipariş maili gider |
| 2 | Başarısız kart | Sipariş `failed`, sepet korunur, kullanıcıya anlaşılır mesaj |
| 3 | Ödeme formunu kapat / vazgeç | Sipariş `paid` olmaz, çekim yok |
| 4 | Ödeme sonrası sekmeyi kapat | Bildirim yine gelir, sipariş `paid` olur |
| 5 | Aynı bildirimi elle 3 kez tekrar gönder | Durum değişmez, ikinci mail gitmez |
| 6 | Bildirimi bozuk `hash` ile gönder | `401`, veritabanında değişiklik yok |
| 7 | DevTools'tan sepet fiyatını değiştir | Sunucu kendi fiyatını kullanır |
| 8 | Ödeme butonuna hızlı çift tıklama | Tek ödeme oturumu açılır |
| 9 | Mobil tarayıcıda tam akış | iframe düzgün açılır, dönüş sorunsuz |
| 10 | `/api/order/status` başka jetonla | `403` |

Her testin sonucunu (ekran görüntüsü + `orders` kaydı + Vercel log satırı) kanıt
paketine ekleyin.

---

## 5. Production'a geçiş

1. Kabul testleri (bölüm 4) tamamlandı.
2. PayTR mağaza hesabı onaylandı, evraklar yüklendi.
3. Panelde **Bildirim URL** production adresine ayarlı.
4. `PAYTR_TEST_MODE=0` yapıldı, deploy edildi.
5. `https://efemiletisim.com/api/payment/config` → `{"cardEnabled":true,"mode":"production"}`.
6. **Kendi kartınızla en düşük tutarlı gerçek bir sipariş verin**, sonra PayTR panelinden
   iade edin. İlk gerçek testtir; atlamayın.
7. İlk hafta günlük mutabakat (bölüm 7).

---

## 6. İşletim

### Günlük

- Vercel → Logs → `[payment]` satırları. Aranacaklar: `notify_bad_hash`,
  `amount_mismatch`, `settle_order_not_found`, `initialize_failed`.
- `pending_review` durumundaki siparişler: para çekilmiş olabilir, sevkiyat yapılmaz,
  24 saat içinde müşteriyle iletişime geçilir.

### İade / iptal

PayTR panelinden yapılır. İşlem sonrası `orders/{id}` kaydını Firebase Console'dan
`refunded` / `cancelled` yapın; bu iki durum "terminal" kabul edilir ve sonradan gelen
bildirimle geri alınmaz.

### Taksit açmak

`PAYTR_NO_INSTALLMENT=0` ve `PAYTR_MAX_INSTALLMENT=6` gibi. Açmadan önce:
PayTR hesabınızda tanımlı mı, ve BDDK'nın **güncel** taksit sınırları elektronik/
telekomünikasyon ürünleri için ne diyor — ikisini de teyit edin.

---

## 7. Mutabakat (haftalık, 15 dakika)

1. PayTR paneli → İşlemler → ilgili tarih aralığı → başarılı işlemleri dışa aktarın.
2. Firestore `orders` koleksiyonundan aynı aralıktaki `status == "paid"` siparişleri alın.
3. Üç farkı arayın:
   - **PayTR'de başarılı, bizde `awaiting_payment`** → bildirim ulaşmamış; Bildirim URL'yi
     ve logları kontrol edin, siparişi elle tamamlayın.
   - **bizde `paid`, PayTR'de yok** → ciddi bulgu, hemen inceleyin.
   - **`pending_review`** → tutar / para birimi / ortam uyuşmazlığı; kapatılmadan sevkiyat yapılmaz.
4. İade ve iptalleri ayrıca eşleştirin.

---

## 8. Sık karşılaşılan hatalar

| Belirti | Olası neden |
|---|---|
| `cardEnabled: false` kaldı | `PAYTR_*` üçlüsünden biri veya `FIREBASE_SERVICE_ACCOUNT` eksik ya da deploy yenilenmedi |
| Checkout'ta "Kart ile ödeme şu anda kullanılamıyor" | Aynı sebep. **Hangi değişkenin eksik olduğunu görmek için** aşağıya bakın |
| PayTR `status: failed`, "Zorunlu alan degeri gecersiz: ..." | İlgili alan boş/geçersiz gidiyor; `PAYTR_DEBUG_ON=1` ile ayrıntıyı görün |
| `paytr_token` hatası | `merchant_key`/`merchant_salt` yanlış veya alan sırası bozulmuş |
| Ödeme alınıyor ama sipariş `awaiting_payment` | Panelde Bildirim URL tanımsız/yanlış |
| `notify_bad_hash` logları | Panelde başka mağazanın anahtarları ya da salt yanlış |
| Sipariş `pending_review`'da takılıyor | Tahsil edilen tutar sipariş tutarıyla uyuşmuyor — logdaki `problems` alanına bakın |
| iframe açılmıyor | CSP'de `frame-src https://www.paytr.com` eksik (bkz. `vercel.json`) |


### "Kart ile ödeme şu anda kullanılamıyor" — hangi değişken eksik?

Bu mesaj kasıtlı bir davranıştır ("fail closed"): yapılandırma eksikken kart
ödemesi açılmaz, checkout EFT/havaleye düşer, hiçbir koşulda sahte başarı üretilmez.
Sebebi öğrenmek için:

```bash
curl -s https://efemiletisim.com/api/payment/config
```

Yanıttaki `paytr` alanı sebebi adıyla söyler — **değerlerin hiçbir parçası dönmez**:

```json
"paytr": {
  "present": ["PAYTR_MERCHANT_ID"],
  "missing": ["PAYTR_MERCHANT_KEY", "PAYTR_MERCHANT_SALT"],
  "ok": false
}
```

| Alan | Anlamı |
|---|---|
| `missing` boş değil | O değişkenler Vercel Production ortamında tanımlı değil |
| `suspicious` var | Değer tanımlı ama tırnak içinde yapıştırılmış ya da başında/sonunda boşluk var; PayTR imzası tutmaz |
| `serviceAccount.parsed: false` | `FIREBASE_SERVICE_ACCOUNT` okunamıyor; `reason` alanı aşamayı söyler |

Değişkeni ekledikten sonra **yeni bir deploy** gerekir: Vercel ortam değişkenleri
derleme anında değil çalışma anında okunur, ama mevcut sunucu örnekleri eski değerle
ayakta kalabilir. Vercel → Deployments → son deploy → Redeploy.

Yerelde aynı sorgu `http://localhost:3000/api/payment/config` ile çalışır; yerel
değerler `.env.local` dosyasından okunur (bkz. `dev-server.js`).

---

## 9. Güvenlik kuralları (değiştirmeyin)

- `PAYTR_MERCHANT_KEY` / `PAYTR_MERCHANT_SALT` ve servis hesabı **hiçbir zaman**
  istemci koduna, repoya veya loga girmez.
- Kart numarası/CVV bu projede hiçbir yerde toplanmaz, taşınmaz, saklanmaz.
- Ödeme sonucu tarayıcıdan gelen veriye göre belirlenmez; yalnız imzalı bildirim yazar.
- Tutar istemciden alınmaz.
- `hash` doğrulanmayan bildirim hiçbir durumu değiştirmez.
- Bildirim işlendiğinde PayTR'ye gövdesi **tam olarak `OK`** olan yanıt dönülür.
- `merchant_oid` alfanumeriktir; sipariş numarası üretimi bunu garanti eder.

## 10. Taksit (tablo + ödeme adımı)

Taksit **açıktır**, üst sınır **12**. İki parça var ve ikisi tek kaynaktan beslenir:

| Parça | Nerede | Ne yapar |
|---|---|---|
| Ödeme adımı | `api/_lib/env.js` → `installmentSettings()` | PayTR'ye `no_installment` / `max_installment` gönderir |
| Vitrin tablosu | `js/paytr-installments.js` | Ürün, sepet ve ödeme sayfasında taksit tablosunu gösterir |

Vitrindeki tablo taksit sayısını **kendisi bilmez**; `/api/payment/config` ucundan okur.
O uç da sunucunun PayTR'ye gerçekten göndereceği ayarı döndürür. Sonuç:

- Kart ödemesi kapalıysa veya taksit kapalıysa tablo **hiç gösterilmez**.
- `PAYTR_MAX_INSTALLMENT` neyse tablo da o kadar taksit gösterir.

Yani müşteriye vitrinde gösterilen taksit, ödeme ekranında bulacağı taksittir.
Sınırı değiştirmek için **tek bir yeri** değiştirmek yeterlidir: ortam değişkeni.

### Ortam değişkenleri

```
PAYTR_NO_INSTALLMENT=0     # 0 = taksit açık, 1 = kapalı
PAYTR_MAX_INSTALLMENT=12   # 1-12 arası üst sınır (0 = sınır yok)
```

Bunları Vercel → Project → Settings → Environment Variables altında **Production**
ortamına girin. Kodun kendi varsayılanı kapalıdır: değişken tanımlı değilse taksit
görünmez ("fail closed"), yani yanlışlıkla açık kalmaz.

Taksidin ayrıca **PayTR mağaza panelinde de tanımlı** olması gerekir. Panelde kapalıyken
`PAYTR_NO_INSTALLMENT=0` yapmak taksit sunmaz.

> **Mevzuat:** elektronik ve telekomünikasyon ürünlerinde BDDK taksit kısıtları vardır ve
> kategoriye göre değişir. Buradaki 12 sınırı mağaza sahibinin kendi kategorisi için
> doğruladığı değerdir. Yeni bir kategori satışa girerse sınır yeniden doğrulanmalıdır.

### Tablo nasıl gösteriliyor

PayTR'nin ham çıktısı 9 kart programı için 2'den 12'ye kadar **her** taksidi ayrı
satır olarak, alt alta basıyor: 9 × 11 = 99 satır, yaklaşık 5000 piksel. Üstelik
dokuz programın oranları çoğu zaman birebir aynı, yani aynı sayılar dokuz kez
tekrarlanıyor.

`js/paytr-installments.js` çıktıyı okuyup yeniden çiziyor:

- Yalnız **3 / 6 / 9 / 12** taksit gösteriliyor, **yan yana** (`PAYTR_GOSTERILEN`).
- Oranları **birebir aynı** olan kart programları tek grupta toplanıyor; grubun
  logoları tablonun altına diziliyor.
- Oranlar farklıysa gruplar **ayrı** gösteriliyor. Birleştirme yalnız gerçekten
  aynı olan satırlar için yapılır — mağaza bir banka için özel kampanya
  tanımlarsa o banka kendi grubunda kalır.
- Müşteri kart programını seçince yalnız o programın seçenekleri kalıyor.

Tutarlar PayTR'nin döndürdüğü metinden **alındığı gibi** kullanılır; istemcide
hiçbir taksit hesabı yapılmaz. Üçüncü taraf içeriği olduğu için DOM düğümleri
`textContent` ile kurulur, `innerHTML` ile değil.

Sonuç: bölüm yüksekliği ~5100 px'ten ~290 px'e indi.

Sütun sayısını **kutunun** genişliği belirler (`@container`), görüntü alanı değil:
aynı masaüstü genişliğinde tablo ürün sayfasında 565 px, ödeme sayfasının özet
sütununda 380 px yer kaplıyor. Görüntü alanına bakan bir kural ödeme sayfasında
4 sütun bırakıp metni taşırıyordu. Varsayılan 2 sütun; konteyner sorgusunu
desteklemeyen tarayıcıda da hiçbir yerde taşma olmaz.

### Müşterinin kendi kartına ait taksitler

Tablonun üstündeki **Kartınız** şeridinden kart programı (Bonus, Axess, World…)
seçilebilir; seçilince yalnız o programın oranları kalır. Bu seçim için kart
numarası **istenmez**.

Gerçek karta özel seçenekleri — kartın hangi bankaya ait olduğu, o karta özel
kampanyalar — **PayTR'nin kendi ödeme formu** gösterir. Kart bilgisi
`odeme-guvenli.html` içindeki PayTR iframe'ine girilir; bu projede kart numarası
hiçbir zaman toplanmaz, taşınmaz, saklanmaz.

> Bunu kendi tarafımızda yapmak, kartın ilk hanelerini (BIN) checkout'ta
> toplamayı gerektirirdi. `CLAUDE.md` bunu açıkça yasaklıyor: "Checkout'a kart
> alanı geri eklenmez." Bu yüzden ödeme sayfasındaki dipnot, karta özel
> seçeneklerin PayTR formunda görüneceğini söyler.

### Tablo bileşeninin parametreleri

| Parametre | Değer | Anlamı |
|---|---|---|
| `token` | `ba98…b395` | Tablo bileşeninin genel anahtarı |
| `merchant_id` | `743825` | Mağaza numarası |
| `amount` | sayfaya göre | Ürün fiyatı / sepet toplamı / ödenecek toplam |
| `taksit` | `/api/payment/config` → `maxInstallment` | Üst sınır (sabit yazılmaz) |
| `tumu` | `1` | Yalnız avantajlı değil, **tüm** seçenekler istenir |

Bilinmesi gerekenler:

- **Buradaki token gizli değildir.** Tablo herkese açık bir sayfada gömülü çalışır, yani
  zaten ziyaretçiye görünür. `PAYTR_MERCHANT_KEY` / `PAYTR_MERCHANT_SALT` ile karıştırmayın;
  onlar ödeme imzasında kullanılır ve **yalnız sunucu ortam değişkeninde** durur.
- **Tablo tahsilatı belirlemez.** Bilgilendirmedir. Ödeme akışında sepet sunucuda yeniden
  fiyatlanmaya devam eder; istemciden tutar alınmaz.
- Sayfada sadece **bir** tablo olabilir: PayTR sabit `id="paytr_taksit_tablosu"` bekliyor.
- `amount=0` gönderilirse PayTR boş yanıt döndürür; bu durumda bölüm gizlenir.
- Tutar biçimi esnektir (`1881.38`, `162,10`, `2.640,50` kabul ediliyor); kod her zaman
  nokta ayraçlı iki basamaklı sade biçim üretir (`23459.00`).
- PayTR'ye ulaşılamazsa bölüm sessizce gizlenir; sayfa bozulmaz.

### Doğrulama

- `npm run test:payment` → 10. bölüm: ayar yokken taksidin kapalı bildirildiğini,
  `0`/`12` verildiğinde hem `/api/payment/config` hem de PayTR'ye giden isteğin aynı
  sınırı söylediğini, aralık dışı bir değerin (13) kabul edilmediğini doğrular.
- `npm run test:installments` → çıktı okuma ve gruplama: yalnız 3/6/9/12'nin
  kaldığını, üst sınırın uygulandığını, aynı oranlı kartların birleştiğini ve
  **farklı oranlıların birleştirilmediğini** doğrular. Son madde önemli: yanlış
  birleştirme müşteriye olmayan bir taksit tutarı gösterirdi.
