'use strict';

/* =========================================
   Sipariş defteri (Firestore / Firebase Admin)
   =========================================
   Sipariş ve ödeme durumunun TEK otoritesi sunucudur. Tarayıcı artık
   sipariş yazamaz (bkz. firestore.rules): "ödendi" bilgisi yalnızca
   PayTR bildiriminden doğrulanmış sonuç ile bu modül üzerinden yazılır.

   Koleksiyonlar:
   - orders/{orderId}        : otoritatif sipariş + ödeme durumu
   - users/{uid}.orders[]    : üyenin profilinde görünen kopya (geriye dönük uyumluluk)
   - mail/{autoId}           : "Trigger Email from Firestore" extension kuyruğu
   - paymentEvents/{eventId} : webhook/callback olay günlüğü (idempotency + mutabakat) */

const { serviceAccount } = require('./env');

let cached = null;

function getStore() {
  if (cached !== undefined && cached !== null) return cached;

  const account = serviceAccount();
  if (!account) return null;

  // firebase-admin yalnızca yapılandırma varsa yüklenir; eksikse fonksiyon
  // soğuk başlangıçta gereksiz yere ağır bağımlılığı çözmez.
  const admin = require('firebase-admin');
  const app = admin.apps.length
    ? admin.app()
    : admin.initializeApp({ credential: admin.credential.cert(account) });

  cached = {
    admin,
    db: admin.firestore(app),
    auth: admin.auth(app),
    FieldValue: admin.firestore.FieldValue
  };
  return cached;
}

function isStoreConfigured() {
  return Boolean(serviceAccount());
}

/* ─── Firebase ID token doğrulama (üye siparişleri) ───
   Başarısızlık sipariş akışını KESMEZ; sipariş misafir siparişi olarak
   devam eder. Böylece oturum sorunları ödemeyi bloklamaz. */
async function verifyIdToken(authorizationHeader) {
  const store = getStore();
  if (!store) return null;

  const header = authorizationHeader || '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) return null;

  try {
    const decoded = await store.auth.verifyIdToken(match[1]);
    return { uid: decoded.uid, email: decoded.email || null };
  } catch {
    return null;
  }
}

/* ─── Sipariş oluştur (idempotent: aynı id ikinci kez yazılamaz) ─── */
async function createOrder(orderId, data) {
  const store = getStore();
  if (!store) throw new Error('store_not_configured');
  await store.db.collection('orders').doc(orderId).create({
    ...data,
    createdAt: store.FieldValue.serverTimestamp(),
    updatedAt: store.FieldValue.serverTimestamp()
  });
}

async function getOrder(orderId) {
  const store = getStore();
  if (!store) throw new Error('store_not_configured');
  const snap = await store.db.collection('orders').doc(orderId).get();
  return snap.exists ? snap.data() : null;
}

async function updateOrder(orderId, data) {
  const store = getStore();
  if (!store) throw new Error('store_not_configured');
  await store.db.collection('orders').doc(orderId).update({
    ...data,
    updatedAt: store.FieldValue.serverTimestamp()
  });
}

/* ─── Durum geçişini atomik uygula ───
   `decide(order)` mevcut siparişi alır ve ya null (değişiklik yok) ya da
   yazılacak alanları döner. Transaction sayesinde eşzamanlı callback +
   webhook çakışması tek sonuç üretir (rapor: TC-CALLBACK-REPLAY,
   TC-WEBHOOK-REPLAY, TC-CONCURRENT). */
async function transitionOrder(orderId, decide) {
  const store = getStore();
  if (!store) throw new Error('store_not_configured');
  const ref = store.db.collection('orders').doc(orderId);

  return store.db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { applied: false, reason: 'not_found', order: null };

    const order = snap.data();
    const patch = decide(order);
    if (!patch) return { applied: false, reason: 'no_change', order };

    tx.update(ref, { ...patch, updatedAt: store.FieldValue.serverTimestamp() });
    return { applied: true, order: { ...order, ...patch } };
  });
}

/* ─── Olay günlüğü (idempotency anahtarı) ───
   Aynı eventId ikinci kez gelirse `false` döner; işleyici erken çıkar. */
async function recordEventOnce(eventId, data) {
  const store = getStore();
  if (!store) throw new Error('store_not_configured');
  try {
    await store.db.collection('paymentEvents').doc(eventId).create({
      ...data,
      createdAt: store.FieldValue.serverTimestamp()
    });
    return true;
  } catch (err) {
    if (err && (err.code === 6 || err.code === 'already-exists')) return false;
    throw err;
  }
}

/* ─── Üye profiline sipariş kopyası ekle ───
   profil.html hâlâ users/{uid}.orders dizisini okuyor; kopya oradan
   görünür kalsın diye sunucu tarafından yazılır. Hata sipariş akışını
   bozmaz, yalnızca loglanır. */
async function appendOrderToUserProfile(uid, orderSummary) {
  const store = getStore();
  if (!store || !uid) return;
  try {
    await store.db.collection('users').doc(uid).update({
      orders: store.FieldValue.arrayUnion(orderSummary)
    });
  } catch (err) {
    console.error('[store] users/%s.orders güncellenemedi: %s', uid, err.message);
  }
}

/* ─── Mail kuyruğu ─── */
async function queueMail(to, subject, html) {
  const store = getStore();
  if (!store || !to) return;
  try {
    await store.db.collection('mail').add({ to, message: { subject, html } });
  } catch (err) {
    console.error('[store] mail kuyruğa yazılamadı: %s', err.message);
  }
}

module.exports = {
  getStore,
  isStoreConfigured,
  verifyIdToken,
  createOrder,
  getOrder,
  updateOrder,
  transitionOrder,
  recordEventOnce,
  appendOrderToUserProfile,
  queueMail
};
