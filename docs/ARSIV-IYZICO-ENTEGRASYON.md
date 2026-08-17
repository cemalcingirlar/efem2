> **ARŞİV — ARTIK GEÇERLİ DEĞİL.** Ödeme sağlayıcısı 2026-08-17 itibarıyla **PayTR**'ye
> taşındı. Güncel kurulum ve işletim rehberi: `docs/PAYTR-ENTEGRASYON.md`.
> Bu dosya yalnızca geçmişe dönük referans için tutuluyor.

# iyzico Entegrasyonu — Kurulum, Test ve İşletim Rehberi

Bu dosya, ödeme altyapısının **nasıl çalıştığını** ve **canlıya nasıl alınacağını** anlatır.
Denetim bulguları için: `docs/IYZICO-DENETIM-RAPORU.md`.

---

## 0. Şu anki durum (önemli)

Ödeme kodu hazır ama **kart ödemesi kapalı**. Ortam değişkenleri girilmediği sürece:

- `/api/payment/config` → `cardEnabled: false` döner,
- checkout'ta kart sekmesi devre dışı görünür, müşteri EFT/havale ile devam eder,
- hiçbir koşulda "ödeme başarılı" taklidi yapılmaz.

Yani bu haliyle deploy etmek **güvenlidir**; aşağıdaki adımlar tamamlandığında kart
ödemesi kendiliğinden açılır.

---

## 1. Mimari özet

| Parça | Dosya | Görev |
|---|---|---|
| Yetenek sorgusu | `api/payment/config.js` | Kart ödemesi açık mı? |
| Ödeme başlatma | `api/payment/initialize.js` | Sepeti sunucu fiyatlarıyla hesaplar, siparişi açar, iyzico ödeme sayfasını alır |
| Dönüş | `api/payment/callback.js` | Tarayıcı dönüşü; sonucu iyzico'dan **sorgular** |
| Webhook | `api/payment/webhook.js` | Sunucudan sunucuya bildirim; `X-IYZ-SIGNATURE-V3` doğrular |
| Sonuçlandırma | `api/_lib/settle.js` | Callback ve webhook'un ortak karar mantığı (idempotent) |
| iyzico istemcisi | `api/_lib/iyzico.js` | IYZWSv2 imzası, endpoint'ler, yanıt imzası doğrulama |
| Sipariş defteri | `api/_lib/store.js` | Firestore (Firebase Admin) |
| Fiyat otoritesi | `api/_lib/orders.js` + `api/_lib/catalog.json` | Sepet fiyatlaması, doğrulama, sipariş kimlikleri |
| EFT siparişi | `api/order/eft.js` | Kartsız sipariş |
| Sipariş durumu | `api/order/status.js` | Sonuç sayfasının okuduğu uç |
| Checkout | `odeme.html`, `js/payment.js` | Kart verisi **toplamaz**, yönlendirir |
| Sonuç | `odeme-sonuc.html` | Durumu sunucudan okur |

**Temel ilke:** finansal doğruluğun kaynağı tarayıcı değil, iyzico'nun retrieve yanıtıdır.
Bir sipariş ancak imza + `conversationId` + tutar + fraud kontrolleri geçtiğinde `paid` olur.

### Sipariş durumları

| Durum | Anlamı | Sevkiyat |
|---|---|---|
| `awaiting_payment` | Ödeme sayfasına yönlendirildi, sonuç bekleniyor | Hayır |
| `awaiting_transfer` | EFT/havale bekleniyor | Hayır |
| `paid` | Ödeme doğrulandı | Evet |
| `pending_review` | Para çekilmiş olabilir ama doğrulama tam değil | **Hayır — önce inceleyin** |
| `failed` | Ödeme alınamadı | Hayır |

---

## 2. Kurulum

### 2.1 iyzico anahtarları

iyzico Merchant Panel → **Ayarlar → API Anahtarları**. Sandbox ve production
anahtarları **farklıdır**, karıştırmayın.

### 2.2 Firebase servis hesabı

