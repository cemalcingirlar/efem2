# efemiletisim.com — Arkadaşın Yapacakları (Vercel + Firebase hesabı gerekli)

Bu dosya, kendi Vercel ve Firebase hesabına bağlı bir AI kod asistanına (Claude Code, Cursor vb.)
doğrudan yapıştırabileceğin hazır prompt'lar içerir. Bu işleri ben (proje sahibinin AI asistanı)
yapmadım çünkü hesap erişimi (Vercel deploy, Firebase Console ayarları, gerçek PayTR mağaza
bilgileri) gerektiriyor — bunlar senin kendi hesabında, senin onayınla ilerlemeli.

Proje zaten bir Firebase projesine bağlı: `js/firebase-config.js` → project ID `efemiletisim`.
Bu config'i incelendi, kullanıcı auth + Firestore `users/{uid}` yapısı doğru ve tutarlı çalışıyor,
bilinen bir hata bulunmadı. Aşağıdaki maddeler eksik/yapılmamış özellikler, hata değil.

Her prompt'u sırayla, ayrı bir AI oturumunda kullan. Sırayı değiştirme — Prompt 1 (ödeme backend'i)
olmadan Prompt 2/3 çalışan bir sisteme oturmaz.

---

## Adım 0 — Domain Bağlama: efemiletisim.com (önce bunu yap, AI prompt değil)

Bu bölüm bir AI'ye yaptırılacak kod işi değil — Vercel ve Firebase panellerinde elle yapman
gereken tıklama adımları. Aşağıdaki 1 ve 2 numaralı adımlar olmadan site canlıda ya hiç açılmaz
ya da açılsa bile giriş/kayıt (Firebase Auth) çalışmaz. Sırayla yap, atlama.

### 1. Domain'i kendi Vercel hesabına bağla

1. [vercel.com](https://vercel.com) → kendi hesabınla giriş yap.
2. Bu projeyi Vercel'e getir: ya GitHub reposunu Vercel'e import et (Vercel Dashboard →
   "Add New" → "Project" → repoyu seç), ya da lokalde `vercel` CLI ile `vercel --prod` çalıştır.
   Repo zaten `vercel.json` içeriyor, ekstra ayara gerek yok.
3. Proje oluşunca: **Project → Settings → Domains** sekmesine git.
4. "Add" butonuna bas, `efemiletisim.com` yaz, ekle. Aynı ekrandan `www.efemiletisim.com`'u da
   ayrıca ekle (ikisi de olsun, sonra biri diğerine yönlendirilir).
5. Vercel sana ekranda DNS kayıtları gösterecek — genelde apex domain (`efemiletisim.com`, yani
   `@`) için bir **A kaydı**, `www` için bir **CNAME kaydı**. **Ekranda sana yazan değerleri
   birebir kullan** — burada örnek bir IP/host yazmıyorum çünkü Vercel bunu hesabına göre
   üretiyor, elle uydurma.
6. Domain'i satın aldığın yerin (GoDaddy, Natro, İsimtescil, Turhost vb. — nereden aldıysanız
   oranın) DNS yönetim paneline gir. Vercel'in gösterdiği A ve CNAME kayıtlarını oraya ekle.
   Aynı isimde (`@` veya `www`) önceden var olan çakışan A/CNAME kaydı varsa onu sil, ikisi
   birlikte duramaz.
7. DNS değişikliğinin yayılması genelde 10 dakika–birkaç saat sürer, bazen 48 saate kadar
   çıkabilir. Vercel'in Domains ekranında domainin yanında yeşil tik / "Valid Configuration"
   yazısı çıkınca bağlantı tamamdır.
8. `www.efemiletisim.com` girenin `efemiletisim.com`'a (veya tersi) otomatik yönlenmesini
   istiyorsan, aynı Domains ekranında domainin yanındaki "Edit" → "Redirect to" seçeneğini
   kullan, hangisi ana adres olacaksa onu seç.

### 2. Firebase — domain'i yetkili (authorized) listesine ekle

