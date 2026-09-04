/* =========================================
   efemiletisim.com – Firebase Yapılandırması
   Project: efemiletisim (ID: efemiletisim)
   ========================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth }       from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyDg2bn1SiRbsuPJJ81SBXu2brf8llokHH4",
  authDomain:        "efemiletisim.firebaseapp.com",
  projectId:         "efemiletisim",
  storageBucket:     "efemiletisim.firebasestorage.app",
  messagingSenderId: "858984175310",
  appId:             "1:858984175310:web:6341417016edcfbc5ae29f",
  measurementId:     "G-MWZM2RFEN5"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// Firebase Auth e-postaları (şifre sıfırlama, e-posta doğrulama) Türkçe gönderilsin.
auth.languageCode = 'tr';

/* ─── Firestore bağlantısını erkenden ısıt ───
   Ölçüm (canlı): Firestore'un İLK okuması 3348 ms, ikincisi 157 ms.
   Fark veriden değil, bağlantının ilk kez kurulmasından geliyor.

   Bu maliyet normalde profil okumasının içinde ödeniyordu: önce
   oturum çözülüyor, SONRA Firestore bağlanmaya başlıyordu — iki
   bekleme arka arkaya. Buradaki minik istek bağlantıyı oturum
   çözülürken başlatır, böylece ikisi paralel ilerler.

   Var olmayan bir belge okunuyor: veri taşımaz, yalnız bağlantıyı
   kurar. `products` herkese açık okunabilir (firestore.rules), yani
   oturum açık olmasa da çalışır. Sonucu kimse beklemiyor ve hata
   yutuluyor — ısınma başarısız olsa bile hiçbir akış etkilenmez. */
/* Kimlik '__...__' biçiminde OLAMAZ: Firestore bu biçimi kendine ayırmış
   ve doc() SENKRON istisna fırlatıyor ("Resource id is invalid because it
   is reserved"). .catch() senkron istisnayı yakalamaz; o hâlde bu modül
   komple patlar ve onunla birlikte tüm oturum sistemi çökerdi.
   Bu yüzden hem sıradan bir kimlik kullanılıyor hem de try/catch var. */
try {
  getDoc(doc(db, 'products', 'baglanti-isitma')).catch(() => {});
} catch (err) {
  /* Isınma bir kolaylık; başarısız olması hiçbir akışı etkilemez. */
}

export { app, auth, db };
