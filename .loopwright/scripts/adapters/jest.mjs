/**
 * Jest adapter for the `tests` collector (alternative to Vitest).
 *
 * TEMPORARY: this collect() only runs the command and dumps its raw output.
 * Task 5 replaces it with a real jest JSON + coverage-summary parser.
 */
import { runShell, writeReport, REPORT_FILES } from '../lib/shell.mjs';

export default {
  name: 'jest',
  collector: 'tests',
  defaultCommand:
    'npx jest --ci --json --outputFile=.loopwright/reports/test-results.json --coverage --coverageReporters=json-summary --coverageDirectory=.loopwright/reports/coverage',
  collect(ctx) {
    const { command, cwd, reportsDir } = ctx;
    const result = runShell(command, cwd);
    for (const file of REPORT_FILES.tests) {
      writeReport(reportsDir, file, { raw: true, status: result.status, stdout: result.stdout, stderr: result.stderr });
    }
  },
};
