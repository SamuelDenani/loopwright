import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTscOutput } from '../scripts/adapters/tsc.mjs';
import { parseEslintJson } from '../scripts/adapters/eslint.mjs';
import { summarizeTestResults } from '../scripts/adapters/vitest.mjs';
import { parseBiomeJson } from '../scripts/adapters/biome.mjs';
import { jscpdArgs } from '../scripts/adapters/jscpd.mjs';

const fixture = (name) => readFileSync(join(import.meta.dirname, 'fixtures', name), 'utf8');

describe('tsc adapter', () => {
  it('parses diagnostics and counts only errors', () => {
    const report = parseTscOutput(fixture('tsc-output.txt'));
    expect(report.errorCount).toBe(1);
    expect(report.ok).toBe(false);
    expect(report.diagnostics[0]).toMatchObject({ file: 'src/a.ts', line: 3, code: 'TS2322', severity: 'error' });
  });
});

describe('eslint adapter', () => {
  it('normalizes to the neutral lint schema', () => {
    const report = parseEslintJson(fixture('eslint.json'));
    expect(report).toMatchObject({ ok: false, errors: 1, warnings: 1 });
    expect(report.messages[0]).toHaveProperty('rule');
    expect(['error', 'warning']).toContain(report.messages[0].severity);
  });
});

describe('vitest adapter', () => {
  const raw = JSON.parse(fixture('vitest-results.json'));

  it('summarizes counts and failure messages', () => {
    const summary = summarizeTestResults(raw, false);
    expect(summary).toMatchObject({ ok: false, total: 3, passed: 2, failed: 1, suitesFailed: 1 });
    expect(summary.failures[0].message.length).toBeGreaterThan(0);
  });

  it('leaves failure file paths untouched when no root is given', () => {
    const summary = summarizeTestResults(raw, false);
    expect(summary.failures[0].file).toBe('/repo/tests/example.test.mjs');
  });

  it('relativizes absolute failure file paths against an explicit root', () => {
    const summary = summarizeTestResults(raw, false, '/repo');
    expect(summary.failures[0].file).toBe('tests/example.test.mjs');
  });
});

describe('jest adapter', () => {
  it('reuses the shared summarizer over jest JSON output', () => {
    const summary = summarizeTestResults(JSON.parse(fixture('jest-results.json')), false);
    expect(summary).toMatchObject({ total: 5, failed: 2 });
    expect(summary.failures).toHaveLength(2);
  });
});

describe('biome adapter', () => {
  it('normalizes biome diagnostics to the neutral lint schema', () => {
    const report = parseBiomeJson(fixture('biome.json'));
    expect(report).toMatchObject({ ok: false, errors: 2, warnings: 1 });
    expect(report.messages).toHaveLength(3);
    expect(report.messages.find((m) => m.file === 'unknown')).toBeTruthy();
  });
});

describe('jscpd adapter', () => {
  it('derives formats from source extensions', () => {
    const args = jscpdArgs({ sources: { roots: ['src', 'app'], extensions: ['.ts', '.tsx'] } });
    expect(args.join(' ')).toContain('--format typescript,tsx');
    expect(args.slice(-2)).toEqual(['src', 'app']);
  });
});
