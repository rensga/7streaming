import assert from 'node:assert/strict';
import { it } from 'node:test';
import { api } from '../public/lib/api.js';

it('comparte solicitudes GET concurrentes a la misma URL', async () => {
  const originalFetch = globalThis.fetch;
  let requestCount = 0;
  globalThis.fetch = async () => {
    requestCount += 1;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return Response.json({ services: [] });
  };

  try {
    const [first, second] = await Promise.all([api('/api/services?page=1'), api('/api/services?page=1')]);
    assert.equal(requestCount, 1);
    assert.deepEqual(first, second);
  } finally {
    globalThis.fetch = originalFetch;
  }
});