/* =========================================
   efemiletisim.com – Firebase Authentication
   =========================================
   E-posta + Şifre kayıt/giriş
   E-posta doğrulama (sendEmailVerification)
   Firestore'da kullanıcı profili yönetimi
   ========================================= */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  updateProfile,
  EmailAuthProvider,
  reauthenticateWithCredential,
  deleteUser
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  doc, setDoc, getDoc, deleteDoc, updateDoc, arrayUnion, serverTimestamp,
  collection, addDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { auth, db } from "./firebase-config.js";

/* ─── Türkçe hata mesajları ─── */
const FIREBASE_ERROR_MESSAGES = {
  "auth/email-already-in-use":   "Bu e-posta adresi zaten kayıtlı.",
  "auth/invalid-email":          "Geçersiz e-posta adresi.",
  "auth/missing-email":          "E-posta adresi girilmedi.",
  "auth/weak-password":          "Şifre en az 6 karakter olmalıdır.",
  "auth/user-not-found":         "Bu e-posta ile kayıtlı hesap bulunamadı.",
  "auth/wrong-password":         "Şifre hatalı. Lütfen tekrar deneyin.",
  "auth/invalid-credential":     "E-posta veya şifre hatalı.",
  "auth/too-many-requests":      "Çok fazla deneme yapıldı. Lütfen birkaç dakika bekleyip tekrar deneyin.",
  "auth/network-request-failed": "İnternet bağlantınızı kontrol edin.",
  "auth/user-disabled":          "Bu hesap devre dışı bırakılmış.",

  /* Firebase Console yapılandırma hataları – kullanıcı hatası değildir,
     mesaj işletmeyi yönlendirecek şekilde açık tutulur. */
  "auth/operation-not-allowed":
    "E-posta/şifre girişi Firebase projesinde etkin değil. " +
    "Firebase Console → Authentication → Sign-in method → Email/Password açılmalıdır.",
  "auth/unauthorized-continue-uri":
    "Bu alan adı Firebase'de yetkili değil. " +
    "Firebase Console → Authentication → Settings → Authorized domains listesine eklenmelidir.",
  "auth/invalid-continue-uri":  "Doğrulama linki adresi geçersiz.",
  "auth/missing-continue-uri":  "Doğrulama linki adresi eksik.",
  "auth/invalid-api-key":       "Firebase API anahtarı geçersiz. js/firebase-config.js kontrol edilmelidir.",
  "auth/quota-exceeded":        "Günlük e-posta gönderim kotası aşıldı. Yarın tekrar deneyin.",
  "auth/internal-error":        "Firebase tarafında beklenmeyen bir hata oluştu."
};

function getFirebaseErrorMsg(code) {
  return FIREBASE_ERROR_MESSAGES[code] || `Bir hata oluştu (${code}).`;
}

/* ─── Firebase hatasını konsola da yaz ───
   Kullanıcıya Türkçe mesaj gösterilir, hata kodu ve orijinal mesaj
   teşhis edilebilmesi için konsolda saklanır. */
function reportAuthError(context, err) {
  console.error(`[auth] ${context} başarısız: ${err.code} – ${err.message}`);
  return { success: false, code: err.code, msg: getFirebaseErrorMsg(err.code) };
}

/* ─── Kayıt ol ─── */
async function firebaseRegister(ad, soyad, email, password) {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const user = cred.user;

    // Firebase display name güncelle
    await updateProfile(user, { displayName: `${ad} ${soyad}` });

    // Firestore'a profil yaz
    await setDoc(doc(db, "users", user.uid), {
      uid:       user.uid,
      ad,
      soyad,
      email,
      emailVerified: false,
      createdAt: serverTimestamp(),
      orders:    [],
      addresses: []
    });

    // Doğrulama e-postası gönder.
    // continueUrl BİLEREK verilmiyor: özel bir devam adresi verildiğinde
    // alan adının Firebase "Authorized domains" listesinde olması zorunludur;
    // aksi halde auth/unauthorized-continue-uri ile mail hiç gönderilmez.
    // Varsayılan action handler (<proje>.firebaseapp.com) her zaman yetkilidir.
    await sendEmailVerification(user);

    return { success: true, user, needsVerification: true };
  } catch (err) {
    return reportAuthError('kayıt', err);
  }
}

