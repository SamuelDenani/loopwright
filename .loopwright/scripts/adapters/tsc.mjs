/**
 * TypeScript compiler adapter for the `typecheck` collector.
 *
 * TEMPORARY: this collect() only runs the command and dumps its raw output.
 * Task 4 replaces it with a real `tsc --pretty false` diagnostic parser.
 */
import { runShell, writeReport, REPORT_FILES } from '../run-report.mjs';

export default {
  name: 'tsc',
  collector: 'typecheck',
  defaultCommand: 'npx tsc --noEmit --pretty false',
  collect(ctx) {
    const { command, cwd, reportsDir } = ctx;
    const result = runShell(command, cwd);
    for (const file of REPORT_FILES.typecheck) {
      writeReport(reportsDir, file, { raw: true, status: result.status, stdout: result.stdout, stderr: result.stderr });
    }
  },
};
