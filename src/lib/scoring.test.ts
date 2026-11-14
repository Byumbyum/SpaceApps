import { describe, expect, it } from 'vitest';
import config from '../../config/scoring.config.json';
import { computeIndex, monitoringPriority, transformFactor } from './scoring';
import type { ScoringConfig } from '../types';

const scoringConfig = config as ScoringConfig;

describe('config-driven scoring', () => {
  it('supports every declared transform', () => {
    const base = scoringConfig.factors[0];
    expect(transformFactor(0.5, { ...base, transform: 'identity', params: {} })).toBe(0.5);
    expect(transformFactor(0.5, { ...base, transform: 'linear_rescale', params: { min: 0, max: 1 } })).toBe(0.5);
    expect(transformFactor(0, { ...base, transform: 'boolean', params: {} })).toBe(0);
    expect(transformFactor(1, { ...base, transform: 'boolean', params: {} })).toBe(1);
    expect(transformFactor(10, { ...base, transform: 'exp_decay', params: { scale: 10 } })).toBeCloseTo(Math.exp(-1));
    expect(transformFactor(10, { ...base, transform: 'one_minus_exp', params: { scale: 10 } })).toBeCloseTo(1 - Math.exp(-1));
    expect(transformFactor(10, { ...base, transform: 'inverse', params: { scale: 10 } })).toBe(0.5);
  });

  it('returns zero when an available positive-weight factor is truly zero', () => {
    const result = computeIndex('Q', {
      coherence: 0.3,
      valid_pair_share: 0.9,
      reference_stability: 0.8,
      temporal_consistency: 0.8,
      correction_magnitude_cm: 0.3,
      sensor_agreement: 0.8,
    }, scoringConfig);
    expect(result.value).toBe(0);
    expect(result.band).toBe('low');
  });

  it('renormalizes weights when a factor is not assessed', () => {
    const result = computeIndex('E', {
      permafrost_fraction: 0.9,
      addt_c_days: 120,
      persistence: 0.7,
      ground_ice_or_fire_context: 0.8,
      field_agreement: null,
      recent_rain_mm: 2,
    }, scoringConfig);
    const effectiveWeight = result.factors.reduce((sum, factor) => sum + factor.effectiveWeight, 0);
    expect(effectiveWeight).toBeCloseTo(1);
    expect(result.missing).toContain('Field evidence agreement');
  });

  it('uses config thresholds for monitoring priority', () => {
    expect(monitoringPriority(2.1, 0.8, scoringConfig)).toBe('higher');
    expect(monitoringPriority(1.2, 0.8, scoringConfig)).toBe('moderate');
    expect(monitoringPriority(0.2, 0.8, scoringConfig)).toBe('lower');
    expect(monitoringPriority(3.5, 0.2, scoringConfig)).toBe('insufficient');
  });
});