Firebase Console → ⚙️ **Proje Ayarları → Servis Hesapları → Yeni özel anahtar üret**.
İnen JSON dosyasının içeriğinin tamamı `FIREBASE_SERVICE_ACCOUNT` değeri olur
(tek satır olarak yapıştırın; satır sonları JSON içinde `\n` olarak kalmalı).
Bu dosyayı **repoya koymayın**.

### 2.3 Vercel ortam değişkenleri

Vercel → Project → Settings → Environment Variables (Production + Preview):

```
IYZICO_API_KEY=...
IYZICO_SECRET_KEY=...
IYZICO_MODE=sandbox
SITE_BASE_URL=https://efemiletisim.com
ORDER_TOKEN_SECRET=<openssl rand -hex 32 çıktısı>
FIREBASE_SERVICE_ACCOUNT={"type":"service_account", ... }
```

Şablon: `.env.example`. Değişiklikten sonra **yeniden deploy** gerekir.

### 2.4 Webhook adresi

iyzico Merchant Panel → Ayarlar → Webhook:

```
https://efemiletisim.com/api/payment/webhook
```

Sandbox ve production panellerinde ayrı ayrı tanımlanır.

### 2.5 Firestore kuralları

```bash
firebase deploy --only firestore:rules
```

Sunucu sipariş API'si çalıştıktan sonra `firestore.rules` içindeki
`users/{userId}` kuralını yorumdaki katı sürümle değiştirin (denetim bulgusu F-06).

---

## 3. Yerel test

```bash
npm install
npm run test:payment
node dev-server.js
```

`dev-server.js`, `/api/*` isteklerini Vercel Functions ile aynı imzayla çalıştırır ve
varsa `.env.local` dosyasını yükler. Yerelde gerçek ödeme testi yapacaksanız
`SITE_BASE_URL` yerel adresinize işaret etmeli ve iyzico'nun bu adrese callback
gönderebilmesi için tünel (ör. ngrok) gerekir.

**Katalog değiştiğinde (fiyat, yeni ürün, yeni renk/beden) mutlaka çalıştırın:**

```bash
npm run sync-catalog     # js/data.js → api/_lib/catalog.json
```

```bash
npm run check-catalog    # fark varsa hata verir (commit öncesi kontrol)
```

Sunucu, sepeti bu dosyadaki fiyatlarla hesaplar ve müşterinin seçtiği varyantı
`sku` üzerinden doğrular. Katalog güncellenmezse yeni ürün/varyant siparişleri
**reddedilir** — yanlış tahsilat olmaz ama sipariş alınamaz.

Tarayıcının sunucuya gönderdiği tek sepet bilgisi: `{ id, sku, qty }`.
Fiyat, toplam, renk ve beden metni gönderilmez; hepsi katalogdan okunur.

---

## 4. Sandbox kabul testleri (production'a geçmeden önce)

`IYZICO_MODE=sandbox` ile aşağıdakiler koşulmadan production'a geçilmemelidir.
Test kartları iyzico'nun resmî dokümantasyonundadır (kod içine gömülmemiştir).

| # | Test | Beklenen |
|---|---|---|
| 1 | Başarılı ödeme | Sonuç sayfası "ödemeniz alındı", `orders/{id}.status = paid`, tutar sepetle aynı, sipariş maili gitti |
| 2 | 3DS başarısız / yetersiz bakiye | Sipariş `failed`, sepet korunuyor, kullanıcıya anlaşılır mesaj |
| 3 | Ödeme sayfasında "vazgeç" | Sipariş `paid` olmuyor, kartta çekim yok |
| 4 | Ödeme sonrası sekmeyi kapat (callback gelmez) | Webhook siparişi `paid` yapıyor |
| 5 | Callback'i aynı `token` ile 5 kez tekrar gönder | Durum değişmiyor, ikinci sipariş/mail oluşmuyor |
| 6 | Webhook'u bozuk imzayla gönder | `401`, veritabanında değişiklik yok |
| 7 | DevTools'tan sepet fiyatını değiştir | Sunucu gerçek fiyatı kullanıyor (`/api/payment/initialize` gövdesinde fiyat zaten gönderilmiyor) |
| 8 | Ödeme butonuna hızlı çift tıklama | Tek ödeme sayfası açılıyor, çift çekim yok |
| 9 | Mobil tarayıcıda tam akış | Yönlendirme ve dönüş sorunsuz |
| 10 | `/api/order/status` başka bir jetonla | `403` |

