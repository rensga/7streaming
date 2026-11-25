import { createServer } from 'node:http';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_PRICE_SIMULATION } from './public/lib/pricing.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(ROOT, 'dist');
const SESSION_TTL = 8 * 60 * 60 * 1000;
const MAX_BODY_BYTES = 32 * 1024;
const CATEGORIES = ['Video', 'Música', 'Diseño', 'Educación', 'Otros'];
const STATUSES = ['active', 'inactive', 'sold_out', 'coming_soon'];
const MIME_TYPES = {
  '.avif': 'image/avif',
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.xml': 'application/xml; charset=utf-8',
};
const PUBLIC_ROUTES = new Set(['/catalogo', '/catalogo/detalle', '/nosotros', '/faqs', '/como-funciona', '/aviso-legal']);

function cleanText(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, maxLength);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function replaceMetaContent(html, key, value) {
  const content = escapeHtml(value);
  return html.replace(new RegExp(`(<meta ${key} content=")[^"]*(")`), (_match, prefix, suffix) => `${prefix}${content}${suffix}`);
}

function validHttpsUrl(value, optional = false) {
  if (optional && !value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function validModernImageUrl(value, optional = false) {
  if (optional && !value) return true;
  if (!validHttpsUrl(value)) return false;
  try {
    return /\.(?:avif|webp)$/i.test(new URL(value).pathname);
  } catch {
    return false;
  }
}

const CURRENCIES = ['USD', 'VES'];

function offerPublicationErrors(service) {
  const errors = {};
  if (!Number.isSafeInteger(service.priceAmount) || service.priceAmount <= 0) errors.priceAmount = 'Indica un precio exacto mayor que cero.';
  if (!CURRENCIES.includes(service.currency)) errors.currency = 'Selecciona USD o VES.';
  if (!service.duration) errors.duration = 'La duración de la oferta es obligatoria.';
  if (!service.deliveryDetails) errors.deliveryDetails = 'Explica cómo y cuándo se entrega la oferta.';
  if (!service.conditions) errors.conditions = 'Publica las condiciones aplicables.';
  if (!service.supportDetails) errors.supportDetails = 'Indica el canal y el plazo de soporte.';
  if (service.authorizedToSell !== true) errors.authorizedToSell = 'Confirma que tienes autorización para comercializar esta oferta.';
  return errors;
}

function normaliseService(input, existing, services) {
  const priceAmount = input.priceAmount === '' || input.priceAmount === null || input.priceAmount === undefined
    ? null
    : Number(input.priceAmount);
  const service = {
    name: cleanText(input.name, 80),
    slug: cleanText(input.slug, 90).toLowerCase(),
    shortDescription: cleanText(input.shortDescription, 180),
    longDescription: cleanText(input.longDescription, 2000),
    logoUrl: cleanText(input.logoUrl, 500),
    category: cleanText(input.category, 30),
    status: cleanText(input.status, 30),
    sortOrder: Number(input.sortOrder),
    isFeatured: input.isFeatured === true,
    seoTitle: cleanText(input.seoTitle, 100),
    seoDescription: cleanText(input.seoDescription, 180),
    priceAmount,
    currency: cleanText(input.currency || 'USD', 3),
    duration: cleanText(input.duration, 80),
    deliveryDetails: cleanText(input.deliveryDetails, 500),
    conditions: cleanText(input.conditions, 1200),
    supportDetails: cleanText(input.supportDetails, 300),
    authorizedToSell: input.authorizedToSell === true,
    published: input.published === true,
  };

  const errors = {};
  if (!service.name) errors.name = 'El nombre es obligatorio.';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(service.slug)) errors.slug = 'Usa letras minúsculas, números y guiones.';
  if (services.some((item) => item.slug === service.slug && item.id !== existing?.id)) errors.slug = 'Este slug ya está en uso.';
  if (!service.shortDescription) errors.shortDescription = 'La descripción corta es obligatoria.';
  if (!service.longDescription) errors.longDescription = 'La descripción completa es obligatoria.';
  if (!validModernImageUrl(service.logoUrl, true)) errors.logoUrl = 'El logo debe usar una URL HTTPS terminada en .webp o .avif.';
  if (!CATEGORIES.includes(service.category)) errors.category = 'Selecciona una categoría válida.';
  if (!STATUSES.includes(service.status)) errors.status = 'Selecciona un estado válido.';
  if (!Number.isSafeInteger(service.sortOrder) || service.sortOrder < 0 || service.sortOrder > 10000) {
    errors.sortOrder = 'El orden debe ser un entero entre 0 y 10000.';
  }
  if (priceAmount !== null && (!Number.isSafeInteger(priceAmount) || priceAmount <= 0 || priceAmount > 99999999999)) {
    errors.priceAmount = 'El precio debe ser un monto positivo y válido.';
  }
  if (!CURRENCIES.includes(service.currency)) errors.currency = 'Selecciona USD o VES.';
  if (input.authorizedToSell !== undefined && typeof input.authorizedToSell !== 'boolean') errors.authorizedToSell = 'La autorización debe confirmarse expresamente.';
  if (input.isFeatured !== undefined && typeof input.isFeatured !== 'boolean') errors.isFeatured = 'El valor destacado debe ser verdadero o falso.';
  if (input.published !== undefined && typeof input.published !== 'boolean') errors.published = 'La visibilidad debe ser verdadera o falsa.';
  if (service.published) Object.assign(errors, offerPublicationErrors(service));
  if (Object.keys(errors).length) return { errors };
  return { service };
}

function normalisePriceSimulation(input) {
  const errors = {};
  const rate = Number(input?.rate);
  const rateDate = cleanText(input?.rateDate, 10);
  if (!Number.isFinite(rate) || rate <= 0 || rate > 1000000 || Number(rate.toFixed(2)) !== rate) {
    errors.rate = 'La tasa debe ser mayor que cero y tener como máximo dos decimales.';
  }
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(rateDate) ? new Date(`${rateDate}T00:00:00.000Z`) : null;
  if (!parsedDate || !Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== rateDate) {
    errors.rateDate = 'Indica una fecha válida para la tasa.';
  }
  if (!Array.isArray(input?.services) || input.services.length < 1 || input.services.length > 20) {
    errors.services = 'El simulador debe contener entre 1 y 20 tarjetas.';
  }

  const names = new Set();
  const services = (Array.isArray(input?.services) ? input.services : []).map((item, index) => {
    const source = item && typeof item === 'object' && !Array.isArray(item) ? item : {};
    const name = cleanText(source.name, 80);
    const category = cleanText(source.category, 30);
    const periodLabel = cleanText(source.periodLabel, 40);
    const monthlyUsdCents = Number(source.monthlyUsdCents);
    const key = name.toLocaleLowerCase('es');
    if (!name) errors[`services.${index}.name`] = 'El nombre de la tarjeta es obligatorio.';
    else if (names.has(key)) errors[`services.${index}.name`] = 'Los nombres de las tarjetas deben ser únicos.';
    names.add(key);
    if (!CATEGORIES.includes(category)) errors[`services.${index}.category`] = 'Selecciona una categoría válida.';
    if (!Number.isSafeInteger(monthlyUsdCents) || monthlyUsdCents <= 0 || monthlyUsdCents > 99999999999) {
      errors[`services.${index}.monthlyUsdCents`] = 'Indica un precio hipotético positivo y válido en USD.';
    }
    if (!periodLabel) errors[`services.${index}.periodLabel`] = 'Indica la duración de referencia.';
    return { name, category, monthlyUsdCents, periodLabel };
  });

  if (Object.keys(errors).length) return { errors };
  return { pricing: { rate, rateDate, services } };
}

function migrateStore(store) {
  let migrated = false;
  const storedPriceSimulation = store.priceSimulation;
  const normalizedPriceSimulation = normalisePriceSimulation(storedPriceSimulation || DEFAULT_PRICE_SIMULATION);
  if (normalizedPriceSimulation.errors) {
    store.priceSimulation = structuredClone(DEFAULT_PRICE_SIMULATION);
    migrated = true;
  } else {
    store.priceSimulation = normalizedPriceSimulation.pricing;
    if (JSON.stringify(storedPriceSimulation) !== JSON.stringify(store.priceSimulation)) migrated = true;
  }
  for (const service of store.services) {
    const before = JSON.stringify(service);
    delete service.officialUrl;
    delete service.priceFrom;
    service.priceAmount = Number.isSafeInteger(service.priceAmount) && service.priceAmount > 0 ? service.priceAmount : null;
    service.currency = CURRENCIES.includes(service.currency) ? service.currency : 'USD';
    service.duration = cleanText(service.duration, 80);
    service.deliveryDetails = cleanText(service.deliveryDetails, 500);
    service.conditions = cleanText(service.conditions, 1200);
    service.supportDetails = cleanText(service.supportDetails, 300);
    service.authorizedToSell = service.authorizedToSell === true;
    if (service.published && Object.keys(offerPublicationErrors(service)).length) service.published = false;
    if (JSON.stringify(service) !== before) migrated = true;
  }
  return migrated;
}

function sendJson(res, status, data, extraHeaders = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  res.end(body);
}

async function readJson(req) {
  if (req.body !== undefined) {
    if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body) && !Array.isArray(req.body)) {
      if (Buffer.byteLength(JSON.stringify(req.body)) > MAX_BODY_BYTES) {
        const error = new Error('El cuerpo de la solicitud supera el límite permitido.');
        error.status = 413;
        throw error;
      }
      return req.body;
    }
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : req.body;
    if (typeof rawBody !== 'string') {
      const error = new Error('El cuerpo JSON no es válido.');
      error.status = 400;
      throw error;
    }
    try {
      const value = JSON.parse(rawBody);
      if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('invalid body');
      return value;
    } catch {
      const error = new Error('El cuerpo JSON no es válido.');
      error.status = 400;
      throw error;
    }
  }
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (Buffer.byteLength(raw) > MAX_BODY_BYTES) {
      const error = new Error('El cuerpo de la solicitud supera el límite permitido.');
      error.status = 413;
      throw error;
    }
  }
  if (!raw) return {};
  try {
    const value = JSON.parse(raw);
    if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('invalid body');
    return value;
  } catch {
    const error = new Error('El cuerpo JSON no es válido.');
    error.status = 400;
    throw error;
  }
}

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map((part) => {
    const separator = part.indexOf('=');
    if (separator < 0) return ['', ''];
    try {
      return [part.slice(0, separator).trim(), decodeURIComponent(part.slice(separator + 1).trim())];
    } catch {
      return ['', ''];
    }
  }).filter(([key]) => key));
}

