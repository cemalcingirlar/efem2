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

  /* Storage kovası: açıkça verilmezse Firebase'in varsayılan adlandırmasına
     düşülür (görsel yükleme bu kovaya yazar). */
  const storageBucket = (process.env.FIREBASE_STORAGE_BUCKET || '').trim()
    || `${account.project_id}.firebasestorage.app`;

  const app = admin.apps.length
    ? admin.app()
    : admin.initializeApp({ credential: admin.credential.cert(account), storageBucket });

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
    return {
      uid: decoded.uid,
      email: decoded.email || null,
      emailVerified: Boolean(decoded.email_verified)
    };
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

/* ─── Yönetici: tüm siparişler (üye + misafir) ───
   Admin paneli bu listeyi okur; istemcinin Firestore'a doğrudan erişimi yok. */
async function listOrders({ limit = 200, status = null } = {}) {
  const store = getStore();
  if (!store) throw new Error('store_not_configured');

  let query = store.db.collection('orders');
  if (status) query = query.where('status', '==', status);

  const snap = await query.orderBy('createdAt', 'desc').limit(Math.min(limit, 500)).get();
  return snap.docs.map(d => d.data());
}

/* ─── Yönetici: sipariş durumunu değiştir ───
   Ödeme durumunun üzerine yazmamak için yalnız sevkiyat durumlarına geçilir;
   çağıran (api/admin/orders.js) izin verilen durumu doğrular. */
async function setOrderStatus(orderId, status, statusLabel, actorEmail) {
  const store = getStore();
  if (!store) throw new Error('store_not_configured');
  const ref = store.db.collection('orders').doc(orderId);

  return store.db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { applied: false, reason: 'not_found', order: null };

    const order = snap.data();
    if (order.status === status) return { applied: false, reason: 'no_change', order };

    tx.update(ref, {
      status,
      statusLabel,
      fulfillment: {
        updatedAt: new Date().toISOString(),
        updatedBy: actorEmail || null,
        previousStatus: order.status
      },
      updatedAt: store.FieldValue.serverTimestamp()
    });

    return { applied: true, order: { ...order, status, statusLabel } };
  });
}

/* ─── Üye profilindeki sipariş kopyasını da güncelle ───
   profil.html users/{uid}.orders dizisini okuyor; admin durumu değiştirince
   müşteri de güncel durumu görsün diye dizideki ilgili kayıt güncellenir.
   Dizi elemanı güncellemek için tüm dizi okunup yeniden yazılır (Firestore'da
   dizi içi alan güncellemesi yok), bu yüzden transaction içinde yapılır. */
async function syncUserOrderStatus(uid, orderId, status, statusLabel) {
  const store = getStore();
  if (!store || !uid) return { applied: false, reason: 'no_user' };
  const ref = store.db.collection('users').doc(uid);

  try {
    return await store.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return { applied: false, reason: 'user_not_found' };

      const data = snap.data() || {};
      const orders = Array.isArray(data.orders) ? data.orders : [];
      let found = false;

      const next = orders.map(o => {
        if (o && o.id === orderId) { found = true; return { ...o, status, statusLabel }; }
        return o;
      });

      if (!found) return { applied: false, reason: 'order_not_in_profile' };

      tx.update(ref, { orders: next });
      return { applied: true };
    });
  } catch (err) {
    console.error('[store] users/%s.orders durumu güncellenemedi: %s', uid, err.message);
    return { applied: false, reason: 'error' };
  }
}

/* ─── Katalog: ürünler ───
   Admin panelinden yönetilen ürünler. İstemci bu koleksiyona yazamaz
   (firestore.rules); tüm yazma işlemleri Admin SDK ile buradan geçer. */
async function listProducts() {
  const store = getStore();
  if (!store) return [];
  const snap = await store.db.collection('products').get();
  return snap.docs.map(d => d.data());
}

async function saveProduct(product) {
  const store = getStore();
  if (!store) throw new Error('store_not_configured');
  await store.db.collection('products').doc(String(product.id)).set({
    ...product,
    updatedAt: store.FieldValue.serverTimestamp()
  }, { merge: true });
}

async function deleteProduct(id) {
  const store = getStore();
  if (!store) throw new Error('store_not_configured');
  await store.db.collection('products').doc(String(id)).delete();
}

/* ─── Katalog: kuponlar ─── */
async function listCoupons() {
  const store = getStore();
  if (!store) return [];
  const snap = await store.db.collection('coupons').get();
  return snap.docs.map(d => d.data());
}

async function saveCoupon(coupon) {
  const store = getStore();
  if (!store) throw new Error('store_not_configured');
  await store.db.collection('coupons').doc(coupon.code).set({
    ...coupon,
    updatedAt: store.FieldValue.serverTimestamp()
  }, { merge: true });
}

async function deleteCoupon(code) {
  const store = getStore();
  if (!store) throw new Error('store_not_configured');
  await store.db.collection('coupons').doc(String(code).toUpperCase()).delete();
}

/* ─── Görsel yükleme (Firebase Storage) ───
   Yükleme sunucudan yapılır; istemcinin Storage'a yazma yetkisi yoktur.
   Dönüş: herkesin okuyabildiği kalıcı URL. */
async function uploadImage(path, buffer, contentType) {
  const store = getStore();
  if (!store) throw new Error('store_not_configured');

  const bucket = store.admin.storage().bucket();
  const file = bucket.file(path);

  await file.save(buffer, {
    contentType,
    resumable: false,
    metadata: { cacheControl: 'public, max-age=31536000, immutable' }
  });
  await file.makePublic();

  return `https://storage.googleapis.com/${bucket.name}/${encodeURI(path)}`;
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
  listOrders,
  setOrderStatus,
  syncUserOrderStatus,
  listProducts,
  saveProduct,
  deleteProduct,
  listCoupons,
  saveCoupon,
  deleteCoupon,
  uploadImage,
  recordEventOnce,
  appendOrderToUserProfile,
  queueMail
};
