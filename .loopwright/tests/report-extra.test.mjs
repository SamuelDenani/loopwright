import { describe, it, expect } from 'vitest';
import { STATUS } from '../scripts/lib/evaluate.mjs';
import { renderMarkdown, renderConsole, COMMENT_MARKER } from '../scripts/lib/report.mjs';

function baseResult(overrides = {}) {
  return {
    verdict: 'pass',
    context: { commit: 'abcdef1234', branch: 'main', baselineCommit: null, hasBaseline: false },
    metrics: [],
    violations: [],
    evidence: {},
    failed: [],
    ...overrides,
  };
}

describe('renderMarkdown — blockers, evidence and remediation text', () => {
  it('renders a blocking metric with its family remediation and evidence', () => {
    const metric = {
      id: 'coverage.lines', label: 'Line coverage', unit: '%', current: 40, baseline: 80,
      status: STATUS.BLOCK, reason: '40% is below the hard floor of 80%',
    };
    const result = baseResult({
      verdict: 'block',
      metrics: [metric],
      evidence: { 'coverage.lines': [{ file: 'src/a.mjs', line: 3, snippet: '40% line coverage' }] },
    });
    const markdown = renderMarkdown(result);
    expect(markdown).toContain(COMMENT_MARKER);
    expect(markdown).toContain('❌ Quality gate failed — 1 blocker(s)');
    expect(markdown).toContain('Add real tests covering the uncovered lines');
    expect(markdown).toContain('`src/a.mjs:3`');
  });

  it('falls back to the generic remediation for a metric id with no matching family', () => {
    const metric = { id: 'totally.custom', label: 'Custom', unit: '', current: 1, baseline: 0, status: STATUS.BLOCK, reason: 'bad' };
    const markdown = renderMarkdown(baseResult({ verdict: 'block', metrics: [metric] }));
    expect(markdown).toContain('Bring the metric back to at least its baseline value.');
  });

  it('uses the exact-match remediation for audit.suppressed over the audit. prefix', () => {
    const metric = { id: 'audit.suppressed', label: 'Suppressed advisories', unit: '', current: 1, baseline: 0, status: STATUS.BLOCK, reason: 'bad' };
    const markdown = renderMarkdown(baseResult({ verdict: 'block', metrics: [metric] }));
    expect(markdown).toContain('A suppression in `.loopwright/config.json` is holding this back.');
  });

  it('reports a collector failure banner distinct from an unconfigured tool', () => {
    const markdown = renderMarkdown(baseResult({
      verdict: 'block',
      failed: [{ collector: 'tests', error: 'test-results.json missing' }],
    }));
    expect(markdown).toContain('🚫 Collector failure: `tests` (test-results.json missing)');
  });

  it('rolls up a non-shape blocking violation using its own reason as the step, not "Split the function"', () => {
    const violation = { status: STATUS.BLOCK, subject: 'typecheck', reason: 'collector "typecheck" was configured at baseline ("tsc") but is now unconfigured' };
    const markdown = renderMarkdown(baseResult({ verdict: 'block', violations: [violation] }));
    expect(markdown).toContain(violation.reason);
    expect(markdown).not.toContain('Split the function');
  });
});

describe('renderMarkdown — warnings section', () => {
  it('folds warnings into a collapsible details block with their own evidence', () => {
    const metric = { id: 'lint.warnings', label: 'ESLint warnings', unit: '', current: 3, baseline: 1, status: STATUS.WARN, reason: 'regressed 2 (tolerance 0)' };
    const violation = { status: STATUS.WARN, subject: 'foo.mjs:1 f()', reason: 'complexity is 12 (soft 10, hard 15) — pre-existing debt' };
    const markdown = renderMarkdown(baseResult({
      metrics: [metric],
      violations: [violation],
      evidence: { 'lint.warnings': [{ file: 'a.mjs', line: 1, snippet: 'no-unused-vars: x' }] },
    }));
    expect(markdown).toMatch(/⚠️ 2 warning\(s\) — not blocking/);
    expect(markdown).toContain('no-unused-vars: x');
    expect(markdown).toContain('foo.mjs:1 f()');
  });
});

describe('renderMarkdown — pass verdict with improvements', () => {
  it('suggests recording a new baseline when metrics improved', () => {
    const metric = { id: 'coverage.lines', label: 'Line coverage', unit: '%', current: 90, baseline: 80, status: STATUS.IMPROVED, reason: 'improved 10%' };
    const markdown = renderMarkdown(baseResult({ verdict: 'pass', metrics: [metric] }));
    expect(markdown).toContain('✅ Quality gate passed');
    expect(markdown).toContain('This PR improves 1 metric(s)');
    expect(markdown).toContain('node .loopwright/scripts/quality-gate.mjs --update-baseline');
  });

  it('shows the baseline commit and omits the improvement callout when nothing improved', () => {
    const markdown = renderMarkdown(baseResult({
      verdict: 'pass',
      context: { commit: 'abcdef1234', branch: 'main', baselineCommit: 'deadbee', hasBaseline: true },
    }));
    expect(markdown).toContain('baseline `deadbee`');
    expect(markdown).not.toContain('This PR improves');
  });
});

describe('renderConsole', () => {
  it('renders one line per metric and per violation with a status tag', () => {
    const result = baseResult({
      metrics: [{ id: 'a', label: 'A', unit: '', current: 1, reason: 'holding', status: STATUS.PASS }],
      violations: [{ status: STATUS.WARN, subject: 'x.mjs f()', reason: 'debt' }],
    });
    const text = renderConsole(result);
    expect(text).toContain('[ pass]');
    expect(text).toContain('[ WARN] x.mjs f() — debt');
  });
});
