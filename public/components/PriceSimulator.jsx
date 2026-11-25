import { useEffect, useState } from 'react';
import {
  DEFAULT_PRICE_SIMULATION,
  calculateSimulatedVes,
  formatSimulationDate,
  formatSimulatedUsd,
  formatSimulatedVes,
} from '../lib/pricing.js';
import { createTelegramPurchaseUrl, DEFAULT_TELEGRAM_USERNAME } from '../lib/telegram.js';

export default function PriceSimulator({ simulation = DEFAULT_PRICE_SIMULATION, loadError = '', onRetry, telegramUsername = import.meta.env.VITE_TELEGRAM_USERNAME || DEFAULT_TELEGRAM_USERNAME }) {
  const [rate, setRate] = useState(String(simulation.rate));
  useEffect(() => setRate(String(simulation.rate)), [simulation.rate]);
  const numericRate = Number(rate);
  const validRate = rate.trim() !== '' && Number.isFinite(numericRate) && numericRate > 0 && numericRate <= 1000000;

  return (
    <section className="price-simulator" aria-labelledby="price-simulator-title">
      <div className="simulator-heading">
        <div>
          <div className="eyebrow"><span className="eyebrow-dash" /> REFERENCIAS DE PRECIOS</div>
          <h2 id="price-simulator-title">Ejemplos orientativos, <span className="text-gradient">con claridad.</span></h2>
          <p>Consulta importes ilustrativos en USD y su conversión estimada a bolívares.</p>
        </div>
        <div className="simulator-rate">
          <label htmlFor="simulator-rate">Tasa de referencia</label>
          <div className="simulator-rate-input"><span>Bs.</span><input id="simulator-rate" type="number" min="0.01" max="1000000" step="0.01" value={rate} onChange={(event) => setRate(event.target.value)} aria-describedby="simulator-rate-note" /></div>
          <small id="simulator-rate-note">1 USDT ≈ {formatSimulatedVes(simulation.rate)} · snapshot del {formatSimulationDate(simulation.rateDate)}</small>
          <a href="https://www.binance.com/en/square/hashtag/bcv" target="_blank" rel="noopener noreferrer">Ver referencia en Binance Square ↗</a>
        </div>
      </div>
      <p className="simulator-disclaimer">Estos importes son solo ejemplos: no son tarifas oficiales ni ofertas disponibles. La conversión asume 1 USD ≈ 1 USDT y usa una referencia configurada en Binance Square; no es una cotización oficial en tiempo real y puede diferir de los precios comprador y vendedor actuales. Confirma el precio final por Telegram.</p>
      {loadError && <p className="simulator-rate-error" role="alert">{loadError} {onRetry && <button className="text-button" type="button" onClick={onRetry}>Reintentar</button>}</p>}
      {!validRate && <p className="simulator-rate-error" role="alert">Introduce una tasa mayor que cero para ver la conversión.</p>}
      <div className="simulated-price-grid">
        {simulation.services.map((service) => {
          const estimatedVes = validRate ? calculateSimulatedVes(service.monthlyUsdCents, numericRate) : null;
          const telegramUrl = createTelegramPurchaseUrl(telegramUsername, service.name);
          return (
            <article className="simulated-price-card" key={service.name}>
              <div className="simulated-price-top"><span className="service-monogram" aria-hidden="true">{service.name.slice(0, 2).toUpperCase()}</span><span className="simulation-badge">Ejemplo</span></div>
              <div className="card-category">{service.category} · {service.periodLabel}</div>
              <h3>{service.name}</h3>
              <p><span>Importe ilustrativo</span><strong>{formatSimulatedUsd(service.monthlyUsdCents)}</strong></p>
              <p className="simulated-ves"><span>Conversión referencial</span><strong>{estimatedVes === null ? '—' : formatSimulatedVes(estimatedVes)}</strong></p>
              {telegramUrl && <a className="simulated-price-link" href={telegramUrl} target="_blank" rel="noopener noreferrer" aria-label={`Consultar disponibilidad de ${service.name} por Telegram`}>Consultar disponibilidad <span aria-hidden="true">↗</span></a>}
            </article>
          );
        })}
      </div>
    </section>
  );
}