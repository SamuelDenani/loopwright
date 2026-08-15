/**
 * ESLint adapter for the `lint` collector.
 *
 * TEMPORARY: this collect() only runs the command and dumps its raw output.
 * Task 4 replaces it with a real ESLint JSON-format parser.
 */
import { runShell, writeReport, REPORT_FILES } from '../run-report.mjs';

export default {
  name: 'eslint',
  collector: 'lint',
  defaultCommand: 'npx eslint . --format json',
  collect(ctx) {
    const { command, cwd, reportsDir } = ctx;
    const result = runShell(command, cwd);
    for (const file of REPORT_FILES.lint) {
      writeReport(reportsDir, file, { raw: true, status: result.status, stdout: result.stdout, stderr: result.stderr });
    }
  },
};
