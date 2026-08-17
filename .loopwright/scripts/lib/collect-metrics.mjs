/**
 * Reads everything the collectors left in reports/ and coverage/, runs the
 * static analysis, and flattens it all into one shape:
 *
 *   { metrics: { "coverage.lines": 98.4, ... }, analysis, evidence }
 *
 * `evidence` is the drill-down an agent needs to act: which test failed, which
 * file is oversized, where the `@ts-ignore` is.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { analyzeSources } from './analyze-source.mjs';
import { REPORTS_DIR } from './paths.mjs';

function readJson(dir, relativePath) {
  const target = resolve(dir, relativePath);
  if (!existsSync(target)) return null;
  try {
    return JSON.parse(readFileSync(target, 'utf8'));
  } catch {
    return null;
  }
}

function walk(dir, extensions, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, extensions, out);
    } else if (extensions.includes(extname(full))) {
      out.push(full);
    }
  }
  return out;
}

function toPosix(path) {
  return path.split('\\').join('/');
}

/**
 * Matches a source-file path against one `sources.ignore` glob. Only the two
 * shapes the config actually uses are supported: a directory glob
 * (`**\/name/**`, matched as a `/name/` path segment anywhere) and a leading
 * `**\/` file-suffix glob (`**\/name.ext`, matched with `endsWith`).
 */
