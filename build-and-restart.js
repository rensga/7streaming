import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

execFileSync(process.execPath, [
  path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'),
  'build',
  '--config',
  path.join(ROOT, 'vite.config.js'),
], { cwd: ROOT, stdio: 'inherit' });
execFileSync(process.execPath, [path.join(ROOT, 'prerender.js')], { cwd: ROOT, stdio: 'inherit' });
console.log('Compilación y prerenderizado completados; no se detuvieron ni iniciaron servidores.');