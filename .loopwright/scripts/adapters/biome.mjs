/**
 * Biome adapter for the `lint` collector (alternative to ESLint).
 *
 * Normalises `biome check --reporter=json` output into the neutral lint
 * schema (`{ ok, errors, warnings, messages }`) shared by every lint adapter,
 * so collect-metrics.mjs and quality-gate.mjs never see a Biome-shaped report.
 */
import { relative } from 'node:path';
import { runShell, writeReport, REPORT_FILES } from '../lib/shell.mjs';

const TOOL_MISSING = /not found|command not found|ERR_MODULE_NOT_FOUND|npm error/i;

function toPosix(path) {
  return path.split('\\').join('/');
}

/**
 * Parses raw Biome JSON-format string into the neutral lint schema. Biome's
 * diagnostic spans are byte offsets, not character positions; converting is
 * not worth the complexity, so line stays 0 as a known limitation.
 *
 * Parses defensively: missing fields degrade to defaults (never throw).
 * - missing location: file becomes 'unknown'
 * - missing severity: defaults to 'warning'
 * - missing category/description: defaults to 'biome' / ''
 */
export function parseBiomeJson(stdout) {
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return null;
  }

  const errors = parsed?.summary?.errors ?? 0;
  const warnings = parsed?.summary?.warnings ?? 0;
  const messages = [];

  for (const diag of parsed?.diagnostics ?? []) {
    messages.push({
      file: diag.location?.path?.file ?? 'unknown',
      line: 0, // Biome spans are byte offsets, not line:col. See comment above.
      severity: diag.severity === 'error' ? 'error' : 'warning',
      rule: diag.category ?? 'biome',
      message: diag.description ?? '',
    });
  }

  return { ok: errors === 0, errors, warnings, messages };
}

function writeLintReport(reportsDir, payload) {
  for (const file of REPORT_FILES.lint) writeReport(reportsDir, file, payload);
}

export default {
  name: 'biome',
  collector: 'lint',
  defaultCommand: 'biome check --reporter=json .',
  collect(ctx) {
    const { command, cwd, reportsDir, hostRoot } = ctx;
    const result = runShell(command, cwd);
    const report = parseBiomeJson(result.stdout);

    if (!report) {
      if (result.status !== 0 && TOOL_MISSING.test(result.stderr)) {
        const error = result.stderr.trim().split('\n')[0] || 'biome failed to run';
        writeLintReport(reportsDir, { ok: false, error });
        console.log(`lint: ${error}`);
        return;
      }
      writeLintReport(reportsDir, { ok: false, error: 'biome produced no parseable JSON' });
      console.log('lint: could not parse biome JSON output');
      return;
    }

    // Biome has no per-invocation ignore flag as robust as ESLint's
    // --ignore-pattern, and while it can respect .gitignore via its VCS
    // integration, that's opt-in/config-dependent and not something to rely
    // on here. So `biome check .` may still traverse the vendored
    // .loopwright/ layer; filter those diagnostics out after the fact
    // instead, and recompute errors/warnings from what's left, so host lint
    // results never include the vendored engine's own fixtures/reports.
    const messages = report.messages
      .map((message) => ({ ...message, file: toPosix(relative(hostRoot, message.file)) }))
      .filter((message) => !message.file.startsWith('.loopwright/'));
    const errors = messages.filter((message) => message.severity === 'error').length;
    const warnings = messages.filter((message) => message.severity === 'warning').length;

    writeLintReport(reportsDir, { ok: errors === 0, errors, warnings, messages });
    console.log(`lint: ${errors} error(s), ${warnings} warning(s)`);
  },
};
