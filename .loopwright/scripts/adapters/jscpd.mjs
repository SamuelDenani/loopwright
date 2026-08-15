/**
 * jscpd adapter for the `duplication` collector.
 *
 * Runs the jscpd binary vendored under .loopwright/node_modules (not the
 * host project's, since the host may not depend on it at all) directly via
 * spawnSync in array form — no shell, so config-derived source roots never
 * pass through shell interpolation.
 */
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { writeReport, REPORT_FILES } from '../lib/shell.mjs';
import { LOOPWRIGHT_DIR } from '../lib/paths.mjs';

const EXTENSION_FORMATS = {
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.jsx': 'jsx',
};

/**
 * Builds the jscpd CLI args from config.sources: the format list is derived
 * from the configured source extensions (deduped, comma-joined), and the
 * source roots are passed as trailing positional args. `--output` is derived
 * from `reportsDir` (the caller's ctx.reportsDir) rather than the fixed
 * REPORTS_DIR constant, so a caller that points reportsDir at a scratch
 * directory (e.g. a test) never writes into the real, committed reports
 * directory — the report jscpd writes and the report `collect()` checks for
 * afterward must always agree on where that is.
 */
export function jscpdArgs(config, reportsDir) {
  const { roots, extensions } = config.sources;
  const formats = [...new Set(extensions.map((ext) => EXTENSION_FORMATS[ext]).filter(Boolean))].join(',');
  return [
    '--reporters',
    'json',
    '--output',
    resolve(reportsDir, 'jscpd'),
    '--min-lines',
    '5',
    '--min-tokens',
    '50',
    '--gitignore',
    '--format',
    formats,
    ...roots,
  ];
}

const EMPTY_REPORT = {
  statistics: { total: { percentage: 0, clones: 0, duplicatedLines: 0, lines: 0 } },
  duplicates: [],
};

export default {
  name: 'jscpd',
  collector: 'duplication',
  defaultCommand: 'jscpd',
  collect(ctx) {
    const { cwd, reportsDir, config } = ctx;
    const bin = resolve(LOOPWRIGHT_DIR, 'node_modules/.bin/jscpd');
    const args = jscpdArgs(config, reportsDir);
    const result = spawnSync(bin, args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (result.stdout?.trim()) console.log(result.stdout.trim());
    if (result.stderr?.trim()) console.log(result.stderr.trim());

    const reportPath = resolve(reportsDir, REPORT_FILES.duplication[0]);
    if (!existsSync(reportPath)) {
      writeReport(reportsDir, REPORT_FILES.duplication[0], EMPTY_REPORT);
      console.log('jscpd: no report produced, wrote an empty one');
    }
  },
};
