import { describe, it, expect } from 'vitest';
import { STATUS, evaluateMetrics, collectorRegressions, format } from '../scripts/lib/evaluate.mjs';
import { COLLECTOR_METRICS } from '../scripts/lib/collect-metrics.mjs';
import { renderMarkdown } from '../scripts/lib/report.mjs';

const config = { metrics: {
  'coverage.lines': { direction: 'higher-better', hardMin: 80, tolerance: 0.5, onRegression: 'block' },
  'typecheck.errors': { direction: 'lower-better', hardMax: 0, tolerance: 0, onRegression: 'block' },
} };

describe('unconfigured collectors', () => {
  it('suppresses hard floors instead of phantom-blocking', () => {
    const [coverage] = evaluateMetrics(config, {}, undefined, {
      unconfiguredMetricIds: new Set(['coverage.lines']), failedByMetricId: new Map(),
    });
    expect(coverage.status).toBe(STATUS.WARN);
    expect(coverage.reason).toMatch(/not configured/);
  });
});

describe('failed collectors', () => {
  it('blocks — infra failure must not look like success', () => {
    const results = evaluateMetrics(config, {}, undefined, {
      unconfiguredMetricIds: new Set(), failedByMetricId: new Map([['typecheck.errors', 'typecheck.json missing — collector did not run']]),
    });
    const typecheck = results.find((entry) => entry.id === 'typecheck.errors');
    expect(typecheck.status).toBe(STATUS.BLOCK);
    expect(typecheck.reason).toMatch(/collector failed/);
  });
});

describe('evaluateMetrics without a context (Task 2 characterization compatibility)', () => {
  it('still works when called with three arguments', () => {
    const [typecheck] = evaluateMetrics({ metrics: { 'typecheck.errors': config.metrics['typecheck.errors'] } }, { 'typecheck.errors': 0 }, { 'typecheck.errors': 0 });
    expect(typecheck.status).toBe(STATUS.PASS);
  });
});

describe('collectorRegressions', () => {
  it('a collector configured at baseline that is now unconfigured blocks', () => {
    const violations = collectorRegressions({ typecheck: 'tsc' }, ['typecheck']);
    expect(violations).toHaveLength(1);
    expect(violations[0].status).toBe(STATUS.BLOCK);
    expect(violations[0].subject).toBe('typecheck');
    expect(violations[0].reason).toMatch(/was configured at baseline \("tsc"\) but is now unconfigured/);
  });

  it('a collector unconfigured at baseline and still unconfigured is not a regression', () => {
    const violations = collectorRegressions({ typecheck: 'unconfigured' }, ['typecheck']);
    expect(violations).toEqual([]);
  });

  it('no baseline collectors map produces no violations', () => {
    expect(collectorRegressions(undefined, ['typecheck'])).toEqual([]);
    expect(collectorRegressions(null, ['typecheck'])).toEqual([]);
  });
});

describe('format', () => {
  it('renders null/undefined metric values as n/a', () => {
    expect(format(null, '%')).toBe('n/a');
    expect(format(undefined, '%')).toBe('n/a');
  });
});

describe('COLLECTOR_METRICS', () => {
  it('maps each collector family to the metric ids it owns', () => {
    expect(COLLECTOR_METRICS.typecheck).toEqual(['typecheck.errors']);
    expect(COLLECTOR_METRICS.tests).toContain('coverage.lines');
    expect(COLLECTOR_METRICS.tests).toContain('tests.failed');
  });
});

describe('renderMarkdown action plan for a collector-regression violation', () => {
  it('uses the violation\'s own reason, not the shape-limits remediation', () => {
    const [regression] = collectorRegressions({ typecheck: 'tsc' }, ['typecheck']);
    const result = {
      verdict: 'block',
      context: { commit: 'abc1234', branch: 'main', baselineCommit: 'def5678', hasBaseline: true },
      metrics: [],
      violations: [regression],
      evidence: {},
      failed: [],
    };

    const markdown = renderMarkdown(result);

    // Must not mislabel an anti-cheat blocker as a shape-limit "split the
    // function" fix — that remediation text is wrong for this violation and,
    // per CLAUDE.md, a fixing agent follows the action plan literally.
    expect(markdown).not.toContain('Shape limits');
    expect(markdown).not.toContain('Split the function');
    // Must instead surface the violation's own reason as the action step.
    expect(markdown).toContain(regression.reason);
    expect(markdown).toContain('typecheck');
  });

  it('still rolls up shape violations under "Shape limits" as before', () => {
    const shapeViolation = {
      status: STATUS.BLOCK,
      subject: 'someFunction()',
      file: 'src/foo.mjs',
      line: 12,
      dimension: 'function length',
      limit: 80,
      softLimit: 45,
      baseline: null,
      reason: 'function length is 90 lines (soft 45, hard 80) — new code over the hard limit',
    };
    const result = {
      verdict: 'block',
      context: { commit: 'abc1234', branch: 'main', baselineCommit: null, hasBaseline: false },
      metrics: [],
      violations: [shapeViolation],
      evidence: {},
      failed: [],
    };

    const markdown = renderMarkdown(result);

    expect(markdown).toContain('Shape limits');
    expect(markdown).toContain('someFunction()');
  });
});
