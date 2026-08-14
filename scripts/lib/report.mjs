/**
 * Renders the gate verdict as Markdown, for both the PR sticky comment and the
 * GitHub step summary.
 *
 * The audience is an agent babysitting the PR, so the shape is deliberate:
 * blockers first, with file:line evidence and a concrete instruction for each,
 * and everything non-actionable folded into <details>.
 */
import { STATUS, format } from './evaluate.mjs';

export const COMMENT_MARKER = '<!-- quality-gate-report -->';

const ICON = {
  [STATUS.BLOCK]: '🚫',
  [STATUS.WARN]: '⚠️',
  [STATUS.PASS]: '✅',
  [STATUS.IMPROVED]: '📈',
  [STATUS.NEW]: '🆕',
};

/** What to actually do about each family of failure. */
const REMEDIATION = {
  'tests.': 'Fix the failing test or the code under it. Do not delete, skip or weaken the assertion.',
  'typecheck.': 'Fix the type error properly. `any`, `as unknown as` and `@ts-ignore` are themselves gated.',
  'lint.': 'Fix the reported rule violations. Inline `eslint-disable` is itself gated.',
  'audit.suppressed':
    'A suppression in `quality-gate.config.json` is holding this back. Re-check whether a fix has shipped and remove the entry.',
  'audit.':
    'Upgrade the offending dependency, or replace it. There is no prod/dev exemption — this PR has to be deployable. If there is genuinely no fix upstream, add an entry with an `expires` date to `audit.ignore` in `quality-gate.config.json` and say why in the PR.',
  'coverage.': 'Add real tests covering the uncovered lines listed below. Do not add coverage-ignore hints.',
  'duplication.': 'Extract the duplicated block into a shared function or module.',
  'complexity.': 'Split the function: extract branches into named helpers, or replace the conditional chain with a lookup.',
  'size.': 'Split the file along its natural seams into smaller modules.',
  'integrity.skippedTests': 'Un-skip the test and make it pass. A skipped test is an untested behaviour.',
  'integrity.focusedTests': 'Remove `.only` — it silently disables every other test in the file.',
  'integrity.assertionlessTests': 'Give the test a real assertion, or delete it. A test that asserts nothing always passes.',
  'integrity.coverageIgnores': 'Remove the coverage-ignore hint and cover the code with a test instead.',
  'integrity.typeSuppressions': 'Remove the suppression and fix the underlying type error.',
  'integrity.lintSuppressions': 'Remove the inline disable and fix the rule violation.',
  'integrity.emptyCatches': 'Handle or rethrow the error. An empty catch turns a failure into silent corruption.',
};

function remediationFor(metricId) {
  const exact = REMEDIATION[metricId];
  if (exact) return exact;
  const prefix = Object.keys(REMEDIATION).find((key) => metricId.startsWith(key));
  return prefix ? REMEDIATION[prefix] : 'Bring the metric back to at least its baseline value.';
}

function escapeCell(value) {
  return String(value).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function metricRows(entries) {
  const lines = ['| | Check | Baseline | Now | Verdict |', '|---|---|---|---|---|'];
  for (const entry of entries) {
    lines.push(
      `| ${ICON[entry.status]} | ${escapeCell(entry.label)} | ${entry.baseline === null ? '—' : escapeCell(format(entry.baseline, entry.unit))} | ${escapeCell(format(entry.current, entry.unit))} | ${escapeCell(entry.reason)} |`,
    );
  }
  return lines.join('\n');
}

function evidenceBlock(entries, evidence) {
  const chunks = [];
  for (const entry of entries) {
    const items = evidence[entry.id] ?? [];
    if (items.length === 0) continue;
    const rendered = items
      .map((item) => `- \`${item.file}${item.line ? `:${item.line}` : ''}\` — ${escapeCell(item.snippet)}`)
      .join('\n');
    chunks.push(`**${entry.label}**\n${rendered}`);
  }
  return chunks.join('\n\n');
}

function violationList(violations) {
  return violations
    .map((violation) => `- ${ICON[violation.status]} \`${violation.subject}\` — ${escapeCell(violation.reason)}`)
    .join('\n');
}

function actionPlan(blockingMetrics, blockingViolations) {
  const steps = [];
  for (const entry of blockingMetrics) {
    steps.push(`**${entry.label}** (${format(entry.current, entry.unit)}) — ${remediationFor(entry.id)}`);
  }
  if (blockingViolations.length > 0) {
    // One function usually breaks several dimensions at once; name it once.
    const unique = [...new Set(blockingViolations.map((violation) => violation.subject))];
    const shown = unique.slice(0, 5).map((subject) => `\`${subject}\``).join(', ');
    const rest = unique.length > 5 ? ` and ${unique.length - 5} more` : '';
    steps.push(`**Shape limits** — ${shown}${rest}. ${REMEDIATION['complexity.']}`);
  }
  return steps.map((step, index) => `${index + 1}. ${step}`).join('\n');
}

function headerSection(result, groups) {
  const { context, missing } = result;
  const blockerCount = groups.blockingMetrics.length + groups.blockingViolations.length;
  const warningCount = groups.warningMetrics.length + groups.warningViolations.length;

  const heading =
    result.verdict === 'pass'
      ? '## ✅ Quality gate passed'
      : `## ❌ Quality gate failed — ${blockerCount} blocker(s)`;

  const summary = [
    `commit \`${context.commit.slice(0, 7)}\``,
    context.baselineCommit ? `baseline \`${context.baselineCommit.slice(0, 7)}\`` : 'no baseline',
    `${warningCount} warning(s)`,
  ];
  if (groups.improvedMetrics.length > 0) summary.push(`${groups.improvedMetrics.length} improvement(s) 📈`);

  const out = [COMMENT_MARKER, heading, '', summary.join(' · '), ''];
  if (missing.length > 0) {
    out.push(
      `> ⚠️ Missing input: ${missing.map((entry) => `\`${entry}\``).join(', ')}. Run \`npm run quality:collect\` before the gate.`,
      '',
    );
  }
  return out;
}

