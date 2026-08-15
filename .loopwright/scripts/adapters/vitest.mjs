/**
 * Vitest adapter for the `tests` collector.
 *
 * TEMPORARY: this collect() only runs the command and dumps its raw output.
 * Task 5 replaces it with a real vitest JSON + coverage-summary parser.
 */
import { runShell, writeReport, REPORT_FILES } from '../run-report.mjs';

export default {
  name: 'vitest',
  collector: 'tests',
  defaultCommand:
    'npx vitest run --coverage --coverage.reporter=json-summary --coverage.reportsDirectory=.loopwright/reports/coverage --reporter=default --reporter=json --outputFile.json=.loopwright/reports/test-results.json',
  collect(ctx) {
    const { command, cwd, reportsDir } = ctx;
    const result = runShell(command, cwd);
    for (const file of REPORT_FILES.tests) {
      writeReport(reportsDir, file, { raw: true, status: result.status, stdout: result.stdout, stderr: result.stderr });
    }
  },
};