Her testin sonucunu (ekran görüntüsü + `orders` kaydı + Vercel log satırı) kanıt
paketine ekleyin.

---

## 5. Production'a geçiş

1. Sandbox testleri (bölüm 4) tamamlandı ve kanıtlandı.
2. iyzico merchant hesabı onaylandı, evraklar yüklendi.
3. `IYZICO_MODE=production`, production `IYZICO_API_KEY` / `IYZICO_SECRET_KEY` girildi.
4. Production panelinde webhook adresi tanımlandı.
5. `SITE_BASE_URL` gerçek domain.
6. Deploy sonrası `https://efemiletisim.com/api/payment/config` → `{"cardEnabled":true,"mode":"production"}`.
7. **Kendi kartınızla en düşük tutarlı bir gerçek sipariş verin**, sonra iyzico panelinden
   iade edin. Bu ilk gerçek testtir; atlamayın.
8. İlk hafta günlük mutabakat (denetim raporu bölüm 9).

---

## 6. İşletim

### Günlük

- Vercel → Logs → `[payment]` satırları. Aranacaklar: `signature_invalid`,
  `amount_mismatch`, `conversation_mismatch`, `settle_retrieve_failed`, `webhook_bad_signature`.
- `pending_review` durumundaki siparişler: para çekilmiş olabilir, sevkiyat yapılmaz,
  24 saat içinde müşteriyle iletişime geçilir.

### İade / iptal (şu an manuel)

- **Aynı gün** yapılan işlem → iyzico panelinden **iptal (cancel)**.
- **Sonraki günler** → **iade (refund)**. İkisi farklı işlemlerdir.
- İşlem sonrası `orders/{id}` kaydını Firebase Console'dan `refunded` / `cancelled`
  yapın; bu iki durum "terminal" kabul edilir ve webhook tarafından geri alınmaz.

### Taksit açmak

`IYZICO_ENABLED_INSTALLMENTS=1,3,6` gibi. Açmadan önce:
merchant hesabınızda tanımlı mı, ve BDDK'nın **denetim tarihindeki güncel** taksit
sınırları elektronik/telekomünikasyon ürünleri için ne diyor — ikisini de teyit edin.

---

## 7. Sık karşılaşılan hatalar

| Belirti | Olası neden |
|---|---|
| `cardEnabled: false` kaldı | `IYZICO_API_KEY`/`IYZICO_SECRET_KEY` veya `FIREBASE_SERVICE_ACCOUNT` eksik ya da deploy yenilenmedi |
| `initialize_failed`, iyzico `errorCode` döndürüyor | Anahtar/ortam uyumsuzluğu, hesapta ürün aktif değil, `callbackUrl` erişilemez |
| `signature_invalid` (initialize) | Yanlış `secretKey` — mode ile anahtar eşleşmiyor |
| Callback geliyor ama sipariş bulunamıyor | `SITE_BASE_URL` yanlış; callback farklı bir deploy'a gidiyor |
| `webhook_bad_signature` | Panelde başka bir hesabın webhook'u tanımlı ya da eski V1/V2 bekleniyor |
| Sipariş `pending_review`'da takılıyor | Tutar/`conversationId`/imza uyuşmazlığı — logdaki `problems` alanına bakın |

---

## 8. Güvenlik kuralları (değiştirmeyin)

- `IYZICO_SECRET_KEY` ve servis hesabı **hiçbir zaman** istemci koduna, repoya veya loga girmez.
- Kart numarası/CVV bu projede hiçbir yerde toplanmaz, taşınmaz, saklanmaz.
- Ödeme sonucu tarayıcıdan gelen veriye göre belirlenmez.
- Tutar istemciden alınmaz.
- İmza doğrulanamayan ödeme `paid` yapılmaz.
