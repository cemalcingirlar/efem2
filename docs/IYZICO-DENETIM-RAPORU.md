> **NOT (2026-08-17):** Ödeme sağlayıcısı bu denetimden sonra **PayTR**'ye taşındı.
> Sağlayıcıya özel maddeler (iyzico imza/endpoint'leri) artık geçerli değildir; mevzuat,
> KVKK, PCI kapsamı, fiyat bütünlüğü ve mutabakat bulguları **aynen geçerlidir**.
> Güncel entegrasyon: `docs/PAYTR-ENTEGRASYON.md`.

# iyzico Canlıya Çıkış Denetim Raporu — efemiletisim.com

Tarih: 2026-08-16
Denetim promptu: `docs/deep-research-report.md`
Denetlenen sürüm: `main` (bu denetimle birlikte yapılan düzeltmeler dahil)
Denetim yöntemi: kaynak kod incelemesi + yerel çalıştırma (`node dev-server.js`) +
tarayıcı ile uçtan uca akış denemesi + `npm run test:payment` (43 birim + 38 akış testi;
akış testleri iyzico'yu taklit eden yerel bir sunucuya karşı koşar).

> **Kapsam sınırı — okumadan geçmeyin.** Bu denetim, gerçek iyzico sandbox/production
> hesabına **hiç istek atmadan** yapıldı: elde API anahtarı yok. Gerçek gateway ile
> çalıştırılması gereken testler aşağıda `NOT VERIFIED` olarak işaretlidir ve
> `docs/IYZICO-ENTEGRASYON.md` içindeki adımlar tamamlanmadan kapatılamaz.

---

## 1. Yönetici özeti

| Alan | Sonuç |
|---|---|
| Genel karar | `CONDITIONAL GO` |
| iyzico entegrasyon tipi | **Checkout Form** (hosted / yönlendirmeli), API-3DS veya ham kart entegrasyonu **yok** |
| Production'a hazır mı? | **Hayır** — ortam değişkenleri girilip sandbox testleri koşulmadan hayır |
| Critical bulgu | 5 (5'i bu denetimde kapatıldı) |
| High bulgu | 4 (2'si kapatıldı, 2'si açık) |
| Medium bulgu | 5 (3'ü kapatıldı, 2'si açık) |
| Low bulgu | 3 |
| NOT VERIFIED | 21 (gerçek gateway erişimi gerekiyor) |
| iyzico başvuru blocker'ı var mı? | **Hayır** (denetim öncesi **evet**'ti — sahte ödeme ve kart formu kaldırıldı) |
| Güvenlik blocker'ı var mı? | **Hayır** (kod tarafında; ortam yapılandırması eksik olduğu sürece kart ödemesi zaten kapalı) |
| Mevzuat blocker'ı var mı? | **Hayır** — ETBİS kaydı işletme tarafından doğrulanmalı (F-08) |

### Denetim öncesi durum (en kritik tespit)

Ödeme **tamamen sahteydi**. `js/payment.js` içindeki `simulatePaymentResult()`
kart numarasına bakıp 1,5 saniye sonra "başarılı" dönüyordu; **tanınmayan her kart
başarılı sayılıyordu** (`testCards[cleanNumber] || 'success'`). Yani:

- Müşteri gerçek kart numarasını ve CVV'sini siteye giriyor, bu veriler hiçbir
  ödeme kuruluşuna gitmiyor, sadece tarayıcıda kalıyordu.
- Hiç para tahsil edilmeden sipariş "Hazırlanıyor" durumunda oluşuyor ve müşteriye
  "Siparişiniz başarıyla alındı" deniyordu.
- Sipariş tutarı tarayıcıdaki `localStorage` sepetinden geliyordu; DevTools'tan
  fiyat değiştirmek yeterliydi.
- Canlı checkout sayfasında **test kartı listesi** gösteriliyordu.

Bu durum hem iyzico başvurusu için kesin blocker hem de tüketici açısından
yanıltıcıydı. Aşağıdaki F-01…F-05 bulguları bu denetimde kapatıldı.

---

## 2. Bulgular

Sınıflar: `İYZİCO-ZORUNLU` · `MEVZUAT-ZORUNLU` · `ENTEGRASYONA-BAĞLI` · `GÜVENLİK-KRİTİK` · `ÖNERİLEN`

### 2.1 Kapatılan bulgular

| ID | Alan | Sınıf | Öncelik | Bulgu | Yapılan düzeltme | Kanıt |
|---|---|---|---|---|---|---|
| F-01 | Ödeme doğruluğu | GÜVENLİK-KRİTİK / İYZİCO-ZORUNLU | CRITICAL | Ödeme client-side simüle ediliyordu; tanınmayan kart "başarılı" sayılıyor, para tahsil edilmeden sipariş oluşuyordu | Simülasyon tamamen silindi. Ödeme sonucu artık yalnızca iyzico `checkoutform/auth/ecom/detail` (retrieve) yanıtından, sunucuda belirleniyor | `js/payment.js` (yeniden yazıldı), `api/_lib/settle.js` |
| F-02 | PCI kapsamı | GÜVENLİK-KRİTİK | CRITICAL | Kart numarası, son kullanma ve **CVV** merchant frontend'inde toplanıyordu | Kart alanları ve kart önizleme bileşeni kaldırıldı. Checkout Form'a geçildi: PAN/CVV yalnız iyzico'nun kendi sayfasına giriliyor, bu sitenin ve sunucunun hiçbir katmanından geçmiyor | `odeme.html`, `css/pages.css` (kart input stilleri silindi) |
| F-03 | Fiyat bütünlüğü | GÜVENLİK-KRİTİK | CRITICAL | Tutar tarayıcıda hesaplanıyor, sipariş toplamı istemciden yazılıyordu (`price=1` saldırısı mümkündü) | Sunucu sepeti kendi kataloğundan (`api/_lib/catalog.json`, `js/data.js`'ten üretilir) yeniden fiyatlıyor. İstemciden yalnız `{id, sku, qty}` kabul ediliyor; gönderilen fiyat/tutar ve renk/beden alanları yok sayılıyor | `api/_lib/orders.js` → `priceBasket()`, `npm run test:payment` (8 test) |
| F-04 | Sandbox/production ayrımı | GÜVENLİK-KRİTİK | CRITICAL | Canlı checkout'ta test kartı listesi gösteriliyordu; "sandbox" ibaresi kod içinde sabitti | Test kartı listesi kaldırıldı. Ortam artık `IYZICO_MODE` ile belirleniyor; sandbox modda müşteriye açık uyarı gösteriliyor; mode ile base URL çelişirse ödeme başlatma reddediliyor | `api/_lib/env.js` → `environmentMismatch()`, `odeme.html` → `#sandbox-warning` |
| F-05 | Sipariş durumu otoritesi | GÜVENLİK-KRİTİK | CRITICAL | Sipariş kaydını ve "ödendi" bilgisini tarayıcı yazıyordu | Kart siparişleri artık yalnız sunucu tarafından `orders/{orderId}` koleksiyonuna yazılıyor; istemci yazamıyor (`firestore.rules`). Durum geçişleri Firestore transaction'ı içinde, idempotent | `api/payment/initialize.js`, `api/_lib/store.js`, `firestore.rules` |
| F-09 | Callback güvenliği | GÜVENLİK-KRİTİK | CRITICAL | (Yeni akışta ortaya çıkabilecek risk) Tarayıcı callback'inin "başarılı" sayılması | Callback'teki hiçbir parametre kanıt sayılmıyor; sonuç retrieve ile sorgulanıyor, yanıt imzası doğrulanıyor, `conversationId` ve tutar siparişle karşılaştırılıyor; uyuşmazlıkta sipariş `pending_review`'a düşüyor, sevkiyat başlamıyor | `api/payment/callback.js`, `api/_lib/settle.js` |
| F-10 | Webhook | GÜVENLİK-KRİTİK | HIGH | Webhook desteği hiç yoktu; kullanıcı sekmeyi kapatırsa ödeme sonucu kaybolurdu | `/api/payment/webhook` eklendi. `X-IYZ-SIGNATURE-V3` doğrulanmadan hiçbir durum değişikliği yapılmıyor (V1/V2 desteklenmiyor). Tekrar gelen olaylar tek sonuç üretiyor | `api/payment/webhook.js`, `api/_lib/iyzico.js` → `verifyWebhookSignatureV3()` |
| F-11 | Ön bilgilendirme | MEVZUAT-ZORUNLU | HIGH | Ön Bilgilendirme Formu yoktu; sipariş onayından hemen önce **ödeme yükümlülüğü** ifadesi bulunmuyordu | `on-bilgilendirme-formu.html` eklendi (satıcı bilgileri, KDV dahil toplam, ödeme/teslimat, cayma hakkı ve istisnaları, şikâyet yolları). Checkout'ta CTA'nın hemen üstünde satıcı + ödenecek tutar + "Bu sipariş ödeme yükümlülüğü doğurur" bloğu var; onay kutusu her iki belgeye de atıf yapıyor ve onay kaydı siparişle birlikte saklanıyor | `on-bilgilendirme-formu.html`, `odeme.html`, `api/payment/initialize.js` (`agreements`) |
| F-14 | Hata mesajları | ÖNERİLEN | MEDIUM | Sağlayıcı hatası kullanıcıya ham gösteriliyordu | Kullanıcıya sabit, güvenli Türkçe mesajlar; teşhis bilgisi yalnız sunucu logunda | `api/_lib/http.js`, `api/_lib/settle.js` |
| F-15 | CSP | GÜVENLİK-KRİTİK | MEDIUM | `connect-src` tarayıcının doğrudan iyzico API'sine bağlanmasına izin veriyordu (kart verisinin tarayıcıdan gateway'e gitmesi ihtimalini açık bırakan bir sinyal) | iyzico host'ları `connect-src`'ten çıkarıldı; tarayıcı yalnız kendi API'mize konuşuyor | `vercel.json` |
| F-16 | Loglama | ÖNERİLEN | MEDIUM | Ödeme olayları için yapılandırılmış log yoktu | `logPaymentEvent()` ile korelasyon kimlikleri (orderId, paymentId, environment, sonuç, tutar) loglanıyor; PAN/CVV/secret/token **loglanmıyor** | `api/_lib/http.js` |

### 2.2 Açık bulgular

| ID | Alan | Sınıf | Öncelik | Bulgu | Yapılması gereken | Sahip |
|---|---|---|---|---|---|---|
| F-06 | Firestore kuralları | GÜVENLİK-KRİTİK | HIGH | `users/{uid}.orders` dizisi hâlâ istemciden yazılabiliyor. Bu, sunucu sipariş API'si yapılandırılmadan önce EFT siparişlerinin kaybolmaması için **bilerek** açık bırakıldı; tutar manipülasyonu EFT'de transfer mutabakatıyla yakalanır ama kural yine de gevşektir | `FIREBASE_SERVICE_ACCOUNT` girildikten sonra `firestore.rules` içindeki yorumlu katı kural etkinleştirilip `firebase deploy --only firestore:rules` çalıştırılmalı | İşletme/geliştirici |
| F-07 | Admin paneli | GÜVENLİK-KRİTİK | HIGH | `admin.html` client-side sabit şifreyle korunuyor ve siparişleri `localStorage`'dan okuyor; sunucudaki gerçek siparişleri görmüyor | Admin panelinin Firestore `orders` koleksiyonuna ve gerçek kimlik doğrulamaya (Firebase custom claims) taşınması. İade/iptal işlemleri panelden yapılacaksa yetki matrisi + audit log şart | İşletme/geliştirici (RAPOR Faz 6) |
| F-08 | ETBİS | MEVZUAT-ZORUNLU | HIGH | Sitede ETBİS kaydına dair bir bilgi yok; kaydın yapılıp yapılmadığı koddan doğrulanamaz | ETBİS kaydı tamamlanmalı ve kayıt bilgisi/logosu siteye eklenmeli. **Kayıt yapılmadan siteye ETBİS ibaresi konulmamalıdır** | İşletme |
| F-12 | İade / iptal | ENTEGRASYONA-BAĞLI | MEDIUM | Kod tarafında iyzico `cancel`/`refund` çağrısı yok; iade şu an manuel olarak iyzico panelinden yapılır | Panelden yapılan iade sonrası sipariş durumunun elle güncellenmesi süreci yazılı hale getirilmeli; hacim arttığında `/api/payment/refund` eklenmeli (cancel: aynı gün, refund: sonrası — ikisi ayrı işlemdir) | İşletme/geliştirici |
| F-13 | Mutabakat | ÖNERİLEN | MEDIUM | Otomatik günlük mutabakat yok | `docs/IYZICO-ENTEGRASYON.md` → "Mutabakat" bölümündeki manuel kontrol haftalık yapılmalı; ilerisi için iyzico reporting/settlement servisi ile otomasyon | İşletme |
| F-17 | Stok | ÖNERİLEN | LOW | Sunucu sipariş sırasında stok kontrolü yapmıyor (stok bilgisi statik katalogda) | Stok gerçek zamanlı yönetilmeye başlandığında `priceBasket()` içine stok kontrolü eklenmeli | Geliştirici |
| F-18 | Katalog senkronu | ÖNERİLEN | LOW | Sunucu fiyat kataloğu `js/data.js`'ten türetiliyor; elle güncellenirse sürüklenme olabilir | Fiyat değiştiren her commit'te `npm run sync-catalog` çalıştırılmalı; `npm run check-catalog` fark varsa hata verir. (Sürüklenme olursa sipariş **reddedilir**, yanlış tahsilat olmaz) | Geliştirici |
| F-19 | Hız sınırı | ÖNERİLEN | LOW | Rate limit fonksiyon örneği başına bellekte; dağıtık değil | Kart deneme saldırısı görülürse Vercel WAF / harici rate-limit servisi | Geliştirici |

---

## 3. Entegrasyon tipi ve veri akışı

Uygulanan model: **Checkout Form (hosted, yönlendirmeli)**.

```
Tarayıcı ──(id + adet + adres + onay)──► /api/payment/initialize
                                            │  fiyatı sunucu hesaplar
                                            │  siparişi "awaiting_payment" yazar
                                            ▼
                                    iyzico CF initialize  (IYZWSv2 imzalı)
                                            │  yanıt imzası doğrulanır
                                            ▼
Tarayıcı ◄──── paymentPageUrl ──────────────┘
   │
   └─► iyzico ödeme sayfası  (PAN + CVV + 3DS yalnız burada)
             │
             ├── POST ─► /api/payment/callback ─► CF retrieve ─► imza + tutar + conversationId doğrula ─► durum
             └── POST ─► /api/payment/webhook  ─► X-IYZ-SIGNATURE-V3 ─► aynı sonuçlandırma kodu
                                                          │
                                                          ▼
                                             orders/{orderId} (transaction, idempotent)
                                                          │
                                            odeme-sonuc.html ◄── /api/order/status
```

### PCI veri akışı işaretlemesi

| Bağlantı | PAN | CVV | Expiry | Kart sahibi adı | token | paymentId | kişisel veri |
|---|---|---|---|---|---|---|---|
| Tarayıcı → efemiletisim.com frontend | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ (ad, adres, e-posta, telefon) |
| Frontend → kendi API'miz | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| API → iyzico | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ (buyer/adres alanları) |
| Tarayıcı → iyzico ödeme sayfası | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| iyzico → API (retrieve/webhook) | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | kart maskesi (BIN + son 4) |
| Veritabanı (`orders`) | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Loglar | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ |

Full PAN ve CVV hiçbir merchant sistemine (frontend, backend, log, Firestore, e-posta,
yedek) girmiyor. Saklanan tek kart verisi iyzico'nun döndürdüğü **BIN (ilk 6) ve son 4
hane** ile kart ailesi bilgisidir; bunlar PAN değildir ve iade/mutabakat için tutulur.

> "iyzico PCI uyumlu olduğu için bizim sorumluluğumuz yok" **doğru değildir**. Hosted
> ödeme kullanıldığında kapsam büyük ölçüde daralır ancak merchant'ın yükümlülüğü
> sürer (ödeme sayfasına giden yolun bütünlüğü, script kontrolü, erişim yönetimi).
> Geçerli SAQ tipi acquirer/iyzico ile teyit edilmelidir.

---

## 4. iyzico başvuru şartları kontrolü

| Şart | Durum | Kanıt / not |
|---|---|---|
| Çalışan site, ürün ve fiyatların görünmesi | `PASS` | 20 ürün, fiyat + KDV dahil ibaresi, çalışan sepet/checkout |
| Gizlilik politikası | `PASS` | `gizlilik-kvkk.html` |
| Mesafeli satış sözleşmesi | `PASS` | `mesafeli-satis-sozlesmesi.html` |
| Ön bilgilendirme formu | `PASS` (bu denetimde eklendi) | `on-bilgilendirme-formu.html` |
| Teslimat / iade koşulları | `PASS` | `iptal-iade.html` |
| Hakkımızda | `PASS` | `hakkimizda.html` |
| Ana sayfadan erişilebilir iletişim bilgisi | `PASS` | Footer: adres, telefon, e-posta, çalışma saatleri; künye: unvan, MERSİS, sicil no, vergi dairesi/no, KEP |
| Ödeme sayfasında SSL | `NOT VERIFIED` | Vercel TLS sağlıyor; canlı domainde sertifika/HSTS taraması yapılmalı |
| Ödeme logoları (iyzico, Visa, Mastercard) | `PASS` | Footer ödeme ikonları + checkout güven şeridi + iyzico rozeti |
| Ürün için gerekli izin/ruhsat | `N/A` | Elektronik aksesuar; regüle kategori yok. Marka ürünleri satıldığı için iyzico distribütör faturası isteyebilir |
| Şirket evrakları (imza sirküleri, vergi levhası, ortak kimlikleri, IBAN) | `NOT VERIFIED` | Merchant panelinden işletme yükleyecek |

---

## 5. Sandbox / production karşılaştırma matrisi

| Ayar | Sandbox | Production | Durum |
|---|---|---|---|
| API base URL | `https://sandbox-api.iyzipay.com` | `https://api.iyzipay.com` | `IYZICO_MODE`'a göre otomatik; çelişki varsa ödeme reddedilir |
| `apiKey` / `secretKey` | Sandbox credential | Production credential | Yalnız sunucu ortam değişkeninde; repoda ve tarayıcı bundle'ında yok |
| Kartlar | iyzico resmî sandbox kartları | Gerçek kartlar | Test kartı listesi siteden kaldırıldı |
| Callback | `${SITE_BASE_URL}/api/payment/callback` | aynı, production domain | `SITE_BASE_URL` ile |
| Webhook | Sandbox panel → aynı yol | Production panel → aynı yol | Panelden girilmesi gerekir |
| Veritabanı | Aynı Firestore projesi | Aynı Firestore projesi | ⚠️ Sipariş kaydında `environment` alanı tutuluyor; test siparişleri bu alandan ayırt edilir |
| Log seviyesi | Sırlar yok | Sırlar yok | Aynı kod yolu |
| Taksit | `IYZICO_ENABLED_INSTALLMENTS` | aynı | Varsayılan `1` (tek çekim) |
| Monitoring | Vercel logs | Vercel logs + alarm | Alarm kurulmalı (F-13) |

---

## 6. Test matrisi

`GEÇTİ` = bu denetimde fiilen çalıştırıldı · `KOD` = kod düzeyinde garanti altına alındı, gerçek gateway ile doğrulanmalı · `NOT VERIFIED` = gerçek iyzico erişimi gerekiyor

Otomatik testler: `npm run test:payment` → 43 birim testi (`scripts/test-payment-lib.mjs`) +
38 akış testi (`scripts/test-payment-flow.mjs`). Akış testi, iyzico gibi davranan yerel bir
sunucu kullanır: gönderilen **IYZWSv2 yetkilendirme başlığını bağımsız olarak yeniden
hesaplayıp doğrular**, yani imzalama mantığı gerçekten sınanır.

| TC | Senaryo | Durum | Not |
|---|---|---|---|
| TC-PRICE-TAMPER | İstemci düşük tutar/fiyat gönderir | **GEÇTİ** | Birim + akış testi: `items[].price=1` gönderilse de sunucu katalog fiyatını kullanıyor ve iyzico'ya o tutar gidiyor |
| TC-VARIANT | Sepette sku yok / sahte sku / başka ürünün sku'su / istemcinin uydurduğu renk | **GEÇTİ** | Birim + akış testi: hepsi reddediliyor; renk/beden katalogdan okunuyor |
| TC-RATE-LIMIT | Aynı IP'den ardışık ödeme denemesi | **GEÇTİ** | Akış testi: 8 denemeden sonra 429 |
| TC-BASKET | Sepet satır toplamı = iyzico `price` | **GEÇTİ** | Birim + akış testi |
| TC-BAD-ITEM | Olmayan ürün / 0 / negatif / 999 adet / yinelenen satır | **GEÇTİ** | Birim test (5 vaka) + akış testi (400) |
| TC-AUTH-HEADER | IYZWSv2 imzası doğru üretiliyor mu | **GEÇTİ** | Sahte gateway imzayı bağımsız hesaplayıp karşılaştırıyor |
| TC-BAD-SIGNATURE | Webhook imzası bozuk/boş | **GEÇTİ** | Birim test — reddediliyor |
| TC-WEBHOOK-SIG | Geçerli V3 imzası (HPP + doğrudan biçim) | **GEÇTİ** | Birim test |
| TC-RESP-SIGNATURE | initialize/retrieve yanıt imzası bozuk | **GEÇTİ** | Akış testi: initialize → ödeme sayfası açılmıyor (502); retrieve → sipariş `pending_review`, sevkiyat yok |
| TC-AMOUNT-MISMATCH | Gateway farklı tutar bildirir | **GEÇTİ** | Akış testi → `pending_review`, mail/sevkiyat yok |
| TC-ORDER-TOKEN | Başka siparişin jetonuyla sipariş okuma | **GEÇTİ** | Birim test — reddediliyor |
| TC-ENV | Yapılandırma yokken ödeme denemesi | **GEÇTİ** | `/api/payment/initialize` → 503, kart sekmesi kapalı, sahte başarı yok |
| TC-AGREEMENT | Sözleşme onayı olmadan ödeme | **GEÇTİ** | Tarayıcı testi + sunucu 400 |
| TC-EFT | EFT siparişi (yerel yedek akış) | **GEÇTİ** | Tarayıcı testi — sipariş oluştu, sepet temizlendi |
| TC-METHOD | Yanlış HTTP metodu | **GEÇTİ** | 405 |
| TC-CALLBACK-REPLAY | Aynı callback 3 kez | **GEÇTİ** | Akış testi: durum değişmiyor, ikinci sipariş maili gitmiyor |
| TC-DECLINE | Gateway `FAILURE` döner | **GEÇTİ** | Akış testi: sipariş `failed`, yan etki yok |
| TC-ERROR-LEAK | Hata mesajında sağlayıcı detayı | **GEÇTİ** | Akış testi: kullanıcıya sabit güvenli mesaj dönüyor |
| TC-DOUBLECLICK | Ödeme butonuna çift tık | **KOD** | Buton `disabled` + sunucuda her deneme ayrı `orderId`; tek ödeme sayfası açılır |
| TC-WEBHOOK-REPLAY | Aynı webhook 5 kez | **KOD** | Callback replay ile aynı mekanizma (transaction) + `paymentEvents` günlüğü |
| TC-ORDER-SWAP | Callback token'ını başka siparişle eşleştirme | **KOD** | `conversationId` ≠ `orderId` → `pending_review`, sevkiyat yok |
| TC-TIMEOUT | initialize sırasında ağ kopması | **KOD** | 20 sn timeout, sipariş `failed`, kör tekrar deneme yok |
| TC-BROWSER-CLOSE | Callback gelmeden sekme kapanır | **KOD** | Webhook aynı sonucu yazar; sonuç sayfası bekleyen siparişi yerelden bulur |
| TC-SUCCESS / TC-3DS-SUCCESS / TC-3DS-FAIL / TC-3DS-INIT | Sandbox kart senaryoları | `NOT VERIFIED` | Anahtar girildikten sonra koşulacak |
| TC-FUNDS / TC-CVC / TC-EXPIRED / TC-FRAUD | Ret senaryoları | `NOT VERIFIED` | Sandbox kartları |
| TC-CANCEL / TC-REFUND / TC-PARTIAL / TC-DOUBLE-REFUND | İptal/iade | `NOT VERIFIED` | Şu an manuel panel süreci (F-12) |
| TC-INSTALLMENT / TC-BAD-INSTALLMENT | Taksit | `N/A` → `NOT VERIFIED` | Varsayılan tek çekim; taksit açılırsa test edilecek |
| TC-CURRENCY / TC-BAD-CURRENCY | Para birimi | **KOD** | Yalnız TRY; retrieve'de currency ≠ TRY → `pending_review` |
| TC-RECON | Gateway ↔ yerel fark | `NOT VERIFIED` | Manuel mutabakat prosedürü yazıldı |
| TC-LOAD / TC-IYZICO-DOWN | Yük / sağlayıcı arızası | `NOT VERIFIED` | Timeout ve kontrollü hata yolu kodda var |
| TC-PREAUTH / TC-CAPTURE | PreAuth & Capture | `N/A` | Kullanılmıyor; standart satış akışı |
| TC-MOBILE | Mobil checkout | `NOT VERIFIED` | Yeni ödeme paneli mobilde gözle kontrol edilmeli |

---

## 7. Mevzuat ve KVKK

| Kontrol | Durum | Not |
|---|---|---|
| Ödemeden önce ürün nitelikleri, KDV dahil toplam ve ek ücretlerin gösterimi | `PASS` | Sipariş özeti + ödeme yükümlülüğü bloğu |
| Sipariş onayından hemen önce "ödeme yükümlülüğü" ifadesi | `PASS` | CTA üstünde; buton metni "Ödemeyi Tamamla" |
| Ön bilgilendirme + mesafeli sözleşme onayının kaydı | `PASS` | `orders.agreements` (zaman damgası + IP) |
| Cayma hakkı (14 gün) ve iade usulü | `PASS` | Ön bilgilendirme formu + iptal-iade sayfası |
| Geri ödemenin, ödeme aracına uygun yapılması | `PASS` (metin) | Uygulama F-12 kapsamında manuel |
| Ticaret unvanı, MERSİS, merkez adresi, KEP, telefon, e-posta | `PASS` | `js/site-config.js` → footer/künye/sözleşmeler |
| ETBİS kaydı | `NOT VERIFIED` | F-08 |
| Pazarlama izninin satın almadan ayrılması | `PASS` | Sitede pazarlama/bülten onayı hiç yok — zorunlu tutulan bir rıza bulunmuyor |
| Zorunlu olmayan çerezler | `PASS` | Analytics/reklam çerezi yüklenmiyor; yalnız işlevsel `localStorage` (tema, sepet, oturum). Reklam/analitik eklenirse **consent yönetimi zorunlu olur** |
| KVKK aydınlatma metni ile fiili işleme uyumu | `PASS` (gözden geçirildi) | Toplanan alanlar sipariş için gerekli; checkout'ta T.C. kimlik no **istenmiyor** (yalnız ayrı/kurumsal fatura seçilirse) |
| iyzico'ya gönderilen `identityNumber` | `PASS` | Müşteriden TCKN toplanmadığı için iyzico'nun zorunlu alanına dolgu değer gönderiliyor (`api/_lib/merchant.js`) — veri minimizasyonu korunuyor |
| Fatura | `NOT VERIFIED` | Tahsil edilen toplam üzerinden müşteriye fatura kesme süreci işletmede; iyzico'nun komisyon faturasıyla karıştırılmamalı |

---

## 8. Rollback planı

Aşağıdaki durumlardan biri görülürse:

- ödeme başarı oranında ani düşüş, `initialize_failed` / `settle_retrieve_failed` log artışı
- `signature_invalid` veya `amount_mismatch` içeren `settle` logları
- aynı sipariş için birden fazla `paymentId`
- webhook `invalid_signature` artışı
- kart deneme (card testing) saldırısı belirtisi

**Uygulanacak sıra:**

1. **Ödemeyi kapat, siteyi kapatma.** Vercel'de `IYZICO_API_KEY` değerini geçici olarak
   silin ve yeniden deploy edin → kart ödemesi otomatik kapanır, checkout EFT'ye düşer,
   sahte başarı üretilmez. (Tüm ödeme uçlarını körlemesine kapatmak yerine bu tercih edilir.)
2. **Uçuştaki işlemleri kurtarın.** `orders` koleksiyonunda `status == "awaiting_payment"`
   ve son 24 saatteki kayıtları listeleyin; her biri için iyzico panelinden `conversationId`
   (= sipariş numarası) ile arama yapın. Ödeme gerçekleşmişse siparişi elle `paid`,
   gerçekleşmemişse `failed` yapın.
3. **Kod sürümünü geri alın** (Vercel → Deployments → önceki sürüme "Promote").
   Sipariş şeması geriye uyumludur: eski sürüm `orders` koleksiyonunu hiç kullanmaz,
   veri kaybı olmaz.
4. **Rollback sonrası ilk iş mutabakattır** (bölüm 9).
5. Müşteriye ulaşılması gereken durum: `pending_review`. Bu siparişlerde para çekilmiş
   olabilir, sevkiyat yapılmamıştır — 24 saat içinde aranmalıdır.

---

## 9. Mutabakat prosedürü (haftalık, 15 dakika)

1. iyzico Merchant Panel → İşlemler → ilgili tarih aralığı → başarılı işlemleri dışa aktarın.
2. Firestore `orders` koleksiyonundan aynı aralıktaki `status == "paid"` siparişleri alın.
3. Şu üç farkı arayın:
   - **gateway'de başarılı, bizde `awaiting_payment`** → webhook/callback kaçmış; siparişi elle tamamlayın ve nedenini loglardan bulun.
   - **bizde `paid`, gateway'de yok** → ciddi bulgu, hemen inceleyin.
   - **`pending_review`** → imza/tutar/fraud uyuşmazlığı; kapatılmadan sevkiyat yapılmaz.
4. İade ve iptalleri ayrıca eşleştirin.
5. Sonucu tarih + fark sayısı olarak kayıt altına alın (fark yoksa da yazın).

---

## 10. Kanıt paketi durumu

| Artefakt | Durum |
|---|---|
| Ana sayfa / ürün / fiyat ekran görüntüleri | İşletme hazırlayacak |
| Gizlilik, mesafeli satış, ön bilgilendirme, iptal-iade, hakkımızda, iletişim | ✅ Hazır (public) |
| Ödeme logoları ekran görüntüsü | ✅ Sayfada mevcut |
| TLS taraması | ⏳ Canlı domainde yapılacak |
| Merchant panel durumu | ⏳ İşletme |
| Şirket evrakları | ⏳ İşletme |
| Sandbox/prod config farkı | ✅ `.env.example` + bu rapor bölüm 5 |
| Başarılı/başarısız ödeme trace'i | ⏳ Sandbox testinden sonra |
| Callback replay testi | ⏳ Sandbox |
| Webhook imza testi | ✅ Birim test (`npm run test:payment`) + ⏳ canlı doğrulama |
| PCI veri akışı | ✅ Bu rapor bölüm 3 |
| Secret taraması | ✅ Repoda iyzico/service account sırrı yok (`.gitignore` güncellendi) |
| Rollback runbook | ✅ Bu rapor bölüm 8 |
| Mutabakat örneği | ✅ Prosedür bölüm 9, çıktı ⏳ |

---

## 11. Nihai kararlar

| Karar | Sonuç |
|---|---|
| **İYZİCO BAŞVURUSUNA HAZIR** | **EVET** — site şartları karşılanıyor; şirket evrakları merchant panelinden yüklenmeli |
| **PRODUCTION PAYMENT TRAFFIC'E HAZIR** | **HAYIR** — `docs/IYZICO-ENTEGRASYON.md` adımları (env değişkenleri, sandbox uçtan uca test, webhook tanımı, F-06 kural sıkılaştırması) tamamlanmadan açılmamalıdır |
| **YASAL/COMPLIANCE REVIEW TAMAMLANDI** | **LEGAL REVIEW REQUIRED** — sözleşme metinleri taslak niteliğinde; ETBİS kaydı (F-08) ve fatura süreci işletme tarafından teyit edilmeli |

"iyzico başvurusundan geçer" ile "gerçek para trafiğine hazır" aynı şey değildir.
Birincisi bugün itibarıyla evet, ikincisi ortam yapılandırması ve sandbox testleri
tamamlanınca evet olacaktır.
