import { useState } from 'react';
import { formatServicePrice } from '../lib/pricing.js';

const statusNames = { active: 'Disponible', inactive: 'Inactivo', sold_out: 'Agotado', coming_soon: 'Próximamente' };

function safeHttpsUrl(value = '') {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

function ServiceMark({ service }) {
  const logo = safeHttpsUrl(service.logoUrl);
  const [failedLogo, setFailedLogo] = useState(false);
  const initials = service.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase() || '7';
  return <span className="service-monogram">{logo && !failedLogo ? <img src={logo} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailedLogo(true)} /> : initials}</span>;
}

export default function ServiceCard({ service, onDetails }) {
  const status = statusNames[service.status] || statusNames.active;
  const badge = service.status === 'sold_out'
    ? <span className="card-badge unavailable">Agotado</span>
    : service.status === 'coming_soon'
      ? <span className="card-badge soon">Próximamente</span>
      : service.isFeatured
        ? <span className="card-badge featured">✳ Destacado</span>
        : <span className="card-badge">Más información</span>;

  return (
    <article className="service-card">
      <div className="card-top"><ServiceMark service={service} />{badge}</div>
      <div className="card-content">
        <div className="card-category">{service.category}</div>
        <div className="card-title-row"><h3 className="card-title">{service.name}</h3><span className={`card-status ${service.status}`}>{status}</span></div>
        <p className="card-description">{service.shortDescription}</p>
        <div className="card-price"><strong>{formatServicePrice(service)}</strong></div>
        <a className="card-link" href={`/catalogo/${encodeURIComponent(service.id)}:${encodeURIComponent(service.slug)}`}>Ver detalles <span aria-hidden="true">↗</span></a>
      </div>
    </article>
  );
}