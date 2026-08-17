import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// collect-metrics.mjs reads from the fixed REPORTS_DIR export of paths.mjs;
// redirect it to a scratch directory per test run so this test never touches
// (or depends on) the real .loopwright/reports produced by an actual gate run.
let REPORTS_DIR;

vi.mock('../scripts/lib/paths.mjs', async () => {
  const actual = await vi.importActual('../scripts/lib/paths.mjs');
  return { ...actual, get REPORTS_DIR() { return REPORTS_DIR; } };
});

const { collectMetrics, listSourceFiles, COLLECTOR_METRICS } = await import('../scripts/lib/collect-metrics.mjs');

function write(relativePath, payload) {
  const target = join(REPORTS_DIR, relativePath);
  mkdirSync(join(target, '..'), { recursive: true });
  writeFileSync(target, JSON.stringify(payload));
}

let root;

beforeEach(() => {
  REPORTS_DIR = mkdtempSync(join(tmpdir(), 'lw-reports-'));
  root = mkdtempSync(join(tmpdir(), 'lw-root-'));
});

const baseConfig = () => ({
  sources: { roots: ['src'], extensions: ['.mjs'], ignore: [] },
  limits: { fileCodeLines: { warn: 10, block: 20 } },
  audit: { ignore: [] },
});

function writeSourceFile(relPath, content) {
  const target = join(root, relPath);
  mkdirSync(join(target, '..'), { recursive: true });
  writeFileSync(target, content);
}

describe('COLLECTOR_METRICS', () => {
  it('lists every metric id owned by each collector family', () => {
    expect(COLLECTOR_METRICS.audit).toEqual(['audit.critical', 'audit.high', 'audit.suppressed']);
    expect(COLLECTOR_METRICS.duplication).toEqual(['duplication.percentage']);
  });
});

describe('listSourceFiles', () => {
  it('filters files under a directory-glob ignore pattern', () => {
    writeSourceFile('src/a.mjs', 'export const a = 1;\n');
    writeSourceFile('src/fixtures/b.mjs', 'export const b = 1;\n');
    const files = listSourceFiles(root, { roots: ['src'], extensions: ['.mjs'], ignore: ['**/fixtures/**'] });
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/a\.mjs$/);
  });

  it('filters files matching a leading-**/ file-suffix ignore pattern', () => {
    writeSourceFile('src/a.mjs', 'export const a = 1;\n');
    writeSourceFile('src/keep.mjs', 'export const b = 1;\n');
    const files = listSourceFiles(root, { roots: ['src'], extensions: ['.mjs'], ignore: ['**/a.mjs'] });
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/keep\.mjs$/);
  });
});

describe('collectMetrics — missing reports', () => {
  it('marks every collector family as failed when no report files exist', () => {
    writeSourceFile('src/a.mjs', 'export const a = 1;\n');
    const { failed, metrics, unconfigured } = collectMetrics(root, baseConfig());
    const collectors = failed.map((entry) => entry.collector);
    expect(collectors).toEqual(expect.arrayContaining(['typecheck', 'lint', 'tests', 'audit', 'duplication']));
    expect(metrics['typecheck.errors']).toBeUndefined();
    expect(unconfigured).toEqual([]);
  });
});

describe('collectMetrics — unconfigured collectors', () => {
  it('records unconfigured status without emitting a metric', () => {
    write('typecheck.json', { configured: false });
    const { unconfigured, metrics } = collectMetrics(root, baseConfig());
    expect(unconfigured).toContain('typecheck');
    expect(metrics['typecheck.errors']).toBeUndefined();
  });
});

describe('collectMetrics — failed adapters (ok:false with error)', () => {
  it('records the adapter error as a failure', () => {
    write('lint.json', { ok: false, error: 'eslint crashed' });
    const { failed } = collectMetrics(root, baseConfig());
    expect(failed).toContainEqual({ collector: 'lint', error: 'eslint crashed' });
  });
});

describe('collectMetrics — typecheck/lint success paths', () => {
  it('collects typecheck error evidence', () => {
    write('typecheck.json', {
      errorCount: 1,
      diagnostics: [{ file: 'a.ts', line: 3, severity: 'error', code: 'TS1', message: 'bad' }],
    });
    const { metrics, evidence } = collectMetrics(root, baseConfig());
    expect(metrics['typecheck.errors']).toBe(1);
    expect(evidence['typecheck.errors'][0]).toMatchObject({ file: 'a.ts', line: 3 });
  });

  it('collects lint error/warning evidence', () => {
    write('lint.json', {
      errors: 1,
      warnings: 1,
      messages: [
        { file: 'a.js', line: 1, severity: 'error', rule: 'no-x', message: 'bad' },
        { file: 'b.js', line: 2, severity: 'warning', rule: 'no-y', message: 'meh' },
      ],
    });
    const { metrics, evidence } = collectMetrics(root, baseConfig());
    expect(metrics['lint.errors']).toBe(1);
    expect(metrics['lint.warnings']).toBe(1);
    expect(evidence['lint.errors']).toHaveLength(1);
    expect(evidence['lint.warnings']).toHaveLength(1);
  });
});

