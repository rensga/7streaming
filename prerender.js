import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, loadEnv } from 'vite';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(ROOT, 'dist');
const configuredEnv = loadEnv('production', ROOT, '');
const deploymentHost = process.env.VERCEL_ENV === 'production'
  ? process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || ''
  : process.env.VERCEL_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || '';
const appOrigin = process.env.APP_ORIGIN || configuredEnv.APP_ORIGIN || (deploymentHost ? `https://${deploymentHost}` : 'http://localhost:2008');
const origin = new URL(appOrigin);
if (!['http:', 'https:'].includes(origin.protocol) || origin.origin !== appOrigin.replace(/\/$/, '')) {
  throw new Error('APP_ORIGIN debe ser un origen HTTP o HTTPS válido, sin ruta.');
}
const socialImageUrl = new URL('/brand/social-cover.svg', origin).href;
const routes = [
  { path: '/', page: 'HomePage', title: '7streaming — Menos ruido. Más buenas elecciones.', description: 'Tienda independiente de servicios digitales de entretenimiento y creatividad. Descubre las ofertas de 7streaming.' },
  { path: '/catalogo', page: 'CatalogPage', title: 'Catálogo de servicios — 7streaming', description: 'Explora ofertas de streaming y herramientas creativas en una tienda independiente.' },
  { path: '/catalogo/0000000000000000:servicio', outputPath: '/catalogo/detalle', page: 'ServiceDetailPage', title: 'Ficha de servicio — 7streaming', description: 'Consulta la información de un servicio en 7streaming.' },
  { path: '/nosotros', page: 'AboutPage', title: 'Nosotros — 7streaming', description: 'Conoce la tienda independiente 7streaming y nuestro compromiso de transparencia.' },
  { path: '/faqs', page: 'FaqPage', title: 'Preguntas frecuentes — 7streaming', description: 'Respuestas sobre ofertas, precios, compras, pagos y privacidad en 7streaming.' },
  { path: '/como-funciona', page: 'HowItWorksPage', title: 'Cómo funciona — 7streaming', description: 'Revisa ofertas y consulta disponibilidad por Telegram; el sitio no procesa pagos.' },
  { path: '/aviso-legal', page: 'LegalPage', title: 'Aviso legal y privacidad — 7streaming', description: 'Avisos de independencia, privacidad y uso legítimo de 7streaming.' },
];
const indexableRoutes = routes.filter((route) => !route.outputPath);

function replaceMetaContent(html, key, value) {
  const content = value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  return html.replace(new RegExp(`(<meta ${key} content=")[^"]*(")`), (_match, prefix, suffix) => `${prefix}${content}${suffix}`);
}

const vite = await createServer({
  configFile: path.join(ROOT, 'vite.config.js'),
  server: { middlewareMode: true },
  appType: 'custom',
});

try {
  const { App } = await vite.ssrLoadModule('/main.jsx');
  const template = await readFile(path.join(OUTPUT_DIR, 'index.html'), 'utf8');
  for (const route of routes) {
    const { default: Page } = await vite.ssrLoadModule(`/pages/${route.page}.jsx`);
    const markup = renderToString(createElement(App, { initialPath: route.path, initialPage: Page }));
    const canonicalPath = route.outputPath ? '/catalogo' : route.path;
    let html = template
      .replace(/<title>[^<]*<\/title>/, `<title>${route.title}</title>`)
      .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${route.description}">`)
      .replace('<meta name="robots" content="index,follow">', `<link rel="canonical" href="${new URL(canonicalPath, origin).href}">\n    <meta name="robots" content="${route.outputPath ? 'noindex,follow' : 'index,follow'}">`)
      .replace('<div id="root"></div>', `<div id="root">${markup}</div>`);
    for (const [key, content] of [
      ['property="og:title"', route.title],
      ['property="og:description"', route.description],
      ['property="og:image"', socialImageUrl],
      ['name="twitter:title"', route.title],
      ['name="twitter:description"', route.description],
      ['name="twitter:image"', socialImageUrl],
    ]) {
      html = replaceMetaContent(html, key, content);
    }
    const outputRoute = route.outputPath || route.path;
    const outputPath = outputRoute === '/' ? path.join(OUTPUT_DIR, 'index.html') : path.join(OUTPUT_DIR, outputRoute.slice(1), 'index.html');
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, html, 'utf8');
  }
  const sitemapEntries = indexableRoutes.map((route) => `  <url><loc>${new URL(route.path, origin).href}</loc></url>`).join('\n');
  await writeFile(path.join(OUTPUT_DIR, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntries}\n</urlset>\n`, 'utf8');
  await writeFile(path.join(OUTPUT_DIR, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${new URL('/sitemap.xml', origin).href}\n`, 'utf8');
  await cp(path.join(ROOT, 'public', 'brand'), path.join(OUTPUT_DIR, 'brand'), { recursive: true });
} finally {
  await vite.close();
}