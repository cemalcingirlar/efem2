# efemiletisim.com — Mail Gönderimi Kurulumu (Firebase hesabı gerekli)

Site tamamen statik + Firebase Auth/Firestore üzerinde çalışıyor, ayrı bir backend sunucusu yok.
Bu yüzden sipariş onay maili, destek bildirimi ve şifre sıfırlama maili göndermek için kod
tarafında hazır bir mekanizma kurdum, ama gerçek gönderimi yapacak servisi **senin Firebase
Console hesabından** açman gerekiyor — bu, hesap erişimi gerektirdiği için benim tarafımdan
yapılamıyor.

Bu dosya bir AI prompt'u değil, elle Firebase Console'da tıklayacağın adımlar. Sırayla oku.

---

## Kod tarafında ne hazır

- `firestore.rules` içine bir `mail` koleksiyonu kuralı eklendi. Site, mail göndermesi gereken
  her durumda (sipariş onayı, ürün sorusu bildirimi) bu koleksiyona bir doküman yazıyor:
  `{ to: "...", message: { subject: "...", html: "..." } }`
- `js/firebase-auth.js` içindeki `sendOrderConfirmationMail()` ve `sendSupportNotificationMail()`
  fonksiyonları bu dokümanı otomatik oluşturuyor. Sen hiçbir kod yazmayacaksın.
- Şu an tetiklenen otomatik mailler:
  - **Müşteri sipariş onayı** → siparişi veren müşterinin e-postasına.
    ⚠️ Bu mail **yalnızca sunucu tarafı sipariş API'si açıkken** gönderilir
    (`FIREBASE_SERVICE_ACCOUNT` ortam değişkeni). Sebebi: Firestore kuralları,
    istemcinin başkasının adresine mail yazmasını engelliyor — misafir sipariş
    veren biri kendi adresine bile istemciden mail attıramaz. Sunucu (Admin SDK)
    kurallardan muaf olduğu için bu maili o gönderir.
  - **İşletme sipariş bildirimi** → `destek@efemiletisim.com`. Hem sunucu tarafında
    hem de sunucu kapalıyken istemci tarafında çalışır (kurallar `destek@` adresine
    yazmaya izin veriyor). İçinde sipariş no, tutar, müşteri iletişim bilgisi,
    teslimat adresi ve SKU'lu ürün listesi var.
  - **Ürün sorusu bildirimi** (`urun-detay.html` soru formu) → `destek@efemiletisim.com`.
- `sifre-sifirla.html` sayfası zaten hazır: Firebase şifre sıfırlama linki artık kullanıcıyı
  Firebase'in genel İngilizce sayfası yerine bu Türkçe sayfaya yönlendiriyor, şifre iki kere
  sorulup eşleştiriliyor.

Senin yapman gereken tek şey: bu `mail` koleksiyonunu izleyip gerçekten e-posta gönderen
servisi kurmak. Bunun için Firebase'in hazır "Trigger Email from Firestore" extension'ını
kullanacağız — kod yazmana gerek yok, sadece Console'dan kurulum.

---

## Adım 1 — Blaze plana geç

Extension'lar (ve genel olarak dışa giden ağ isteği yapan her Firebase özelliği) ücretsiz
Spark planında çalışmaz.

1. [console.firebase.google.com](https://console.firebase.google.com) → proje `efemiletisim`.
2. Sol alt köşede plan adına tıkla → **Blaze (Pay as you go)** seç, kart bilgisi ekle.
3. Bu site ölçeğinde (ayda birkaç yüz mail) pratikte ücret sıfıra yakın çıkar; extension'ın
   kendisi de ayda 20.000 çağrıya kadar ücretsizdir.

## Adım 2 — Bir SMTP sağlayıcı seç

Extension mail'i kendi göndermiyor, senin verdiğin bir SMTP hesabı üzerinden gönderiyor.
İki makul seçenek:

- **Resend veya SendGrid (önerilen)** — ücretsiz katmanları yeterli (SendGrid ayda 100,
  Resend ayda 3.000 mail), kendi domain'inle (`efemiletisim.com`) gönderim yapıp SPF/DKIM
  doğrulaması eklemene izin veriyor. Bu, spam'e düşmemek için en önemli adım (Adım 5'e bak).
- **Google Workspace SMTP** — eğer `destek@efemiletisim.com` zaten bir Google Workspace
  kutusuysa, o hesabın SMTP bilgilerini (smtp.gmail.com, port 465, uygulama şifresi) doğrudan
  kullanabilirsin. Ekstra hesap açmana gerek kalmaz ama günlük gönderim limiti düşüktür (~2000/gün,
  yeni hesaplarda daha az).

Hangisini seçersen seç, elinde şunlar olmalı: SMTP host, port, kullanıcı adı, şifre/API key.

## Adım 3 — Extension'ı kur

1. Firebase Console → sol menü **Extensions** (veya **Build → Extensions**).
2. "Explore Extensions Hub" → ara: **Trigger Email from Firestore** (yayıncı: `firebase`,
   extension ID: `firestore-send-email`).
3. "Install" → proje `efemiletisim`'i onayla.
4. Kurulum sırasında sorulan alanlar:
   - **SMTP connection URI**: `smtps://KULLANICI:SIFRE@HOST:465` formatında, Adım 2'deki
     bilgilerle doldur (SendGrid için kullanıcı adı genelde `apikey`, şifre = API key).
   - **Mail collection**: **`mail`** yaz — birebir bu, kod bu ismi kullanıyor. Farklı bir isim
     yazarsan site'nin gönderdiği mailler hiçbir yere düşmez.
   - **Default FROM address**: `efem iletişim <destek@efemiletisim.com>`
   - **Default REPLY-TO address**: `destek@efemiletisim.com` (opsiyonel ama önerilir)
