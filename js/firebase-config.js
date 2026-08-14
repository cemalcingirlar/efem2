/* =========================================
   efemiletisim.com – Firebase Yapılandırması
   Project: efemiletisim (ID: efemiletisim)
   ========================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth }       from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore }  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

export { app, auth, db };
