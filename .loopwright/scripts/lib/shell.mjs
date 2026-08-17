/**
 * Shell + report-file primitives shared between run-report.mjs and the
 * adapters.
 *
 * Kept separate from run-report.mjs on purpose: run-report.mjs imports
 * ADAPTERS from adapters/index.mjs, which imports every adapter file. If the
 * adapters imported runShell/writeReport back from run-report.mjs, that would
 * be a circular edge (adapter -> run-report.mjs -> adapters/index.mjs ->
 * adapter) — and whichever adapter module Node happens to load first would
 * see an incomplete module graph and crash. This file has no dependency on
 * adapters/index.mjs, so it breaks the cycle; run-report.mjs re-exports these
 * names unchanged so its public API is unaffected.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export const REPORT_FILES = {
  typecheck: ['typecheck.json'],
  lint: ['lint.json'],
  tests: ['test-summary.json', 'test-results.json'],
  audit: ['audit.json'],
  duplication: ['jscpd/jscpd-report.json'],
};

export function runShell(command, cwd, { maxBuffer = 64 * 1024 * 1024 } = {}) {
  const result = spawnSync(command, { shell: true, cwd, encoding: 'utf8', maxBuffer });
  // spawnSync reports a failure to run the command at all — the shell missing,
  // or output overflowing maxBuffer — on `error` rather than through the exit
  // status. Dropping it would leave the caller with a bare status 1 and empty
  // stderr, which is indistinguishable from the command itself failing quietly.
  const stderr = result.stderr ?? '';
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.error ? `${stderr}${result.error.message}\n` : stderr,
  };
}

export function writeReport(reportsDir, relativePath, payload) {
  const target = resolve(reportsDir, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`);
}