/* ─── Giriş yap ─── */
async function firebaseLogin(email, password) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const user = cred.user;

    // E-posta doğrulama kontrolü
    if (!user.emailVerified) {
      await signOut(auth);
      return {
        success: false,
        needsVerification: true,
        email,
        msg: "E-posta adresiniz henüz doğrulanmamış. Lütfen gelen kutunuzu kontrol edin."
      };
    }

    /* Profil BURADA okunmuyor.

       Eskiden getUserProfile() cagriliyordu ve donen `profile` hicbir yerde
       kullanilmiyordu (tek cagiran hesap.html, yalniz success/msg'e bakiyor).
       Firestore'un ilk okumasi soguk baglanti yuzunden ~3,3 saniye suruyor;
       "Giris yapiliyor..." gostergesi bu sure boyunca donuyordu.

       Ustelik profil zaten js/auth.js icindeki onAuthChange tarafindan
       okunuyor, yani ayni belge her giriste IKI kez cekiliyordu.
       Yonlendirmeyi de hesap.html'in kendi onAuthChange'i yapiyor; bu
       okumayi beklemesi icin bir sebep yok. */
    return { success: true, user };
  } catch (err) {
    return reportAuthError('giriş', err);
  }
}

/* ─── Çıkış yap ─── */
async function firebaseLogout() {
  try {
    await signOut(auth);
    return { success: true };
  } catch (err) {
    return reportAuthError('çıkış', err);
  }
}

/* ─── Şifre sıfırlama e-postası ───
   actionCodeSettings.url, kullanıcıyı Firebase'in genel action handler'ı yerine
   kendi Türkçe/çift-şifreli sıfırlama sayfamıza (sifre-sifirla.html) yönlendirir.
   Bu adres site kendi alan adında olduğu için "Authorized domains" listesinde
   zaten yetkilidir; ekstra Firebase Console ayarı gerekmez. */
async function firebaseForgotPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email, {
      url: `${window.location.origin}/sifre-sifirla.html`
    });
    return { success: true };
  } catch (err) {
    return reportAuthError('şifre sıfırlama maili', err);
  }
}

/* ─── Doğrulama e-postasını tekrar gönder ─── */
async function resendVerificationEmail(email, password) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await sendEmailVerification(cred.user);
    await signOut(auth);
    return { success: true };
  } catch (err) {
    return reportAuthError('doğrulama maili tekrar gönderme', err);
  }
}

/* ─── Firestore: kullanıcı profili oku ─── */
async function getUserProfile(uid) {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    console.error(`[auth] Kullanıcı profili okunamadı (uid: ${uid}): ${err.code} – ${err.message}`);
    return null;
  }
}

/* ─── Firestore: profil bilgilerini güncelle ───
   data: { ad, soyad, telefon, tck, dogumTarihi } içinden sadece verilenler yazılır. */
async function updateUserProfile(uid, data) {
  try {
    await updateDoc(doc(db, "users", uid), data);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      msg: `Profil güncellenemedi: ${err.code} – ${err.message}`
    };
  }
}

/* ─── Firestore: kayıtlı adresler listesini tamamen değiştir ───
   Ekleme/düzenleme/silme tek noktadan, tüm dizi yeniden yazılır
   (arrayRemove tam obje eşleşmesi istediği için düzenlemeye uygun değil). */
async function replaceUserAddresses(uid, addresses) {
  try {
    await updateDoc(doc(db, "users", uid), { addresses });
    return { success: true };
  } catch (err) {
    return {
      success: false,
      msg: `Adresler güncellenemedi: ${err.code} – ${err.message}`
    };
  }
}

