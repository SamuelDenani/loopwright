/**
 * TypeScript compiler adapter for the `typecheck` collector.
 *
 * Parses `tsc --noEmit --pretty false` output (stdout + stderr, one
 * diagnostic per line) into structured diagnostics.
 */
import { runShell, writeReport, REPORT_FILES } from '../lib/shell.mjs';

const TS_DIAGNOSTIC = /^(.+?)\((\d+),(\d+)\): (error|warning) (TS\d+): (.*)$/;

// "tool missing" heuristic shared by the tsc/eslint/vitest adapters: a
// non-zero exit with nothing parseable and a stderr line that looks like the
// binary itself couldn't run, rather than the tool running and finding
// errors.
const TOOL_MISSING = /not found|command not found|ERR_MODULE_NOT_FOUND|npm error/i;

export function parseTscOutput(text) {
  const diagnostics = [];
  for (const rawLine of text.split('\n')) {
    const match = TS_DIAGNOSTIC.exec(rawLine.trim());
    if (!match) continue;
    diagnostics.push({
      file: match[1],
      line: Number(match[2]),
      column: Number(match[3]),
      severity: match[4],
      code: match[5],
      message: match[6],
    });
  }
  const errorCount = diagnostics.filter((entry) => entry.severity === 'error').length;
  return { ok: errorCount === 0, errorCount, diagnostics };
}

function writeTypecheckReport(reportsDir, payload) {
  for (const file of REPORT_FILES.typecheck) writeReport(reportsDir, file, payload);
}

export default {
  name: 'tsc',
  collector: 'typecheck',
  defaultCommand: 'npx tsc --noEmit --pretty false',
  collect(ctx) {
    const { command, cwd, reportsDir } = ctx;
    const result = runShell(command, cwd);
    const report = parseTscOutput(`${result.stdout}\n${result.stderr}`);

    if (result.status !== 0 && report.diagnostics.length === 0 && TOOL_MISSING.test(result.stderr)) {
      const error = result.stderr.trim().split('\n')[0] || 'tsc failed to run';
      writeTypecheckReport(reportsDir, { ok: false, error });
      console.log(`typecheck: ${error}`);
      return;
    }

    writeTypecheckReport(reportsDir, {
      ok: report.ok,
      errorCount: report.errorCount,
      diagnostics: report.diagnostics.slice(0, 200),
    });
    console.log(`typecheck: ${report.errorCount} error(s)`);
  },
};
