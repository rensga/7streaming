export const BINANCE_REFERENCE_RATE = 1111.65;
export const BINANCE_REFERENCE_DATE = '2026-11-22';

export const simulatedServices = [
  { name: 'Netflix', category: 'Video', monthlyUsdCents: 599, periodLabel: 'Base mensual' },
  { name: 'Disney+', category: 'Video', monthlyUsdCents: 499, periodLabel: 'Base mensual' },
  { name: 'Max', category: 'Video', monthlyUsdCents: 699, periodLabel: 'Base mensual' },
  { name: 'Prime Video', category: 'Video', monthlyUsdCents: 499, periodLabel: 'Base mensual' },
  { name: 'Crunchyroll', category: 'Video', monthlyUsdCents: 499, periodLabel: 'Base mensual' },
  { name: 'Spotify', category: 'Música', monthlyUsdCents: 599, periodLabel: 'Base mensual' },
  { name: 'Canva', category: 'Diseño', monthlyUsdCents: 999, periodLabel: 'Base mensual' },
  { name: 'CapCut', category: 'Diseño', monthlyUsdCents: 699, periodLabel: 'Base mensual' },
];

export const DEFAULT_PRICE_SIMULATION = {
  rate: BINANCE_REFERENCE_RATE,
  rateDate: BINANCE_REFERENCE_DATE,
  services: simulatedServices,
};

export function formatSimulationDate(value) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime())) return 'fecha no válida';
  return new Intl.DateTimeFormat('es-VE', {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function formatApiUpdateTime(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'aún no consultada';
  return new Intl.DateTimeFormat('es-VE', {
    timeZone: 'America/Caracas',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function calculateSimulatedVes(priceUsdCents, rate) {
  if (!Number.isSafeInteger(priceUsdCents) || priceUsdCents <= 0 || !Number.isFinite(rate) || rate <= 0) return null;
  const amount = (priceUsdCents / 100) * rate;
  if (!Number.isFinite(amount) || amount > Number.MAX_SAFE_INTEGER / 100) return null;
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export function formatSimulatedUsd(priceUsdCents) {
  if (!Number.isSafeInteger(priceUsdCents) || priceUsdCents <= 0) return '—';
  return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD' }).format(priceUsdCents / 100);
}

export function formatSimulatedVes(amount) {
  if (!Number.isFinite(amount) || amount <= 0) return '—';
  return `Bs. ${new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)}`;
}

export function formatServicePrice(service) {
  if (!Number.isSafeInteger(service.priceAmount) || service.priceAmount <= 0) return 'Precio por confirmar';
  try {
    return new Intl.NumberFormat('es-VE', {
      style: 'currency',
      currency: service.currency,
    }).format(service.priceAmount / 100);
  } catch {
    return `${service.currency} ${(service.priceAmount / 100).toFixed(2)}`;
  }
}