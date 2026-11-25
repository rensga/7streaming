function normalizeTelegramUsername(username) {
  const normalizedUsername = typeof username === 'string' ? username.trim().replace(/^@/, '') : '';
  return /^[A-Za-z0-9_]{5,32}$/.test(normalizedUsername) ? normalizedUsername : '';
}

export const DEFAULT_TELEGRAM_USERNAME = 'rensgaaa';

export function createTelegramContactUrl(username) {
  const normalizedUsername = normalizeTelegramUsername(username);
  if (!normalizedUsername) return null;
  const message = 'Hola, quisiera consultar disponibilidad y métodos de pago del catálogo.';
  return `https://t.me/${normalizedUsername}?text=${encodeURIComponent(message)}`;
}

export function createTelegramPurchaseUrl(username, serviceName) {
  const normalizedUsername = normalizeTelegramUsername(username);
  const normalizedServiceName = typeof serviceName === 'string' ? serviceName.trim() : '';
  if (!normalizedUsername || !normalizedServiceName) return null;

  const message = `Hola, quiero consultar disponibilidad y métodos de pago para ${normalizedServiceName}.`;
  return `https://t.me/${normalizedUsername}?text=${encodeURIComponent(message)}`;
}