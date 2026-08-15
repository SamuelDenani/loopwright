/**
 * Jest adapter for the `tests` collector (alternative to Vitest).
 *
 * Runs the configured jest command (which writes test-results.json itself,
 * via --outputFile), then reads that file back and summarises it into
 * test-summary.json using the shared vitest summarizer (jest uses the same
 * field names).
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runShell, writeReport, REPORT_FILES } from '../lib/shell.mjs';
import { summarizeTestResults } from './vitest.mjs';

const TOOL_MISSING = /not found|command not found|ERR_MODULE_NOT_FOUND|npm error/i;

function readJsonIfPresent(target) {
  if (!existsSync(target)) return null;
  try {
    return JSON.parse(readFileSync(target, 'utf8'));
  } catch {
    return null;
  }
}

function writeTestsReport(reportsDir, payload) {
  for (const file of REPORT_FILES.tests) writeReport(reportsDir, file, payload);
}

export default {
  name: 'jest',
  collector: 'tests',
  defaultCommand:
    'npx jest --ci --json --outputFile=.loopwright/reports/test-results.json --coverage --coverageReporters=json-summary --coverageDirectory=.loopwright/reports/coverage',
  collect(ctx) {
    const { command, cwd, reportsDir, hostRoot } = ctx;
    const result = runShell(command, cwd);
    const raw = readJsonIfPresent(resolve(reportsDir, 'test-results.json'));

    if (result.status !== 0 && raw === null && TOOL_MISSING.test(result.stderr)) {
      const error = result.stderr.trim().split('\n')[0] || 'jest failed to run';
      writeTestsReport(reportsDir, { ok: false, error });
      console.log(`tests: ${error}`);
      return;
    }

    const summary = summarizeTestResults(raw, result.status === 0, hostRoot);
    writeTestsReport(reportsDir, summary);
    console.log(`tests: exit ${result.status}, ${summary.failures.length} failing assertion(s)`);
  },
};
