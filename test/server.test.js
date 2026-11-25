import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, describe, it } from 'node:test';
import { DEFAULT_PRICE_SIMULATION } from '../public/lib/pricing.js';
import { createApplication, getServerHost, getServerPort } from '../server.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const appOrigin = 'http://localhost:3000';
const adminEmail = 'admin@example.test';
const adminPassword = 'correct-horse-battery-42';
let dataDir;
let server;
let baseUrl;
let adminCookie;
let csrfToken;

before(async () => {
  dataDir = await mkdtemp(path.join(ROOT, '.test-data-'));
  server = await createApplication({ dataDir, appOrigin, adminEmail, adminPassword });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
});

async function login() {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { Origin: appOrigin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });
  const result = await response.json();
  const cookie = response.headers.get('set-cookie');
  adminCookie = cookie?.split(';', 1)[0];
  csrfToken = result.csrfToken;
  return { response, result };
}

function adminHeaders({ write = false, csrf = csrfToken, origin = appOrigin } = {}) {
  return {
    Cookie: adminCookie,
    ...(origin ? { Origin: origin } : {}),
    ...(write ? { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf } : {}),
  };
}

function assertSocialMetadata(html) {
  const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
  const description = html.match(/<meta name="description" content="([^"]+)">/)?.[1];
  assert.ok(title);
  assert.ok(description);
  assert.equal(html.match(/<meta property="og:title" content="([^"]+)">/)?.[1], title);
  assert.equal(html.match(/<meta property="og:description" content="([^"]+)">/)?.[1], description);
  assert.match(html, /<meta property="og:image" content="https?:\/\/[^\"]+\/brand\/social-cover\.svg">/);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image">/);
}

