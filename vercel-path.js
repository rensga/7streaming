const routedPathPattern = /^\/(?:api|catalogo)\/[A-Za-z0-9._~:/-]+$/;

export function restoreVercelRequestPath(request) {
  const incomingUrl = new URL(request.url, 'https://vercel.local');
  const originalPath = incomingUrl.searchParams.get('__7streaming_route');
  if (!originalPath || !routedPathPattern.test(originalPath)) return false;

  incomingUrl.searchParams.delete('__7streaming_route');
  request.url = `${originalPath}${incomingUrl.searchParams.size ? `?${incomingUrl.searchParams}` : ''}`;
  return true;
}