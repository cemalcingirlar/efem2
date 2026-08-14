# efemiletisim.com — Arkadaşın Yapacakları (Vercel + Firebase hesabı gerekli)

Bu dosya, kendi Vercel ve Firebase hesabına bağlı bir AI kod asistanına (Claude Code, Cursor vb.)
doğrudan yapıştırabileceğin hazır prompt'lar içerir. Bu işleri ben (proje sahibinin AI asistanı)
yapmadım çünkü hesap erişimi (Vercel deploy, Firebase Console ayarları, gerçek iyzico merchant
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

1. iyzico Merchant panelinde (gerçek/production hesabına geçtiğinde) entegrasyon/domain ayarı
   varsa `https://efemiletisim.com` olarak gir.
2. Sandbox'tan production'a geçerken `IYZICO_API_KEY` / `IYZICO_SECRET_KEY` /
   `IYZICO_BASE_URL` ortam değişkenlerini Vercel Dashboard → Project → Settings →
   Environment Variables üzerinden gerçek (production) değerlerle güncelle.

Adım 1 ve 2 bitince bana haber ver, `efemiletisim.com` üzerinden ben de kontrol ederim.

---

## Öncelik sırası

1. **Prompt 1 — Gerçek iyzico entegrasyonu (Vercel Functions)** — en kritik, şu an ödeme tamamen sahte.
2. **Prompt 2 — Admin panelini Firestore + Storage'a taşı, gerçek auth**
3. **Prompt 3 — Sipariş yönetimi (misafir siparişleri dahil)**
4. **Prompt 4 — Kupon yönetim ekranı**
5. **Prompt 5 — Mobil app (opsiyonel, en son)**
6. **Prompt 6 — CSP sıkılaştırma (opsiyonel, ileri seviye güvenlik)**
7. **Prompt 7 — Sipariş ve destek e-postaları (Vercel Functions + e-posta API'si)** — Prompt 1 ve
   Prompt 3 tamamlanmadan gerçek anlamda çalışmaz (sipariş şu an sahte/localStorage).

Ayrıca aşağıda **senin doldurman gereken veriler** ve **iş kararı bekleyen konular** listesi var
(bunlar AI'nin yapabileceği iş değil, senin bilgi/karar vermen gerekiyor).

---

## ⚠️ Önce oku: Ödemenin şu anki gerçek durumu

`js/payment.js` içindeki ödeme akışı **tamamen sahte/simülasyon**. Kredi kartı formuna girilen
bilgiler hiçbir yere gönderilmiyor, hiçbir API çağrısı yapılmıyor — `setTimeout` ile 1.5 saniye
beklenip, girilen kart numarası önceden tanımlı bir test-kartı listesindeyse "başarılı" ya da
"başarısız" sonucu simüle ediliyor (`simulatePaymentResult()` fonksiyonu). Bilinmeyen her kart
numarası da otomatik "başarılı" sayılıyor. Yani şu anki haliyle site **hiçbir gerçek ödeme
alamaz** — bu bilerek bırakılmış bir demo/placeholder, gizlenen bir hata değil.

---

## Prompt 1 — Gerçek iyzico entegrasyonu (Vercel Functions backend)

```
Bu proje bir statik HTML/CSS/JS e-ticaret sitesi (efemiletisim.com), Vercel'de barındırılıyor.
Şu an ödeme akışı js/payment.js içinde tamamen client-side SİMÜLE EDİLİYOR — gerçek bir iyzico
API çağrısı yok, kart bilgileri hiçbir yere gönderilmiyor. Bunu gerçek iyzico entegrasyonuna
çevirmeni istiyorum.

Yapman gerekenler:

1. iyzico secret key'i ASLA client-side koda koyma. /api altında Vercel Functions (Node.js)
   oluştur, iyzico'nun resmi Node SDK'sını (`iyzipay` npm paketi) kullan. API key/secret key
   Vercel proje ortam değişkenlerinden (`IYZICO_API_KEY`, `IYZICO_SECRET_KEY`,
   `IYZICO_BASE_URL`) okunmalı — bunları ben Vercel dashboard'undan gireceğim, sen sadece
   process.env üzerinden oku, koda gömme.

2. En az şu endpoint'leri oluştur:
   - POST /api/create-payment — sepet + kart bilgisi + adres alır, iyzico'ya "Ödeme Oluştur"
     (Payment.create) çağrısı yapar, sonucu döner. Kart numarası/CVV backend'e gelir, iyzico'ya
     iletilir, hiçbir yerde loglanmaz veya saklanmaz.
   - POST /api/payment-webhook (opsiyonel ama önerilir) — iyzico'nun callback/webhook'unu
     karşılar, sipariş durumunu günceller.

3. Sandbox modunda çalışacak şekilde kur (IYZICO_BASE_URL=https://sandbox-api.iyzipay.com),
   ben gerçek merchant bilgilerimi aldıktan sonra env değişkenini production URL'e çevireceğim.

4. odeme.html / js/payment.js dosyasındaki `processPayment()` ve `simulatePaymentResult()`
   fonksiyonlarını, gerçek /api/create-payment çağrısı yapacak şekilde güncelle. Kart doğrulama
   (Luhn, son kullanma tarihi vb.) client-side kalabilir ama gerçek ödeme kararı backend'den
   dönmeli.

5. Sipariş, ödeme SONUCU başarılı dönünce Firestore'a yazılmalı (js/firebase-auth.js içindeki
   saveOrderToFirestore ile aynı mantık, ama artık backend'den tetiklenmeli ki client ödeme
   sonucunu taklit edip sahte "başarılı" siparişi kendi kendine yazamasın).

6. Test kartları sayfası (js/payment.js → showTestCards()) sandbox modunda kalabilir; iyzico'nun
   kendi resmi sandbox test kartlarını kullan (https://docs.iyzico.com/en/testing).

7. package.json yoksa oluştur, `iyzipay` bağımlılığını ekle. .env.example dosyası oluştur,
   gerekli env değişkenlerini (değersiz, sadece isimleriyle) listele. .env dosyasını
   .gitignore'a ekle, gerçek key'leri asla commit etme.

Bitirince: sandbox modunda uçtan uca bir test siparişi ver (gerçek iyzico sandbox API'sine
gerçekten istek gittiğini network log'unda doğrula), sonucu bana raporla.
```

---

## Prompt 2 — Admin panelini Firestore + Storage'a taşı, gerçek auth

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

## Prompt 3 — Sipariş yönetimi (misafir siparişleri dahil)

```
efemiletisim.com projesinde şu an sipariş yönetim ekranı yok — kullanıcılar kendi siparişlerini
profil.html'de görüyor (Firestore users/{uid}.orders array'inden), ama admin tarafında SİPARİŞLERİ
GÖRECEK/durumu güncelleyecek hiçbir ekran yok. Ayrıca misafir (üye olmadan) verilen siparişler
HİÇBİR YERE kaydedilmiyor (bkz. odeme.html → window.saveOrder, isLoggedIn() false ise sipariş
sadece client-side bir obje olarak dönüyor, Firestore'a hiç yazılmıyor) — bu ciddi bir eksik,
misafir siparişi veren birinin siparişi işletme tarafında hiçbir yerde görünmüyor.

Yapman gerekenler:

1. Firestore'da top-level bir `orders` koleksiyonu oluştur (üye siparişleri hem users/{uid}.orders
   içinde hem de bu top-level koleksiyonda tutulabilir, ya da tamamen bu koleksiyona taşınabilir —
   sen karar ver, ama admin'in TÜM siparişleri (üye + misafir) tek yerden görebilmesi şart).

2. Misafir siparişleri de bu `orders` koleksiyonuna yazılsın (userId alanı null/guest:true
   olarak işaretlenmiş şekilde). Firestore Security Rules: misafir yazması gerektiği için bu
   koleksiyona kimliksiz (unauthenticated) YAZMA izni gerekebilir — bunu dikkatli tasarla (ör.
   sadece Vercel Function üzerinden, Firebase Admin SDK ile server-side yazılsın, client
   doğrudan yazmasın — daha güvenli).

3. admin.html'e yeni bir "Siparişler" sekmesi ekle: tüm siparişleri listele (tarih, müşteri,
   tutar, durum), sipariş durumunu güncelleme (Hazırlanıyor → Kargoda → Teslim Edildi → İptal)
   dropdown'ı ekle. Durum güncellenince, eğer üye siparişiyse users/{uid}.orders içindeki karşılık
   gelen kaydı da güncelle (senkron kalsın, kullanıcı profil.html'de güncel durumu görsün).

4. Bu Faz 2'de yapılan admin auth (Prompt 2) tamamlanmış olmalı — sipariş yönetimi de aynı
   admin-only korumadan geçsin.

Bitirince: bir üye siparişi + bir misafir siparişi ver, admin panelinden ikisinin de göründüğünü
ve durum güncellemenin kullanıcı tarafına yansıdığını doğrula.
```

---

## Prompt 4 — Kupon yönetim ekranı

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

## Prompt 6 — CSP sıkılaştırma (opsiyonel, ileri seviye güvenlik)

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

---

## Prompt 7 — Sipariş ve destek e-postaları (Vercel Functions + e-posta API'si)

```
efemiletisim.com projesinde şu an hiçbir otomatik e-posta gönderimi yok (Firebase Auth'un kendi
doğrulama/şifre sıfırlama mailleri hariç, onlar zaten çalışıyor). İstiyorum ki:

1. Sipariş verildiğinde müşteriye onay e-postası gitsin (sipariş no, ürünler, tutar, teslimat
   adresi özeti).
2. Sipariş durumu admin panelinden "İptal" (cancelled) yapıldığında müşteriye iptal bildirimi
   gitsin.
3. Yeni bir sipariş verildiğinde VE (varsa) müşterinin sorduğu bir soru olduğunda
   destek@efemiletisim.com adresine bildirim gitsin.
4. Tüm mailler destek@efemiletisim.com adresinden gönderilmiş gibi görünsün (gönderen adı
   "efemiletisim.com").

Bunu yapman gerekenler:

1. Bir e-posta gönderim servisi seç (Resend, SendGrid veya benzeri — Vercel Marketplace
   entegrasyonlarına bak) ve API key'i Vercel proje ortam değişkeni olarak ekle (ör.
   `RESEND_API_KEY`). Gönderen adres olarak destek@efemiletisim.com kullanılacaksa o domain'in
   ilgili DNS kayıtlarını (SPF/DKIM) doğrulaman gerekir, yoksa mailler spam kutusuna düşer —
   bu adım hesap/domain erişimi gerektirir, senin yapman lazım.

2. `/api` altında Vercel Functions oluştur:
   - POST /api/send-order-confirmation — sipariş verildiğinde odeme.html'den (veya backend
     ödeme akışından, bkz. Prompt 1) tetiklenir, müşteriye + destek@'e mail atar.
   - POST /api/send-order-cancellation — admin panelden sipariş "İptal" yapıldığında tetiklenir,
     müşteriye mail atar. admin.html → changeOrderStatus() fonksiyonunu, status 'cancelled'
     olduğunda bu endpoint'i çağıracak şekilde güncelle.

3. Sipariş gerçekten Firestore'a yazılmadan (bkz. Prompt 3) bu e-postalar güvenilir şekilde
   tetiklenemez — misafir siparişleri şu an hiçbir yere kaydedilmiyor, admin "İptal" durumunu
   sadece kendi tarayıcısındaki localStorage'da görüyor. Prompt 1 ve Prompt 3 tamamlanmadan bu
   Prompt'u yapma, yarım bir sistem olur.

4. Varsa bir "soru sor" formu (ürün detay sayfası veya iletişim) ekleyeceksen, o da aynı
   /api altından destek@'e mail atan ayrı bir endpoint olsun (ör. /api/send-support-question).

Bitirince: sandbox/test modunda uçtan uca bir test siparişi ver, hem müşteri hem destek@ mailinin
gerçekten ulaştığını doğrula, sonucu bana raporla.
```

---

## Senin doldurman gereken veriler (AI'nin işi değil, bilgi eksik)

`js/site-config.js` içinde:

| Alan | Şu anki durum | Ne gerekiyor |
|---|---|---|
| `legal.taxOffice` | ✅ dolduruldu — "Seyhan Vergi Dairesi" | — |
| `legal.kepAddress` | ✅ dolduruldu — `efeiletisim.s921087@hs03.kep.tr` (verildiği gibi girildi, "efeiletisim" yazımı KEP sağlayıcısından geldiği için değiştirilmedi — gerçekten `efemiletisim` olması gerekiyorsa haber ver, düzeltilir) | — |
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
- **iyzico merchant başvurusu**: Prompt 1 tamamlandıktan sonra gerçek (production) iyzico
  hesabı için başvuru yaparken şirket künyesi (MERSİS, vergi no, vergi dairesi) ve muhtemelen
  distribütörlük/bayilik belgesi istenebilir — bkz. RAPOR.md bölüm 4, "Replika şüphesi" notu.
