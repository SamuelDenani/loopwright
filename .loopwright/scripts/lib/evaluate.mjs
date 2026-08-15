/**
 * Turns raw metrics into a verdict.
 *
 * Two independent judgements are made and then merged:
 *
 *   1. metric ratchet — every configured metric is compared against the
 *      baseline (did this PR make it worse?) and against any absolute
 *      hardMin/hardMax (is it unacceptable regardless of history?)
 *
 *   2. shape limits   — per-file and per-function size/complexity limits, with
 *      grandfathering: code that already broke a limit when the baseline was
 *      taken is reported as debt, and only blocks if this PR made it worse.
 *      New files get no grandfathering at all.
 */

export const STATUS = {
  BLOCK: 'block',
  WARN: 'warn',
  PASS: 'pass',
  IMPROVED: 'improved',
  NEW: 'new',
};

const RANK = { block: 3, warn: 2, new: 1, improved: 1, pass: 0 };

export function worstStatus(statuses) {
  return statuses.reduce((worst, status) => (RANK[status] > RANK[worst] ? status : worst), STATUS.PASS);
}

function isWorse(direction, current, baseline, tolerance) {
  return direction === 'lower-better'
    ? current > baseline + tolerance
    : current < baseline - tolerance;
}

function isBetter(direction, current, baseline) {
  return direction === 'lower-better' ? current < baseline : current > baseline;
}

/**
 * Absolute limits win over the ratchet: a hard floor is a hard floor even if
 * the baseline happened to be recorded below it.
 */
function checkHardLimits(policy, current, unit) {
  if (policy.hardMax !== undefined && current > policy.hardMax) {
    return {
      status: STATUS.BLOCK,
      reason: `${format(current, unit)} exceeds the hard limit of ${format(policy.hardMax, unit)}`,
    };
  }
  if (policy.hardMin !== undefined && current < policy.hardMin) {
    return {
      status: STATUS.BLOCK,
      reason: `${format(current, unit)} is below the hard floor of ${format(policy.hardMin, unit)}`,
    };
  }
  return null;
}

function checkRatchet(policy, current, baseline, unit) {
  const direction = policy.direction ?? 'lower-better';
  const tolerance = policy.tolerance ?? 0;

  // The baseline and current values already have their own report columns;
  // the reason only carries what they don't show — the delta and the margin.
  const drift = Math.abs(current - baseline);
  if (isWorse(direction, current, baseline, tolerance)) {
    return {
      status: policy.onRegression === 'warn' ? STATUS.WARN : STATUS.BLOCK,
      reason: `regressed ${format(drift, unit)} (tolerance ${format(tolerance, unit)})`,
    };
  }
  if (isBetter(direction, current, baseline)) {
    return {
      status: STATUS.IMPROVED,
      reason: `improved ${format(drift, unit)}`,
    };
  }
  return {
    status: STATUS.PASS,
    reason: drift === 0 ? 'holding' : `within tolerance (${format(drift, unit)} off baseline)`,
  };
}

const EMPTY_CONTEXT = { unconfiguredMetricIds: new Set(), failedByMetricId: new Map() };

function evaluateMetric(id, policy, current, baseline, context = EMPTY_CONTEXT) {
  const unit = policy.unit ?? '';
  const base = {
    id,
    label: policy.label ?? id,
    unit,
    current: current ?? null,
    baseline: baseline ?? null,
    direction: policy.direction ?? 'lower-better',
    tolerance: policy.tolerance ?? 0,
  };

  // These two checks fire before anything else — including the hard-limit
  // check below — so an unconfigured collector never phantom-blocks on a
  // hardMin/hardMax (a repo with no test runner yet must not be blocked by
  // `coverage.lines` hardMin: 80), and a collector that failed to run always
  // blocks instead of silently reading as "no data, just a warning".
  if (context.unconfiguredMetricIds.has(id)) {
    return {
      ...base,
      current: null,
      status: STATUS.WARN,
      reason: 'collector not configured — see docs/loopwright/quality-gate.md',
    };
  }
  if (context.failedByMetricId.has(id)) {
    return { ...base, status: STATUS.BLOCK, reason: `collector failed: ${context.failedByMetricId.get(id)}` };
  }

  if (current === undefined || current === null) {
    return { ...base, status: STATUS.WARN, reason: 'no data collected for this metric' };
  }

  const hardLimit = checkHardLimits(policy, current, unit);
  if (hardLimit) return { ...base, ...hardLimit };

  if (baseline === undefined || baseline === null) {
    return { ...base, status: STATUS.NEW, reason: 'no baseline recorded yet' };
  }

  return { ...base, ...checkRatchet(policy, current, baseline, unit) };
}

export function format(value, unit) {
  if (value === null || value === undefined) return 'n/a';
  if (typeof value !== 'number') return String(value);
  const rounded = Number.isInteger(value) ? String(value) : value.toFixed(2);
  return unit ? `${rounded}${unit}` : rounded;
}

export function evaluateMetrics(config, current, baselineMetrics, context = EMPTY_CONTEXT) {
  return Object.entries(config.metrics).map(([id, policy]) =>
    evaluateMetric(id, policy, current[id], baselineMetrics?.[id], context),
  );
}

