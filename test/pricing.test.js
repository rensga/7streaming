import assert from 'node:assert/strict';
import { it } from 'node:test';
import {
  BINANCE_REFERENCE_RATE,
  calculateSimulatedVes,
  formatSimulatedUsd,
  formatSimulatedVes,
  simulatedServices,
} from '../public/lib/pricing.js';

it('convierte la base hipotética de USD a VES y redondea a dos decimales', () => {
  assert.equal(calculateSimulatedVes(599, BINANCE_REFERENCE_RATE), 6658.78);
  assert.match(formatSimulatedUsd(599), /5,99/);
  assert.equal(formatSimulatedVes(6658.78), 'Bs. 6.658,78');
});

it('rechaza tasas e importes inválidos sin romper la simulación', () => {
  assert.equal(calculateSimulatedVes(599, 0), null);
  assert.equal(calculateSimulatedVes(599, Number.NaN), null);
  assert.equal(calculateSimulatedVes(-1, BINANCE_REFERENCE_RATE), null);
  assert.equal(calculateSimulatedVes(1.5, BINANCE_REFERENCE_RATE), null);
  assert.equal(formatSimulatedVes(Number.NaN), '—');
});

it('incluye ejemplos ilustrativos, no ofertas publicadas', () => {
  assert.deepEqual(simulatedServices.map(({ name }) => name), [
    'Netflix', 'Disney+', 'Max', 'Prime Video', 'Crunchyroll', 'Spotify', 'Canva', 'CapCut',
  ]);
  assert.ok(simulatedServices.every(({ monthlyUsdCents }) => Number.isSafeInteger(monthlyUsdCents) && monthlyUsdCents > 0));
});