function ignoreMatches(file, pattern) {
  const path = toPosix(file);
  if (pattern.endsWith('/**')) {
    const dir = pattern.slice(0, -3).replace(/^\*\*\//, '');
    return path.includes(`/${dir}/`);
  }
  return path.endsWith(pattern.replace(/^\*\*\//, ''));
}

export function listSourceFiles(root, sources) {
  const files = [];
  for (const dir of sources.roots) {
    walk(resolve(root, dir), sources.extensions, files);
  }
  const patterns = sources.ignore ?? [];
  return files.filter((file) => !patterns.some((pattern) => ignoreMatches(file, pattern))).sort();
}

function pct(entry) {
  return typeof entry?.pct === 'number' ? Number(entry.pct.toFixed(2)) : null;
}

/**
 * Metric ids owned by each collector family. Used to translate a collector
 * name (from `unconfigured`/`failed`) into the metric ids that must inherit
 * its status when `quality-gate.mjs` evaluates the current run.
 */
export const COLLECTOR_METRICS = {
  typecheck: ['typecheck.errors'],
  lint: ['lint.errors', 'lint.warnings'],
  tests: ['tests.failed', 'tests.suitesFailed', 'coverage.lines', 'coverage.branches', 'coverage.functions', 'coverage.statements'],
  audit: ['audit.critical', 'audit.high', 'audit.suppressed'],
  duplication: ['duplication.percentage'],
};

/**
 * Each collector below reads one report and contributes to the shared bag.
 * They are deliberately independent: one collector's status never aborts the
 * whole run. `familyStatus` is the shared guard every family-scoped collector
 * runs through first:
 *
 *   - report missing (adapter never ran / report file absent) -> `failed`
 *   - `{ configured: false }` (dispatcher stamp for an unconfigured adapter)
 *     -> `unconfigured`
 *   - `{ ok: false, error }` (adapter's own tool-missing/parse-failure path)
 *     -> `failed`
 *   - otherwise the report is handed back for the collector to read
 *
 * `unconfigured` warns forever but never blocks; `failed` always blocks — an
 * infrastructure failure must not look like a passing run.
 */
function familyStatus(ctx, collector, relativePath, baseDir = REPORTS_DIR) {
  const report = readJson(baseDir, relativePath);
  if (report === null) {
    ctx.failed.push({ collector, error: `${relativePath} missing — collector did not run` });
    return null;
  }
  if (report.configured === false) {
    ctx.unconfigured.push(collector);
    return null;
  }
  if (report.ok === false && report.error) {
    ctx.failed.push({ collector, error: report.error });
    return null;
  }
  return report;
}

function collectTypecheck(ctx) {
  const report = familyStatus(ctx, 'typecheck', 'typecheck.json');
  if (!report) return;

  ctx.metrics['typecheck.errors'] = report.errorCount ?? 0;
  ctx.evidence['typecheck.errors'] = (report.diagnostics ?? [])
    .filter((entry) => entry.severity === 'error')
    .slice(0, 15)
    .map((entry) => ({ file: entry.file, line: entry.line, snippet: `${entry.code}: ${entry.message}` }));
}

function collectLint(ctx) {
  const report = familyStatus(ctx, 'lint', 'lint.json');
  if (!report) return;
  ctx.metrics['lint.errors'] = report.errors ?? 0;
  ctx.metrics['lint.warnings'] = report.warnings ?? 0;
  const toEvidence = (m) => ({ file: m.file, line: m.line ?? 0, snippet: `${m.rule ?? 'unknown'}: ${m.message}` });
  ctx.evidence['lint.errors'] = (report.messages ?? []).filter((m) => m.severity === 'error').slice(0, 15).map(toEvidence);
  ctx.evidence['lint.warnings'] = (report.messages ?? []).filter((m) => m.severity === 'warning').slice(0, 15).map(toEvidence);
}

function collectTests(ctx) {
  const report = familyStatus(ctx, 'tests', 'test-summary.json');
  if (!report) return;
  if (!report.ranSuccessfully) {
    ctx.failed.push({ collector: 'tests', error: 'test-results.json missing — test runner produced no JSON' });
    return;
  }

  ctx.metrics['tests.failed'] = report.failed ?? 0;
  ctx.metrics['tests.suitesFailed'] = report.suitesFailed ?? 0;
  ctx.evidence['tests.failed'] = (report.failures ?? []).slice(0, 10).map((failure) => ({
    file: failure.file,
    line: 0,
    snippet: `${failure.title} — ${failure.message.split('\n')[0] ?? ''}`,
  }));
}

/**
 * Coverage is produced by the same `vitest --coverage` run as `tests`, so it
 * rides on the `tests` collector's status rather than having its own: it only
 * runs once `tests` is confirmed neither unconfigured nor failed, and a
 * missing coverage-summary.json while tests ran is recorded as a `tests`
 * failure (not a separate "coverage" collector) — see `COLLECTOR_METRICS`.
 */
function collectCoverage(ctx) {
  const report = readJson(resolve(REPORTS_DIR, 'coverage'), 'coverage-summary.json');
  if (!report?.total) {
    ctx.failed.push({ collector: 'tests', error: 'coverage/coverage-summary.json missing — collector did not run' });
    return;
  }

  for (const key of ['lines', 'branches', 'functions', 'statements']) {
    const value = pct(report.total[key]);
    if (value !== null) ctx.metrics[`coverage.${key}`] = value;
  }

  ctx.evidence['coverage.lines'] = Object.entries(report)
    .filter(([file]) => file !== 'total')
    .map(([file, data]) => ({ file: toPosix(relative(ctx.root, file)), value: pct(data.lines) ?? 100 }))
    .filter((entry) => entry.value < 100)
    .sort((a, b) => a.value - b.value)
    .slice(0, 10)
    .map((entry) => ({ file: entry.file, line: 0, snippet: `${entry.value}% line coverage` }));
}

/**
 * `npm audit` reports one entry per vulnerable package, with the advisories
 * behind it in `via`. Flatten it into something the ignore rules can match on.
 */
function auditEntries(report) {
  return Object.entries(report?.vulnerabilities ?? {}).map(([name, data]) => ({
    name,
    severity: data.severity,
    fixAvailable: Boolean(data.fixAvailable),
    advisories: (data.via ?? [])
      .filter((via) => typeof via === 'object')
      .map((via) => ({ id: String(via.source ?? ''), url: via.url ?? '', title: via.title ?? '' })),
  }));
}

function matchesRule(entry, rule) {
  if (rule.package && rule.package === entry.name) return true;
  if (!rule.advisory) return false;
  const needle = String(rule.advisory);
  return entry.advisories.some((advisory) => advisory.id === needle || advisory.url.includes(needle));
}

/**
 * A suppression must carry an expiry date, and an expired one stops
 * suppressing. That is the point: an advisory parked with "no fix upstream"
 * comes back as a blocker on a date somebody chose, instead of quietly
 * becoming permanent.
 */
function activeSuppression(entry, rules, now) {
  const rule = rules.find((candidate) => matchesRule(entry, candidate));
  if (!rule) return null;
  const expiry = Date.parse(rule.expires ?? '');
  if (Number.isNaN(expiry)) return { rule, expired: true, why: 'no valid `expires` date' };
  if (expiry < now) return { rule, expired: true, why: `suppression expired on ${rule.expires}` };
  return { rule, expired: false, why: `suppressed until ${rule.expires}` };
}

function collectAudit(ctx) {
  const report = familyStatus(ctx, 'audit', 'audit.json');
  if (!report) return;
  if (!report.metadata?.vulnerabilities) {
    ctx.failed.push({ collector: 'audit', error: 'audit.json missing metadata.vulnerabilities' });
    return;
  }

  const rules = ctx.config.audit?.ignore ?? [];
  const now = Date.now();
  const entries = auditEntries(report);

  const counted = [];
  const suppressed = [];
  for (const entry of entries) {
    const suppression = activeSuppression(entry, rules, now);
    if (suppression && !suppression.expired) {
      suppressed.push({ entry, suppression });
    } else {
      counted.push({ entry, suppression });
    }
  }

  for (const severity of ['critical', 'high']) {
    ctx.metrics[`audit.${severity}`] = counted.filter(({ entry }) => entry.severity === severity).length;
  }
  ctx.metrics['audit.suppressed'] = suppressed.length;

  const describe = ({ entry, suppression }) => ({
    file: entry.name,
    line: 0,
    snippet: [
      `${entry.severity}: ${entry.advisories[0]?.title ?? entry.name}`,
      entry.fixAvailable ? 'fix available — upgrade it' : 'no fix available upstream',
      suppression?.expired ? `(${suppression.why})` : '',
    ]
      .filter(Boolean)
      .join(' · '),
  });

  for (const severity of ['critical', 'high']) {
    ctx.evidence[`audit.${severity}`] = counted
      .filter(({ entry }) => entry.severity === severity)
      .slice(0, 10)
      .map(describe);
  }
  ctx.evidence['audit.suppressed'] = suppressed.slice(0, 10).map(({ entry, suppression }) => ({
    file: entry.name,
    line: 0,
    snippet: `${entry.severity} — ${suppression.why} — ${suppression.rule.reason ?? 'no reason given'}`,
  }));
}

function collectDuplication(ctx) {
  const report = familyStatus(ctx, 'duplication', 'jscpd/jscpd-report.json');
  if (!report) return;
  const total = report.statistics?.total;
  if (!total) {
    ctx.failed.push({ collector: 'duplication', error: 'jscpd report missing statistics.total' });
    return;
  }

  ctx.metrics['duplication.percentage'] = Number((total.percentage ?? 0).toFixed(2));
  ctx.evidence['duplication.percentage'] = (report.duplicates ?? []).slice(0, 10).map((clone) => ({
    file: clone.firstFile?.name ?? 'unknown',
    line: clone.firstFile?.start ?? 0,
    snippet: `${clone.lines ?? 0} lines duplicated in ${clone.secondFile?.name ?? 'unknown'}:${clone.secondFile?.start ?? 0}`,
  }));
}

const INTEGRITY_METRICS = {
  'integrity.skippedTests': 'skippedTests',
  'integrity.focusedTests': 'focusedTests',
  'integrity.assertionlessTests': 'assertionlessTests',
  'integrity.coverageIgnores': 'coverageIgnores',
  'integrity.typeSuppressions': 'typeSuppressions',
  'integrity.lintSuppressions': 'lintSuppressions',
  'integrity.emptyCatches': 'emptyCatches',
};

function collectStaticAnalysis(ctx, analysis) {
  ctx.metrics['complexity.max'] = analysis.totals.maxComplexity;
  ctx.metrics['complexity.average'] = analysis.totals.averageComplexity;
  ctx.evidence['complexity.max'] = [...analysis.functions]
    .sort((a, b) => b.complexity - a.complexity)
    .slice(0, 10)
    .map((fn) => ({ file: fn.file, line: fn.line, snippet: `${fn.name} — complexity ${fn.complexity}` }));

  const limit = ctx.config.limits.fileCodeLines.block;
  const oversized = analysis.files.filter((file) => file.codeLines > limit);
  ctx.metrics['size.oversizedFiles'] = oversized.length;
  ctx.evidence['size.oversizedFiles'] = [...oversized]
    .sort((a, b) => b.codeLines - a.codeLines)
    .slice(0, 10)
    .map((file) => ({ file: file.file, line: 0, snippet: `${file.codeLines} code lines (limit ${limit})` }));

  for (const [metricId, findingKey] of Object.entries(INTEGRITY_METRICS)) {
    const found = analysis.findings[findingKey] ?? [];
    ctx.metrics[metricId] = found.length;
    ctx.evidence[metricId] = found.slice(0, 10);
  }
}

export function collectMetrics(root, config) {
  const ctx = { root, config, metrics: {}, evidence: {}, unconfigured: [], failed: [] };

  collectTypecheck(ctx);
  collectLint(ctx);
  collectTests(ctx);
  const testsOk = !ctx.unconfigured.includes('tests') && !ctx.failed.some((entry) => entry.collector === 'tests');
  if (testsOk) collectCoverage(ctx);
  collectAudit(ctx);
  collectDuplication(ctx);

  const analysis = analyzeSources(listSourceFiles(root, config.sources), root);
  collectStaticAnalysis(ctx, analysis);

  return {
    metrics: ctx.metrics,
    evidence: ctx.evidence,
    analysis,
    unconfigured: ctx.unconfigured,
    failed: ctx.failed,
  };
}
