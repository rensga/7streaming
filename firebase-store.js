import { createHash } from 'node:crypto';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const APP_NAME = '7streaming';
const SESSION_WINDOW_MS = 15 * 60 * 1000;
const MAX_STATE_DOCUMENT_BYTES = 900_000;

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

function conflictError() {
  const error = new Error('El catálogo cambió en otra solicitud. Recarga la página e inténtalo de nuevo.');
  error.status = 409;
  return error;
}

function serializeStore(store) {
  const document = JSON.stringify(store);
  if (Buffer.byteLength(document, 'utf8') > MAX_STATE_DOCUMENT_BYTES) {
    const error = new Error('El catálogo supera el límite seguro de tamaño de Firestore; reduce el historial o divide los datos antes de guardar.');
    error.status = 413;
    throw error;
  }
  return document;
}

export function createFirebaseStoreAdapter(firestore) {
  if (!firestore || typeof firestore.collection !== 'function' || typeof firestore.runTransaction !== 'function') {
    throw new Error('Se requiere una instancia válida de Firestore.');
  }

  const stateRef = firestore.collection('sevenstreaming').doc('state');
  const sessions = firestore.collection('sevenstreamingSessions');
  const loginAttempts = firestore.collection('sevenstreamingLoginAttempts');

  return {
    async load(initialStore) {
      const initialDocument = serializeStore(initialStore);
      return firestore.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(stateRef);
        if (!snapshot.exists) {
          transaction.set(stateRef, { revision: 0, document: initialDocument });
          return { store: structuredClone(initialStore), revision: 0 };
        }
        const data = snapshot.data();
        const store = typeof data.document === 'string' ? JSON.parse(data.document) : data.document;
        return { store, revision: Number(data.revision) };
      });
    },
    async save(store, expectedRevision) {
      const document = serializeStore(store);
      return firestore.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(stateRef);
        if (!snapshot.exists || Number(snapshot.data().revision) !== expectedRevision) throw conflictError();
        const revision = expectedRevision + 1;
        transaction.set(stateRef, { revision, document });
        return revision;
      });
    },
    async createSession(token, csrfToken, expiresAt) {
      await sessions.doc(digest(token)).set({ csrfToken, expiresAt });
    },
    async getSession(token) {
      const sessionRef = sessions.doc(digest(token));
      const snapshot = await sessionRef.get();
      if (!snapshot.exists) return null;
      const session = snapshot.data();
      const expiry = Number(session.expiresAt);
      if (expiry <= Date.now()) {
        await sessionRef.delete();
        return null;
      }
      return { csrfToken: session.csrfToken, expiresAt: expiry };
    },
    async deleteSession(token) {
      await sessions.doc(digest(token)).delete();
    },
    async getLoginAttemptCount(client, now = Date.now()) {
      const snapshot = await loginAttempts.doc(digest(client)).get();
      if (!snapshot.exists) return 0;
      const attempts = snapshot.data().attempts || [];
      return attempts.filter((time) => Number.isFinite(time) && now - time < SESSION_WINDOW_MS).length;
    },
    async recordLoginFailure(client, now = Date.now()) {
      const attemptRef = loginAttempts.doc(digest(client));
      await firestore.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(attemptRef);
        const previousAttempts = snapshot.exists ? snapshot.data().attempts || [] : [];
        const attempts = previousAttempts.filter((time) => Number.isFinite(time) && now - time < SESSION_WINDOW_MS);
        transaction.set(attemptRef, { attempts: [...attempts, now] });
      });
    },
    async clearLoginFailures(client) {
      await loginAttempts.doc(digest(client)).delete();
    },
  };
}

export function createFirebaseStoreAdapterFromEnv(env = process.env) {
  const projectId = env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Configura FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY para conectar Firestore.');
  }

  const app = getApps().find((item) => item.name === APP_NAME) || initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    projectId,
  }, APP_NAME);

  return createFirebaseStoreAdapter(getFirestore(app));
}