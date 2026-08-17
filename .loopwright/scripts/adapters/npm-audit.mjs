/**
 * npm audit adapter for the `audit` collector.
 *
 * `npm audit --json` always prints JSON on stdout (even on the non-zero exit
 * it uses to signal "vulnerabilities found"), so the report is a pass-through
 * of that JSON, unchanged. The only failure case handled here is stdout not
 * being parseable at all.
 */
import { runShell, writeReport, REPORT_FILES } from '../lib/shell.mjs';

export default {
  name: 'npm-audit',
  collector: 'audit',
  defaultCommand: 'npm audit --json',
  collect(ctx) {
    const { command, cwd, reportsDir } = ctx;
    const result = runShell(command, cwd);

    let parsed = null;
    try {
      parsed = JSON.parse(result.stdout);
    } catch {
      parsed = null;
    }

    const payload = parsed ?? { ok: false, error: 'npm audit produced no parseable JSON' };
    for (const file of REPORT_FILES.audit) writeReport(reportsDir, file, payload);
    console.log(`audit: ${JSON.stringify(parsed?.metadata?.vulnerabilities ?? null)}`);
  },
};
