import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runShell, writeReport } from '../scripts/lib/shell.mjs';

describe('runShell', () => {
  it('runs a shell command and captures stdout/status', () => {
    const result = runShell('echo hello', process.cwd());
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('hello');
  });

  it('captures a non-zero exit status and stderr', () => {
    const result = runShell('sh -c "echo boom 1>&2; exit 3"', process.cwd());
    expect(result.status).toBe(3);
    expect(result.stderr.trim()).toBe('boom');
  });

  it('falls back to status 1 when the process was killed by a signal (status is null)', () => {
    const result = runShell('kill -9 $$', process.cwd());
    expect(result.status).toBe(1);
  });
});

describe('writeReport', () => {
  it('creates nested directories and writes pretty JSON with a trailing newline', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lw-shell-'));
    writeReport(dir, 'nested/report.json', { ok: true, n: 1 });
    const raw = readFileSync(join(dir, 'nested/report.json'), 'utf8');
    expect(raw.endsWith('\n')).toBe(true);
    expect(JSON.parse(raw)).toEqual({ ok: true, n: 1 });
  });
});
