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
    spawnSyncMock.mockReturnValue({ stdout: 'Clone found\n', stderr: 'a warning\n' });
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
    spawnSyncMock.mockReturnValue({ stdout: '', stderr: '   ' });
    jscpd.collect({ cwd: dir, reportsDir: dir, config });
    expect(logs).toEqual([]);
    const report = JSON.parse(readFileSync(join(dir, 'jscpd/jscpd-report.json'), 'utf8'));
    expect(report.statistics.total.clones).toBe(3);
  });

  it('handles a result with no stdout/stderr keys at all (optional chaining fallback)', () => {
    spawnSyncMock.mockReturnValue({});
    expect(() => jscpd.collect({ cwd: dir, reportsDir: dir, config })).not.toThrow();
    expect(existsSync(resolve(dir, 'jscpd/jscpd-report.json'))).toBe(true);
  });
});