1. [console.firebase.google.com](https://console.firebase.google.com) → proje `efemiletisim`
   seç (bu proje zaten `js/firebase-config.js` içinde bağlı, yeni proje açmana gerek yok).
2. Sol menüden **Authentication** → üstte **Settings** sekmesi → **Authorized domains** bölümü.
3. "Add domain" butonuna bas, `efemiletisim.com` yaz, kaydet. `www.efemiletisim.com`'u da ayrı
   bir satır olarak ekle (kullanıcı o adresten de giriş yapabilsin diye).
4. Bu adımı atlarsan ne olur: canlı sitede `hesap.html` üzerinden giriş/kayıt denendiğinde
   Firebase `auth/unauthorized-domain` hatası verir, kimse giriş yapamaz — sessizce bozuk kalır,
   fark etmesi zor olur, o yüzden domain bağlandıktan hemen sonra bunu yap.

### 3. İyzico — sadece gerçek ödemeye geçince (Prompt 1 tamamlandıktan sonra)

Şu an ödeme tamamen simülasyon (yukarıdaki "Ödemenin şu anki gerçek durumu" bölümüne bak), bu
adımın aciliyeti yok, Prompt 1 bittiğinde hatırla:

1. PayTR Mağaza panelinde (canlı hesaba geçtiğinde) alan adı ve Bildirim URL ayarı
   varsa `https://efemiletisim.com` olarak gir.
2. Test modundan canlıya geçerken `PAYTR_TEST_MODE=0` ve gerekiyorsa
   `PAYTR_*` ortam değişkenlerini Vercel Dashboard → Project → Settings →
   Environment Variables üzerinden gerçek (production) değerlerle güncelle.

Adım 1 ve 2 bitince bana haber ver, `efemiletisim.com` üzerinden ben de kontrol ederim.

---

## Öncelik sırası

1. ~~Prompt 1 — Gerçek ödeme entegrasyonu~~ ✅ **tamamlandı**; 2026-08-17'de sağlayıcı **PayTR**'ye taşındı. Geriye kalan: Adım 1'deki ortam değişkenleri, Bildirim URL ve test işlemleri.
2. ~~Prompt 2 — Admin panelini Firestore + Storage'a taşı, gerçek auth~~ ✅ **tamamlandı** (2026-08-18). Geriye kalan: Adım 2'deki yönetici hesabı + kural yayınlama.
3. ~~Prompt 3 — Sipariş yönetimi (misafir siparişleri dahil)~~ ✅ **tamamlandı** (2026-08-18)
4. ~~Prompt 4 — Kupon yönetim ekranı~~ ✅ **tamamlandı** (2026-08-18)
5. **Prompt 5 — Mobil app (opsiyonel, en son)**
6. 🟡 **Prompt 6 — CSP sıkılaştırma** — ödeme sayfası tamamlandı, kalan sayfalar bekliyor

Ayrıca aşağıda **senin doldurman gereken veriler** ve **iş kararı bekleyen konular** listesi var
(bunlar AI'nin yapabileceği iş değil, senin bilgi/karar vermen gerekiyor).

---

## ✅ Ödemenin şu anki durumu (2026-08-16 güncellemesi)

Ödeme artık **sahte değil**. Gerçek **PayTR iFrame API** entegrasyonu yazıldı:

- Kart numarası ve CVV bu sitede hiç toplanmıyor — müşteri PayTR'nin kendi güvenli ödeme
  sayfasına yönlendiriliyor.
- Ödenecek tutar sunucuda hesaplanıyor (tarayıcıdaki fiyat kabul edilmiyor).
- Sipariş "ödendi" bilgisi yalnızca PayTR'nin imzalı bildirimi doğrulandıktan sonra yazılıyor.

**Ama kart ödemesi şu anda KAPALI** — çünkü aşağıdaki ortam değişkenleri henüz girilmedi.
Bu haliyle site güvenle yayında kalabilir: checkout kart yerine EFT/havale sunar, hiçbir
koşulda "ödeme alındı" taklidi yapılmaz.

Kod tarafında yapılacak bir şey kalmadı; sıradaki adımlar **hesap erişimi gerektiren**
işler. Ayrıntılı rehber: `docs/PAYTR-ENTEGRASYON.md`, denetim raporu:
`docs/IYZICO-DENETIM-RAPORU.md`.

---

## Adım 1 — Ödemeyi açmak için yapman gerekenler (AI prompt'u değil, senin işin)

> **2026-08-17: Ödeme sağlayıcısı PayTR oldu.** Aşağıdaki adımlar iyzico için değil,
> PayTR içindir. Ayrıntılı rehber: `docs/PAYTR-ENTEGRASYON.md`.

### 1.1 PayTR mağaza bilgilerini al
PayTR Mağaza Paneli → **Bilgi → API Entegrasyon Bilgileri**: `merchant_id`,
`merchant_key`, `merchant_salt`. Bu üçü sırdır; kimseyle paylaşma, repoya koyma.

### 1.2 Firebase servis hesabı oluştur
Firebase Console → ⚙️ Proje Ayarları → Servis Hesapları → **Yeni özel anahtar üret**.
İnen JSON dosyasını kimseyle paylaşma, repoya koyma.

### 1.3 Vercel'e ortam değişkenlerini gir
Vercel → Project → Settings → Environment Variables (Production ve Preview için):

```
PAYTR_MERCHANT_ID=...
PAYTR_MERCHANT_KEY=...
PAYTR_MERCHANT_SALT=...
PAYTR_TEST_MODE=1
SITE_BASE_URL=https://efemiletisim.com
ORDER_TOKEN_SECRET=<rastgele 32+ karakter>
FIREBASE_SERVICE_ACCOUNT=<servis hesabı JSON'unun tamamı, tek satır>
```

Kaydettikten sonra **yeniden deploy et** (Deployments → Redeploy).

### 1.4 Bildirim URL'sini PayTR paneline yaz  ← ATLAMA
PayTR Mağaza Paneli → **Ayarlar → Bildirim URL**:
`https://efemiletisim.com/api/payment/notify`

Bu adım atlanırsa para tahsil edilir ama siparişler "ödeme bekleniyor" durumunda kalır.

### 1.5 Firestore kurallarını yayınla
```
firebase deploy --only firestore:rules
```

### 1.6 Test işlemlerini koş
`docs/PAYTR-ENTEGRASYON.md` → bölüm 4'teki 10 testi sırayla yap. Hepsi geçmeden
`PAYTR_TEST_MODE=0` yapma.

### 1.7 Kontrol
`https://efemiletisim.com/api/payment/config` adresi `{"cardEnabled":true,"mode":"test",...}`
dönmeli. Dönmüyorsa değişkenlerden biri eksiktir. Canlıya geçince `mode` `production` olur.

---

## Adım 2 — Yönetim panelini açmak için yapman gerekenler (AI prompt'u değil, senin işin)

Ayrıntılı anlatım: `docs/ADMIN-KURULUMU.md`

### 2.1 Yönetici hesabı oluştur

> ⚠️ Firebase Console → Authentication → **Add user** ile AÇMA. O yolla oluşan
> kullanıcının e-postası "doğrulanmamış" kalır ve Console'da bunu doğrulanmış
> yapan bir düğme yok; panel o hesabı içeri almaz.

1. `efemiletisim.com/hesap.html?tab=register` adresinden normal kullanıcı gibi kayıt ol.
2. Gelen doğrulama e-postasındaki bağlantıya tıkla (spam klasörüne de bak).
3. Bu e-postayı aşağıdaki `ADMIN_EMAILS` değişkenine yaz.

Yönetici = normal Firebase kullanıcısı + e-postası `ADMIN_EMAILS` listesinde olan hesap.
Ayrı bir "admin kaydı" yok.

### 2.2 Vercel ortam değişkenleri

| Değişken | Değer |
|---|---|
| `ADMIN_EMAILS` | yönetici e-postan (virgülle birden fazla yazılabilir) |
| `FIREBASE_SERVICE_ACCOUNT` | Adım 1.2'de aldığın servis hesabı JSON'u (aynısı) |
| `FIREBASE_STORAGE_BUCKET` | boş bırakılabilir; Firebase varsayılanı kullanılır |

### 2.3 Firebase Storage'ı aç
Firebase Console → Storage → **Get started**. Kova oluşmadan görsel yüklenemez.

### 2.4 Kuralları yayınla  ← ATLAMA

```bash
firebase deploy --only firestore:rules,storage
```

Ya da Console → Firestore → Rules ve Storage → Rules ekranlarından
`firestore.rules` / `storage.rules` içeriğini yapıştırıp **Publish**.

Bu adım yapılmazsa: `coupons` koleksiyonu tarayıcıdan okunabilir kalır ve
Storage'a yetkisiz yazma yolu açık kalabilir.

### 2.5 Kontrol
- [ ] Yetkisiz bir hesapla giriş → panel açılmıyor
- [ ] Yönetici hesabıyla giriş → panel açılıyor, ürünler sunucudan geliyor
- [ ] Panelden ürün ekle → `urunler.html` sayfasında **başka bir tarayıcıda** görünüyor
- [ ] Panelden görsel yükle → ürün kartında görünüyor
- [ ] Aktif bir kupon oluştur → sepette uygulanıyor, toplam düşüyor

---

## ~~Prompt 2 — Admin panelini Firestore + Storage'a taşı, gerçek auth~~ ✅ tamamlandı (2026-08-18)

**Ne yapıldı:** Panel giriş ekranı gerçek Firebase e-posta/şifre girişine bağlandı; yetki
sunucuda `/api/verify-admin` ile doğrulanıyor (ID token + doğrulanmış e-posta +
`ADMIN_EMAILS` listesi). Ürün ekle/düzenle/sil artık `localStorage` değil Firestore
`products` koleksiyonuna yazıyor; vitrin bu katalogu `/api/catalog` üzerinden okuyor.
Görsel yükleme Firebase Storage'a taşındı. Ayrıntı: `docs/ADMIN-KURULUMU.md`.

**Prompt'tan sapılan iki nokta ve sebebi:**

1. *Custom claim / `admins/{uid}` yerine `ADMIN_EMAILS` ortam değişkeni.*
   Custom claim ayarlamak için tek seferlik bir Admin SDK betiği çalıştırman gerekirdi;
   ortam değişkeni aynı güvenliği sağlıyor (kontrol yine sunucuda) ve yönetici eklemek
   Vercel panelinden bir satır değiştirmeye iniyor. Kontrolün istemciye kaymaması şartı
   korunuyor.

2. *İstemci Firestore'u doğrudan okumuyor, `/api/catalog` ucundan okuyor.*
   Kural yazmak yerine yazma yolunu tamamen kapattık: `products` koleksiyonuna ve
   Storage'a hiçbir tarayıcı yazamıyor, bütün yazma işlemleri Admin SDK ile sunucudan
   geçiyor. Ürün fiyatı sipariş tutarını belirlediği için "admin oturumu ele geçirilirse
   fiyat değiştirilebilir" riskini böyle kapattık. Okuma tarafında da site zaten statik;
   Firebase istemci SDK'sını her sayfaya bindirmemiş olduk.

**Senin yapman gerekenler:** aşağıdaki "Adım 2".


```
Bu proje efemiletisim.com — admin.html şu an tamamen demo seviyesinde:
- Admin şifresi client-side hardcoded ("admin" / "efemi2024" — admin.html kaynağında açıkça
  görünüyor, gerçek bir güvenlik değil).
- Ürünler localStorage'da tutuluyor (js/data.js'teki BASE_PRODUCTS'a admin panelden eklenenler
  ekleniyor) — tarayıcı değişince/temizlenince kaybolur, iki cihaz arasında senkron olmaz.
- Görsel yükleme yok, sadece URL yapıştırma var.

Firebase projesi zaten bağlı (js/firebase-config.js, project ID: efemiletisim), Firestore'da
users/{uid} koleksiyonu zaten kullanılıyor (bkz. js/firebase-auth.js). Bunu genişleteceğiz.

Yapman gerekenler:

1. Firestore'da yeni bir `products` koleksiyonu tasarla (js/data.js'teki BASE_PRODUCTS
   objesinin alanlarıyla birebir aynı şema: id, name, category, price, originalPrice, rating,
   reviewCount, stock, images, desc, specs vb.).

2. Admin gerçek kimlik doğrulaması: Firebase Authentication'da admin için gerçek bir hesap
   oluştur (Firebase Console'dan benim yapacağım kısım — sen kodu hazırla), Firestore'da
   `admins/{uid}` koleksiyonu veya Firebase Custom Claims (`admin: true`) ile "bu kullanıcı
   admin mi" kontrolünü SERVER-SIDE doğrula (bir Vercel Function ile, ör. /api/verify-admin —
   client'tan gelen Firebase ID token'ı doğrulayıp admin claim'ini kontrol etsin). Admin
   paneline erişim bu server-side kontrolden geçmeden localStorage/client-side bayrakla
   sağlanmasın.

3. admin.html'i, ürün ekle/düzenle/sil işlemlerini localStorage yerine Firestore `products`
   koleksiyonuna yazacak şekilde güncelle (Firestore Security Rules'da bu koleksiyona sadece
   admin claim'i olan kullanıcıların yazabildiğinden emin ol, herkes okuyabilsin).

4. Görsel yükleme: Firebase Storage kullan, admin panelden dosya seçilip yüklenebilsin
   (`assets/images/products/` altına link yapıştırma yerine). Storage Security Rules'da sadece
   admin yazabilsin, herkes okuyabilsin şeklinde ayarla.

5. js/products.js ve js/data.js'i, ürünleri artık Firestore'dan (BASE_PRODUCTS sabit dizisi
   yerine) okuyacak şekilde güncelle — sayfa yüklenirken bir kere Firestore'dan çekip client-side
   cache'le (performans için, her sayfa geçişinde tekrar sorgu atma).

6. firestore.rules dosyasını güncelle (şu an sadece users/{userId} var), yeni koleksiyonlar için
   kuralları ekle. Deploy etmeden önce bana kuralları göster, ben "Firebase Console → Firestore →
   Rules" üzerinden veya Firebase CLI ile kendim deploy edeceğim.

Bitirince: admin panelinden ürün ekleyip, normal ürünler sayfasında (urunler.html) o ürünün
göründüğünü doğrula, sonucu raporla.
```

---

## ~~Prompt 3 — Sipariş yönetimi (misafir siparişleri dahil)~~ ✅ tamamlandı (2026-08-18)

Bu iş bitti; aşağıdakiler artık kodda var:

- **Top-level `orders` koleksiyonu** — üye ve misafir tüm siparişler burada.
- **Misafir siparişleri kaydediliyor** (`guest: true`, `userId: null`). Yazma işini yalnız
  sunucu (Vercel Function + Firebase Admin SDK) yapar; istemci `orders` koleksiyonuna
  yazamaz (`firestore.rules`). Prompt'ta önerilen "daha güvenli" seçenek buydu.
- **Admin paneli sipariş ekranı sunucudan besleniyor**: `/api/admin/orders` → üye + misafir
  siparişleri tek listede; durum değiştirme (Hazırlanıyor → Kargoda → Teslim Edildi → İptal)
  API üzerinden yazılıyor.
- **Üye siparişinde `users/{uid}.orders` kopyası da güncelleniyor** — müşteri `profil.html`
  sayfasında güncel durumu görüyor.
- **Yetki sunucuda**: Firebase ID token + doğrulanmış e-posta + `ADMIN_EMAILS` listesi.
  Panelin eski istemci tarafı şifresi bir yetki kontrolü değildir; gerçek koruma sunucudadır.
- Testler: `npm run test:admin` (29 test) — yetkisiz erişim, liste, durum güncelleme,
  profil senkronu, geç gelen ödeme bildiriminin sevkiyatı geri almaması.

### Senin yapman gerekenler (hesap erişimi gerektiriyor)

1. **Vercel → Environment Variables**:
   `ADMIN_EMAILS=destek@efemiletisim.com` (birden fazlaysa virgülle ayır)
   ve `FIREBASE_SERVICE_ACCOUNT` (bkz. Adım 1.2). İkisi de yoksa panel eski yerel
   deftere düşer ve bunu ekranda uyarı şeridiyle söyler.
2. **Panele girerken siteye de Firebase hesabınla giriş yapmış ol** (`hesap.html`).
   Sipariş listesi bu oturumun kimliğiyle çekiliyor.
3. Doğrulama: bir üye siparişi + bir misafir siparişi ver, panelde ikisinin de
   göründüğünü ve durumu "Kargoda" yapınca müşterinin `profil.html` ekranında
   değiştiğini kontrol et.

> Kalan eksik: `admin.html` hâlâ istemci tarafı bir kullanıcı adı/şifre ekranı gösteriyor.
> Bu ekran **güvenlik değildir** (kaynak kodda görünür); yalnızca paneli kazara açmayı önler.
> Gerçek sipariş verisi sunucu yetkisiyle korunuyor. Panelin tamamını Firebase girişine
> bağlamak Prompt 2'nin işi.

## ~~Prompt 4 — Kupon yönetim ekranı~~ ✅ tamamlandı (2026-08-18)

**Ne yapıldı:** Kuponlar Firestore `coupons` koleksiyonunda; panelde "Kuponlar"
sekmesinden ekleniyor, düzenleniyor, açılıp kapatılıyor. `js/cart.js` içindeki sabit
`COUPONS` objesi kaldırıldı; sepet kupon kodunu `/api/coupon/validate` ucuna
soruyor. İndirim tutarı istemciden ALINMIYOR — sipariş oluşturulurken sunucuda yeniden
hesaplanıyor, yani sepetteki değerle oynamak ödenecek tutarı değiştirmiyor.

**Not:** Sepet değiştiğinde uygulanan kupon otomatik düşer ve yeniden girilmesi gerekir.
Bunun sebebi minimum sepet tutarı şartıdır: ürün çıkarıldığında geçersizleşen bir indirimin
ekranda kalması ödeme adımında tutar sürprizi yaratırdı.


```
efemiletisim.com projesinde kuponlar şu an js/cart.js içinde hardcoded (COUPONS objesi,
tek kupon: EFEM500, şu an enabled:false). Admin panelinden kupon ekleyip/düzenleyip/pasif
edebileceğimiz bir ekran istiyorum.

1. Firestore'da bir `coupons` koleksiyonu oluştur (code, label, type: percent|fixed, value,
   minSubtotal, enabled, expiresAt gibi alanlarla).
2. js/cart.js'teki kupon doğrulama mantığını, hardcoded COUPONS objesi yerine Firestore'dan
   okuyacak şekilde güncelle.
3. admin.html'e "Kuponlar" sekmesi ekle: listele, yeni kupon oluştur, düzenle, aktif/pasif toggle.
4. Aynı admin-only auth koruması (Prompt 2) geçerli olsun.

Bitirince: admin panelinden yeni bir test kuponu oluşturup, sepet sayfasında o kuponun
çalıştığını doğrula.
```

---

## Prompt 5 — Mobil app (Expo / React Native) — opsiyonel, en son

```
efemiletisim.com web sitesi tamamlandıktan sonra, aynı Firebase backend'e (auth + Firestore
products/orders/users koleksiyonları) bağlı bir React Native (Expo) mobil app istiyorum.

MVP kapsamı (ilk sürüm):
- Ürün listesi + kategori filtreleme (Firestore products koleksiyonundan)
- Ürün detay sayfası
- Sepet (local state, AsyncStorage ile kalıcı)
- Firebase Authentication ile giriş/kayıt (web'deki js/firebase-auth.js'teki akışla aynı mantık)
- Sipariş verme (Prompt 1'de kurulan /api/create-payment Vercel Function'ını mobil'den de
  çağırabilirsin — backend zaten platform-agnostic olmalı)
- Profil / sipariş geçmişi

Marka rengi #2563EB (primary blue), logo assets/logos/ altında (icon-square.png, logo-full.png)
— bunları mobil app asset'i olarak kullan.

Bu store'a (App Store / Google Play) yayınlanacak "bitmiş" bir app değil, çalışan bir MVP
iskeleti olsun — store hesapları, ikon/splash tasarımı, App Store Connect/Play Console
süreçleri ayrı bir aşama, şimdilik kapsam dışı.

Ayrı bir repo/klasör olarak kur (efemiletisim-mobile veya benzeri), bu web reposundan bağımsız
deploy edilsin.
```

---

## Prompt 6 — CSP sıkılaştırma (opsiyonel) — 🟡 kısmen yapıldı (2026-08-18)

**Yapılan:** Ödeme formunun taşındığı sayfa (`odeme-guvenli.html`) tamamen satır içi
kod barındırmayacak hâle getirildi ve kendisine özel, `'unsafe-inline'` İÇERMEYEN bir
CSP ile servis ediliyor (`vercel.json`). Bu, e-skimming (kart bilgisi çalan enjekte
script) açısından sitenin en kritik sayfası. Toast kapatma düğmesindeki satır içi
`onclick` de kaldırıldı, çünkü sıkı CSP altında sessizce çalışmıyordu.

**Yapılmayan ve sebebi:** Sitenin geri kalanı hâlâ `'unsafe-inline'` ile servis ediliyor.
`'unsafe-inline'` ancak bir sayfadaki satır içi kodun TAMAMI kaldırıldığında düşürülebilir;
yarım temizlik hiçbir güvenlik kazancı vermez. 16 sayfada ~300 statik `on*="…"` handler'ı,
ayrıca ürün kartı / sepet satırı / admin tablosu gibi çalışma anında üretilen işaretlemede
yüzlerce handler daha var — hepsinin olay delegasyonuna çevrilmesi gerekir. Sitenin her
etkileşimli öğesine dokunan, regresyon riski yüksek bir iş; ödeme sağlayıcısı geçişi ve
panel yeniden yazımının hemen ardına sıkıştırılmadı. Ayrı bir çalışma olarak duruyor.

**Sırada ne var (istersen):** sayfa sayfa ilerle — her sayfanın satır içi `<script>` bloğunu
kendi `js/<sayfa>-page.js` dosyasına al, `on*=` handler'larını `addEventListener`'a
ve dinamik listeler için olay delegasyonuna çevir, `style=""` attribute'larını sınıflara
taşı. Bir sayfa tamamen temizlendiğinde `vercel.json`'a o sayfa için sıkı CSP kuralı ekle
(`odeme-guvenli` kuralı örnek). Hepsi bittiğinde genel kuraldan `'unsafe-inline'`
kaldırılabilir.

<details><summary>Özgün prompt</summary>


```
efemiletisim.com projesinde vercel.json'a temel güvenlik header'ları (X-Frame-Options,
X-Content-Type-Options, HSTS, temel bir Content-Security-Policy) eklendi. Ancak mevcut CSP,
script-src ve style-src için 'unsafe-inline' kullanıyor — çünkü site genelinde her HTML
sayfasının sonunda büyük inline <script> blokları (sayfa-özel JS mantığı) ve <head> içinde
inline <style> blokları var.

Bunu sıkılaştırmak istiyorsan: her sayfadaki inline <script>...</script> bloklarını ayrı .js
dosyalarına taşı (ör. urun-detay.html'in inline script'i js/urun-detay-page.js olsun), inline
onclick="..." handler'larını addEventListener'a çevir, inline <style> bloklarını ilgili CSS
dosyasına taşı. Bu tamamlandığında CSP'den 'unsafe-inline'ı kaldırıp yerine nonce veya hash
tabanlı bir politika kur.

Bu büyük bir refactor, acil değil — sadece "tam puan" bir güvenlik denetimi istiyorsan yap.
```

</details>

---

## Senin doldurman gereken veriler (AI'nin işi değil, bilgi eksik)

`js/site-config.js` içinde:

| Alan | Şu anki durum | Ne gerekiyor |
|---|---|---|
| `legal.taxOffice` | boş `''` | Vergi dairesi adı (fatura/yasal metinlerde görünüyor) |
| `partners.distributors` → İndeks, Ouno Servis | logo yok, metin rozeti | PNG/SVG logo dosyası ver, `assets/logos/indeks.svg` ve `assets/logos/ouno.svg` olarak eklenip bağlanır |
| Huawei Watch GT4, Watch Fit 3 görselleri | placeholder SVG | `consumer.huawei.com` bot korumalı, elle indirip `assets/images/products/huawei-watch-gt4.jpg` / `huawei-watch-fit3.jpg` olarak koy |
| JBL Tune 770NC, Live 660NC görselleri | placeholder SVG | `jbl.com` (Harman) otomatik erişimi engelliyor, elle indirip `jbl-tune770nc.jpg` / `jbl-live660nc.jpg` olarak koy |

## İş kararı bekleyen konular (kod değil, senin/işletmenin kararı)

- **EFEM500 kuponu** (`js/cart.js` → `COUPONS`) tanımlı ama `enabled: false`. İndirim tutarı ve
  minimum sepet tutarı kararlaştırılınca `value`/`minSubtotal` doldurup `enabled: true` yapman
  yeterli (Prompt 4 sonrası bu artık admin panelinden de yapılabilecek).
- **Katalog güncelliği**: ürünlerin çoğu 2023 model (Apple Watch Series 9, iPad 10. Nesil vb.),
  bu modeller markaların resmi sitelerinde artık satışta değil. Kısa vadede sorun değil ama
  orta vadede güncel modellere geçiş düşünülmeli.
- **PayTR üye işyeri başvurusu**: Canlı mağaza için başvuruda ticaret sicil gazetesi, vergi
  levhası, imza sirküleri, ortakların kimlik görüntüleri ve IBAN/banka teyit belgesi istenir.
  Şirket künyesi (MERSİS, vergi no, vergi dairesi) ve muhtemelen distribütörlük/bayilik belgesi
  de sorulabilir — bkz. RAPOR.md bölüm 4, "Replika şüphesi" notu.
