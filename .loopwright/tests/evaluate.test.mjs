import { describe, it, expect } from 'vitest';
import { STATUS, worstStatus, evaluateMetrics } from '../scripts/lib/evaluate.mjs';

const policy = (over = {}) => ({ label: 'm', direction: 'lower-better', tolerance: 0, onRegression: 'block', ...over });

describe('worstStatus', () => {
  it('block outranks warn outranks pass', () => {
    expect(worstStatus(['pass', 'warn', 'block'])).toBe(STATUS.BLOCK);
    expect(worstStatus(['pass', 'improved', 'warn'])).toBe(STATUS.WARN);
    expect(worstStatus([])).toBe(STATUS.PASS);
  });
});

describe('evaluateMetrics', () => {
  const run = (p, current, baseline) =>
    evaluateMetrics({ metrics: { m: p } }, { m: current }, baseline === undefined ? undefined : { m: baseline })[0];

  it('hard limits win even when the baseline was already over', () => {
    expect(run(policy({ hardMax: 0 }), 3, 5).status).toBe(STATUS.BLOCK);
    expect(run(policy({ direction: 'higher-better', hardMin: 80 }), 79, 70).status).toBe(STATUS.BLOCK);
  });

  it('regression beyond tolerance blocks or warns per onRegression', () => {
    expect(run(policy(), 2, 1).status).toBe(STATUS.BLOCK);
    expect(run(policy({ onRegression: 'warn' }), 2, 1).status).toBe(STATUS.WARN);
    expect(run(policy({ tolerance: 1 }), 2, 1).status).toBe(STATUS.PASS);
  });

  it('improvement and no-baseline are reported as such', () => {
    expect(run(policy(), 1, 2).status).toBe(STATUS.IMPROVED);
    expect(run(policy(), 1, undefined).status).toBe(STATUS.NEW);
  });

  it('missing data is a warning', () => {
    expect(run(policy(), undefined, 1).status).toBe(STATUS.WARN);
  });
});
