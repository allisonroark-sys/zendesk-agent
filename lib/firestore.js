const admin = require('firebase-admin');

function getDb() {
  if (!admin.apps.length) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    if (process.env.FIREBASE_PRIVATE_KEY_BASE64) {
      privateKey = Buffer.from(process.env.FIREBASE_PRIVATE_KEY_BASE64, 'base64').toString('utf8');
    } else if (privateKey) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }
    if (!projectId || !clientEmail || !privateKey) {
      return null;
    }
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }
  return admin.firestore();
}

const COLLECTION = 'agent_runs';
const MAX_RUNS = 50;

async function saveRun(summary) {
  const db = getDb();
  if (!db) return;
  try {
    await db.collection(COLLECTION).add({
      ...summary,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const snap = await db.collection(COLLECTION).orderBy('createdAt', 'desc').get();
    if (snap.size > MAX_RUNS) {
      const toDelete = snap.docs.slice(MAX_RUNS);
      const batch = db.batch();
      toDelete.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  } catch (err) {
    console.error('Firestore save error:', err.message);
  }
}

async function getRuns() {
  const db = getDb();
  if (!db) return [];
  try {
    const snap = await db
      .collection(COLLECTION)
      .orderBy('createdAt', 'desc')
      .limit(MAX_RUNS)
      .get();
    return snap.docs.map((d) => {
      const data = d.data();
      return { ...data, id: d.id };
    });
  } catch (err) {
    console.error('Firestore get error:', err.message);
    return [];
  }
}

module.exports = { saveRun, getRuns };
