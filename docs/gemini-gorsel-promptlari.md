# Gemini için Görsel Üretim Prompt'ları — efemiletisim.com

Amaç: siteye "sanatsal hava" katacak, çizim tarzı (line-art / ince kalem eskizi) minimalist görseller üretmek. Ürün fotoğraflarının yerine geçmiyor — bunlar dekoratif/atmosferik görseller: hero arka planı, kategori illüstrasyonları, boş durum (empty state) çizimleri, hakkımızda sayfası görselleri gibi yerlerde kullanılacak.

Model: Gemini'nin görsel üretim modu (Nano Banana / Imagen). Her prompt'u olduğu gibi yapıştırıp üretebilirsin. Türkçe de anlıyor ama İngilizce prompt'lar bu modellerde daha tutarlı stil sonucu veriyor — bu yüzden prompt'lar İngilizce yazıldı.

---

## 1) Stil Sabiti (her prompt'un başına ekle)

Tüm görsellerin AYNI seride hissettirmesi için, aşağıdaki "stil prefix"ini her prompt'un başına ekleyerek üret. Tutarlılık için mümkünse hepsini aynı Gemini konuşmasında art arda iste (model önceki görseli referans alarak stili daha kolay korur).

```
STYLE: Minimalist single-line continuous ink illustration, fine uniform line
weight (like a technical pen sketch), on a warm cream/off-white paper texture
background (#FAF7F0). No color fill except one restrained accent in cool blue
(#2563EB) used sparingly — a single highlighted element per image, never more
than 10% of the composition. No photorealism, no gradients, no drop shadows,
no 3D rendering. Hand-drawn feel with slightly imperfect, organic linework —
not vector-perfect, not clipart, not corporate flat-icon style. Generous
negative space around the subject. Editorial, art-gallery quality, like a
page from a designer's sketchbook.
```

