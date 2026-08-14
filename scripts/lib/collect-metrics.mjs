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

function readJson(root, relativePath) {
  const target = resolve(root, relativePath);
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

export function listSourceFiles(root, sources) {
  const files = [];
  for (const dir of sources.roots) {
    walk(resolve(root, dir), sources.extensions, files);
  }
  const ignore = (sources.ignore ?? []).map((pattern) => pattern.replace('**/', ''));
  return files.filter((file) => !ignore.some((suffix) => toPosix(file).endsWith(suffix))).sort();
}

function pct(entry) {
  return typeof entry?.pct === 'number' ? Number(entry.pct.toFixed(2)) : null;
}

/**
 * Each collector below reads one report and contributes to the shared bag. They
 * are deliberately independent: a missing report degrades one metric family
 * instead of aborting the whole run.
 */

function collectTypecheck(ctx) {
  const report = readJson(ctx.root, 'reports/typecheck.json');
  if (!report) return ctx.missing.push('reports/typecheck.json');

  ctx.metrics['typecheck.errors'] = report.errorCount ?? 0;
  ctx.evidence['typecheck.errors'] = (report.diagnostics ?? [])
    .filter((entry) => entry.severity === 'error')
    .slice(0, 15)
    .map((entry) => ({ file: entry.file, line: entry.line, snippet: `${entry.code}: ${entry.message}` }));
}

function collectLint(ctx) {
  const report = readJson(ctx.root, 'reports/eslint.json');
  if (!report) return ctx.missing.push('reports/eslint.json');

  let errors = 0;
  let warnings = 0;
  const messages = [];
  for (const file of report) {
    errors += file.errorCount ?? 0;
    warnings += file.warningCount ?? 0;
    const path = toPosix(relative(ctx.root, file.filePath ?? ''));
    for (const message of file.messages ?? []) {
      messages.push({
        file: path,
        line: message.line ?? 0,
        severity: message.severity === 2 ? 'error' : 'warning',
        snippet: `${message.ruleId ?? 'unknown'}: ${message.message}`,
      });
    }
  }

  ctx.metrics['lint.errors'] = errors;
  ctx.metrics['lint.warnings'] = warnings;
  ctx.evidence['lint.errors'] = messages.filter((entry) => entry.severity === 'error').slice(0, 15);
  ctx.evidence['lint.warnings'] = messages.filter((entry) => entry.severity === 'warning').slice(0, 15);
}

function collectTests(ctx) {
  const report = readJson(ctx.root, 'reports/test-summary.json');
  if (!report) return ctx.missing.push('reports/test-summary.json');
  if (!report.ranSuccessfully) ctx.missing.push('reports/test-results.json (vitest produced no JSON)');

  ctx.metrics['tests.failed'] = report.failed ?? 0;
  ctx.metrics['tests.suitesFailed'] = report.suitesFailed ?? 0;
  ctx.evidence['tests.failed'] = (report.failures ?? []).slice(0, 10).map((failure) => ({
    file: failure.file,
    line: 0,
    snippet: `${failure.title} — ${failure.message.split('\n')[0] ?? ''}`,
  }));
}

function collectCoverage(ctx) {
  const report = readJson(ctx.root, 'coverage/coverage-summary.json');
  if (!report?.total) return ctx.missing.push('coverage/coverage-summary.json');

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
  const report = readJson(ctx.root, 'reports/audit.json');
  if (!report?.metadata?.vulnerabilities) return ctx.missing.push('reports/audit.json');

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
  const report = readJson(ctx.root, 'reports/jscpd/jscpd-report.json');
  const total = report?.statistics?.total;
  if (!total) return ctx.missing.push('reports/jscpd/jscpd-report.json');

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
  const ctx = { root, config, metrics: {}, evidence: {}, missing: [] };

  collectTypecheck(ctx);
  collectLint(ctx);
  collectTests(ctx);
  collectCoverage(ctx);
  collectAudit(ctx);
  collectDuplication(ctx);

  const analysis = analyzeSources(listSourceFiles(root, config.sources), root);
  collectStaticAnalysis(ctx, analysis);

  return { metrics: ctx.metrics, evidence: ctx.evidence, analysis, missing: ctx.missing };
}
