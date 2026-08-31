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
import { delimiter, dirname, resolve } from 'node:path';
import { HOST_ROOT } from './paths.mjs';

export const REPORT_FILES = {
  typecheck: ['typecheck.json'],
  lint: ['lint.json'],
  tests: ['test-summary.json', 'test-results.json'],
  audit: ['audit.json'],
  duplication: ['jscpd/jscpd-report.json'],
};

/**
 * Adapter commands name a bare binary (`tsc`, `vitest`, …) and rely on this
 * PATH, rather than going through `npx`. npx falls through to the registry
 * when a binary is not installed locally, so on a repo whose dependencies were
 * never installed — or installed by a package manager the workflow did not
 * recognise — `npx tsc` silently downloads `tsc`, an unrelated abandoned
 * package that is not TypeScript, and the collector reports its nonsense as
 * fact. Every package manager (npm, pnpm, yarn) populates node_modules/.bin,
 * so resolving through it works for all three, and a genuinely missing tool
 * fails with 'command not found' — which each adapter's TOOL_MISSING check
 * already reports honestly.
 *
 * Both the host root and `cwd` contribute a bin directory: a collector may set
 * `cwd` to a subdirectory with its own install (loopwright's own config points
 * the tests collector at .loopwright/).
 */
function binPath(cwd) {
  const dirs = [resolve(cwd, 'node_modules/.bin'), resolve(HOST_ROOT, 'node_modules/.bin')];
  return [...new Set(dirs), process.env.PATH ?? ''].join(delimiter);
}

export function runShell(command, cwd, { maxBuffer = 64 * 1024 * 1024 } = {}) {
  const env = { ...process.env, PATH: binPath(cwd) };
  const result = spawnSync(command, { shell: true, cwd, encoding: 'utf8', maxBuffer, env });
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