async function serveStatic(pathname, res, serviceDetails) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    sendJson(res, 400, { error: 'Ruta no válida.' });
    return;
  }
  const routePath = decoded.replace(/\/+$/, '') || '/';
  const isPageRoute = routePath === '/' || PUBLIC_ROUTES.has(routePath);
  const relativePath = isPageRoute
    ? routePath === '/' ? 'index.html' : path.join(routePath.slice(1), 'index.html')
    : decoded.replace(/^\/+/, '');
  const filePath = path.resolve(PUBLIC_DIR, relativePath);
  if (filePath !== PUBLIC_DIR && !filePath.startsWith(`${PUBLIC_DIR}${path.sep}`)) {
    sendJson(res, 404, { error: 'No encontrado.' });
    return;
  }
  try {
    let content = await readFile(filePath);
    const extension = path.extname(filePath);
    if (serviceDetails && extension === '.html') {
      const { service, canonicalUrl } = serviceDetails;
      const title = service.seoTitle || `${service.name} — 7streaming`;
      const description = service.seoDescription || service.shortDescription;
      let html = content.toString('utf8')
        .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`)
        .replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${escapeHtml(canonicalUrl)}">`)
        .replace('<meta name="robots" content="noindex,follow">', '<meta name="robots" content="index,follow">');
      for (const [key, value] of [
        ['name="description"', description],
        ['property="og:title"', title],
        ['property="og:description"', description],
        ['name="twitter:title"', title],
        ['name="twitter:description"', description],
      ]) html = replaceMetaContent(html, key, value);
      content = Buffer.from(html);
    }
    const isHashedAsset = routePath.startsWith('/assets/');
    const isModernImage = extension === '.avif' || extension === '.webp';
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[extension] || 'application/octet-stream',
      'Cache-Control': isHashedAsset ? 'public, max-age=31536000, immutable' : isModernImage ? 'public, max-age=3600' : 'no-cache',
    });
    res.end(content);
  } catch {
    sendJson(res, 404, { error: 'No encontrado.' });
  }
}

