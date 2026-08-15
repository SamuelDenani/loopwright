import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import tsc from '../scripts/adapters/tsc.mjs';
import eslint from '../scripts/adapters/eslint.mjs';
import biome from '../scripts/adapters/biome.mjs';
import vitestAdapter from '../scripts/adapters/vitest.mjs';
import jest from '../scripts/adapters/jest.mjs';
import npmAudit from '../scripts/adapters/npm-audit.mjs';
import jscpd, { jscpdArgs } from '../scripts/adapters/jscpd.mjs';
import { REPORTS_DIR, LOOPWRIGHT_DIR } from '../scripts/lib/paths.mjs';

let dir;
let logs;
let spy;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'lw-adapter-'));
  logs = [];
  spy = vi.spyOn(console, 'log').mockImplementation((msg) => logs.push(msg));
});

afterEach(() => {
  spy.mockRestore();
});

function echoJson(payload) {
  const path = join(dir, `payload-${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(path, JSON.stringify(payload));
  return `cat ${path}`;
}

const TOOL_MISSING_CMD = 'sh -c "echo \'sh: nope: command not found\' 1>&2; exit 127"';

describe('tsc adapter collect()', () => {
  it('writes a typecheck report on success', () => {
    const command = 'node -e "process.stdout.write(\'src/a.ts(3,7): error TS2322: bad.\\n\')"';
    tsc.collect({ command, cwd: dir, reportsDir: dir, hostRoot: dir });
    const report = JSON.parse(readFileSync(join(dir, 'typecheck.json'), 'utf8'));
    expect(report.errorCount).toBe(1);
    expect(logs.join(' ')).toMatch(/typecheck: 1 error/);
  });

  it('flags a missing tool instead of a false pass', () => {
    tsc.collect({ command: TOOL_MISSING_CMD, cwd: dir, reportsDir: dir, hostRoot: dir });
    const report = JSON.parse(readFileSync(join(dir, 'typecheck.json'), 'utf8'));
    expect(report.ok).toBe(false);
    expect(report.error).toMatch(/command not found/);
  });
});

describe('eslint adapter collect()', () => {
  it('writes a lint report and relativizes file paths', () => {
    const payload = [
      { filePath: join(dir, 'src/a.js'), errorCount: 1, warningCount: 0, messages: [{ ruleId: 'no-x', severity: 2, line: 1, message: 'bad' }] },
    ];
    eslint.collect({ command: echoJson(payload), cwd: dir, reportsDir: dir, hostRoot: dir });
    const report = JSON.parse(readFileSync(join(dir, 'lint.json'), 'utf8'));
    expect(report.errors).toBe(1);
    expect(report.messages[0].file).toBe('src/a.js');
  });

  it('flags a missing tool', () => {
    eslint.collect({ command: TOOL_MISSING_CMD, cwd: dir, reportsDir: dir, hostRoot: dir });
    const report = JSON.parse(readFileSync(join(dir, 'lint.json'), 'utf8'));
    expect(report.ok).toBe(false);
  });

  it('flags unparseable output that is not a missing-tool signature', () => {
    const command = 'node -e "process.stdout.write(\'not json\')"';
    eslint.collect({ command, cwd: dir, reportsDir: dir, hostRoot: dir });
    const report = JSON.parse(readFileSync(join(dir, 'lint.json'), 'utf8'));
    expect(report.error).toMatch(/no parseable JSON/i);
  });
});

describe('biome adapter collect()', () => {
  it('writes a lint report and relativizes file paths', () => {
    const payload = {
      summary: { errors: 1, warnings: 0 },
      diagnostics: [{ category: 'lint/x', severity: 'error', description: 'bad', location: { path: { file: join(dir, 'src/a.js') } } }],
    };
    biome.collect({ command: echoJson(payload), cwd: dir, reportsDir: dir, hostRoot: dir });
    const report = JSON.parse(readFileSync(join(dir, 'lint.json'), 'utf8'));
    expect(report.errors).toBe(1);
    expect(report.messages[0].file).toBe('src/a.js');
  });

  it('flags a missing tool', () => {
    biome.collect({ command: TOOL_MISSING_CMD, cwd: dir, reportsDir: dir, hostRoot: dir });
    const report = JSON.parse(readFileSync(join(dir, 'lint.json'), 'utf8'));
    expect(report.ok).toBe(false);
  });

  it('flags unparseable output', () => {
    const command = 'node -e "process.stdout.write(\'nope\')"';
    biome.collect({ command, cwd: dir, reportsDir: dir, hostRoot: dir });
    const report = JSON.parse(readFileSync(join(dir, 'lint.json'), 'utf8'));
    expect(report.error).toMatch(/no parseable JSON/i);
  });
});

describe('vitest adapter collect()', () => {
  it('reads back test-results.json written by the command and summarizes it', () => {
    const raw = { numTotalTests: 1, numPassedTests: 1, numFailedTests: 0, testResults: [] };
    writeFileSync(join(dir, 'test-results.json'), JSON.stringify(raw));
    const command = 'true';
    vitestAdapter.collect({ command, cwd: dir, reportsDir: dir, hostRoot: dir });
    const summary = JSON.parse(readFileSync(join(dir, 'test-summary.json'), 'utf8'));
    expect(summary.total).toBe(1);
    expect(summary.ok).toBe(true);
  });

  it('flags a missing tool when no results file is produced', () => {
    vitestAdapter.collect({ command: TOOL_MISSING_CMD, cwd: dir, reportsDir: dir, hostRoot: dir });
    const summary = JSON.parse(readFileSync(join(dir, 'test-summary.json'), 'utf8'));
    expect(summary.ok).toBe(false);
    expect(summary.error).toMatch(/command not found/);
  });

  it('records ranSuccessfully:false when the runner exits non-zero with no report and no missing-tool signature', () => {
    const command = 'sh -c "echo boom 1>&2; exit 1"';
    vitestAdapter.collect({ command, cwd: dir, reportsDir: dir, hostRoot: dir });
    const summary = JSON.parse(readFileSync(join(dir, 'test-summary.json'), 'utf8'));
    expect(summary.ranSuccessfully).toBe(false);
  });

  it('treats an unparseable test-results.json as absent (falls back to ranSuccessfully:false)', () => {
    writeFileSync(join(dir, 'test-results.json'), 'not json');
    vitestAdapter.collect({ command: 'true', cwd: dir, reportsDir: dir, hostRoot: dir });
    const summary = JSON.parse(readFileSync(join(dir, 'test-summary.json'), 'utf8'));
    expect(summary.ranSuccessfully).toBe(false);
  });
});

describe('jest adapter collect()', () => {
  it('reads back test-results.json and summarizes it', () => {
    const raw = { numTotalTests: 2, numPassedTests: 2, numFailedTests: 0, testResults: [] };
    writeFileSync(join(dir, 'test-results.json'), JSON.stringify(raw));
    jest.collect({ command: 'true', cwd: dir, reportsDir: dir, hostRoot: dir });
    const summary = JSON.parse(readFileSync(join(dir, 'test-summary.json'), 'utf8'));
    expect(summary.total).toBe(2);
  });

  it('flags a missing tool when no results file is produced', () => {
    jest.collect({ command: TOOL_MISSING_CMD, cwd: dir, reportsDir: dir, hostRoot: dir });
    const summary = JSON.parse(readFileSync(join(dir, 'test-summary.json'), 'utf8'));
    expect(summary.ok).toBe(false);
  });
});

describe('npm-audit adapter collect()', () => {
  it('passes through parseable npm audit JSON unchanged', () => {
    const payload = { metadata: { vulnerabilities: { critical: 0, high: 1 } }, vulnerabilities: {} };
    npmAudit.collect({ command: echoJson(payload), cwd: dir, reportsDir: dir, hostRoot: dir });
    const report = JSON.parse(readFileSync(join(dir, 'audit.json'), 'utf8'));
    expect(report.metadata.vulnerabilities.high).toBe(1);
  });

  it('writes a synthetic failure payload when stdout is not parseable', () => {
    const command = 'node -e "process.stdout.write(\'not json\')"';
    npmAudit.collect({ command, cwd: dir, reportsDir: dir, hostRoot: dir });
    const report = JSON.parse(readFileSync(join(dir, 'audit.json'), 'utf8'));
    expect(report.ok).toBe(false);
    expect(report.error).toMatch(/no parseable JSON/);
  });
});

describe('jscpd adapter', () => {
  it('derives formats and passes source roots positionally (already covered by jscpdArgs unit test)', () => {
    expect(jscpdArgs({ sources: { roots: ['a'], extensions: ['.mjs'] } })).toContain('a');
  });

  it('runs the vendored jscpd binary and writes a report even on a source tree with no clones', () => {
    if (!existsSync(resolve(LOOPWRIGHT_DIR, 'node_modules/.bin/jscpd'))) return; // not vendored in this checkout
    const srcDir = join(dir, 'src');
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, 'a.mjs'), 'export const a = 1;\n');
    // Real usage (run-report.mjs) always passes reportsDir === REPORTS_DIR — the
    // adapter's --output target is hardcoded to REPORTS_DIR/jscpd regardless of
    // ctx.reportsDir, so the existsSync fallback check only lines up when the
    // two agree, same as in production.
    jscpd.collect({
      cwd: dir,
      reportsDir: REPORTS_DIR,
      config: { sources: { roots: [srcDir], extensions: ['.mjs'] } },
    });
    // Intentionally not cleaned up: this writes into the real, gitignored
    // .loopwright/reports/jscpd (see comment above on why reportsDir must
    // equal REPORTS_DIR here). A real `run-report.mjs --all` regenerates it
    // on the next run either way.
    expect(existsSync(resolve(REPORTS_DIR, 'jscpd/jscpd-report.json'))).toBe(true);
  });
});
