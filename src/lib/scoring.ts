import type {
  FactorConfig,
  IndexBand,
  IndexKey,
  IndexResult,
  RawFactorValues,
  ScoringConfig,
} from '../types';

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function transformFactor(raw: number, factor: FactorConfig): number {
  const { transform, params } = factor;
  if (transform === 'identity') return clamp01(raw);
  if (transform === 'linear_rescale') {
    const min = params.min ?? 0;
    const max = params.max ?? 1;
    return clamp01((raw - min) / (max - min));
  }
  if (transform === 'exp_decay') return clamp01(Math.exp(-raw / (params.scale ?? 1)));
  if (transform === 'one_minus_exp') return clamp01(1 - Math.exp(-raw / (params.scale ?? 1)));
  if (transform === 'inverse') return clamp01(1 / (1 + raw / (params.scale ?? 1)));
  if (transform === 'boolean') return raw > 0 ? 1 : 0;
  return clamp01(raw);
}

export function bandFor(value: number | null, config: ScoringConfig): IndexBand {
  if (value === null) return 'not-assessed';
  if (value >= config.bands.high) return 'high';
  if (value >= config.bands.medium) return 'medium';
  return 'low';
}

export function computeIndex(
  index: IndexKey,
  values: RawFactorValues,
  config: ScoringConfig,
): IndexResult {
  const configured = config.factors.filter((factor) => factor.index === index);
  const available = configured.filter((factor) => typeof values[factor.id] === 'number');
  const availableWeight = available.reduce((sum, factor) => sum + factor.weight, 0);

  const factors = configured.map((factor) => {
    const input = values[factor.id];
    const isAvailable = typeof input === 'number';
    const raw = isAvailable ? Number(input) : null;
    const normalized = raw === null ? null : transformFactor(raw, factor);
    return {
      id: factor.id,
      label: factor.label,
      raw,
      normalized,
      weight: factor.weight,
      effectiveWeight: isAvailable && availableWeight > 0 ? factor.weight / availableWeight : 0,
      explanation: factor.explanation,
      available: isAvailable,
    };
  });

  if (!available.length || availableWeight <= 0) {
    return {
      value: null,
      band: 'not-assessed',
      factors,
      limitedBy: null,
      missing: configured.map((factor) => factor.label),
    };
  }

  // The redline supersedes the older epsilon-floor rule for an observed true zero.
  const hasTrueZero = factors.some((factor) => factor.available && factor.normalized === 0 && factor.weight > 0);
  const value = hasTrueZero
    ? 0
    : Math.exp(
        factors
          .filter((factor) => factor.available && factor.normalized !== null)
          .reduce(
            (sum, factor) => sum + factor.effectiveWeight * Math.log(Math.max(factor.normalized ?? 0, config.epsilon)),
            0,
          ),
      );
  const present = factors.filter((factor) => factor.available && factor.normalized !== null);
  const limitedBy = present.reduce<(typeof present)[number] | null>(
    (weakest, factor) => (weakest === null || (factor.normalized ?? 1) < (weakest.normalized ?? 1) ? factor : weakest),
    null,
  );

  return {
    value,
    band: bandFor(value, config),
    factors,
    limitedBy,
    missing: factors.filter((factor) => !factor.available).map((factor) => factor.label),
  };
}

export function monitoringPriority(z: number, medianQ: number, config: ScoringConfig) {
  if (medianQ < config.monitoring_priority.minimum_q) return 'insufficient' as const;
  const absoluteZ = Math.abs(z);
  if (absoluteZ >= config.monitoring_priority.higher_z) return 'higher' as const;
  if (absoluteZ >= config.monitoring_priority.moderate_z) return 'moderate' as const;
  return 'lower' as const;
}