function blockerSection(groups, evidence) {
  const { blockingMetrics, blockingViolations } = groups;
  if (blockingMetrics.length === 0 && blockingViolations.length === 0) return [];

  const out = ['### 🚫 Blockers', ''];
  if (blockingMetrics.length > 0) out.push(metricRows(blockingMetrics), '');
  if (blockingViolations.length > 0) out.push(violationList(blockingViolations), '');
  out.push('### 🛠️ What to do', '', actionPlan(blockingMetrics, blockingViolations), '');

  const details = evidenceBlock(blockingMetrics, evidence);
  if (details) out.push('<details><summary>Evidence (file:line)</summary>', '', details, '', '</details>', '');
  return out;
}

function warningSection(groups, evidence) {
  const { warningMetrics, warningViolations } = groups;
  const count = warningMetrics.length + warningViolations.length;
  if (count === 0) return [];

  const out = [`<details><summary>⚠️ ${count} warning(s) — not blocking</summary>`, ''];
  if (warningMetrics.length > 0) out.push(metricRows(warningMetrics), '');
  if (warningViolations.length > 0) out.push(violationList(warningViolations), '');

  const details = evidenceBlock(warningMetrics, evidence);
  if (details) out.push(details, '');
  out.push('</details>', '');
  return out;
}

function groupResults(result) {
  const byStatus = (collection, status) => collection.filter((entry) => entry.status === status);
  return {
    blockingMetrics: byStatus(result.metrics, STATUS.BLOCK),
    warningMetrics: byStatus(result.metrics, STATUS.WARN),
    improvedMetrics: byStatus(result.metrics, STATUS.IMPROVED),
    blockingViolations: byStatus(result.violations, STATUS.BLOCK),
    warningViolations: byStatus(result.violations, STATUS.WARN),
  };
}

export function renderMarkdown(result) {
  const groups = groupResults(result);

  const out = [
    ...headerSection(result, groups),
    ...blockerSection(groups, result.evidence),
    ...warningSection(groups, result.evidence),
    '<details><summary>📊 All metrics</summary>',
    '',
    metricRows(result.metrics),
    '',
    '</details>',
    '',
  ];

  if (result.verdict === 'pass' && groups.improvedMetrics.length > 0) {
    out.push(
      `> 📈 This PR improves ${groups.improvedMetrics.length} metric(s). Run \`npm run quality:baseline\` and commit \`quality-baseline.json\` to lock the gain in.`,
      '',
    );
  }

  out.push(
    '---',
    '<sub>Generated by `scripts/quality-gate.mjs` · reproduce locally with `npm run quality` · full reports are in the workflow artifacts.</sub>',
  );

  return out.join('\n');
}

export function renderConsole(result) {
  const lines = [];
  const symbol = { block: 'BLOCK', warn: ' WARN', pass: ' pass', improved: ' impr', new: '  new' };
  for (const entry of result.metrics) {
    lines.push(`[${symbol[entry.status]}] ${entry.label.padEnd(38)} ${format(entry.current, entry.unit).padStart(8)}  ${entry.reason}`);
  }
  for (const violation of result.violations) {
    lines.push(`[${symbol[violation.status]}] ${violation.subject} — ${violation.reason}`);
  }
  return lines.join('\n');
}
