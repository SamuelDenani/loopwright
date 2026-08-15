import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// jscpd.mjs spawns the vendored jscpd binary directly via node:child_process
// spawnSync (not the shared runShell helper), so its collect() branches are
// exercised here with a mocked spawnSync instead of running the real binary
// (already covered once, end-to-end, in adapters-collect.test.mjs).
const spawnSyncMock = vi.fn();
vi.mock('node:child_process', () => ({ spawnSync: (...args) => spawnSyncMock(...args) }));

const jscpdModule = await import('../scripts/adapters/jscpd.mjs');
const jscpd = jscpdModule.default;
const { jscpdOutcome } = jscpdModule;

let dir;
let logs;
let logSpy;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'lw-jscpd-'));
  logs = [];
  logSpy = vi.spyOn(console, 'log').mockImplementation((msg) => logs.push(msg));
  spawnSyncMock.mockReset();
});

afterEach(() => {
  logSpy.mockRestore();
});

const config = { sources: { roots: ['src'], extensions: ['.mjs'] } };

describe('jscpd adapter collect() — mocked binary', () => {
  it('logs stdout/stderr when present and writes an empty report if none was produced', () => {
    spawnSyncMock.mockReturnValue({ stdout: 'Clone found\n', stderr: 'a warning\n', status: 0 });
    jscpd.collect({ cwd: dir, reportsDir: dir, config });
    expect(logs).toContain('Clone found');
    expect(logs).toContain('a warning');
    expect(logs).toContain('jscpd: no report produced, wrote an empty one');
    const report = JSON.parse(readFileSync(join(dir, 'jscpd/jscpd-report.json'), 'utf8'));
    expect(report.statistics.total.clones).toBe(0);
  });

  it('does not log anything for blank stdout/stderr, and leaves an existing report untouched', () => {
    mkdirSync(join(dir, 'jscpd'), { recursive: true });
    writeFileSync(join(dir, 'jscpd/jscpd-report.json'), JSON.stringify({ statistics: { total: { clones: 3 } } }));
    spawnSyncMock.mockReturnValue({ stdout: '', stderr: '   ', status: 0 });
    jscpd.collect({ cwd: dir, reportsDir: dir, config });
    expect(logs).toEqual([]);
    const report = JSON.parse(readFileSync(join(dir, 'jscpd/jscpd-report.json'), 'utf8'));
    expect(report.statistics.total.clones).toBe(3);
  });

  it('handles a result with no stdout/stderr keys at all (optional chaining fallback)', () => {
    spawnSyncMock.mockReturnValue({ status: 0 });
    expect(() => jscpd.collect({ cwd: dir, reportsDir: dir, config })).not.toThrow();
    expect(existsSync(resolve(dir, 'jscpd/jscpd-report.json'))).toBe(true);
  });

  it('fails closed (not EMPTY_REPORT) when spawnSync reports a startup error', () => {
    spawnSyncMock.mockReturnValue({ error: new Error('ENOENT: spawnSync jscpd'), stdout: '', stderr: '', status: null });
    jscpd.collect({ cwd: dir, reportsDir: dir, config });
    const report = JSON.parse(readFileSync(join(dir, 'jscpd/jscpd-report.json'), 'utf8'));
    expect(report.ok).toBe(false);
    expect(report.error).toMatch(/ENOENT/);
    expect(report.statistics).toBeUndefined();
  });

  it('fails closed (not EMPTY_REPORT) when jscpd exits non-zero', () => {
    spawnSyncMock.mockReturnValue({ stdout: '', stderr: 'fatal: bad config\n', status: 1 });
    jscpd.collect({ cwd: dir, reportsDir: dir, config });
    const report = JSON.parse(readFileSync(join(dir, 'jscpd/jscpd-report.json'), 'utf8'));
    expect(report.ok).toBe(false);
    expect(report.error).toMatch(/status 1/);
    expect(report.error).toMatch(/fatal: bad config/);
  });
});

describe('jscpdOutcome()', () => {
  it('reports failure when spawnSync itself errored, regardless of status', () => {
    const outcome = jscpdOutcome({ error: new Error('spawn ENOENT'), stderr: '', status: null }, false);
    expect(outcome).toEqual({ ok: false, error: 'jscpd failed to start: spawn ENOENT' });
  });

  it('reports failure with a stderr snippet when the process exits non-zero', () => {
    const outcome = jscpdOutcome({ stderr: 'boom\nmore detail\n', status: 2 }, false);
    expect(outcome).toEqual({ ok: false, error: 'jscpd exited with status 2: boom' });
  });

  it('reports failure without a snippet when stderr is empty on a non-zero exit', () => {
    const outcome = jscpdOutcome({ stderr: '', status: 1 }, false);
    expect(outcome).toEqual({ ok: false, error: 'jscpd exited with status 1' });
  });

  it('reports a clean empty result when the process exits 0 and produced no report', () => {
    const outcome = jscpdOutcome({ stderr: '', status: 0 }, false);
    expect(outcome).toEqual({ ok: true, empty: true });
  });

  it('reports a clean non-empty result when the process exits 0 and a report exists', () => {
    const outcome = jscpdOutcome({ stderr: '', status: 0 }, true);
    expect(outcome).toEqual({ ok: true, empty: false });
  });
});