/* ─── Hesabı kalıcı sil ───
   Firebase, hassas işlemler için yakın zamanda giriş şartı koşar;
   bu yüzden silmeden önce şifre ile yeniden kimlik doğrulama yapılır. */
async function deleteUserAccount(password) {
  const user = auth.currentUser;
  if (!user) {
    return { success: false, msg: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };
  }
  try {
    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, credential);
    await deleteDoc(doc(db, "users", user.uid));
    await deleteUser(user);
    return { success: true };
  } catch (err) {
    return reportAuthError('hesap silme', err);
  }
}

/* ─── Firestore: sipariş kaydet ─── */
async function saveOrderToFirestore(uid, orderData) {
  try {
    const order = {
      id:          "EFM" + Date.now().toString().slice(-6),
      date:        new Date().toISOString(),
      status:      "processing",
      statusLabel: "Hazırlanıyor",
      items:       orderData.items,
      total:       orderData.total,
      address:     orderData.address     || null,
      invoice:     orderData.invoice     || null,
      delivery:    orderData.delivery    || "kargo",
      paymentMethod: orderData.paymentMethod || "kart",
      paymentId:   orderData.paymentId   || null,
      eftReceiptNo: orderData.eftReceiptNo || null,
      trackingNumber: null
    };

    await updateDoc(doc(db, "users", uid), {
      orders: arrayUnion(order)
    });

    return order;
  } catch (err) {
    throw new Error(
      `Sipariş Firestore'a yazılamadı (uid: ${uid}, tutar: ${orderData.total}): ` +
      `${err.code} – ${err.message}`
    );
  }
}

/* ─── Mail kuyruğuna yaz ───
   "mail" koleksiyonu firestore.rules tarafından korunur: hedef adres ya
   destek@efemiletisim.com ya da isteği yapan kullanıcının kendi e-postası olmalıdır.
   Gerçek gönderim, Firebase Console'a kurulacak "Trigger Email from Firestore"
   extension'ı tarafından yapılır (bkz. docs/EMAIL-KURULUMU.md). */
async function queueMail(to, subject, html) {
  try {
    await addDoc(collection(db, "mail"), {
      to,
      message: { subject, html }
    });
    return { success: true };
  } catch (err) {
    console.error(`[mail] Kuyruğa yazılamadı (to: ${to}): ${err.code} – ${err.message}`);
    return { success: false };
  }
}

/* ─── Sipariş onay maili (üyeye, kendi e-postasına) ─── */
async function sendOrderConfirmationMail(order) {
  const user = auth.currentUser;
  if (!user?.email) return { success: false };

  const itemsHtml = (order.items || [])
    .map(i => `<li>${i.name} × ${i.qty} — ${i.price * i.qty} ₺</li>`)
    .join('');

  return queueMail(
    user.email,
    `Siparişiniz Alındı – ${order.id}`,
    `<p>Merhaba,</p>
     <p><strong>${order.id}</strong> numaralı siparişiniz alındı ve hazırlanıyor.</p>
     <ul>${itemsHtml}</ul>
     <p><strong>Toplam: ${order.total} ₺</strong></p>
     <p>Bizi tercih ettiğiniz için teşekkür ederiz.<br>efem iletişim</p>`
  );
}

/* ─── Destek/soru bildirim maili (herkes → destek@) ─── */
async function sendSupportNotificationMail(subject, html) {
  return queueMail('destek@efemiletisim.com', subject, html);
}

/* ─── Auth state değişikliğini dinle ─── */
function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

/* ─── Mevcut kullanıcı ─── */
function getCurrentFirebaseUser() {
  return auth.currentUser;
}

export {
  firebaseRegister,
  firebaseLogin,
  firebaseLogout,
  firebaseForgotPassword,
  resendVerificationEmail,
  getUserProfile,
  updateUserProfile,
  replaceUserAddresses,
  deleteUserAccount,
  saveOrderToFirestore,
  sendOrderConfirmationMail,
  sendSupportNotificationMail,
  onAuthChange,
  getCurrentFirebaseUser
};