**Negatif / kaçınılacaklar** (Gemini'ye ayrıca belirt istersen): *no text, no logos, no watermark, no photorealistic rendering, no gradient mesh, no glossy 3D, no emoji-style icons, no thick outlines, no busy background clutter.*

---

## 2) Ana Sayfa — Hero Arka Plan İllüstrasyonu

**Kullanım yeri:** `index.html` hero bölümü, `hero-bg-shapes` katmanının arkasında veya `hero-visual` yanında dekoratif katman olarak. Dosya: `assets/images/hero-sketch.png` (veya `.webp`).

**Boyut:** 1600×1200px (4:3), transparan/kırpılabilir kenarlar.

```
STYLE: Minimalist single-line continuous ink illustration, fine uniform line
weight (like a technical pen sketch), on a warm cream/off-white paper texture
background (#FAF7F0). No color fill except one restrained accent in cool blue
(#2563EB) used sparingly — a single highlighted element per image, never more
than 10% of the composition. No photorealism, no gradients, no drop shadows,
no 3D rendering. Hand-drawn feel with slightly imperfect, organic linework —
not vector-perfect, not clipart, not corporate flat-icon style. Generous
negative space around the subject. Editorial, art-gallery quality, like a
page from a designer's sketchbook.

SUBJECT: A loose, artful arrangement of three tech objects floating in space —
a smartwatch with visible watch face detail, an over-ear wireless headphone,
and a slim tablet at a slight angle — connected by thin looping line-art
ribbons/wires that flow between them like a single unbroken sketch stroke.
Objects overlap slightly at different scales to create depth without shading.
The smartwatch's screen circle is the one accented element, drawn in the
blue accent color. Wide horizontal composition with empty space on the left
third for text overlay. No hands, no people, no background scenery.
```

---

## 3) Kategori İllüstrasyonları (3 adet)

**Kullanım yeri:** `urunler.html` kategori kartları / `index.html` kategori bölümü — mevcut SVG ikonların yanına veya yerine büyük dekoratif üst görsel olarak. Dosyalar: `assets/images/category-saat.png`, `category-kulaklik.png`, `category-tablet.png`.

**Boyut:** 800×800px (1:1, kare).

### 3a. Akıllı Saatler
```
[STYLE prefix'i buraya ekle]

SUBJECT: A single smartwatch drawn in continuous fine-line sketch style,
three-quarter angle view, showing subtle strap texture with parallel hatch
lines. The watch face circle is filled with the blue accent color as the
one highlighted detail. Small motion/notification lines radiate softly from
the top corner of the screen. Centered composition, generous cream negative
space around it, like a single object study in a sketchbook.
```

### 3b. Kulaklıklar
```
[STYLE prefix'i buraya ekle]

SUBJECT: A single over-ear wireless headphone drawn in continuous fine-line
sketch style, floating at a slight tilt, headband arched gracefully. Soft
looping line-art sound waves emanate from one ear cushion in the blue accent
color as the single highlighted element. Centered composition, generous
cream negative space, sketchbook object-study feel.
```

### 3c. Tabletler
```
[STYLE prefix'i buraya ekle]

SUBJECT: A single slim tablet drawn in continuous fine-line sketch style,
standing propped at a slight angle like it's resting against an invisible
surface. The screen area has a few thin geometric line details (like a
sketched app grid) with one small accent-blue square highlighted among them.
Centered composition, generous cream negative space, sketchbook object-study
feel.
```

---

## 4) Hakkımızda Sayfası — Atmosfer Görseli

**Kullanım yeri:** `hakkimizda.html`, hikaye/değerler bölümünün yanında geniş bir illüstrasyon. Dosya: `assets/images/hakkimizda-sketch.png`.

**Boyut:** 1400×1000px.

```
[STYLE prefix'i buraya ekle]

SUBJECT: A cozy, small neighborhood electronics shopfront drawn in loose
architectural sketch style — a storefront window with a few tech products
displayed on a shelf inside, an awning, a half-open door. Line-art only, no
color except a single blue accent on the shop's door handle or a small sign
detail. Slightly whimsical, warm, human-scale — this represents a genuine
local telecom/electronics store, not a big-box retailer. Wide composition
with sky-level negative space above for text overlay.
```

---

## 5) Boş Durum (Empty State) İllüstrasyonları — 3 adet

**Kullanım yeri:** `.empty-state .icon` alanının üstüne büyük illüstrasyon olarak (sepet boş, favoriler boş, sipariş yok — `sepet.html`, `profil.html`). Şu an bu alanlarda sade SVG ikon var; bu görseller onun yerini alacak/zenginleştirecek. Dosyalar: `assets/images/empty-cart.png`, `empty-favorites.png`, `empty-orders.png`.

**Boyut:** 500×500px (1:1), transparan arka plan tercih edilir (PNG).

### 5a. Boş Sepet
```
[STYLE prefix'i buraya ekle]

SUBJECT: A small line-art shopping basket/cart, empty, drawn with a gentle
melancholic tilt (as if slightly sad but charming, not depressing) — maybe
one single small dashed line floating above it like a lost item drifting
away, in the blue accent color. Lots of empty cream space around it,
small and centered, playful sketchbook doodle feel — not corporate icon.
```

### 5b. Boş Favoriler
```
[STYLE prefix'i buraya ekle]

SUBJECT: A simple line-art heart outline, hollow/unfilled, drawn with a soft
dashed or dotted stroke instead of a solid line to suggest "waiting to be
filled" — one small solid blue accent spark or star drawn just outside the
heart's outline as if inviting it. Small and centered, generous cream
negative space, playful sketchbook doodle feel.
```

### 5c. Boş Sipariş Geçmişi
```
[STYLE prefix'i buraya ekle]

SUBJECT: A small line-art shipping box, closed, sitting alone with a single
looping dashed line-art path behind it suggesting a road/journey not yet
taken — the box's tape line is the single blue accent detail. Small and
centered, generous cream negative space, playful sketchbook doodle feel.
```

---

## 6) Ödeme Sayfası — Güven Atmosferi Görseli

**Kullanım yeri:** `odeme.html`, ödeme adımının yanında veya üstünde küçük bir dekoratif şerit görseli (isteğe bağlı — sayfa zaten metin/rozetlerle güven veriyor, bu tamamen dekoratif katman). Dosya: `assets/images/odeme-sketch.png`.

**Boyut:** 1200×400px (geniş, kısa şerit).

```
[STYLE prefix'i buraya ekle]

SUBJECT: A minimal line-art padlock illustration, closed, drawn with a single
continuous confident stroke, centered inside a very thin circular line-art
badge/seal shape (like a wax-seal outline, not a solid badge). The padlock's
keyhole is the single blue accent detail. Wide short composition with equal
cream negative space on both sides, quiet and reassuring, sketchbook
object-study feel — not a generic security icon, not a shield, not a lock
clipart.
```

---

## 7) 404 / Genel Hata Sayfası (varsa ileride eklenecek)

**Kullanım yeri:** Şu an sitede özel bir 404 sayfası yok; ileride eklenirse kullanılabilir. Dosya: `assets/images/404-sketch.png`.

**Boyut:** 900×700px.

```
[STYLE prefix'i buraya ekle]

SUBJECT: A small line-art tablet or smartwatch character drawn with a
puzzled expression suggested only through simple line marks (a squiggle
where a screen would show a question mark), looking lost, standing on a
single thin horizontal ground line with nothing else around it. The screen's
question mark is the single blue accent detail. Vast cream negative space,
lonely but charming, sketchbook doodle feel.
```

---

## Kullanım Notları

- **Sırayla üret, aynı sohbette kal:** Gemini'ye önce stil prefix'ini tek başına gönderip bir "referans" görsel ürettirip, sonraki her prompt'ta *"aynı stilde ama şu konu"* diye devam etmek, farklı sohbetlerde tek tek üretmekten daha tutarlı sonuç verir.
- **Format:** Üretilen görselleri PNG olarak indirip, siteye eklerken WebP'ye çevir (dosya boyutu için) — proje zaten `assets/images/products/` altında `.webp` kullanıyor, aynı yaklaşımı sürdür.
- **Kaydetme yeri:** Tüm yeni görselleri `assets/images/` altına (ürün görselleriyle karışmasın diye `assets/images/products/` DIŞINA) kaydet.
- **Ana rengi bozma:** Prompt'lardaki tek accent renk `#2563EB` — sitenin `--primary` değişkeniyle birebir aynı. Farklı bir mavi tonu çıkarsa, prompt'a `exact hex #2563EB` ekleyerek tekrar dene.
- **Alt metin unutma:** Her görseli siteye eklerken anlamlı bir `alt` metni yaz (SEO + erişilebilirlik) — bu görseller dekoratif olsa da `alt=""` yerine kısa açıklama tercih edilmeli çünkü çoğu içerikle ilişkili (örn. `alt="Akıllı saat çizimi"`).
- **Karanlık mod:** Siteye artık dark mode eklendi (bkz. `CHANGELOG.md`). Bu görseller kirli-beyaz/krem zeminle üretiliyor; karanlık modda kart arka planı koyulaşacağı için görselleri şeffaf PNG olarak indirip CSS'te `background: var(--surface-2)` gibi bir kart içine oturtmak, krem zemin koyu temada garip durmasını önler.
