import { describe, it, expect } from 'vitest';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
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

  it('surfaces a spawn error in stderr instead of dropping it', () => {
    // Output overflowing maxBuffer still exits 0, so the truncation is invisible
    // in the status — the error is the only signal that stdout is incomplete.
    const result = runShell('echo aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', process.cwd(), { maxBuffer: 4 });
    expect(result.status).toBe(0);
    expect(result.stderr).toMatch(/ENOBUFS|maxBuffer/i);
  });
});

describe('runShell binary resolution', () => {
  // Regression: the adapters name bare binaries and rely on runShell putting
  // node_modules/.bin on PATH. With npx, a repo whose deps were not installed
  // resolved 'tsc' to an unrelated package off the registry instead of failing.
  it('resolves a binary from the cwd node_modules/.bin', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lw-bin-'));
    mkdirSync(join(dir, 'node_modules/.bin'), { recursive: true });
    const bin = join(dir, 'node_modules/.bin/lw-fake-tool');
    writeFileSync(bin, '#!/bin/sh\necho resolved-locally\n');
    chmodSync(bin, 0o755);

    const result = runShell('lw-fake-tool', dir);
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('resolved-locally');
  });

  it('fails loudly when a binary is absent instead of resolving it elsewhere', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lw-bin-'));
    const result = runShell('lw-definitely-not-installed', dir);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/not found/i);
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
