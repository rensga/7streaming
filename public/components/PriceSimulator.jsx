import { useEffect, useState } from 'react';
import {
  DEFAULT_PRICE_SIMULATION,
  calculateSimulatedVes,
  formatSimulationDate,
  formatSimulatedUsd,
  formatSimulatedVes,
} from '../lib/pricing.js';

export default function PriceSimulator({ simulation = DEFAULT_PRICE_SIMULATION, loadError = '', onRetry }) {
  const [rate, setRate] = useState(String(simulation.rate));
  useEffect(() => setRate(String(simulation.rate)), [simulation.rate]);
  const numericRate = Number(rate);
  const validRate = rate.trim() !== '' && Number.isFinite(numericRate) && numericRate > 0 && numericRate <= 1000000;

  return (
    <section className="price-simulator" aria-labelledby="price-simulator-title">
      <div className="simulator-heading">
        <div>
          <div className="eyebrow"><span className="eyebrow-dash" /> SIMULADOR DE REFERENCIA</div>
          <h2 id="price-simulator-title">Precios de ejemplo, <span className="text-gradient">sin sorpresas.</span></h2>
          <p>Compara bases de precio hipotéticas en USD y su conversión estimada a bolívares.</p>
        </div>
        <div className="simulator-rate">
          <label htmlFor="simulator-rate">Tasa de referencia</label>
          <div className="simulator-rate-input"><span>Bs.</span><input id="simulator-rate" type="number" min="0.01" max="1000000" step="0.01" value={rate} onChange={(event) => setRate(event.target.value)} aria-describedby="simulator-rate-note" /></div>
          <small id="simulator-rate-note">1 USDT ≈ {formatSimulatedVes(simulation.rate)} · snapshot del {formatSimulationDate(simulation.rateDate)}</small>
          <a href="https://www.binance.com/en/square/hashtag/bcv" target="_blank" rel="noopener noreferrer">Ver referencia en Binance Square ↗</a>
        </div>
      </div>
      <p className="simulator-disclaimer">Las bases son hipotéticas, no tarifas oficiales ni ofertas. La conversión asume 1 USD ≈ 1 USDT y usa una referencia configurada en Binance Square; no es una cotización oficial en tiempo real y puede diferir de los precios comprador y vendedor actuales.</p>
      {loadError && <p className="simulator-rate-error" role="alert">{loadError} {onRetry && <button className="text-button" type="button" onClick={onRetry}>Reintentar</button>}</p>}
      {!validRate && <p className="simulator-rate-error" role="alert">Introduce una tasa mayor que cero para ver la conversión.</p>}
      <div className="simulated-price-grid">
        {simulation.services.map((service) => {
          const estimatedVes = validRate ? calculateSimulatedVes(service.monthlyUsdCents, numericRate) : null;
          return (
            <article className="simulated-price-card" key={service.name}>
              <div className="simulated-price-top"><span className="service-monogram" aria-hidden="true">{service.name.slice(0, 2).toUpperCase()}</span><span className="simulation-badge">Simulación</span></div>
              <div className="card-category">{service.category} · {service.periodLabel}</div>
              <h3>{service.name}</h3>
              <p><span>Base hipotética</span><strong>{formatSimulatedUsd(service.monthlyUsdCents)}</strong></p>
              <p className="simulated-ves"><span>Conversión estimada</span><strong>{estimatedVes === null ? '—' : formatSimulatedVes(estimatedVes)}</strong></p>
            </article>
          );
        })}
      </div>
    </section>
  );
}