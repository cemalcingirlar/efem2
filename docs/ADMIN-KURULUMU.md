# Yönetim paneli kurulumu (ürün · kupon · görsel)

Bu belge `admin.html` panelinin ve arkasındaki `/api/admin/*` uçlarının nasıl
çalıştığını ve canlıya almak için nelerin yapılması gerektiğini anlatır.

---

## 1. Kısaca mimari

```
tarayıcı (admin.html)
   │  Firebase e-posta/şifre girişi  →  ID token
   ▼
POST /api/verify-admin              ← yetki SUNUCUDA doğrulanır
   │  (ID token + doğrulanmış e-posta + ADMIN_EMAILS listesi)
   ▼
/api/admin/products · /api/admin/coupons · /api/admin/upload · /api/admin/orders
   │  Firebase Admin SDK (kurallardan muaf)
   ▼
Firestore: products, coupons, orders     Storage: products/…
```

Vitrin tarafı ise:

```
js/data.js  →  GET /api/catalog  →  Firestore `products`
               (BASE_PRODUCTS üzerine biner, hata olursa statik listede kalır)

js/cart.js  →  POST /api/coupon/validate  →  Firestore `coupons`
```

### Neden istemci doğrudan Firestore'a yazmıyor?

Ürün fiyatı ve kupon tanımı **sipariş tutarını belirler**. Tarayıcıya yazma
izni verilmiş olsaydı, panel oturumu ele geçiren biri fiyatı 1 ₺ yapıp sipariş
verebilir ya da kendine %90 kupon tanımlayabilirdi. Bu yüzden:

- `firestore.rules` → `products` yazmaya kapalı, `coupons` okumaya da kapalı,
- `storage.rules` → herkes okur, **kimse yazamaz**,
- bütün yazma işlemleri sunucudaki yönetici doğrulamasından geçer.

Panelin giriş ekranı bir güvenlik sınırı değildir; statik HTML'i herkes
indirebilir. Sınır, verinin bulunduğu yerdedir — yetkisiz bir tarayıcı paneli
açsa bile hiçbir veri göremez ve hiçbir şey yazamaz.

---

## 2. Ortam değişkenleri (Vercel → Settings → Environment Variables)

| Değişken | Zorunlu | Açıklama |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | evet | Servis hesabı JSON'unun tamamı (tek satır veya base64) |
| `ADMIN_EMAILS` | evet | Yönetici e-postaları, virgülle ayrılmış |
| `FIREBASE_STORAGE_BUCKET` | hayır | Boşsa `<project_id>.firebasestorage.app` varsayılır |

Bu üçü olmadan panel **fail closed** davranır: giriş ekranı açılır ama
`/api/verify-admin` `503 store_unavailable` veya `503 admin_not_configured`
döner ve panele girilemez. Sahte bir "başarılı giriş" üretilmez.

---

## 3. Yönetici hesabı oluşturma

Bu projede ayrı bir "admin kaydı" yoktur. Yönetici = **normal bir Firebase
kullanıcısı** + e-postası `ADMIN_EMAILS` listesinde olan hesap.
Custom claim ayarlamaya gerek yoktur.

> ⚠️ Hesabı **Firebase Console → Authentication → Add user** ile açmayın.
> O yolla oluşan kullanıcının `emailVerified` değeri `false` kalır ve Console'da
> bunu doğrulanmış yapan bir düğme yoktur. Panel doğrulanmış e-posta şart
> koştuğu için hesap `403 email_unverified` alır.

### Doğru yol — siteden kayıt ol

1. `https://efemiletisim.com/hesap.html?tab=register` (yerelde
   `http://localhost:3000/hesap.html?tab=register`) adresinden ad, soyad,
   e-posta ve şifre ile kayıt olun.
2. Firebase doğrulama e-postasını gönderir; gelen kutusundaki bağlantıya tıklayın.
   (Gelmezse spam klasörüne bakın; gönderen `noreply@efemiletisim.firebaseapp.com`.)
3. Aynı e-postayı `ADMIN_EMAILS` değişkenine ekleyip projeyi **yeniden deploy
   edin** — Vercel ortam değişkenleri yalnız yeni dağıtımda etkinleşir.
4. `admin.html` adresinden bu hesapla giriş yapın.

Kayıt akışı hesabı oluştururken Firestore'da `users/{uid}` profilini de yazar;
Console'dan açılan kullanıcıda bu doküman oluşmaz.

### Alan adı yetkilendirmesi

Firebase Console → Authentication → Settings → **Authorized domains** listesinde
`efemiletisim.com` bulunmalıdır. `localhost` varsayılan olarak yetkilidir.

---

## 4. Güvenlik kurallarını yayınlama

Kurallar repoda hazır; **deploy etmesi gereken sizsiniz**.

`firestore.rules` içindeki yeni bölüm:

```
match /products/{productId} {
  allow read: if true;
  allow create, update, delete: if false;
}

match /coupons/{couponCode} {
  allow read, write: if false;
}
```

`storage.rules` (yeni dosya):

