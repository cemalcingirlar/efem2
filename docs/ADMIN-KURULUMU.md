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

1. Firebase Console → Authentication → Users → **Add user** (e-posta + şifre).
2. Hesapla siteye bir kez giriş yapıp **e-posta doğrulama** bağlantısını
   tıklayın. Doğrulanmamış e-posta panele giremez (`403 email_unverified`).
3. Adresi `ADMIN_EMAILS` listesine ekleyip projeyi yeniden deploy edin.

Custom claim ayarlamaya gerek yoktur; yetki listesi ortam değişkenindedir.

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

## 6. Doğrulama listesi (canlıya çıkmadan)

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

## 7. Testler

```bash
npm run test:admin:catalog
```

Kapsam: yetki kapısı (401/403/503), `priceKurus`'un fiyattan türetilmesi,
Firestore ürününün statik katalogun üzerine binmesi ve sipariş tutarını
belirlemesi, kupon doğrulama kuralları, indirimin sepeti aşamaması, görsel
yüklemede içerik türü denetimi ve dosya adının yeniden üretilmesi.

Tümü: `npm test`
