#!/usr/bin/env node
/**
 * Runs one quality collector and normalises its tool's output into reports/.
 *
 * Adapters ALWAYS exit 0, even when the underlying tool fails. That is
 * deliberate: `scripts/quality-gate.mjs` is the single blocking step, so a
 * failing test run still produces a report the gate (and the agent babysitting
 * the PR) can read instead of aborting the workflow halfway through.
 *
 * Which tool runs for which collector is config-driven (config.json's
 * `collectors` section names an adapter, plus an optional command/cwd
 * override); this file only dispatches to the adapter registry.
 *
 * Usage: node .loopwright/scripts/run-report.mjs <typecheck|lint|tests|audit|duplication|--all>
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { HOST_ROOT, REPORTS_DIR, CONFIG_PATH } from './lib/paths.mjs';
import { ADAPTERS } from './adapters/index.mjs';

export const REPORT_FILES = {
  typecheck: ['typecheck.json'],
  lint: ['lint.json'],
  tests: ['test-summary.json', 'test-results.json'],
  audit: ['audit.json'],
  duplication: ['jscpd/jscpd-report.json'],
};

export function runShell(command, cwd) {
  const result = spawnSync(command, { shell: true, cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return { status: result.status ?? 1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

export function writeReport(reportsDir, relativePath, payload) {
  const target = resolve(reportsDir, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`);
}

export function writeUnconfigured(collector, reportsDir) {
  for (const file of REPORT_FILES[collector]) writeReport(reportsDir, file, { configured: false });
}

export function resolveCollector(collectorName, entry, hostRoot) {
  const adapter = ADAPTERS[entry.adapter];
  if (!adapter) throw new Error(`unknown adapter "${entry.adapter}" for collector "${collectorName}"`);
  if (adapter.collector !== collectorName)
    throw new Error(`adapter "${entry.adapter}" serves "${adapter.collector}", not "${collectorName}"`);
  return { adapter, command: entry.command ?? adapter.defaultCommand, cwd: resolve(hostRoot, entry.cwd ?? '.') };
}

function main() {
  const target = process.argv[2];
  const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  const names = target === '--all' ? Object.keys(config.collectors) : [target];
  for (const name of names) {
    const entry = config.collectors[name];
    if (!entry) { console.error(`no collector "${name}" in config.json`); process.exitCode = 2; return; }
    if (entry.adapter === 'unconfigured') {
      writeUnconfigured(name, REPORTS_DIR);
      console.log(`${name}: unconfigured (skipped)`);
      continue;
    }
    const { adapter, command, cwd } = resolveCollector(name, entry, HOST_ROOT);
    adapter.collect({ command, cwd, hostRoot: HOST_ROOT, reportsDir: REPORTS_DIR, config });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
