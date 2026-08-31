/**
 * ESLint adapter for the `lint` collector.
 *
 * Normalises `eslint --format json` output into the neutral lint schema
 * (`{ ok, errors, warnings, messages }`) shared by every lint adapter, so
 * collect-metrics.mjs and quality-gate.mjs never see an ESLint-shaped report.
 */
import { relative } from 'node:path';
import { runShell, writeReport, REPORT_FILES } from '../lib/shell.mjs';

const TOOL_MISSING = /not found|command not found|ERR_MODULE_NOT_FOUND|npm error/i;

function toPosix(path) {
  return path.split('\\').join('/');
}

/**
 * Parses raw ESLint JSON-format stdout into the neutral lint schema. `file`
 * on each message is whatever ESLint reported (usually an absolute path);
 * `collect` relativises it once ctx.hostRoot is known. Returns `null` when
 * `stdout` is not parseable JSON.
 */
export function parseEslintJson(stdout) {
  let results;
  try {
    results = JSON.parse(stdout);
  } catch {
    return null;
  }

  let errors = 0;
  let warnings = 0;
  const messages = [];
  for (const file of results) {
    errors += file.errorCount ?? 0;
    warnings += file.warningCount ?? 0;
    for (const message of file.messages ?? []) {
      messages.push({
        file: file.filePath ?? '',
        line: message.line ?? 0,
        severity: message.severity === 2 ? 'error' : 'warning',
        rule: message.ruleId ?? 'unknown',
        message: message.message,
      });
    }
  }

  return { ok: errors === 0, errors, warnings, messages };
}

function writeLintReport(reportsDir, payload) {
  for (const file of REPORT_FILES.lint) writeReport(reportsDir, file, payload);
}

export default {
  name: 'eslint',
  collector: 'lint',
  // --ignore-pattern excludes the vendored .loopwright/ layer: it ships its
  // own fixtures and reports that are not the host's code, so ESLint must
  // never traverse into it when run from the host's config.
  defaultCommand: "eslint . --format json --ignore-pattern '.loopwright/**'",
  collect(ctx) {
    const { command, cwd, reportsDir, hostRoot } = ctx;
    const result = runShell(command, cwd);
    const report = parseEslintJson(result.stdout);

    if (!report) {
      if (result.status !== 0 && TOOL_MISSING.test(result.stderr)) {
        const error = result.stderr.trim().split('\n')[0] || 'eslint failed to run';
        writeLintReport(reportsDir, { ok: false, error });
        console.log(`lint: ${error}`);
        return;
      }
      writeLintReport(reportsDir, { ok: false, error: 'eslint produced no parseable JSON' });
      console.log('lint: could not parse eslint JSON output');
      return;
    }

    const messages = report.messages.map((message) => ({
      ...message,
      file: toPosix(relative(hostRoot, message.file)),
    }));
    writeLintReport(reportsDir, { ...report, messages });
    console.log(`lint: ${report.errors} error(s), ${report.warnings} warning(s)`);
  },
};
