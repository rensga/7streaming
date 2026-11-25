import initialStore from '../data/catalog.json' with { type: 'json' };
import { createApplication } from '../server.js';
import { createFirebaseStoreAdapterFromEnv } from '../firebase-store.js';
import { restoreVercelRequestPath } from '../vercel-path.js';

let applicationPromise;
let requestQueue = Promise.resolve();

async function createVercelApplication() {
  const projectHost = process.env.VERCEL_ENV === 'production'
    ? process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || ''
    : process.env.VERCEL_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || '';
  const appOrigin = process.env.APP_ORIGIN || (projectHost ? `https://${projectHost}` : '');
  const persistence = createFirebaseStoreAdapterFromEnv();
  return createApplication({
    appOrigin,
    nodeEnv: 'production',
    initialStore,
    storeAdapter: persistence,
    authStore: persistence,
  });
}

export default async function handler(req, res) {
  const previousRequest = requestQueue;
  let releaseRequest;
  requestQueue = new Promise((resolve) => { releaseRequest = resolve; });
  await previousRequest;

  let isPublicPricingRequest = false;
  try {
    restoreVercelRequestPath(req);
    const requestPath = new URL(req.url, 'https://vercel.local').pathname;
    isPublicPricingRequest = req.method === 'GET' && requestPath === '/api/pricing';

    if (!applicationPromise) applicationPromise = createVercelApplication();
    let application;
    try {
      application = await applicationPromise;
    } catch (error) {
      applicationPromise = null;
      throw error;
    }
    await application.refreshStore();
    await application.listeners('request')[0](req, res);
  } catch (error) {
    const firebaseConfigurationMissing = error.message === 'Configura FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY para conectar Firestore.';
    if (isPublicPricingRequest && firebaseConfigurationMissing) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({
        pricing: structuredClone(initialStore.priceSimulation),
        fetchedAt: new Date().toISOString(),
        fallback: true,
      }));
      return;
    }
    if (firebaseConfigurationMissing) {
      res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ error: 'Firestore no está configurado en Vercel. Añade las credenciales privadas requeridas para habilitar el panel y sus APIs.' }));
      return;
    }
    if (error.status) {
      res.writeHead(error.status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ error: error.message }));
    } else {
      console.error('Error al procesar solicitud en Vercel:', error.message);
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ error: 'Ocurrió un error interno.' }));
    }
  } finally {
    releaseRequest();
  }
}