/**
 * The anti-cheat rule: a collector that RAN at baseline time (its adapter
 * wasn't `'unconfigured'`) and is now unconfigured is not "no data" — it is
 * evidence someone turned the tool off to pass the gate. That is a synthetic
 * blocking violation, independent of the per-metric WARN a now-unconfigured
 * collector otherwise produces.
 */
export function collectorRegressions(baselineCollectors, unconfigured) {
  if (!baselineCollectors) return [];
  const nowUnconfigured = new Set(unconfigured ?? []);
  const violations = [];
  for (const [name, adapter] of Object.entries(baselineCollectors)) {
    if (adapter === 'unconfigured') continue;
    if (!nowUnconfigured.has(name)) continue;
    violations.push({
      status: STATUS.BLOCK,
      file: '.loopwright/config.json',
      line: 0,
      subject: name,
      reason: `collector "${name}" was configured at baseline ("${adapter}") but is now unconfigured — disabling a tool is not a way to pass the gate`,
    });
  }
  return violations;
}

// --- shape limits ------------------------------------------------------------

/** The per-file dimensions that carry a baseline value for grandfathering. */
const FILE_DIMENSIONS = [
  { key: 'codeLines', limit: 'fileCodeLines', label: 'file length', unit: ' code lines' },
];

const FUNCTION_DIMENSIONS = [
  { key: 'loc', limit: 'functionLines', label: 'function length', unit: ' lines' },
  { key: 'complexity', limit: 'complexity', label: 'cyclomatic complexity', unit: '' },
  { key: 'maxDepth', limit: 'maxDepth', label: 'nesting depth', unit: '' },
  { key: 'params', limit: 'params', label: 'parameter count', unit: '' },
];

/**
 * A violation blocks when the code is new or got worse, and only warns when it
 * is pre-existing debt that this change did not aggravate.
 */
function classifyViolation(value, limit, baselineValue) {
  if (value <= limit.warn) return null;

  const overBlock = value > limit.block;
  const isNew = baselineValue === undefined || baselineValue === null;
  const gotWorse = !isNew && value > baselineValue;

  if (overBlock) {
    if (isNew) return { status: STATUS.BLOCK, why: 'new code over the hard limit' };
    if (gotWorse) return { status: STATUS.BLOCK, why: `worse than the baseline (${baselineValue})` };
    return { status: STATUS.WARN, why: 'pre-existing debt, not aggravated by this change' };
  }

  if (isNew || gotWorse) return { status: STATUS.WARN, why: isNew ? 'new code over the soft limit' : `worse than the baseline (${baselineValue})` };
  return null;
}

function collectViolations(config, dimensions, target, baselineEntry, location) {
  const violations = [];
  for (const dimension of dimensions) {
    const limit = config.limits[dimension.limit];
    const value = target[dimension.key];
    const verdict = classifyViolation(value, limit, baselineEntry?.[dimension.key]);
    if (!verdict) continue;

    violations.push({
      status: verdict.status,
      ...location,
      dimension: dimension.label,
      value,
      limit: limit.block,
      softLimit: limit.warn,
      baseline: baselineEntry?.[dimension.key] ?? null,
      reason: `${dimension.label} is ${value}${dimension.unit} (soft ${limit.warn}, hard ${limit.block}) — ${verdict.why}`,
    });
  }
  return violations;
}

export function evaluateShape(config, analysis, baselineFiles = {}) {
  const violations = [];

  for (const file of analysis.files) {
    violations.push(
      ...collectViolations(config, FILE_DIMENSIONS, file, baselineFiles[file.file], {
        file: file.file,
        line: 0,
        subject: file.file,
      }),
    );
  }

  // Functions are keyed by file plus name so a rename reads as new code, which
  // is the conservative reading: a rewritten function should meet the limits.
  for (const fn of analysis.functions) {
    violations.push(
      ...collectViolations(config, FUNCTION_DIMENSIONS, fn, baselineFiles[fn.file]?.functions?.[fn.name], {
        file: fn.file,
        line: fn.line,
        subject: `${fn.file}:${fn.line} ${fn.name}()`,
      }),
    );
  }

  const order = { block: 0, warn: 1 };
  violations.sort((a, b) => order[a.status] - order[b.status] || b.value - a.value);
  return violations;
}

/** The per-file snapshot stored in the baseline, used for grandfathering. */
export function snapshotFiles(analysis) {
  const files = {};
  for (const file of analysis.files) {
    files[file.file] = { codeLines: file.codeLines, functions: {} };
  }
  for (const fn of analysis.functions) {
    const entry = files[fn.file];
    if (!entry) continue;
    const existing = entry.functions[fn.name];
    // Overloads and same-named callbacks collapse onto the worst case.
    entry.functions[fn.name] = {
      loc: Math.max(existing?.loc ?? 0, fn.loc),
      complexity: Math.max(existing?.complexity ?? 0, fn.complexity),
      maxDepth: Math.max(existing?.maxDepth ?? 0, fn.maxDepth),
      params: Math.max(existing?.params ?? 0, fn.params),
    };
  }
  return files;
}