5. "Install extension" ile bitir. Kurulum birkaç dakika sürebilir.

## Adım 4 — Firestore güvenlik kurallarını yayınla

`firestore.rules` dosyası zaten güncel (bu depoda). Eğer daha önce Firebase CLI ile deploy
etmediysen:

```
firebase deploy --only firestore:rules
```

Bu adım atlanırsa site `mail` koleksiyonuna yazamaz, permission-denied hatası alırsın (tarayıcı
konsolunda görünür).

## Adım 5 — Spam'e düşmeyi engelle (SPF/DKIM/DMARC)

Firebase'in varsayılan `noreply@efemiletisim.firebaseapp.com` göndereni (şifre sıfırlama/e-posta
doğrulama mailleri için) ve genel olarak kurumsal olmayan gönderim adresleri spam klasörüne
düşmeye çok yatkındır. Asıl çözüm:

1. Seçtiğin SMTP sağlayıcının (SendGrid/Resend) panelinde **Domain Authentication** /
   **Domain Verification** bölümüne git, `efemiletisim.com` domain'ini ekle.
2. Sağlayıcı sana birkaç **TXT ve CNAME** DNS kaydı verecek (SPF + DKIM için). Bunları
   domain'inin DNS panelinden ekle — aynı `docs/ARKADAS-YAPILACAKLAR.md` Adım 0'da A/CNAME
   eklediğin yere.
3. DNS yayılınca sağlayıcı panelinde domain "Verified" görünür. Bundan sonra `destek@efemiletisim.com`
   adresinden gönderilen mailler kendi domain'inin itibarını taşır, spam'e düşme ihtimali
   ciddi şekilde azalır.
4. Ekstra: bir **DMARC** TXT kaydı (`_dmarc.efemiletisim.com`) eklemek isteğe bağlı ama önerilir;
   sağlayıcı dokümantasyonunda örnek değer verir.

## Adım 6 — Firebase Auth mail şablonlarını Türkçeleştir

Şifre sıfırlama linki artık `sifre-sifirla.html`'e yönlendiriyor (Türkçe, çift şifre alanlı),
ama linki taşıyan **mailin kendisi** (konu/gövde metni) hâlâ Firebase'in varsayılan İngilizce
şablonundan geliyor. Bunu değiştirmek kod değil, Console ayarı:

1. Console → **Authentication** → **Templates** sekmesi.
2. Sağ üstte dil seçiciyi **Türkçe** yap (bu, "Password reset", "Email verification" gibi tüm
   şablonların dilini değiştirir).
3. "Password reset" şablonuna tıkla, gönderen adını `efem iletişim` yap, istersen konu/metni
   markanıza göre elle düzenle. Aynısını "Email address verification" için de yap.
4. Bu şablonlar hâlâ `noreply@efemiletisim.firebaseapp.com` adresinden gider (Auth'un kendi
   sistemi, extension'dan bağımsızdır) — bunu değiştirmek için Console'da **Authentication →
   Templates → SMTP settings** kısmından kendi SMTP sağlayıcını (Adım 2'deki) buraya da
   bağlayabilirsin; bu, hem gönderen adresini `destek@efemiletisim.com` yapar hem spam'e düşmeyi
   daha da azaltır.

## Test etme

1. Siteye üye ol, giriş yap, bir sipariş tamamla.
2. Console → **Firestore Database** → `mail` koleksiyonunda yeni bir doküman görmelisin.
   Birkaç saniye içinde extension onu işler, dokümana `delivery.state: "SUCCESS"` alanı eklenir.
   `"ERROR"` görürsen `delivery.error` alanındaki mesaj neyin yanlış gittiğini söyler (genelde
   SMTP bilgisi hatalıdır).
3. Alıcı kutusuna (spam/gereksiz dahil) mail gerçekten düştü mü kontrol et.

## Bilinen sınırlama: sipariş iptal maili

Admin panelindeki (`admin.html`) sipariş listesi şu an **tarayıcı localStorage**'ında tutuluyor,
canlı Firestore'a bağlı değil (bu, `docs/ARKADAS-YAPILACAKLAR.md` Prompt 3'te zaten not edilmiş
bilinen bir eksik). Bu yüzden admin bir siparişi "İptal" yaptığında otomatik mail göndermek için
gerçek bir backend (Cloud Function + Firebase Admin SDK) gerekiyor — bunu şimdilik kurmadım.

Bunun yerine: bir siparişi "İptal Edildi" yaptığında sipariş detay ekranında **"Müşteriye İptal
Maili Gönder"** butonu çıkıyor, tıklayınca kendi mail programın (destek@efemiletisim.com
kutundan) önceden doldurulmuş bir taslakla açılıyor, sen "Gönder"e basıyorsun. Tam otomatik değil
ama tek tıkla çalışıyor.

Gerçek otomatik iptal maili istersen, `docs/ARKADAS-YAPILACAKLAR.md`'deki Prompt 3'ü (Firestore
backend'e geçiş) tamamlaman gerekir — o zaman admin panelinin durum değişiklikleri gerçek
`users/{uid}.orders` kaydını güncelleyecek ve bir Cloud Function ile otomatik mail tetiklenebilir.
