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
function getFirebaseErrorMsg(code) {
  const map = {
    "auth/email-already-in-use":    "Bu e-posta adresi zaten kayıtlı.",
    "auth/invalid-email":           "Geçersiz e-posta adresi.",
    "auth/weak-password":           "Şifre en az 6 karakter olmalıdır.",
    "auth/user-not-found":          "Bu e-posta ile kayıtlı hesap bulunamadı.",
    "auth/wrong-password":          "Şifre hatalı. Lütfen tekrar deneyin.",
    "auth/invalid-credential":      "E-posta veya şifre hatalı.",
    "auth/too-many-requests":       "Çok fazla başarısız giriş. Lütfen bir süre bekleyin.",
    "auth/network-request-failed":  "İnternet bağlantınızı kontrol edin.",
    "auth/user-disabled":           "Bu hesap devre dışı bırakılmış."
  };
  return map[code] || "Bir hata oluştu. Lütfen tekrar deneyin.";
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

    // Doğrulama e-postası gönder
    await sendEmailVerification(user, {
      url: window.location.origin + "/hesap.html",
      handleCodeInApp: false
    });

    return { success: true, user, needsVerification: true };
  } catch (err) {
    return { success: false, msg: getFirebaseErrorMsg(err.code) };
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
    return { success: false, msg: getFirebaseErrorMsg(err.code) };
  }
}

/* ─── Çıkış yap ─── */
async function firebaseLogout() {
  try {
    await signOut(auth);
    return { success: true };
  } catch (err) {
    return { success: false, msg: getFirebaseErrorMsg(err.code) };
  }
}

/* ─── Şifre sıfırlama e-postası ─── */
async function firebaseForgotPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email, {
      url: window.location.origin + "/hesap.html"
    });
    return { success: true };
  } catch (err) {
    return { success: false, msg: getFirebaseErrorMsg(err.code) };
  }
}

/* ─── Doğrulama e-postasını tekrar gönder ─── */
async function resendVerificationEmail(email, password) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await sendEmailVerification(cred.user, {
      url: window.location.origin + "/hesap.html"
    });
    await signOut(auth);
    return { success: true };
  } catch (err) {
    return { success: false, msg: getFirebaseErrorMsg(err.code) };
  }
}

/* ─── Firestore: kullanıcı profili oku ─── */
async function getUserProfile(uid) {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? snap.data() : null;
  } catch {
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
    console.error("Sipariş kaydedilemedi:", err);
    return null;
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
