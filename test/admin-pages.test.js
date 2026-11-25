import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it } from 'node:test';
import { createServer } from 'vite';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

describe('rutas privadas y páginas de error', () => {
  it('oculta el acceso administrativo del sitio y lo deja en /panel/admin', async () => {
    const vite = await createServer({
      configFile: path.join(ROOT, 'vite.config.js'),
      server: { middlewareMode: true },
      appType: 'custom',
    });

    try {
      const { App } = await vite.ssrLoadModule('/main.jsx');
      const home = renderToStaticMarkup(createElement(App, { initialPath: '/' }));
      const admin = renderToStaticMarkup(createElement(App, { initialPath: '/panel/admin' }));
      assert.doesNotMatch(home, /Administración|admin-entry/);
      assert.match(admin, /name="email"/);
      assert.match(admin, /name="password"/);
      assert.match(admin, /ACCESO RESTRINGIDO/);
      assert.doesNotMatch(admin, /admin-entry/);
    } finally {
      await vite.close();
    }
  });

  it('muestra errores diferenciados para acceso denegado y rutas inexistentes', async () => {
    const vite = await createServer({
      configFile: path.join(ROOT, 'vite.config.js'),
      server: { middlewareMode: true },
      appType: 'custom',
    });

    try {
      const { App } = await vite.ssrLoadModule('/main.jsx');
      const forbidden = renderToStaticMarkup(createElement(App, { initialPath: '/403' }));
      const notFound = renderToStaticMarkup(createElement(App, { initialPath: '/esta-ruta-no-existe' }));
      assert.match(forbidden, /403/);
      assert.match(forbidden, /acceso denegado/i);
      assert.match(notFound, /404/);
      assert.match(notFound, /no encontramos/i);
    } finally {
      await vite.close();
    }
  });
});