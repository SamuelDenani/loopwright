import { describe, it, expect } from 'vitest';
import { STATUS, evaluateMetrics, evaluateShape, snapshotFiles, worstStatus, format } from '../scripts/lib/evaluate.mjs';

describe('worstStatus', () => {
  it('ranks block over warn over new/improved over pass', () => {
    expect(worstStatus([STATUS.PASS, STATUS.WARN])).toBe(STATUS.WARN);
    expect(worstStatus([STATUS.WARN, STATUS.BLOCK])).toBe(STATUS.BLOCK);
    expect(worstStatus([])).toBe(STATUS.PASS);
    expect(worstStatus([STATUS.NEW])).toBe(STATUS.NEW);
  });
});

describe('evaluateMetrics — hard limits', () => {
  const config = { metrics: { 'audit.critical': { direction: 'lower-better', hardMax: 0, tolerance: 0, onRegression: 'block' } } };

  it('blocks when a hardMax is exceeded, independent of the baseline', () => {
    const [entry] = evaluateMetrics(config, { 'audit.critical': 2 }, { 'audit.critical': 5 });
    expect(entry.status).toBe(STATUS.BLOCK);
    expect(entry.reason).toMatch(/exceeds the hard limit/);
  });

  it('warns with "no data collected" when current is missing entirely', () => {
    const [entry] = evaluateMetrics(config, {}, { 'audit.critical': 0 });
    expect(entry.status).toBe(STATUS.WARN);
    expect(entry.reason).toBe('no data collected for this metric');
  });
});

describe('evaluateMetrics — ratchet (lower-better)', () => {
  const config = { metrics: { 'lint.warnings': { direction: 'lower-better', tolerance: 1, onRegression: 'block' } } };

  it('blocks a regression beyond tolerance', () => {
    const [entry] = evaluateMetrics(config, { 'lint.warnings': 10 }, { 'lint.warnings': 5 });
    expect(entry.status).toBe(STATUS.BLOCK);
    expect(entry.reason).toMatch(/regressed/);
  });

  it('warns instead of blocking when onRegression is "warn"', () => {
    const warnConfig = { metrics: { 'lint.warnings': { direction: 'lower-better', tolerance: 0, onRegression: 'warn' } } };
    const [entry] = evaluateMetrics(warnConfig, { 'lint.warnings': 10 }, { 'lint.warnings': 5 });
    expect(entry.status).toBe(STATUS.WARN);
  });

  it('marks an improvement', () => {
    const [entry] = evaluateMetrics(config, { 'lint.warnings': 2 }, { 'lint.warnings': 5 });
    expect(entry.status).toBe(STATUS.IMPROVED);
    expect(entry.reason).toMatch(/improved/);
  });

  it('passes and reports "holding" when unchanged', () => {
    const [entry] = evaluateMetrics(config, { 'lint.warnings': 5 }, { 'lint.warnings': 5 });
    expect(entry.status).toBe(STATUS.PASS);
    expect(entry.reason).toBe('holding');
  });

  it('passes within tolerance with a nonzero drift message', () => {
    const [entry] = evaluateMetrics(config, { 'lint.warnings': 5.5 }, { 'lint.warnings': 5 });
    expect(entry.status).toBe(STATUS.PASS);
    expect(entry.reason).toMatch(/within tolerance/);
  });
});

describe('evaluateMetrics — ratchet (higher-better)', () => {
  const config = { metrics: { 'coverage.lines': { direction: 'higher-better', tolerance: 0.5, onRegression: 'block' } } };

  it('blocks a regression and marks an improvement in the higher-better direction', () => {
    const [regressed] = evaluateMetrics(config, { 'coverage.lines': 70 }, { 'coverage.lines': 80 });
    expect(regressed.status).toBe(STATUS.BLOCK);
    const [improved] = evaluateMetrics(config, { 'coverage.lines': 90 }, { 'coverage.lines': 80 });
    expect(improved.status).toBe(STATUS.IMPROVED);
  });
});

describe('evaluateMetrics — new metric with no baseline', () => {
  it('is "new", not pass/block, when there is no prior value', () => {
    const config = { metrics: { 'duplication.percentage': { direction: 'lower-better', tolerance: 0, onRegression: 'block' } } };
    const [entry] = evaluateMetrics(config, { 'duplication.percentage': 3 }, undefined);
    expect(entry.status).toBe(STATUS.NEW);
  });
});

describe('format', () => {
  it('renders a unit suffix and formats non-integers to two decimals', () => {
    expect(format(3, '%')).toBe('3%');
    expect(format(3.14159, '%')).toBe('3.14%');
    expect(format('n/a', '')).toBe('n/a');
  });
});

