/**
 * Biome adapter for the `lint` collector (alternative to ESLint).
 *
 * TEMPORARY: this collect() only runs the command and dumps its raw output.
 * Task 4 replaces it with a real Biome JSON-format parser.
 */
import { runShell, writeReport, REPORT_FILES } from '../lib/shell.mjs';

export default {
  name: 'biome',
  collector: 'lint',
  defaultCommand: 'npx biome check --reporter=json .',
  collect(ctx) {
    const { command, cwd, reportsDir } = ctx;
    const result = runShell(command, cwd);
    for (const file of REPORT_FILES.lint) {
      writeReport(reportsDir, file, { raw: true, status: result.status, stdout: result.stdout, stderr: result.stderr });
    }
  },
};