describe('collectMetrics — tests + coverage', () => {
  it('collects test and coverage metrics together when tests ran successfully', () => {
    write('test-summary.json', { ranSuccessfully: true, failed: 1, suitesFailed: 1, failures: [{ file: 'a.test.mjs', title: 't', message: 'boom\nmore' }] });
    write('coverage/coverage-summary.json', {
      total: { lines: { pct: 90 }, branches: { pct: 80 }, functions: { pct: 85 }, statements: { pct: 88 } },
      [join(root, 'src/a.mjs')]: { lines: { pct: 50 } },
    });
    const { metrics, evidence } = collectMetrics(root, baseConfig());
    expect(metrics['tests.failed']).toBe(1);
    expect(metrics['coverage.lines']).toBe(90);
    expect(metrics['coverage.branches']).toBe(80);
    expect(evidence['tests.failed'][0].snippet).toMatch(/t — boom/);
    expect(evidence['coverage.lines'][0].snippet).toMatch(/^50% line coverage$/);
  });

  it('treats tests as failed (not just coverage) when test-summary reports ranSuccessfully:false', () => {
    write('test-summary.json', { ranSuccessfully: false });
    const { failed, metrics } = collectMetrics(root, baseConfig());
    expect(failed).toContainEqual({ collector: 'tests', error: 'test-results.json missing — test runner produced no JSON' });
    expect(metrics['coverage.lines']).toBeUndefined();
  });

  it('does not attempt coverage collection when tests are unconfigured', () => {
    write('test-summary.json', { configured: false });
    const { unconfigured, failed } = collectMetrics(root, baseConfig());
    expect(unconfigured).toContain('tests');
    expect(failed.some((e) => e.collector === 'tests' && /coverage/.test(e.error))).toBe(false);
  });

  it('fails the tests collector when coverage-summary.json is missing after a successful test run', () => {
    write('test-summary.json', { ranSuccessfully: true, failed: 0, suitesFailed: 0, failures: [] });
    const { failed } = collectMetrics(root, baseConfig());
    expect(failed).toContainEqual({ collector: 'tests', error: 'coverage/coverage-summary.json missing — collector did not run' });
  });
});

describe('collectMetrics — audit suppression rules', () => {
  function auditReport(vulns) {
    return { metadata: { vulnerabilities: {} }, vulnerabilities: vulns };
  }

  it('counts unsuppressed critical/high advisories', () => {
    write('audit.json', auditReport({
      pkgA: { severity: 'critical', fixAvailable: true, via: [{ source: 1, url: 'https://x/1', title: 'bad' }] },
      pkgB: { severity: 'high', fixAvailable: false, via: [{ source: 2, url: 'https://x/2', title: 'meh' }] },
    }));
    const { metrics, evidence } = collectMetrics(root, baseConfig());
    expect(metrics['audit.critical']).toBe(1);
    expect(metrics['audit.high']).toBe(1);
    expect(metrics['audit.suppressed']).toBe(0);
    expect(evidence['audit.critical'][0].snippet).toMatch(/fix available/);
    expect(evidence['audit.high'][0].snippet).toMatch(/no fix available/);
  });

  it('suppresses an advisory matched by package name with a future expiry', () => {
    const config = baseConfig();
    config.audit.ignore = [{ package: 'pkgA', expires: '2999-01-01', reason: 'no fix yet' }];
    write('audit.json', auditReport({
      pkgA: { severity: 'high', fixAvailable: false, via: [{ source: 1, url: 'https://x/1', title: 'bad' }] },
    }));
    const { metrics, evidence } = collectMetrics(root, config);
    expect(metrics['audit.high']).toBe(0);
    expect(metrics['audit.suppressed']).toBe(1);
    expect(evidence['audit.suppressed'][0].snippet).toMatch(/no fix yet/);
  });

  it('suppresses an advisory matched by advisory id and re-counts it once expired', () => {
    const expiredConfig = baseConfig();
    expiredConfig.audit.ignore = [{ advisory: '1', expires: '2000-01-01' }];
    write('audit.json', auditReport({
      pkgA: { severity: 'high', fixAvailable: false, via: [{ source: 1, url: 'https://x/1', title: 'bad' }] },
    }));
    const { metrics, evidence } = collectMetrics(root, expiredConfig);
    expect(metrics['audit.high']).toBe(1);
    expect(metrics['audit.suppressed']).toBe(0);
    expect(evidence['audit.high'][0].snippet).toMatch(/no valid `expires` date|expired/);
  });

  it('matches an advisory by URL substring and treats an invalid expiry date as expired', () => {
    const config = baseConfig();
    config.audit.ignore = [{ advisory: 'GHSA-xxxx', expires: 'not-a-date' }];
    write('audit.json', auditReport({
      pkgA: { severity: 'high', fixAvailable: false, via: [{ source: 1, url: 'https://x/GHSA-xxxx', title: 'bad' }] },
    }));
    const { metrics } = collectMetrics(root, config);
    expect(metrics['audit.high']).toBe(1);
  });

  it('fails the audit collector when metadata.vulnerabilities is missing', () => {
    write('audit.json', { vulnerabilities: {} });
    const { failed } = collectMetrics(root, baseConfig());
    expect(failed).toContainEqual({ collector: 'audit', error: 'audit.json missing metadata.vulnerabilities' });
  });
});

