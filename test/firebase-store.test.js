import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createFirebaseStoreAdapter, createFirebaseStoreAdapterFromEnv } from '../firebase-store.js';

class FakeDocumentSnapshot {
  constructor(value) {
    this.value = value;
    this.exists = value !== undefined;
  }

  data() {
    return structuredClone(this.value);
  }
}

class FakeFirestore {
  documents = new Map();

  collection(name) {
    return { doc: (id) => ({
      path: `${name}/${id}`,
      get: async () => new FakeDocumentSnapshot(this.documents.get(`${name}/${id}`)),
      set: async (value) => this.documents.set(`${name}/${id}`, structuredClone(value)),
      delete: async () => this.documents.delete(`${name}/${id}`),
    }) };
  }

  async runTransaction(callback) {
    const writes = [];
    const transaction = {
      get: async (reference) => new FakeDocumentSnapshot(this.documents.get(reference.path)),
      set: (reference, value) => writes.push(() => this.documents.set(reference.path, structuredClone(value))),
    };
    const result = await callback(transaction);
    writes.forEach((write) => write());
    return result;
  }
}

describe('adaptador de persistencia Firebase', () => {
  it('inicializa Firestore con la semilla y protege las escrituras con revisión', async () => {
    const firestore = new FakeFirestore();
    const adapter = createFirebaseStoreAdapter(firestore);
    const seed = { services: [], auditLogs: [], priceSimulation: { rate: 1 } };
    const initial = await adapter.load(seed);
    assert.deepEqual(initial, { store: seed, revision: 0 });

    const updated = { ...seed, priceSimulation: { rate: 2 } };
    assert.equal(await adapter.save(updated, 0), 1);
    assert.deepEqual(await adapter.load(seed), { store: updated, revision: 1 });
    await assert.rejects(adapter.save(seed, 0), (error) => error.status === 409);
    await assert.rejects(adapter.save({ description: 'x'.repeat(900_001) }, 1), (error) => error.status === 413);
  });

  it('persiste sesiones sin guardar el token original y elimina sesiones vencidas', async () => {
    const firestore = new FakeFirestore();
    const adapter = createFirebaseStoreAdapter(firestore);
    const token = 'session-token-secret';
    await adapter.createSession(token, 'csrf-token', Date.now() + 60_000);

    assert.ok([...firestore.documents.keys()].every((key) => !key.includes(token)));
    assert.deepEqual(await adapter.getSession(token), { csrfToken: 'csrf-token', expiresAt: [...firestore.documents.values()][0].expiresAt });

    await adapter.createSession('expired-token', 'old-csrf', Date.now() - 1);
    assert.equal(await adapter.getSession('expired-token'), null);
  });

  it('registra, expira y limpia intentos de inicio de sesión', async () => {
    const firestore = new FakeFirestore();
    const adapter = createFirebaseStoreAdapter(firestore);
    const now = Date.now();
    await adapter.recordLoginFailure('client-ip', now - 1_000);
    await adapter.recordLoginFailure('client-ip', now);
    assert.equal(await adapter.getLoginAttemptCount('client-ip', now), 2);
    assert.equal(await adapter.getLoginAttemptCount('client-ip', now + 15 * 60 * 1000 + 1), 0);
    await adapter.clearLoginFailures('client-ip');
    assert.equal(await adapter.getLoginAttemptCount('client-ip', now), 0);
  });

  it('exige las credenciales privadas de Firebase sin iniciar una conexión', () => {
    assert.throws(() => createFirebaseStoreAdapterFromEnv({}), /FIREBASE_PROJECT_ID.*FIREBASE_CLIENT_EMAIL.*FIREBASE_PRIVATE_KEY/);
  });
});