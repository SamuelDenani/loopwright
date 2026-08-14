#!/usr/bin/env node
/**
 * Runs one quality tool and normalises its output into reports/.
 *
 * These commands ALWAYS exit 0, even when the underlying tool fails. That is
 * deliberate: `scripts/quality-gate.mjs` is the single blocking step, so a
 * failing test run still produces a report the gate (and the agent babysitting
 * the PR) can read instead of aborting the workflow halfway through.
 *
 * Usage: node scripts/run-report.mjs <typecheck|lint|test|audit|jscpd>
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const REPORTS = resolve(ROOT, 'reports');

function writeReport(relativePath, payload) {
  const target = resolve(ROOT, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`);
  return target;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function readJsonIfPresent(relativePath) {
  const target = resolve(ROOT, relativePath);
  if (!existsSync(target)) return null;
  try {
    return JSON.parse(readFileSync(target, 'utf8'));
  } catch {
    return null;
  }
}

// --- typecheck ---------------------------------------------------------------

const TS_DIAGNOSTIC = /^(.+?)\((\d+),(\d+)\): (error|warning) (TS\d+): (.*)$/;

function collectTypecheck() {
  const { status, stdout, stderr } = run('npx', ['tsc', '--noEmit', '--pretty', 'false']);
  const diagnostics = [];
  for (const line of `${stdout}\n${stderr}`.split('\n')) {
    const match = TS_DIAGNOSTIC.exec(line.trim());
    if (match) {
      diagnostics.push({
        file: match[1],
        line: Number(match[2]),
        column: Number(match[3]),
        severity: match[4],
        code: match[5],
        message: match[6],
      });
    }
  }
  const errors = diagnostics.filter((entry) => entry.severity === 'error');
  writeReport('reports/typecheck.json', {
    ok: status === 0,
    errorCount: errors.length,
    diagnostics: diagnostics.slice(0, 200),
  });
  console.log(`typecheck: ${errors.length} error(s)`);
  if (errors.length > 0) console.log(stdout.trim() || stderr.trim());
}

// --- lint --------------------------------------------------------------------

function collectLint() {
  mkdirSync(REPORTS, { recursive: true });
  const { stdout } = run('npx', ['eslint', '.', '--format', 'json']);
  let results = [];
  try {
    results = JSON.parse(stdout);
  } catch {
    console.log('lint: could not parse eslint JSON output');
  }
  writeReport('reports/eslint.json', results);

  let errorCount = 0;
  let warningCount = 0;
  for (const file of results) {
    errorCount += file.errorCount ?? 0;
    warningCount += file.warningCount ?? 0;
  }
  console.log(`lint: ${errorCount} error(s), ${warningCount} warning(s)`);

  // A human-readable copy for the CI log and the artifact bundle.
  const { stdout: pretty } = run('npx', ['eslint', '.', '--format', 'stylish']);
  if (pretty.trim()) console.log(pretty.trim());
}

// --- tests + coverage --------------------------------------------------------

function extractFailures(raw) {
  const failures = [];
  for (const file of raw?.testResults ?? []) {
    const name = file.name ? file.name.replace(`${ROOT}/`, '') : 'unknown';
    for (const assertion of file.assertionResults ?? []) {
      if (assertion.status !== 'failed') continue;
      const messages = assertion.failureMessages ?? [];
      failures.push({
        file: name,
        title: assertion.fullName || assertion.title || '<untitled>',
        message: messages.join('\n').split('\n').slice(0, 6).join('\n'),
      });
    }
  }
  return failures;
}

function collectTests() {
  mkdirSync(REPORTS, { recursive: true });
  const { status, stdout, stderr } = run('npx', [
    'vitest',
    'run',
    '--coverage',
    '--reporter=default',
    '--reporter=json',
    '--outputFile.json=reports/test-results.json',
  ]);
  console.log(stdout.trim());
  if (status !== 0 && stderr.trim()) console.log(stderr.trim());

  const raw = readJsonIfPresent('reports/test-results.json');
  const failures = extractFailures(raw);
  const count = (key, fallback = 0) => raw?.[key] ?? fallback;

  writeReport('reports/test-summary.json', {
    ok: status === 0,
    ranSuccessfully: raw !== null,
    total: count('numTotalTests'),
    passed: count('numPassedTests'),
    failed: count('numFailedTests', failures.length),
    skipped: count('numPendingTests') + count('numTodoTests'),
    suitesFailed: count('numFailedTestSuites'),
    failures: failures.slice(0, 50),
  });
  console.log(`tests: exit ${status}, ${failures.length} failing assertion(s)`);
}

// --- npm audit ---------------------------------------------------------------

function collectAudit() {
  // The whole dependency tree, with no prod/dev split: a PR is either ready to
  // deploy or it is not, and a gate with an exempt category cannot tell you which.
  const { stdout } = run('npm', ['audit', '--json']);
  let parsed = null;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    parsed = null;
  }
  writeReport('reports/audit.json', parsed ?? { error: 'npm audit produced no parseable JSON' });
  console.log(`audit: ${JSON.stringify(parsed?.metadata?.vulnerabilities ?? null)}`);
}

// --- jscpd -------------------------------------------------------------------

function collectJscpd() {
  mkdirSync(resolve(REPORTS, 'jscpd'), { recursive: true });
  const { stdout, stderr } = run('npx', ['jscpd']);
  console.log(stdout.trim() || stderr.trim());
  const report = readJsonIfPresent('reports/jscpd/jscpd-report.json');
  if (!report) {
    writeReport('reports/jscpd/jscpd-report.json', {
      statistics: { total: { percentage: 0, clones: 0, duplicatedLines: 0, lines: 0 } },
      duplicates: [],
    });
    console.log('jscpd: no report produced, wrote an empty one');
    return;
  }
  const total = report.statistics?.total ?? {};
  console.log(`jscpd: ${total.percentage ?? 0}% duplicated across ${total.clones ?? 0} clone(s)`);
}

// --- entrypoint --------------------------------------------------------------

const collectors = {
  typecheck: collectTypecheck,
  lint: collectLint,
  test: collectTests,
  audit: collectAudit,
  jscpd: collectJscpd,
};

const target = process.argv[2];
const collector = collectors[target];
if (!collector) {
  console.error(`unknown collector "${target ?? ''}". expected one of: ${Object.keys(collectors).join(', ')}`);
  process.exit(2);
}

collector();
process.exit(0);