```
service firebase.storage {
  match /b/{bucket}/o {
    match /products/{allPaths=**} {
      allow read: if true;
      allow write: if false;
    }
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

Yayınlama:

```bash
firebase deploy --only firestore:rules,storage
```

Ya da Firebase Console → Firestore → Rules ve Storage → Rules ekranlarından
yapıştırıp **Publish**.

> Storage kuralları ilk kez yayınlanacaksa önce Firebase Console → Storage
> ekranından kovanın **oluşturulmuş** olması gerekir.

---

## 5. Panelin kullanımı

### Ürünler

- **Ürün Ekle** → form doldurulur → `POST /api/admin/products`.
- Kod içindeki katalogda (`js/data.js` → `BASE_PRODUCTS`) tanımlı bir ürün
  düzenlenirse Firestore'a bir kopyası yazılır ve onun üzerine biner.
- **Sil** aynı ürün statik katalogda da varsa onu tamamen silmez, orijinal
  hâline döndürür (panel bunu ayrıca söyler).
- Formda düzenlenmeyen alanlar (varyantlar, renk görselleri, galeri) düzenleme
  sırasında korunur — bir fiyat güncellemesi renk seçeneklerini silmez.
- `priceKurus` alanı **istemciden alınmaz**, `price` üzerinden sunucuda
  hesaplanır. Ödeme akışı yalnız bu alanı okur.

### Görseller

- "Bilgisayardan Yükle" → tarayıcıda 1200 px'e küçültülür → `POST /api/admin/upload`.
- Sunucu içerik türünü **dosyanın ilk baytlarından** doğrular (gönderilen
  `contentType`'a güvenilmez), dosya adını yeniden üretir ve Storage'a yazar.
- Sınır: 3 MB. Kabul edilenler: JPG, PNG, WEBP, AVIF, GIF.

### Kuponlar

| Alan | Anlamı |
|---|---|
| Kod | 3–24 karakter, harf/rakam/tire. Büyük harfe çevrilir, birincil anahtardır |
| Tip | `fixed` (₺) veya `percent` (%) |
| Değer | ₺ ya da yüzde. Yüzde en fazla 90, sabit en fazla 100.000 ₺ |
| Minimum sepet | Bu tutarın altındaki sepetlerde kupon çalışmaz |
| Son kullanma | Boş bırakılabilir |
| Aktif | Kapalıyken kod geçerli olsa bile kullanılamaz |

Panel ₺ girer, Firestore'a **kuruş** yazılır; bütün sipariş hesapları kuruş
üzerinden yapılır.

İndirim müşterinin tarayıcısında değil, sipariş oluşturulurken sunucuda
hesaplanır. Sepette gösterilen tutarla oynamak ödenecek tutarı değiştirmez.
Sepet değişirse uygulanan kupon otomatik düşer ve yeniden doğrulanması gerekir.

---

## 6. Kurulumu doğrulama — tek adres

```bash
curl -s https://efemiletisim.com/api/payment/config
```

Her şey yerindeyse:

```json
{
  "orderApiEnabled": true,
  "serviceAccount": { "present": true, "parsed": true, "projectId": "efemiletisim" },
  "adminEmails":    { "present": true, "valid": 1, "invalid": 0 }
}
```

### `serviceAccount` hata kodları

| `reason` | Anlamı | Çözüm |
|---|---|---|
| `not_set` | Değişken sunucuya ulaşmamış | Production ortamına ekle, sonra **redeploy** |
| `not_json_not_base64` | Değer var ama `{` ile başlamıyor | Yanlış şey yapıştırılmış — `hint` ve `length` alanına bak |
| `invalid_json` | JSON kırpılmış | Dosyanın tamamı kopyalanmamış |
| `missing_fields` | Alan eksik | Yanlış dosya (servis hesabı değil) |

`hint` değerinin anlamı: `tirnak_icinde_yapistirilmis`, `windows_dosya_yolu`,
`unix_dosya_yolu`, `dosya_adi`, `sadece_private_key`, `web_api_key`, `bilinmiyor`.

`length` de çok işe yarar — doğru bir servis hesabı JSON'u **~2.300 karakterdir**:

| Görülen uzunluk | Muhtemelen yapıştırılan |
|---|---|
| ~180 | Firebase Console'daki "Admin SDK configuration snippet" kod örneği |
| ~24–60 | Bir e-posta adresi veya dosya adı |
| ~2.300 | Doğru dosya |

> ⚠️ **Değişkeni kaydetmek yetmez.** Vercel ortam değişkenlerini yalnız dağıtım
> oluşturulurken okur; çalışan site eski değerlerle devam eder. Kaydettikten sonra
> Deployments → en üstteki → **⋯ → Redeploy**. Kontrol ederken de o an canlıda
> olan dağıtımın senin düzeltmenden SONRA oluşturulduğundan emin ol.

### `adminEmails`

`valid` kaç geçerli adres olduğunu söyler. `0` ise (`no_valid_email`) değişkene
e-posta dışında bir şey yazılmış demektir. Adresler güvenlik gereği dönmez.

---

## 7. Doğrulama listesi (canlıya çıkmadan)

- [ ] `ADMIN_EMAILS` dışındaki bir hesapla giriş → panel açılmıyor, `403`
- [ ] Doğru hesapla giriş → panel açılıyor, ürün listesi sunucudan geliyor
- [ ] Panelden yeni ürün eklendi → `urunler.html` sayfasında **başka bir
      tarayıcıda** görünüyor
- [ ] Ürünün fiyatı değiştirildi → sepette ve ödeme özetinde yeni fiyat
- [ ] Görsel yüklendi → ürün kartında görünüyor, URL `storage.googleapis.com`
- [ ] Kupon oluşturuldu (aktif) → sepette uygulanıyor, toplam düşüyor
- [ ] Aynı kupon kapatıldı → sepette "kullanıma kapalı" uyarısı
- [ ] `firestore.rules` ve `storage.rules` yayınlandı

---

## 8. Testler

```bash
npm run test:admin:catalog
```

Kapsam: yetki kapısı (401/403/503), `priceKurus`'un fiyattan türetilmesi,
Firestore ürününün statik katalogun üzerine binmesi ve sipariş tutarını
belirlemesi, kupon doğrulama kuralları, indirimin sepeti aşamaması, görsel
yüklemede içerik türü denetimi ve dosya adının yeniden üretilmesi.

Tümü: `npm test`
