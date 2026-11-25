const inFlightGets = new Map();

export function api(url, options = {}, csrfToken = '') {
  const method = options.method || 'GET';
  if (method === 'GET' && inFlightGets.has(url)) return inFlightGets.get(url);

  const request = (async () => {
    const headers = { ...(options.headers || {}) };
    if (options.body && typeof options.body === 'string') headers['Content-Type'] = 'application/json';
    if (method !== 'GET' && csrfToken) headers['X-CSRF-Token'] = csrfToken;
    const response = await fetch(url, { ...options, method, headers, credentials: 'same-origin' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || 'No se pudo completar la solicitud.');
      error.status = response.status;
      error.fields = data.fields || {};
      throw error;
    }
    return data;
  })();

  if (method !== 'GET') return request;
  inFlightGets.set(url, request);
  return request.finally(() => {
    if (inFlightGets.get(url) === request) inFlightGets.delete(url);
  });
}