describe('evaluateShape', () => {
  const config = { limits: { fileCodeLines: { warn: 10, block: 20 }, functionLines: { warn: 5, block: 10 }, complexity: { warn: 3, block: 6 }, maxDepth: { warn: 2, block: 4 }, params: { warn: 2, block: 4 } } };

  const analysis = {
    files: [{ file: 'a.mjs', codeLines: 25, lines: 30, functionCount: 1, maxComplexity: 1 }],
    functions: [{ file: 'a.mjs', name: 'f', line: 1, loc: 12, complexity: 7, maxDepth: 1, params: 1 }],
  };

  it('blocks new code that is over the hard limit with no baseline entry', () => {
    const violations = evaluateShape(config, analysis, {});
    const fileViolation = violations.find((v) => v.dimension === 'file length');
    const fnViolation = violations.find((v) => v.dimension === 'cyclomatic complexity');
    expect(fileViolation.status).toBe(STATUS.BLOCK);
    expect(fileViolation.reason).toMatch(/new code over the hard limit/);
    expect(fnViolation.status).toBe(STATUS.BLOCK);
  });

  it('warns (does not block) pre-existing debt that got no worse', () => {
    const baselineFiles = { 'a.mjs': { codeLines: 25, functions: { f: { loc: 12, complexity: 7, maxDepth: 1, params: 1 } } } };
    const violations = evaluateShape(config, analysis, baselineFiles);
    const fileViolation = violations.find((v) => v.dimension === 'file length');
    expect(fileViolation.status).toBe(STATUS.WARN);
    expect(fileViolation.reason).toMatch(/pre-existing debt/);
  });

  it('blocks when debt got strictly worse than its baseline value', () => {
    const baselineFiles = { 'a.mjs': { codeLines: 21, functions: { f: { loc: 12, complexity: 7, maxDepth: 1, params: 1 } } } };
    const violations = evaluateShape(config, analysis, baselineFiles);
    const fileViolation = violations.find((v) => v.dimension === 'file length');
    expect(fileViolation.status).toBe(STATUS.BLOCK);
    expect(fileViolation.reason).toMatch(/worse than the baseline \(21\)/);
  });

  it('warns for new code over the soft limit but under the hard limit', () => {
    const softAnalysis = { files: [{ file: 'b.mjs', codeLines: 12, lines: 15, functionCount: 0, maxComplexity: 0 }], functions: [] };
    const violations = evaluateShape(config, softAnalysis, {});
    expect(violations).toHaveLength(1);
    expect(violations[0].status).toBe(STATUS.WARN);
    expect(violations[0].reason).toMatch(/new code over the soft limit/);
  });

  it('produces no violation when a dimension stays within its soft limit', () => {
    const cleanAnalysis = { files: [{ file: 'c.mjs', codeLines: 3, lines: 5, functionCount: 0, maxComplexity: 0 }], functions: [] };
    expect(evaluateShape(config, cleanAnalysis, {})).toEqual([]);
  });

  it('sorts blocking violations before warnings, largest value first', () => {
    const mixed = {
      files: [
        { file: 'd.mjs', codeLines: 12, lines: 12, functionCount: 0, maxComplexity: 0 },
        { file: 'e.mjs', codeLines: 30, lines: 30, functionCount: 0, maxComplexity: 0 },
      ],
      functions: [],
    };
    const violations = evaluateShape(config, mixed, {});
    expect(violations[0].status).toBe(STATUS.BLOCK);
    expect(violations.at(-1).status).toBe(STATUS.WARN);
  });
});

describe('snapshotFiles', () => {
  it('keys files by path and collapses same-named functions onto their worst-case shape', () => {
    const analysis = {
      files: [{ file: 'a.mjs', codeLines: 10 }],
      functions: [
        { file: 'a.mjs', name: 'f', loc: 5, complexity: 2, maxDepth: 1, params: 1 },
        { file: 'a.mjs', name: 'f', loc: 9, complexity: 4, maxDepth: 2, params: 0 },
      ],
    };
    const snapshot = snapshotFiles(analysis);
    expect(snapshot['a.mjs'].codeLines).toBe(10);
    expect(snapshot['a.mjs'].functions.f).toEqual({ loc: 9, complexity: 4, maxDepth: 2, params: 1 });
  });

  it('ignores a function whose file has no entry in analysis.files', () => {
    const analysis = { files: [], functions: [{ file: 'ghost.mjs', name: 'f', loc: 1, complexity: 1, maxDepth: 0, params: 0 }] };
    expect(snapshotFiles(analysis)).toEqual({});
  });
});
