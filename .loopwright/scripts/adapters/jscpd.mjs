/**
 * jscpd adapter for the `duplication` collector.
 *
 * `defaultCommand` is a marker string: Task 4 computes the real jscpd
 * invocation from config (ignore globs, thresholds, reporters) rather than
 * hardcoding it here.
 *
 * TEMPORARY: this collect() only runs the command and dumps its raw output.
 * Task 4 replaces it with a real jscpd-report.json pass-through/normaliser.
 */
import { runShell, writeReport, REPORT_FILES } from '../run-report.mjs';

export default {
  name: 'jscpd',
  collector: 'duplication',
  defaultCommand: 'jscpd',
  collect(ctx) {
    const { command, cwd, reportsDir } = ctx;
    const result = runShell(command, cwd);
    for (const file of REPORT_FILES.duplication) {
      writeReport(reportsDir, file, { raw: true, status: result.status, stdout: result.stdout, stderr: result.stderr });
    }
  },
};