describe('collectMetrics — duplication', () => {
  it('collects duplication percentage and evidence', () => {
    write('jscpd/jscpd-report.json', {
      statistics: { total: { percentage: 3.5 } },
      duplicates: [{ firstFile: { name: 'a.mjs', start: 1 }, secondFile: { name: 'b.mjs', start: 5 }, lines: 10 }],
    });
    const { metrics, evidence } = collectMetrics(root, baseConfig());
    expect(metrics['duplication.percentage']).toBe(3.5);
    expect(evidence['duplication.percentage'][0].snippet).toMatch(/10 lines duplicated in b\.mjs:5/);
  });

  it('fails duplication when statistics.total is missing', () => {
    write('jscpd/jscpd-report.json', { statistics: {} });
    const { failed } = collectMetrics(root, baseConfig());
    expect(failed).toContainEqual({ collector: 'duplication', error: 'jscpd report missing statistics.total' });
  });
});

describe('collectMetrics — static analysis (complexity/size/integrity)', () => {
  it('flattens analyzeSources output into complexity/size/integrity metrics', () => {
    // Built from a variable, not a literal skipped-test call — this is
    // deliberately-bad fixture code for the analyzer to detect, not a real
    // skipped test, and writing that call out literally would trip the
    // repo's own pre-commit shortcut-scanner.
    const skip = '.skip';
    writeSourceFile(
      'src/a.mjs',
      [
        'export function f(a, b, c) {',
        '  if (a) { if (b) { if (c) { return 1; } } }',
        '  return 0;',
        '}',
        `it${skip}('todo', () => {});`,
      ].join('\n'),
    );
    const { metrics, evidence } = collectMetrics(root, baseConfig());
    expect(metrics['complexity.max']).toBeGreaterThan(1);
    expect(metrics['size.oversizedFiles']).toBe(0);
    expect(metrics['integrity.skippedTests']).toBe(1);
    expect(evidence['complexity.max'][0]).toHaveProperty('snippet');
  });

  it('flags a file over the configured hard line limit as oversized', () => {
    const lines = Array.from({ length: 25 }, (_, i) => `const x${i} = ${i};`).join('\n');
    writeSourceFile('src/big.mjs', `${lines}\n`);
    const { metrics, evidence } = collectMetrics(root, baseConfig());
    expect(metrics['size.oversizedFiles']).toBe(1);
    expect(evidence['size.oversizedFiles'][0].file).toBe('src/big.mjs');
  });
});

describe('collectMetrics — defaults for sparse reports', () => {
  it('a report file that is not valid JSON reads back as missing (parse failure), same as absent', () => {
    mkdirSync(REPORTS_DIR, { recursive: true });
    writeFileSync(join(REPORTS_DIR, 'typecheck.json'), 'not json at all');
    const { failed } = collectMetrics(root, baseConfig());
    expect(failed).toContainEqual({ collector: 'typecheck', error: 'typecheck.json missing — collector did not run' });
  });

  it('defaults every optional field on a minimal typecheck/lint/duplication report', () => {
    write('typecheck.json', {});
    write('lint.json', { messages: [{}] });
    write('jscpd/jscpd-report.json', { statistics: { total: {} } });
    const { metrics, evidence } = collectMetrics(root, baseConfig());
    expect(metrics['typecheck.errors']).toBe(0);
    expect(metrics['lint.errors']).toBe(0);
    expect(metrics['lint.warnings']).toBe(0);
    expect(evidence['lint.errors']).toEqual([]);
    // the one message has no `severity`, so it is neither an error nor a warning
    expect(evidence['lint.warnings']).toEqual([]);
    expect(metrics['duplication.percentage']).toBe(0);
    expect(evidence['duplication.percentage']).toEqual([]);
  });

  it('defaults every optional field on a minimal successful test-summary and coverage report', () => {
    write('test-summary.json', { ranSuccessfully: true });
    write('coverage/coverage-summary.json', { total: {} });
    const { metrics, evidence } = collectMetrics(root, baseConfig());
    expect(metrics['tests.failed']).toBe(0);
    expect(metrics['tests.suitesFailed']).toBe(0);
    expect(evidence['tests.failed']).toEqual([]);
    expect(metrics['coverage.lines']).toBeUndefined();
  });

  it('defaults every optional field on a minimal audit entry (no via, no fixAvailable)', () => {
    write('audit.json', { metadata: { vulnerabilities: {} }, vulnerabilities: { pkgA: { severity: 'high' } } });
    const { metrics, evidence } = collectMetrics(root, baseConfig());
    expect(metrics['audit.high']).toBe(1);
    expect(evidence['audit.high'][0].snippet).toMatch(/^high: pkgA/);
  });
});
