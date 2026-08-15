/**
 * Vitest adapter for the `tests` collector.
 *
 * Runs the configured vitest command (which writes test-results.json itself,
 * via --outputFile.json / vitest.config.mjs), then reads that file back and
 * summarises it into test-summary.json.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runShell, writeReport } from '../lib/shell.mjs';

const TOOL_MISSING = /not found|command not found|ERR_MODULE_NOT_FOUND|npm error/i;

function readJsonIfPresent(target) {
  if (!existsSync(target)) return null;
  try {
    return JSON.parse(readFileSync(target, 'utf8'));
  } catch {
    return null;
  }
}

export function extractFailures(raw) {
  const failures = [];
  for (const file of raw?.testResults ?? []) {
    const name = file.name ?? 'unknown';
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

/**
 * Summarises a parsed vitest JSON reporter payload (`raw`, or `null` when no
 * JSON was produced) plus the process exit outcome (`ok`) into the
 * test-summary.json shape.
 */
export function summarizeTestResults(raw, ok) {
  const failures = extractFailures(raw);
  const count = (key, fallback = 0) => raw?.[key] ?? fallback;
  return {
    ok,
    ranSuccessfully: raw !== null && raw !== undefined,
    total: count('numTotalTests'),
    passed: count('numPassedTests'),
    failed: count('numFailedTests', failures.length),
    skipped: count('numPendingTests') + count('numTodoTests'),
    suitesFailed: count('numFailedTestSuites'),
    failures: failures.slice(0, 50),
  };
}

export default {
  name: 'vitest',
  collector: 'tests',
  defaultCommand:
    'npx vitest run --coverage --coverage.reporter=json-summary --coverage.reportsDirectory=.loopwright/reports/coverage --reporter=default --reporter=json --outputFile.json=.loopwright/reports/test-results.json',
  collect(ctx) {
    const { command, cwd, reportsDir } = ctx;
    const result = runShell(command, cwd);
    const raw = readJsonIfPresent(resolve(reportsDir, 'test-results.json'));

    if (result.status !== 0 && raw === null && TOOL_MISSING.test(result.stderr)) {
      const error = result.stderr.trim().split('\n')[0] || 'vitest failed to run';
      writeReport(reportsDir, 'test-summary.json', { ok: false, error });
      console.log(`tests: ${error}`);
      return;
    }

    const summary = summarizeTestResults(raw, result.status === 0);
    writeReport(reportsDir, 'test-summary.json', summary);
    console.log(`tests: exit ${result.status}, ${summary.failures.length} failing assertion(s)`);
  },
};