async function adminRequest(url, method, body, options = {}) {
  return fetch(`${baseUrl}${url}`, {
    method,
    headers: adminHeaders({ write: method !== 'GET', ...options }),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function offer(overrides = {}) {
  return {
    name: 'Audio Alfa',
    slug: 'audio-alfa',
    shortDescription: 'Oferta de prueba con información clara.',
    longDescription: 'Detalle de prueba para validar el catálogo de ofertas autorizadas.',
    logoUrl: '',
    category: 'Música',
    status: 'active',
    sortOrder: 20,
    isFeatured: false,
    seoTitle: 'Audio Alfa — 7streaming',
    seoDescription: 'Oferta de prueba en 7streaming con condiciones verificadas.',
    priceAmount: 1299,
    currency: 'USD',
    duration: '1 mes',
    deliveryDetails: 'Entrega digital tras confirmación del pago.',
    conditions: 'Oferta válida para uso personal; revisar compatibilidad antes de pagar.',
    supportDetails: 'Soporte por correo durante 7 días desde la entrega.',
    authorizedToSell: true,
    published: true,
    ...overrides,
  };
}

describe('sitio Eligeva', () => {
  it('respeta PORT y rechaza valores inválidos', () => {
    assert.equal(getServerPort('2009'), 2009);
    assert.equal(getServerPort('0'), 0);
    assert.equal(getServerPort(''), 2008);
    assert.equal(getServerHost(undefined, 'production'), '0.0.0.0');
    assert.equal(getServerHost(undefined, 'development'), '127.0.0.1');
    assert.equal(getServerHost('127.0.0.2', 'production'), '127.0.0.2');
    assert.throws(() => getServerPort('no-es-un-puerto'), /PORT/);
    assert.throws(() => getServerPort('65536'), /PORT/);
  });

  it('incluye una semilla de precios hipotéticos sin publicar ofertas', async () => {
    const seed = JSON.parse(await readFile(path.join(ROOT, 'data', 'catalog.json'), 'utf8'));
    assert.deepEqual(seed.priceSimulation, DEFAULT_PRICE_SIMULATION);
    assert.ok(seed.services.every((service) => !service.published && !service.authorizedToSell));
  });

  it('permite administrar los precios ilustrativos con sesión y los conserva', async () => {
    const publicResponse = await fetch(`${baseUrl}/api/pricing`);
    assert.equal(publicResponse.status, 200);
    const publicData = await publicResponse.json();
    const { pricing } = publicData;
    assert.equal(pricing.rate, 1111.65);
    assert.equal(pricing.rateDate, '2026-11-22');
    assert.equal(pricing.services.length, 8);
    assert.ok(pricing.services.every((service) => Number.isSafeInteger(service.monthlyUsdCents)));
    assert.equal(publicData.fallback, false);
    assert.ok(Number.isFinite(Date.parse(publicData.fetchedAt)));

    const unauthorized = await fetch(`${baseUrl}/api/admin/pricing`);
    assert.equal(unauthorized.status, 401);
    await login();

    const missingCsrf = await adminRequest('/api/admin/pricing', 'PUT', pricing, { csrf: 'invalid' });
    assert.equal(missingCsrf.status, 403);
    const invalid = await adminRequest('/api/admin/pricing', 'PUT', { ...pricing, rate: 0 });
    assert.equal(invalid.status, 400);
    assert.ok((await invalid.json()).fields.rate);
    const invalidDate = await adminRequest('/api/admin/pricing', 'PUT', { ...pricing, rateDate: '2026-02-30' });
    assert.equal(invalidDate.status, 400);
    assert.ok((await invalidDate.json()).fields.rateDate);
    const duplicateNames = pricing.services.map((service, index) => index === 1
      ? { ...service, name: pricing.services[0].name }
      : service);
    const duplicate = await adminRequest('/api/admin/pricing', 'PUT', { ...pricing, services: duplicateNames });
    assert.equal(duplicate.status, 400);
    assert.ok((await duplicate.json()).fields['services.1.name']);

    const updatedPricing = {
      ...pricing,
      rate: 1234.5,
      rateDate: '2026-11-24',
      services: pricing.services.map((service, index) => index === 0
        ? { ...service, name: 'Netflix Premium', monthlyUsdCents: 799, periodLabel: 'Base mensual' }
        : service),
    };
    const saved = await adminRequest('/api/admin/pricing', 'PUT', updatedPricing);
    assert.equal(saved.status, 200);
    const savedData = await saved.json();
    assert.deepEqual(savedData.pricing, updatedPricing);
    assert.equal(savedData.fallback, false);
    assert.ok(Number.isFinite(Date.parse(savedData.fetchedAt)));

    const publicUpdated = await fetch(`${baseUrl}/api/pricing`);
    const publicUpdatedData = await publicUpdated.json();
    assert.deepEqual(publicUpdatedData.pricing, updatedPricing);
    assert.equal(publicUpdatedData.fallback, false);
    assert.ok(Number.isFinite(Date.parse(publicUpdatedData.fetchedAt)));
    const persistedStore = JSON.parse(await readFile(path.join(dataDir, 'catalog.json'), 'utf8'));
    assert.deepEqual(persistedStore.priceSimulation, updatedPricing);
    const auditResponse = await adminRequest('/api/admin/audit?page=1&pageSize=50', 'GET');
    const { logs } = await auditResponse.json();
    assert.ok(logs.some((log) => log.serviceId === 'price-simulation' && log.action === 'updated'));
  });

  it('migra el simulador sin borrar catálogos existentes', async () => {
    const legacyDataDir = await mkdtemp(path.join(ROOT, '.test-data-'));
    let legacyServer;
    try {
      const legacyService = {
        id: 'legacy-service',
        name: 'Servicio heredado',
        slug: 'servicio-heredado',
        published: false,
      };
      await writeFile(path.join(legacyDataDir, 'catalog.json'), JSON.stringify({ services: [legacyService], auditLogs: [] }), 'utf8');
      legacyServer = await createApplication({ dataDir: legacyDataDir, appOrigin });
      await new Promise((resolve) => legacyServer.listen(0, '127.0.0.1', resolve));

      const response = await fetch(`http://127.0.0.1:${legacyServer.address().port}/api/pricing`);
      const { pricing } = await response.json();
      const migratedStore = JSON.parse(await readFile(path.join(legacyDataDir, 'catalog.json'), 'utf8'));
      assert.equal(response.status, 200);
      assert.equal(pricing.rate, 1111.65);
      assert.equal(migratedStore.services[0].id, 'legacy-service');
      assert.equal(migratedStore.priceSimulation.rateDate, '2026-11-22');
    } finally {
      if (legacyServer?.listening) await new Promise((resolve) => legacyServer.close(resolve));
      await rm(legacyDataDir, { recursive: true, force: true });
    }
  });

  it('comparte datos y sesiones entre instancias y detecta escrituras obsoletas', async () => {
    const shared = { store: null, revision: 0, sessions: new Map(), failures: new Map() };
    const storeAdapter = {
      async load(initialStore) {
        if (!shared.store) shared.store = structuredClone(initialStore);
        return { store: structuredClone(shared.store), revision: shared.revision };
      },
      async save(nextStore, expectedRevision) {
        if (expectedRevision !== shared.revision) {
          const error = new Error('conflicto de revisión');
          error.status = 409;
          throw error;
        }
        shared.store = structuredClone(nextStore);
        shared.revision += 1;
        return shared.revision;
      },
    };
    const authStore = {
      async createSession(token, csrf, expiresAt) { shared.sessions.set(token, { csrfToken: csrf, expiresAt }); },
      async getSession(token) { return shared.sessions.get(token) || null; },
      async deleteSession(token) { shared.sessions.delete(token); },
      async getLoginAttemptCount(client) { return (shared.failures.get(client) || []).length; },
      async recordLoginFailure(client, now) { shared.failures.set(client, [...(shared.failures.get(client) || []), now]); },
      async clearLoginFailures(client) { shared.failures.delete(client); },
    };
    const options = { appOrigin, adminEmail, adminPassword, storeAdapter, authStore };
    const first = await createApplication(options);
    const second = await createApplication(options);
    await Promise.all([
      new Promise((resolve) => first.listen(0, '127.0.0.1', resolve)),
      new Promise((resolve) => second.listen(0, '127.0.0.1', resolve)),
    ]);

    try {
      const loginResponse = await fetch(`http://127.0.0.1:${first.address().port}/api/auth/login`, {
        method: 'POST',
        headers: { Origin: appOrigin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminEmail, password: adminPassword }),
      });
      const { csrfToken: sharedCsrf } = await loginResponse.json();
      const cookie = loginResponse.headers.get('set-cookie')?.split(';', 1)[0];
      assert.equal(loginResponse.status, 200);

      const initial = await fetch(`http://127.0.0.1:${second.address().port}/api/admin/pricing`, {
        headers: { Cookie: cookie },
      });
      const { pricing } = await initial.json();
      const updated = { ...pricing, rate: 1350.25 };
      const saved = await fetch(`http://127.0.0.1:${second.address().port}/api/admin/pricing`, {
        method: 'PUT',
        headers: { Cookie: cookie, Origin: appOrigin, 'X-CSRF-Token': sharedCsrf, 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      assert.equal(saved.status, 200);

      const staleWrite = await fetch(`http://127.0.0.1:${first.address().port}/api/admin/pricing`, {
        method: 'PUT',
        headers: { Cookie: cookie, Origin: appOrigin, 'X-CSRF-Token': sharedCsrf, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...pricing, rate: 1400 }),
      });
      assert.equal(staleWrite.status, 409);

      await first.refreshStore();
      const refreshed = await fetch(`http://127.0.0.1:${first.address().port}/api/pricing`);
      assert.equal((await refreshed.json()).pricing.rate, 1350.25);
    } finally {
      await Promise.all([
        new Promise((resolve) => first.close(resolve)),
        new Promise((resolve) => second.close(resolve)),
      ]);
    }
  });

  it('sirve la página y un catálogo público sin exigir sesión', async () => {
    const sourceTemplate = await readFile(path.join(ROOT, 'public', 'index.html'), 'utf8');
    assert.doesNotMatch(sourceTemplate, /canonical\.invalid/);
    const page = await fetch(baseUrl);
    assert.equal(page.status, 200);
    const pageHtml = await page.text();
    assert.match(pageHtml, /Eligeva/);
    assert.doesNotMatch(pageHtml, /7streaming/);
    assert.match(pageHtml, /id="root"/);
    assertSocialMetadata(pageHtml);
    const homeCanonical = pageHtml.match(/<link rel="canonical" href="([^\"]+)">/)?.[1];
    assert.ok(homeCanonical);
    assert.equal(new URL(homeCanonical).pathname, '/');
    assert.doesNotMatch(homeCanonical, /canonical\.invalid/);
    const scriptPath = pageHtml.match(/src="([^"]+\.js)"/)?.[1];
    const stylePath = pageHtml.match(/href="([^"]+\.css)"/)?.[1];
    assert.ok(scriptPath);
    assert.ok(stylePath);
    assert.equal((await fetch(`${baseUrl}${scriptPath}`)).status, 200);
    assert.equal((await fetch(`${baseUrl}${stylePath}`)).status, 200);
    for (const asset of ['/brand/logo-dark.svg', '/brand/mark.svg', '/brand/social-cover.svg']) {
      assert.equal((await fetch(`${baseUrl}${asset}`)).status, 200, `${asset} debe servirse correctamente`);
    }

    for (const [route, heading] of [['/catalogo', 'Un mundo para'], ['/nosotros', 'Elegir bien empieza'], ['/faqs', 'Preguntas'], ['/como-funciona', 'Descubre. Compara.'], ['/aviso-legal', 'Aviso legal']]) {
      const routeResponse = await fetch(`${baseUrl}${route}`);
      const routeHtml = await routeResponse.text();
      assert.equal(routeResponse.status, 200, `${route} debe responder correctamente`);
      assert.ok(routeHtml.includes(heading), `${route} debe incluir su contenido prerenderizado`);
      assert.match(routeHtml, /Eligeva/);
      assert.doesNotMatch(routeHtml, /7streaming/);
      assert.ok(routeHtml.includes('id="root"'));
      assertSocialMetadata(routeHtml);
      const routeCanonical = routeHtml.match(/<link rel="canonical" href="([^\"]+)">/)?.[1];
      assert.ok(routeCanonical);
      assert.equal(new URL(routeCanonical).pathname, route);
      assert.doesNotMatch(routeCanonical, /canonical\.invalid/);
    }

    const adminPage = await fetch(`${baseUrl}/panel/admin`);
    const adminHtml = await adminPage.text();
    assert.equal(adminPage.status, 200);
    assert.match(adminHtml, /ACCESO RESTRINGIDO/);
    assert.match(adminHtml, /name="email"/);
    assert.doesNotMatch(adminHtml, /admin-entry|Administración/);
    assert.match(adminHtml, /<meta name="robots" content="noindex,follow">/);

    const missingPage = await fetch(`${baseUrl}/una-ruta-que-no-existe`);
    const missingHtml = await missingPage.text();
    assert.equal(missingPage.status, 404);
    assert.match(missingHtml, /404/);
    assert.match(missingHtml, /no encontramos/i);

    const forbiddenPage = await fetch(`${baseUrl}/403`);
    const forbiddenHtml = await forbiddenPage.text();
    assert.equal(forbiddenPage.status, 200);
    assert.match(forbiddenHtml, /403/);
    assert.match(forbiddenHtml, /acceso denegado/i);

    const explicitNotFoundPage = await fetch(`${baseUrl}/404`);
    assert.equal(explicitNotFoundPage.status, 200);
    assert.match(await explicitNotFoundPage.text(), /No encontramos lo que buscabas/i);

    const detailTemplate = await (await fetch(`${baseUrl}/catalogo/detalle`)).text();
    assert.match(detailTemplate, /<meta name="robots" content="noindex,follow">/);
    const detailCanonical = detailTemplate.match(/<link rel="canonical" href="([^\"]+)">/)?.[1];
    assert.ok(detailCanonical);
    assert.equal(new URL(detailCanonical).pathname, '/catalogo');

    const robotsResponse = await fetch(`${baseUrl}/robots.txt`);
    const sitemapResponse = await fetch(`${baseUrl}/sitemap.xml`);
    assert.equal(robotsResponse.status, 200);
    assert.equal(sitemapResponse.status, 200);
    assert.match(sitemapResponse.headers.get('content-type'), /application\/xml/);
    const sitemap = await sitemapResponse.text();
    assert.doesNotMatch(sitemap, /panel\/admin|\/403|\/404|\/500/);
    assert.match(sitemap, /<loc>https?:\/\/[^<]+\/faqs<\/loc>/);
    assert.doesNotMatch(sitemap, /0000000000000000/);

    const response = await fetch(`${baseUrl}/api/services`);
    const { services, pagination } = await response.json();
    assert.equal(response.status, 200);
    assert.equal(services.length, 0);
    assert.deepEqual(pagination, { page: 1, pageSize: 20, total: 0, pages: 0 });
    assert.ok(services.every((service) => !('officialUrl' in service)));
    const health = await fetch(`${baseUrl}/api/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: 'ok' });
  });

  it('no publica fichas heredadas sin precio ni autorización comercial', async () => {
    const legacyDir = await mkdtemp(path.join(ROOT, `.test-data-${randomBytes(3).toString('hex')}-`));
    let legacyServer;
    try {
      await writeFile(path.join(legacyDir, 'catalog.json'), JSON.stringify({
        services: [{
          id: 'abcdef0123456789', name: 'Oferta heredada', slug: 'oferta-heredada',
          shortDescription: 'Descripción anterior', longDescription: 'Ficha anterior',
          category: 'Video', status: 'active', sortOrder: 1, published: true,
          priceFrom: 'Consultar', officialUrl: 'https://provider.example',
        }],
        auditLogs: [],
      }));
      legacyServer = await createApplication({ dataDir: legacyDir, appOrigin });
      await new Promise((resolve) => legacyServer.listen(0, '127.0.0.1', resolve));
      const url = `http://127.0.0.1:${legacyServer.address().port}`;
      const response = await fetch(`${url}/api/services`);
      assert.equal(response.status, 200);
      assert.deepEqual((await response.json()).services, []);
      assert.equal((await fetch(`${url}/catalogo/abcdef0123456789:oferta-heredada`)).status, 404);
    } finally {
      if (legacyServer?.listening) await new Promise((resolve) => legacyServer.close(resolve));
      await rm(legacyDir, { recursive: true, force: true });
    }
  });

  it('sirve fichas públicas solo para ofertas publicadas y rechaza direcciones inválidas', async () => {
    assert.equal((await fetch(`${baseUrl}/api/services/audio-alfa`)).status, 404);
    assert.equal((await fetch(`${baseUrl}/catalogo/0000000000000000:servicio-inexistente`)).status, 404);
    assert.equal((await fetch(`${baseUrl}/catalogo/0000000000000000:audio-alfa`)).status, 404);
  });

  it('rechaza el panel sin sesión y exige credenciales válidas para iniciar sesión', async () => {
    const blocked = await fetch(`${baseUrl}/api/admin/services`);
    assert.equal(blocked.status, 401);

    const wrongPassword = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { Origin: appOrigin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: 'not-the-password' }),
    });
    assert.equal(wrongPassword.status, 401);

    const { response, result } = await login();
    assert.equal(response.status, 200);
    assert.ok(adminCookie.startsWith('seven_session='));
    assert.match(response.headers.get('set-cookie'), /HttpOnly/);
    assert.equal(result.email, adminEmail);
    assert.ok(result.csrfToken);

    const draftResponse = await adminRequest('/api/admin/services', 'POST', offer({
      name: 'Borrador sin autorización', slug: 'borrador-sin-autorizacion', authorizedToSell: false, published: false,
    }));
    assert.equal(draftResponse.status, 201);
    const adminList = await adminRequest('/api/admin/services?page=1&pageSize=2', 'GET');
    const resultList = await adminList.json();
    assert.equal(adminList.status, 200);
    assert.equal(resultList.services.length, 1);
    assert.equal(resultList.pagination.total, 1);
    const unpublished = resultList.services[0];
    const publishIncomplete = await adminRequest(`/api/admin/services/${unpublished.id}/visibility`, 'PATCH', { published: true });
    assert.equal(publishIncomplete.status, 400);
    assert.ok((await publishIncomplete.json()).fields.authorizedToSell);
  });

  it('filtra y pagina el catálogo público por búsqueda y categoría', async () => {
    for (const service of [offer(), offer({ name: 'Audio Beta', slug: 'audio-beta', sortOrder: 21 }), offer({ name: 'Diseño Gamma', slug: 'diseno-gamma', category: 'Diseño', sortOrder: 22 })]) {
      const created = await adminRequest('/api/admin/services', 'POST', service);
      assert.equal(created.status, 201);
    }

    const response = await fetch(`${baseUrl}/api/services?q=Audio&category=M%C3%BAsica`);
    const { services } = await response.json();
    assert.equal(services.length, 2);
    assert.ok(services.every((service) => service.currency === 'USD' && service.priceAmount === 1299));
    const detailPath = `/catalogo/${services[0].id}:${services[0].slug}`;
    const detailResponse = await fetch(`${baseUrl}${detailPath}`);
    const detailHtml = await detailResponse.text();
    assert.equal(detailResponse.status, 200);
    assert.ok(detailHtml.includes(`<title>${services[0].seoTitle.replaceAll('7streaming', 'Eligeva')}</title>`));
    assert.match(detailHtml, /Oferta de prueba en Eligeva con condiciones verificadas\./);
    assert.doesNotMatch(detailHtml, /7streaming/);
    assert.ok(detailHtml.includes(`<link rel="canonical" href="${new URL(detailPath, appOrigin).href}">`));
    assert.match(detailHtml, /<meta name="robots" content="index,follow">/);

    const firstPageResponse = await fetch(`${baseUrl}/api/services?page=1&pageSize=2`);
    const firstPage = await firstPageResponse.json();
    const secondPageResponse = await fetch(`${baseUrl}/api/services?page=2&pageSize=2`);
    const secondPage = await secondPageResponse.json();
    assert.equal(firstPageResponse.status, 200);
    assert.equal(firstPage.services.length, 2);
    assert.deepEqual(firstPage.pagination, { page: 1, pageSize: 2, total: 3, pages: 2 });
    assert.equal(secondPage.services.length, 1);
    assert.notEqual(firstPage.services[0].id, secondPage.services[0].id);
  });

  it('valida campos, publica cambios del CRUD y conserva auditoría al borrar', async () => {
    const serviceInput = {
      name: 'Paramount+',
      slug: 'paramount-plus',
      shortDescription: 'Películas y series para disfrutar.',
      longDescription: 'Consulta el catálogo y las condiciones de esta oferta.',
      logoUrl: 'https://cdn.example/paramount.avif',
      category: 'Video',
      status: 'active',
      sortOrder: 20,
      isFeatured: false,
      seoTitle: 'Paramount+ — 7streaming',
      seoDescription: 'Consulta la oferta de Paramount+ en 7streaming.',
      priceAmount: 1499,
      currency: 'USD',
      duration: '1 mes',
      deliveryDetails: 'Entrega digital tras confirmar el pago.',
      conditions: 'Oferta válida para uso personal.',
      supportDetails: 'Soporte durante 7 días desde la entrega.',
      authorizedToSell: true,
      published: true,
    };

    const invalidLogo = await adminRequest('/api/admin/services', 'POST', { ...serviceInput, logoUrl: 'https://cdn.example/logo.png' });
    assert.equal(invalidLogo.status, 400);
    assert.ok((await invalidLogo.json()).fields.logoUrl);

    const missingCsrf = await adminRequest('/api/admin/services', 'POST', serviceInput, { csrf: 'invalid' });
    assert.equal(missingCsrf.status, 403);
    const foreignOrigin = await adminRequest('/api/admin/services', 'POST', serviceInput, { origin: 'https://attacker.example' });
    assert.equal(foreignOrigin.status, 403);

    const createdResponse = await adminRequest('/api/admin/services', 'POST', {
      ...serviceInput,
      officialUrl: 'https://provider.example/plans',
    });
    const { service } = await createdResponse.json();
    assert.equal(createdResponse.status, 201);
    assert.equal(service.slug, serviceInput.slug);
    assert.equal(service.logoUrl, serviceInput.logoUrl);
    assert.ok(!('officialUrl' in service));
    assert.equal(service.priceAmount, 1499);
    assert.equal(service.currency, 'USD');
    assert.equal(service.authorizedToSell, true);

    const incompleteOffer = await adminRequest('/api/admin/services', 'POST', offer({
      name: 'Oferta sin permiso', slug: 'oferta-sin-permiso', authorizedToSell: false,
    }));
    assert.equal(incompleteOffer.status, 400);
    assert.ok((await incompleteOffer.json()).fields.authorizedToSell);

    const duplicate = await adminRequest('/api/admin/services', 'POST', serviceInput);
    assert.equal(duplicate.status, 400);
    assert.ok((await duplicate.json()).fields.slug);

    let publicCatalog = await fetch(`${baseUrl}/api/services`);
    let publicData = await publicCatalog.json();
    assert.ok(publicData.services.some((item) => item.slug === service.slug));

    const hiddenResponse = await adminRequest(`/api/admin/services/${service.id}/visibility`, 'PATCH', { published: false });
    assert.equal(hiddenResponse.status, 200);
    const hiddenDetail = await fetch(`${baseUrl}/api/services/${service.slug}`);
    assert.equal(hiddenDetail.status, 404);

    const updateResponse = await adminRequest(`/api/admin/services/${service.id}`, 'PUT', {
      ...serviceInput,
      name: 'Paramount+ México',
      slug: 'paramount-plus-mx',
      published: true,
      sortOrder: 8,
    });
    const updated = await updateResponse.json();
    assert.equal(updateResponse.status, 200);
    assert.equal(updated.service.name, 'Paramount+ México');

    publicCatalog = await fetch(`${baseUrl}/api/services`);
    publicData = await publicCatalog.json();
    assert.ok(publicData.services.some((item) => item.slug === 'paramount-plus-mx'));

    const restartedServer = await createApplication({ dataDir, appOrigin });
    await new Promise((resolve) => restartedServer.listen(0, '127.0.0.1', resolve));
    try {
      const restartedUrl = `http://127.0.0.1:${restartedServer.address().port}/api/services/paramount-plus-mx`;
      const persistedResponse = await fetch(restartedUrl);
      const persistedData = await persistedResponse.json();
      assert.equal(persistedResponse.status, 200);
      assert.equal(persistedData.service.name, 'Paramount+ México');
    } finally {
      await new Promise((resolve) => restartedServer.close(resolve));
    }

    const deleted = await adminRequest(`/api/admin/services/${service.id}`, 'DELETE');
    assert.equal(deleted.status, 200);
    const deletedDetail = await fetch(`${baseUrl}/api/services/paramount-plus-mx`);
    assert.equal(deletedDetail.status, 404);

    const fullList = await adminRequest('/api/admin/services?includeDeleted=true&pageSize=50', 'GET');
    const allServices = await fullList.json();
    assert.ok(allServices.services.some((item) => item.id === service.id && item.deletedAt));

    const auditResponse = await adminRequest('/api/admin/audit?page=1&pageSize=50', 'GET');
    const { logs } = await auditResponse.json();
    assert.ok(logs.some((log) => log.action === 'created' && log.serviceId === service.id));
    assert.ok(logs.some((log) => log.action === 'updated' && log.serviceId === service.id));
    assert.ok(logs.some((log) => log.action === 'deleted' && log.serviceId === service.id));
  });

  it('no acepta rutas de archivos fuera del directorio compilado', async () => {
    const response = await fetch(`${baseUrl}/..%5cserver.js`);
    assert.equal(response.status, 404);
  });

  it('rechaza una contraseña administrativa demasiado corta', async () => {
    const isolatedDir = await mkdtemp(path.join(ROOT, `.test-data-${randomBytes(3).toString('hex')}-`));
    try {
      await assert.rejects(
        createApplication({ dataDir: isolatedDir, appOrigin, adminEmail, adminPassword: 'short' }),
        /al menos 12 caracteres/,
      );
    } finally {
      await rm(isolatedDir, { recursive: true, force: true });
    }
  });

  it('exige HTTPS y credenciales administrativas para producción y marca la cookie segura', async () => {
    await assert.rejects(
      createApplication({ dataDir, appOrigin, adminEmail, adminPassword, nodeEnv: 'production' }),
      /APP_ORIGIN.*HTTPS/,
    );
    await assert.rejects(
      createApplication({ dataDir, appOrigin: 'https://shop.example', nodeEnv: 'production' }),
      /ADMIN_EMAIL y ADMIN_PASSWORD/,
    );

    const prodDir = await mkdtemp(path.join(ROOT, `.test-data-${randomBytes(3).toString('hex')}-`));
    let prodServer;
    try {
      prodServer = await createApplication({
        dataDir: prodDir,
        appOrigin: 'https://shop.example',
        adminEmail,
        adminPassword,
        nodeEnv: 'production',
      });
      await new Promise((resolve) => prodServer.listen(0, '127.0.0.1', resolve));
      const response = await fetch(`http://127.0.0.1:${prodServer.address().port}/api/auth/login`, {
        method: 'POST',
        headers: { Origin: 'https://shop.example', 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminEmail, password: adminPassword }),
      });
      assert.equal(response.status, 200);
      assert.match(response.headers.get('set-cookie'), /; Secure/);
      const health = await fetch(`http://127.0.0.1:${prodServer.address().port}/api/health`);
      assert.match(health.headers.get('strict-transport-security'), /max-age=/);
    } finally {
      if (prodServer?.listening) await new Promise((resolve) => prodServer.close(resolve));
      await rm(prodDir, { recursive: true, force: true });
    }
  });
});