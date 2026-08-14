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
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  doc, setDoc, getDoc, updateDoc, arrayUnion, serverTimestamp
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

    // Firestore'dan profil oku
    const profile = await getUserProfile(user.uid);
    return { success: true, user, profile };
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
   continueUrl verilmez; gerekçe firebaseRegister içindeki not ile aynıdır. */
async function firebaseForgotPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email);
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
      delivery:    orderData.delivery    || "kargo",
      paymentMethod: orderData.paymentMethod || "kart",
      paymentId:   orderData.paymentId   || null
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
  saveOrderToFirestore,
  onAuthChange,
  getCurrentFirebaseUser
};
