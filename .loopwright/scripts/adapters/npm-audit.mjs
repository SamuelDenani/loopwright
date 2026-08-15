/**
 * npm audit adapter for the `audit` collector.
 *
 * TEMPORARY: this collect() only runs the command and dumps its raw output.
 * Task 4 replaces it with a real `npm audit --json` parser.
 */
import { runShell, writeReport, REPORT_FILES } from '../run-report.mjs';

export default {
  name: 'npm-audit',
  collector: 'audit',
  defaultCommand: 'npm audit --json',
  collect(ctx) {
    const { command, cwd, reportsDir } = ctx;
    const result = runShell(command, cwd);
    for (const file of REPORT_FILES.audit) {
      writeReport(reportsDir, file, { raw: true, status: result.status, stdout: result.stdout, stderr: result.stderr });
    }
  },
};
