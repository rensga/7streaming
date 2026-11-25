import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import vercelHandler from '../api/index.js';
import { createFirebaseStoreAdapterFromEnv } from '../firebase-store.js';
import { restoreVercelRequestPath } from '../vercel-path.js';

describe('enrutamiento de API en Vercel', () => {
  it('restaura la ruta de API y conserva los parámetros originales', () => {
    const request = { url: '/api?__7streaming_route=%2Fapi%2Fservices&q=netflix&page=2' };
    assert.equal(restoreVercelRequestPath(request), true);
    assert.equal(request.url, '/api/services?q=netflix&page=2');
  });

  it('restaura la ficha dinámica con su segmento de ID y slug', () => {
    const request = { url: '/api?__7streaming_route=%2Fcatalogo%2F0123456789abcdef%3Anetflix-premium' };
    assert.equal(restoreVercelRequestPath(request), true);
    assert.equal(request.url, '/catalogo/0123456789abcdef:netflix-premium');
  });

  it('ignora rutas que no correspondan a endpoints esperados', () => {
    const request = { url: '/api?__7streaming_route=%2Fprivate%2Fdata' };
    assert.equal(restoreVercelRequestPath(request), false);
    assert.equal(request.url, '/api?__7streaming_route=%2Fprivate%2Fdata');
  });

  it('define las funciones, rewrites y archivos necesarios para Vercel', async () => {
    const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
    assert.equal(config.outputDirectory, 'dist');
    assert.equal(config.functions['api/index.js'].includeFiles, 'dist/catalogo/detalle/index.html');
    assert.ok(config.rewrites.some((rewrite) => rewrite.source === '/api/:path*'));
    assert.ok(config.rewrites.some((rewrite) => rewrite.source === '/catalogo/:path+'));
  });

  it('incluye reglas Firestore que niegan el acceso directo desde clientes', async () => {
    const config = JSON.parse(await readFile(new URL('../firebase.json', import.meta.url), 'utf8'));
    const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
    assert.equal(config.firestore.rules, 'firestore.rules');
    assert.match(rules, /allow read, write: if false/);
  });

  it('requiere credenciales privadas de Firebase para conectar Firestore', () => {
    assert.throws(() => createFirebaseStoreAdapterFromEnv({}), /FIREBASE_PROJECT_ID.*FIREBASE_CLIENT_EMAIL.*FIREBASE_PRIVATE_KEY/);
  });

  it('exporta el handler Node sin iniciar conexiones al importar el módulo', () => {
    assert.equal(typeof vercelHandler, 'function');
  });
});