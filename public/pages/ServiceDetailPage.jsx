import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { formatServicePrice } from '../lib/pricing.js';
import { createTelegramPurchaseUrl, DEFAULT_TELEGRAM_USERNAME } from '../lib/telegram.js';

const detailPathPattern = /^\/catalogo\/([a-f0-9]{16}):([a-z0-9-]+)$/;
const statusNames = { active: 'Disponible', sold_out: 'Agotado', coming_soon: 'Próximamente' };

function DetailSkeleton() {
  return <div className="detail-loading" role="status" aria-label="Cargando ficha"><div className="skeleton-block skeleton-kicker" /><div className="skeleton-block skeleton-title" /><div className="skeleton-block skeleton-copy" /><p>Cargando ficha del servicio…</p></div>;
}

export function PurchaseButton({ service, telegramUsername = '' }) {
  const telegramUrl = createTelegramPurchaseUrl(telegramUsername, service?.name);
  if (!telegramUrl) return <button className="button button-primary" type="button" disabled aria-describedby="purchase-note">Adquirir ahora</button>;
  return <a className="button button-primary" href={telegramUrl} target="_blank" rel="noopener noreferrer" aria-describedby="purchase-note">Adquirir ahora</a>;
}

export default function ServiceDetailPage({ path }) {
  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const match = path?.match(detailPathPattern);
    let active = true;
    if (!match) {
      setLoading(false);
      setError('La dirección de esta ficha no es válida.');
      return () => { active = false; };
    }

    setLoading(true);
    setError('');
    api(`/api/services/${match[2]}`)
      .then(({ service: result }) => {
        if (result.id !== match[1]) throw new Error('No encontramos este servicio.');
        if (active) {
          setService(result);
          document.title = `${result.name} — 7streaming`;
        }
      })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [path]);

  return (
    <section className="content-page page-shell service-detail-page" aria-label="Ficha del servicio">
      <a className="detail-back" href="/catalogo">← Volver al catálogo</a>
      {loading ? <DetailSkeleton /> : error || !service ? (
        <div className="detail-error" role="alert"><h1>No encontramos este servicio.</h1><p>{error || 'Puede que ya no esté disponible.'}</p><a className="button button-outline" href="/catalogo">Explorar catálogo</a></div>
      ) : (
        <div className="service-detail">
          <div className="eyebrow"><span className="eyebrow-dash" /> {service.category} · {statusNames[service.status] || 'Información del servicio'}</div>
          <h1 id="service-detail-title">{service.name}</h1>
          <p className="service-detail-description">{service.longDescription}</p>
          <div className="service-detail-price"><span>Precio exacto</span><strong>{formatServicePrice(service)}</strong></div>
          <dl className="offer-details">
            <div><dt>Duración</dt><dd>{service.duration}</dd></div>
            <div><dt>Entrega</dt><dd>{service.deliveryDetails}</dd></div>
            <div><dt>Condiciones</dt><dd>{service.conditions}</dd></div>
            <div><dt>Soporte</dt><dd>{service.supportDetails}</dd></div>
          </dl>
          <section className="purchase-panel" aria-labelledby="purchase-title">
            <div><h2 id="purchase-title">¿Quieres adquirir {service.name}?</h2><p>Somos una tienda independiente y no estamos afiliados a {service.name}.</p></div>
            <PurchaseButton service={service} telegramUsername={import.meta.env.VITE_TELEGRAM_USERNAME || DEFAULT_TELEGRAM_USERNAME} />
            <small id="purchase-note">{createTelegramPurchaseUrl(import.meta.env.VITE_TELEGRAM_USERNAME || DEFAULT_TELEGRAM_USERNAME, service.name)
              ? 'Se abrirá un chat de Telegram para confirmar disponibilidad y acordar el pago directamente. La web no procesa pagos ni registra pedidos; no envíes contraseñas, datos de tarjeta ni códigos de verificación.'
              : 'El contacto de Telegram aún no está configurado; no se puede iniciar una compra desde esta ficha.'}</small>
          </section>
        </div>
      )}
    </section>
  );
}