export function getServerPort(value = process.env.PORT) {
  const port = value === undefined || value === '' ? 2008 : Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT debe ser un número entero entre 0 y 65535.');
  return port;
}

export function getServerHost(value = process.env.HOST, nodeEnv = process.env.NODE_ENV) {
  return value?.trim() || (nodeEnv === 'production' ? '0.0.0.0' : '127.0.0.1');
}

export async function createApplication(options = {}) {
  const port = getServerPort(options.port ?? process.env.PORT);
  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV;
  const isProduction = nodeEnv === 'production';
  const appOrigin = options.appOrigin ?? process.env.APP_ORIGIN ?? (isProduction ? '' : `http://localhost:${port}`);
  let origin;
  try {
    origin = new URL(appOrigin);
    if (!['http:', 'https:'].includes(origin.protocol) || origin.origin !== appOrigin.replace(/\/$/, '')) throw new Error();
  } catch {
    throw new Error('APP_ORIGIN debe ser un origen HTTP o HTTPS válido, sin ruta.');
  }
  if (isProduction && origin.protocol !== 'https:') throw new Error('En producción, APP_ORIGIN debe usar HTTPS.');

  let assetCdnOrigin = '';
  const assetCdnUrl = options.assetCdnUrl ?? process.env.ASSET_CDN_URL ?? '';
  if (assetCdnUrl) {
    try {
      const cdn = new URL(assetCdnUrl);
      if (!['http:', 'https:'].includes(cdn.protocol) || cdn.username || cdn.password) throw new Error();
      assetCdnOrigin = cdn.origin;
    } catch {
      throw new Error('ASSET_CDN_URL debe ser una URL HTTP o HTTPS válida.');
    }
  }

  const adminEmail = (options.adminEmail ?? process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  const adminPassword = options.adminPassword ?? process.env.ADMIN_PASSWORD ?? '';
  if (Boolean(adminEmail) !== Boolean(adminPassword)) throw new Error('Configura ADMIN_EMAIL y ADMIN_PASSWORD juntos.');
  if (isProduction && (!adminEmail || !adminPassword)) throw new Error('En producción son obligatorias las variables ADMIN_EMAIL y ADMIN_PASSWORD.');
  if (isProduction && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) throw new Error('ADMIN_EMAIL debe ser un correo válido.');
  if (adminPassword && adminPassword.length < 12) throw new Error('ADMIN_PASSWORD debe tener al menos 12 caracteres.');

  const storeAdapter = options.storeAdapter;
  const authStore = options.authStore;
  const initialStore = options.initialStore ?? {
    services: [],
    auditLogs: [],
    priceSimulation: structuredClone(DEFAULT_PRICE_SIMULATION),
  };
  const dataDir = options.dataDir ?? path.join(ROOT, 'data');
  const storePath = path.join(dataDir, 'catalog.json');
  let store;
  let storeRevision = 0;
  if (storeAdapter) {
    const snapshot = await storeAdapter.load(structuredClone(initialStore));
    if (!Number.isSafeInteger(Number(snapshot.revision)) || Number(snapshot.revision) < 0) throw new Error('La revisión del almacén de catálogo no es válida.');
    store = snapshot.store;
    storeRevision = Number(snapshot.revision);
  } else {
    await mkdir(dataDir, { recursive: true });
    try {
      store = JSON.parse(await readFile(storePath, 'utf8'));
      if (!Array.isArray(store.services) || !Array.isArray(store.auditLogs)) throw new Error('Invalid store');
    } catch (error) {
      if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
      store = structuredClone(initialStore);
      await writeFile(storePath, JSON.stringify(store, null, 2), 'utf8');
    }
  }
  if (!Array.isArray(store?.services) || !Array.isArray(store?.auditLogs)) throw new Error('El almacén de catálogo no tiene un formato válido.');
  let storeMigrated = migrateStore(store);

  const serviceIndexes = { byCategory: new Map(), byStatus: new Map(), bySlug: new Map(), byId: new Map() };
  function rebuildServiceIndexes() {
    serviceIndexes.byCategory.clear();
    serviceIndexes.byStatus.clear();
    serviceIndexes.bySlug.clear();
    serviceIndexes.byId.clear();
    for (const service of store.services) {
      serviceIndexes.bySlug.set(service.slug, service);
      serviceIndexes.byId.set(service.id, service);
      for (const [index, key] of [[serviceIndexes.byCategory, service.category], [serviceIndexes.byStatus, service.status]]) {
        if (!index.has(key)) index.set(key, []);
        index.get(key).push(service);
      }
    }
  }
  rebuildServiceIndexes();

  function indexedServices(category = '', status = '') {
    const categoryMatches = category ? serviceIndexes.byCategory.get(category) || [] : null;
    const statusMatches = status ? serviceIndexes.byStatus.get(status) || [] : null;
    let candidates = store.services;
    if (categoryMatches && statusMatches) candidates = categoryMatches.length <= statusMatches.length ? categoryMatches : statusMatches;
    else if (categoryMatches) candidates = categoryMatches;
    else if (statusMatches) candidates = statusMatches;
    return candidates.filter((item) => (!category || item.category === category) && (!status || item.status === status));
  }

  const sessions = new Map();
  const loginAttempts = new Map();
  const salt = randomBytes(16);
  const expectedPassword = adminPassword ? scryptSync(adminPassword, salt, 64) : null;
  let writeQueue = Promise.resolve();

  function persist() {
    if (storeAdapter) {
      const write = storeAdapter.save(store, storeRevision).then((revision) => { storeRevision = Number(revision); });
      writeQueue = write.catch(() => {});
      return write;
    }
    const snapshot = JSON.stringify(store, null, 2);
    const temporaryPath = `${storePath}.${randomBytes(6).toString('hex')}.tmp`;
    const write = writeQueue.then(async () => {
      await writeFile(temporaryPath, snapshot, 'utf8');
      await rename(temporaryPath, storePath);
    });
    writeQueue = write.catch(() => {});
    return write;
  }

  if (storeMigrated) await persist();

  async function authenticatedSession(req) {
    const token = parseCookies(req.headers.cookie).seven_session;
    if (authStore) {
      if (!token) return null;
      const session = await authStore.getSession(token);
      return session && session.expiresAt > Date.now() ? { token, ...session } : null;
    }
    const session = token && sessions.get(token);
    if (!session || session.expiresAt <= Date.now()) {
      if (token) sessions.delete(token);
      return null;
    }
    return { token, ...session };
  }

  function originMatches(req) {
    return req.headers.origin === origin.origin;
  }

  function appendAudit(action, service, fields = []) {
    store.auditLogs.unshift({
      id: randomBytes(8).toString('hex'),
      action,
      serviceId: service.id,
      serviceName: service.name,
      fields,
      actor: adminEmail,
      createdAt: new Date().toISOString(),
    });
    store.auditLogs = store.auditLogs.slice(0, 1000);
  }

  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (isProduction && origin.protocol === 'https:') res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    const cdnSource = assetCdnOrigin ? ` ${assetCdnOrigin}` : '';
    res.setHeader('Content-Security-Policy', `default-src 'self'; img-src 'self' https: data:; style-src 'self'${cdnSource}; script-src 'self'${cdnSource}; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`);

    try {
      const requestUrl = new URL(req.url, origin.origin);
      const pathname = requestUrl.pathname;
      const method = req.method || 'GET';

      if (pathname === '/api/health' && method === 'GET') return sendJson(res, 200, { status: 'ok' });

      if (pathname === '/api/pricing' && method === 'GET') {
        return sendJson(res, 200, { pricing: store.priceSimulation });
      }

      if (pathname === '/api/auth/login' && method === 'POST') {
        if (!originMatches(req)) return sendJson(res, 403, { error: 'Origen no permitido.' });
        if (!adminEmail || !expectedPassword) return sendJson(res, 503, { error: 'El acceso administrativo no está configurado.' });
        const now = Date.now();
        const client = cleanText(req.headers['x-real-ip'], 100) || req.socket?.remoteAddress || 'local';
        const attempts = authStore
          ? await authStore.getLoginAttemptCount(client, now)
          : (loginAttempts.get(client) || []).filter((time) => now - time < 15 * 60 * 1000).length;
        if (attempts >= 5) return sendJson(res, 429, { error: 'Demasiados intentos. Prueba de nuevo en unos minutos.' });
        const body = await readJson(req);
        const email = cleanText(body.email, 254).toLowerCase();
        const password = typeof body.password === 'string' ? body.password : '';
        const submittedHash = scryptSync(password, salt, 64);
        if (email !== adminEmail || !timingSafeEqual(expectedPassword, submittedHash)) {
          if (authStore) await authStore.recordLoginFailure(client, now);
          else loginAttempts.set(client, [...(loginAttempts.get(client) || []).filter((time) => now - time < 15 * 60 * 1000), now]);
          return sendJson(res, 401, { error: 'Correo o contraseña incorrectos.' });
        }
        if (authStore) await authStore.clearLoginFailures(client);
        else loginAttempts.delete(client);
        const token = randomBytes(32).toString('base64url');
        const csrfToken = randomBytes(24).toString('base64url');
        if (authStore) await authStore.createSession(token, csrfToken, now + SESSION_TTL);
        else {
          sessions.clear();
          sessions.set(token, { csrfToken, expiresAt: now + SESSION_TTL });
        }
        const secure = origin.protocol === 'https:' ? '; Secure' : '';
        return sendJson(res, 200, { authenticated: true, csrfToken, email: adminEmail }, {
          'Set-Cookie': `seven_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL / 1000}${secure}`,
        });
      }

      if (pathname === '/api/auth/logout' && method === 'POST') {
        const session = await authenticatedSession(req);
        if (!originMatches(req) || !session || req.headers['x-csrf-token'] !== session.csrfToken) {
          return sendJson(res, 403, { error: 'Sesión u origen no válido.' });
        }
        if (authStore) await authStore.deleteSession(session.token);
        else sessions.delete(session.token);
        const secure = origin.protocol === 'https:' ? '; Secure' : '';
        return sendJson(res, 200, { authenticated: false }, {
          'Set-Cookie': `seven_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`,
        });
      }

      if (pathname === '/api/auth/session' && method === 'GET') {
        const session = await authenticatedSession(req);
        return sendJson(res, 200, session
          ? { authenticated: true, csrfToken: session.csrfToken, email: adminEmail }
          : { authenticated: false });
      }

      if (pathname === '/api/services' && method === 'GET') {
        const search = cleanText(requestUrl.searchParams.get('q') || '', 100).toLocaleLowerCase('es');
        const category = cleanText(requestUrl.searchParams.get('category') || '', 30);
        const page = Math.max(1, Number.parseInt(requestUrl.searchParams.get('page') || '1', 10) || 1);
        const pageSize = Math.min(50, Math.max(1, Number.parseInt(requestUrl.searchParams.get('pageSize') || '20', 10) || 20));
        const filtered = indexedServices(category)
          .filter((item) => !item.deletedAt && item.published && item.status !== 'inactive')
          .filter((item) => !search || `${item.name} ${item.shortDescription} ${item.category}`.toLocaleLowerCase('es').includes(search))
          .sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured) || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'es'));
        const total = filtered.length;
        return sendJson(res, 200, {
          services: filtered.slice((page - 1) * pageSize, page * pageSize),
          pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) },
        });
      }

      const publicServiceMatch = pathname.match(/^\/api\/services\/([a-z0-9-]+)$/);
      if (publicServiceMatch && method === 'GET') {
        const service = serviceIndexes.bySlug.get(publicServiceMatch[1]);
        if (service?.deletedAt || !service?.published || service?.status === 'inactive') return sendJson(res, 404, { error: 'Servicio no encontrado.' });
        return service ? sendJson(res, 200, { service }) : sendJson(res, 404, { error: 'Servicio no encontrado.' });
      }

      if (pathname.startsWith('/api/admin/')) {
        const session = await authenticatedSession(req);
        if (!session) return sendJson(res, 401, { error: 'Inicia sesión como administrador.' });
        if (method !== 'GET' && method !== 'HEAD' && (!originMatches(req) || req.headers['x-csrf-token'] !== session.csrfToken)) {
          return sendJson(res, 403, { error: 'Origen o token de seguridad no válido.' });
        }

        if (pathname === '/api/admin/pricing' && method === 'GET') {
          return sendJson(res, 200, { pricing: store.priceSimulation });
        }

        if (pathname === '/api/admin/pricing' && method === 'PUT') {
          const body = await readJson(req);
          const { pricing, errors } = normalisePriceSimulation(body);
          if (errors) return sendJson(res, 400, { error: 'Revisa los valores del simulador.', fields: errors });
          store.priceSimulation = pricing;
          appendAudit('updated', { id: 'price-simulation', name: 'Simulador de precios' }, Object.keys(pricing));
          await persist();
          return sendJson(res, 200, { pricing });
        }

        if (pathname === '/api/admin/services' && method === 'GET') {
          const search = cleanText(requestUrl.searchParams.get('q') || '', 100).toLocaleLowerCase('es');
          const category = cleanText(requestUrl.searchParams.get('category') || '', 30);
          const status = cleanText(requestUrl.searchParams.get('status') || '', 30);
          const includeDeleted = requestUrl.searchParams.get('includeDeleted') === 'true';
          const page = Math.max(1, Number.parseInt(requestUrl.searchParams.get('page') || '1', 10) || 1);
          const pageSize = Math.min(50, Math.max(1, Number.parseInt(requestUrl.searchParams.get('pageSize') || '20', 10) || 20));
          const filtered = indexedServices(category, status)
            .filter((item) => includeDeleted || !item.deletedAt)
            .filter((item) => !search || `${item.name} ${item.shortDescription} ${item.slug}`.toLocaleLowerCase('es').includes(search))
            .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'es'));
          const total = filtered.length;
          return sendJson(res, 200, {
            services: filtered.slice((page - 1) * pageSize, page * pageSize),
            pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) },
          });
        }

        if (pathname === '/api/admin/audit' && method === 'GET') {
          const page = Math.max(1, Number.parseInt(requestUrl.searchParams.get('page') || '1', 10) || 1);
          const pageSize = Math.min(50, Math.max(1, Number.parseInt(requestUrl.searchParams.get('pageSize') || '20', 10) || 20));
          return sendJson(res, 200, {
            logs: store.auditLogs.slice((page - 1) * pageSize, page * pageSize),
            pagination: { page, pageSize, total: store.auditLogs.length },
          });
        }

        if (pathname === '/api/admin/services' && method === 'POST') {
          const body = await readJson(req);
          const { service, errors } = normaliseService(body, null, store.services);
          if (errors) return sendJson(res, 400, { error: 'Revisa los campos del formulario.', fields: errors });
          const now = new Date().toISOString();
          const created = { ...service, id: randomBytes(8).toString('hex'), createdAt: now, updatedAt: now, deletedAt: null };
          store.services.push(created);
          rebuildServiceIndexes();
          appendAudit('created', created, Object.keys(service));
          await persist();
          return sendJson(res, 201, { service: created });
        }

        const visibilityMatch = pathname.match(/^\/api\/admin\/services\/([a-f0-9]+)\/visibility$/);
        if (visibilityMatch && method === 'PATCH') {
          const body = await readJson(req);
          if (typeof body.published !== 'boolean') return sendJson(res, 400, { error: 'El campo published debe ser verdadero o falso.' });
          const service = serviceIndexes.byId.get(visibilityMatch[1]);
          if (service?.deletedAt) return sendJson(res, 404, { error: 'Servicio no encontrado.' });
          if (!service) return sendJson(res, 404, { error: 'Servicio no encontrado.' });
          if (body.published) {
            const errors = offerPublicationErrors(service);
            if (Object.keys(errors).length) return sendJson(res, 400, { error: 'Completa y verifica la información comercial antes de publicar.', fields: errors });
          }
          service.published = body.published;
          service.updatedAt = new Date().toISOString();
          rebuildServiceIndexes();
          appendAudit(body.published ? 'published' : 'unpublished', service, ['published']);
          await persist();
          return sendJson(res, 200, { service });
        }

        const orderMatch = pathname.match(/^\/api\/admin\/services\/order$/);
        if (orderMatch && method === 'PATCH') {
          const body = await readJson(req);
          if (!Array.isArray(body.orderedIds) || body.orderedIds.length > 500 || new Set(body.orderedIds).size !== body.orderedIds.length) {
            return sendJson(res, 400, { error: 'orderedIds debe ser una lista de identificadores únicos.' });
          }
          const activeServices = store.services.filter((item) => !item.deletedAt);
          if (body.orderedIds.length !== activeServices.length || body.orderedIds.some((id) => !activeServices.some((item) => item.id === id))) {
            return sendJson(res, 400, { error: 'La lista debe incluir todos los servicios activos exactamente una vez.' });
          }
          const now = new Date().toISOString();
          body.orderedIds.forEach((id, index) => {
            const service = activeServices.find((item) => item.id === id);
            service.sortOrder = index + 1;
            service.updatedAt = now;
          });
          appendAudit('reordered', { id: 'catalog', name: 'Catálogo' }, ['sortOrder']);
          await persist();
          return sendJson(res, 200, { services: activeServices.sort((a, b) => a.sortOrder - b.sortOrder) });
        }

        const serviceMatch = pathname.match(/^\/api\/admin\/services\/([a-f0-9]+)$/);
        if (serviceMatch) {
          const service = serviceIndexes.byId.get(serviceMatch[1]);
          if (service?.deletedAt) return sendJson(res, 404, { error: 'Servicio no encontrado.' });
          if (method === 'GET') return service ? sendJson(res, 200, { service }) : sendJson(res, 404, { error: 'Servicio no encontrado.' });
          if (method === 'PUT') {
            if (!service) return sendJson(res, 404, { error: 'Servicio no encontrado.' });
            const body = await readJson(req);
            const { service: updated, errors } = normaliseService(body, service, store.services);
            if (errors) return sendJson(res, 400, { error: 'Revisa los campos del formulario.', fields: errors });
            Object.assign(service, updated, { updatedAt: new Date().toISOString() });
            rebuildServiceIndexes();
            appendAudit('updated', service, Object.keys(updated));
            await persist();
            return sendJson(res, 200, { service });
          }
          if (method === 'DELETE') {
            if (!service) return sendJson(res, 404, { error: 'Servicio no encontrado.' });
            service.deletedAt = new Date().toISOString();
            service.published = false;
            service.updatedAt = service.deletedAt;
            rebuildServiceIndexes();
            appendAudit('deleted', service, ['deletedAt', 'published']);
            await persist();
            return sendJson(res, 200, { service });
          }
        }

        return sendJson(res, 404, { error: 'Ruta administrativa no encontrada.' });
      }

      if (pathname.startsWith('/api/')) return sendJson(res, 404, { error: 'Ruta no encontrada.' });
      if (method !== 'GET' && method !== 'HEAD') return sendJson(res, 405, { error: 'Método no permitido.' });
      const serviceDetailMatch = pathname.match(/^\/catalogo\/([a-f0-9]{16}):([a-z0-9-]+)$/);
      if (serviceDetailMatch) {
        const service = serviceIndexes.byId.get(serviceDetailMatch[1]);
        if (!service || service.slug !== serviceDetailMatch[2] || service.deletedAt || !service.published || service.status === 'inactive') {
          return sendJson(res, 404, { error: 'Servicio no encontrado.' });
        }
        return serveStatic('/catalogo/detalle', res, { service, canonicalUrl: new URL(pathname, origin).href });
      }
      return serveStatic(pathname, res);
    } catch (error) {
      if (error.status) return sendJson(res, error.status, { error: error.message });
      console.error('Error al procesar solicitud:', error.message);
      return sendJson(res, 500, { error: 'Ocurrió un error interno.' });
    }
  });

  server.refreshStore = async () => {
    if (!storeAdapter) return;
    const snapshot = await storeAdapter.load(structuredClone(initialStore));
    if (!Array.isArray(snapshot.store?.services) || !Array.isArray(snapshot.store?.auditLogs)) {
      throw new Error('El almacén de catálogo no tiene un formato válido.');
    }
    if (!Number.isSafeInteger(Number(snapshot.revision)) || Number(snapshot.revision) < 0) {
      throw new Error('La revisión del almacén de catálogo no es válida.');
    }
    store = snapshot.store;
    storeRevision = Number(snapshot.revision);
    storeMigrated = migrateStore(store);
    rebuildServiceIndexes();
    if (storeMigrated) await persist();
  };

  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const port = getServerPort();
    const app = await createApplication({ port });
    const host = getServerHost();
    app.listen(port, host, () => {
      console.log(`7streaming disponible en ${process.env.APP_ORIGIN || `http://localhost:${port}`}`);
      if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
        console.warn('Panel administrativo deshabilitado: configura ADMIN_EMAIL y ADMIN_PASSWORD en .env.');
      }
    });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}