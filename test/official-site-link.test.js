import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it } from 'node:test';
import { createServer } from 'vite';
import { createTelegramContactUrl, createTelegramPurchaseUrl } from '../public/lib/telegram.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

describe('contacto de compra por Telegram', () => {
  it('mantiene Adquirir ahora deshabilitado si falta un usuario público', async () => {
    const vite = await createServer({
      configFile: path.join(ROOT, 'vite.config.js'),
      server: { middlewareMode: true },
      appType: 'custom',
    });

    try {
      const { PurchaseButton } = await vite.ssrLoadModule('/pages/ServiceDetailPage.jsx');
      const markup = renderToStaticMarkup(createElement(PurchaseButton, { service: { name: 'Netflix' } }));
      assert.match(markup, /<button[^>]*disabled=""[^>]*aria-describedby="purchase-note"[^>]*>Adquirir ahora<\/button>/);
      assert.doesNotMatch(markup, /href=|target=/);
    } finally {
      await vite.close();
    }
  });

  it('abre un chat Telegram con un texto de consulta sin información sensible', async () => {
    const vite = await createServer({
      configFile: path.join(ROOT, 'vite.config.js'),
      server: { middlewareMode: true },
      appType: 'custom',
    });

    try {
      const { PurchaseButton } = await vite.ssrLoadModule('/pages/ServiceDetailPage.jsx');
      const markup = renderToStaticMarkup(createElement(PurchaseButton, {
        service: { name: 'Disney+' },
        telegramUsername: '@cuenta_personal',
      }));
      const href = markup.match(/href="([^"]+)"/)?.[1];
      assert.match(markup, /target="_blank"/);
      assert.match(markup, /rel="noopener noreferrer"/);
      assert.match(markup, />Adquirir ahora<\/a>/);
      assert.ok(href);
      assert.equal(new URL(href).origin, 'https://t.me');
      assert.equal(new URL(href).pathname, '/cuenta_personal');
      assert.match(new URL(href).searchParams.get('text'), /Disney\+/);
      assert.doesNotMatch(new URL(href).searchParams.get('text'), /contraseña|tarjeta|código/i);
    } finally {
      await vite.close();
    }
  });

  it('valida el usuario de Telegram y codifica el texto como parámetro', () => {
    const url = createTelegramPurchaseUrl(' @mi_tienda ', 'Servicio & diseño');
    assert.ok(url);
    assert.equal(new URL(url).pathname, '/mi_tienda');
    assert.match(new URL(url).searchParams.get('text'), /Servicio & diseño/);
    assert.equal(createTelegramPurchaseUrl('https://evil.example', 'Netflix'), null);
    assert.equal(createTelegramPurchaseUrl('tiny', 'Netflix'), null);
    assert.equal(createTelegramPurchaseUrl('valid_user', ''), null);
    assert.equal(new URL(createTelegramContactUrl('@rensgaaa')).pathname, '/rensgaaa');
  });
});