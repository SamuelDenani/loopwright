#!/usr/bin/env node
/**
 * Inspects a host repo (package.json + a handful of marker files/dirs) and
 * proposes a `sources`/`collectors` shape for config.json. `detectStack` is
 * pure-ish (reads fs, never writes); script mode merges the result over
 * config.default.json and writes CONFIG_PATH, refusing if it already exists
 * so a re-run never clobbers a reviewed config.
 *
 * Usage: node .loopwright/scripts/detect-stack.mjs
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { LOOPWRIGHT_DIR, HOST_ROOT, CONFIG_PATH } from './lib/paths.mjs';

const CANDIDATE_ROOTS = ['src', 'app', 'pages', 'lib', 'components', 'server', 'tests', '__tests__', 'test'];

function readDeps(hostRoot, notices) {
  const pkgPath = join(hostRoot, 'package.json');
  if (!existsSync(pkgPath)) {
    notices.push('package.json not found — all collectors left unconfigured');
    return null;
  }
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  return { ...pkg.dependencies, ...pkg.devDependencies };
}

function detectTypecheck(hostRoot, deps, notices) {
  if (deps && 'typescript' in deps && existsSync(join(hostRoot, 'tsconfig.json'))) {
    return { adapter: 'tsc' };
  }
  notices.push('typecheck: no typescript + tsconfig.json found — left unconfigured');
  return { adapter: 'unconfigured' };
}

function detectLint(hostRoot, deps, notices) {
  if (existsSync(join(hostRoot, 'biome.json')) || existsSync(join(hostRoot, 'biome.jsonc'))) {
    return { adapter: 'biome' };
  }
  const eslintConfigs = ['eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs', '.eslintrc', '.eslintrc.js',
    '.eslintrc.cjs', '.eslintrc.json', '.eslintrc.yml', '.eslintrc.yaml'];
  const hasEslintConfig = eslintConfigs.some((f) => existsSync(join(hostRoot, f)));
  if ((deps && 'eslint' in deps) || hasEslintConfig) {
    return { adapter: 'eslint' };
  }
  notices.push('lint: no biome or eslint config/deps found — left unconfigured');
  return { adapter: 'unconfigured' };
}

function detectTests(deps, notices) {
  if (deps && 'vitest' in deps) return { adapter: 'vitest' };
  if (deps && 'jest' in deps) return { adapter: 'jest' };
  notices.push('tests: no runner configured');
  return { adapter: 'unconfigured' };
}

function detectAudit(hostRoot, notices) {
  if (existsSync(join(hostRoot, 'package-lock.json'))) return { adapter: 'npm-audit' };
  if (existsSync(join(hostRoot, 'yarn.lock'))) {
    notices.push('audit: found yarn.lock, no npm-audit adapter for it — left unconfigured');
    return { adapter: 'unconfigured' };
  }
  if (existsSync(join(hostRoot, 'pnpm-lock.yaml'))) {
    notices.push('audit: found pnpm-lock.yaml, no npm-audit adapter for it — left unconfigured');
    return { adapter: 'unconfigured' };
  }
  notices.push('audit: no lockfile found — left unconfigured');
  return { adapter: 'unconfigured' };
}

function detectSources(hostRoot, deps, notices) {
  const roots = CANDIDATE_ROOTS.filter((d) => existsSync(join(hostRoot, d)));
  if (roots.length === 0) {
    notices.push('sources: no conventional source directory found — defaulting roots to ["src"]');
    roots.push('src');
  }
  const isTs = Boolean(deps && 'typescript' in deps);
  const extensions = isTs ? ['.ts', '.tsx'] : ['.js', '.jsx', '.mjs'];
  return { roots, extensions };
}

export function detectStack(hostRoot) {
  const notices = [];
  const deps = readDeps(hostRoot, notices);

  const collectors = {
    typecheck: detectTypecheck(hostRoot, deps, notices),
    lint: detectLint(hostRoot, deps, notices),
    tests: detectTests(deps, notices),
    audit: detectAudit(hostRoot, notices),
    duplication: { adapter: 'jscpd' },
  };

  const sources = detectSources(hostRoot, deps, notices);

  return { sources, collectors, notices };
}

function main() {
  if (existsSync(CONFIG_PATH)) {
    console.error(`refusing to overwrite existing ${CONFIG_PATH}`);
    process.exitCode = 2;
    return;
  }
  const defaultConfigPath = join(LOOPWRIGHT_DIR, 'config.default.json');
  const defaults = JSON.parse(readFileSync(defaultConfigPath, 'utf8'));
  const detected = detectStack(HOST_ROOT);
  const config = { ...defaults, sources: detected.sources, collectors: detected.collectors };

  for (const [name, entry] of Object.entries(detected.collectors)) {
    console.log(`${name}: ${entry.adapter}`);
  }
  for (const notice of detected.notices) {
    console.log(`notice: ${notice}`);
  }

  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  console.log('config.json written — review it, then record a baseline.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
