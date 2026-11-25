import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const cdnUrl = process.env.ASSET_CDN_URL || loadEnv(mode, ROOT, '').ASSET_CDN_URL;
  const assetBase = cdnUrl ? `${cdnUrl.replace(/\/+$/, '')}/` : '/';
  return {
    root: path.join(ROOT, 'public'),
    envDir: ROOT,
    publicDir: false,
    base: assetBase,
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      port: 5173,
      proxy: {
        '/api': 'http://127.0.0.1:2008',
      },
    },
    build: {
      outDir: path.join(ROOT, 'dist'),
      emptyOutDir: true,
      assetsInclude: ['**/*.avif', '**/*.webp'],
    },
  };
});