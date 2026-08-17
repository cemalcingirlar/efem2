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
| PayTR `status: failed`, "Zorunlu alan degeri gecersiz: ..." | İlgili alan boş/geçersiz gidiyor; `PAYTR_DEBUG_ON=1` ile ayrıntıyı görün |
| `paytr_token` hatası | `merchant_key`/`merchant_salt` yanlış veya alan sırası bozulmuş |
| Ödeme alınıyor ama sipariş `awaiting_payment` | Panelde Bildirim URL tanımsız/yanlış |
| `notify_bad_hash` logları | Panelde başka mağazanın anahtarları ya da salt yanlış |
| Sipariş `pending_review`'da takılıyor | Tahsil edilen tutar sipariş tutarıyla uyuşmuyor — logdaki `problems` alanına bakın |
| iframe açılmıyor | CSP'de `frame-src https://www.paytr.com` eksik (bkz. `vercel.json`) |

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
