import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectStack } from '../scripts/detect-stack.mjs';

function host(pkg, files = [], dirs = []) {
  const dir = mkdtempSync(join(tmpdir(), 'lw-host-'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg));
  for (const d of dirs) mkdirSync(join(dir, d), { recursive: true });
  for (const f of files) writeFileSync(join(dir, f), '{}');
  return dir;
}

describe('detectStack', () => {
  it('reads a create-next-app repo: eslint + tsc, no test runner', () => {
    const dir = host(
      { dependencies: { next: '15.0.0', react: '19.0.0' }, devDependencies: { typescript: '^5', eslint: '^9', 'eslint-config-next': '15.0.0' } },
      ['tsconfig.json', 'package-lock.json'], ['app'],
    );
    const result = detectStack(dir);
    expect(result.collectors.typecheck.adapter).toBe('tsc');
    expect(result.collectors.lint.adapter).toBe('eslint');
    expect(result.collectors.tests.adapter).toBe('unconfigured');
    expect(result.collectors.audit.adapter).toBe('npm-audit');
    expect(result.sources).toEqual({ roots: ['app'], extensions: ['.ts', '.tsx'] });
    expect(result.notices.join(' ')).toMatch(/no runner/);
  });

  it('prefers biome config over eslint deps, detects jest', () => {
    const dir = host({ devDependencies: { jest: '^29', eslint: '^9' } }, ['biome.json', 'package-lock.json'], ['src']);
    const result = detectStack(dir);
    expect(result.collectors.lint.adapter).toBe('biome');
    expect(result.collectors.tests.adapter).toBe('jest');
    expect(result.sources.extensions).toEqual(['.js', '.jsx', '.mjs']);
  });

  it('degrades to unconfigured everywhere on a bare repo', () => {
    const dir = host({}, [], []);
    const result = detectStack(dir);
    for (const name of ['typecheck', 'lint', 'tests', 'audit']) {
      expect(result.collectors[name].adapter).toBe('unconfigured');
    }
    expect(result.collectors.duplication.adapter).toBe('jscpd');
  });

  it('does not mistake a plain file named "src" for a source directory', () => {
    const dir = host({}, ['src'], []);
    const result = detectStack(dir);
    expect(result.sources.roots).toEqual(['src']);
    expect(result.notices.join(' ')).toMatch(/no conventional source directory/);
  });

  it('leaves audit unconfigured for a yarn.lock repo — no adapter covers it', () => {
    const dir = host({}, ['yarn.lock'], ['src']);
    const result = detectStack(dir);
    expect(result.collectors.audit.adapter).toBe('unconfigured');
    expect(result.notices.join(' ')).toMatch(/found yarn\.lock/);
  });

  it('leaves audit unconfigured for a pnpm-lock.yaml repo — no adapter covers it', () => {
    const dir = host({}, ['pnpm-lock.yaml'], ['src']);
    const result = detectStack(dir);
    expect(result.collectors.audit.adapter).toBe('unconfigured');
    expect(result.notices.join(' ')).toMatch(/found pnpm-lock\.yaml/);
  });

  it('detects an eslint config file even with no eslint dependency listed', () => {
    const dir = host({}, ['eslint.config.js'], ['src']);
    const result = detectStack(dir);
    expect(result.collectors.lint.adapter).toBe('eslint');
  });

  it('leaves typecheck unconfigured for a typescript dependency with no tsconfig.json', () => {
    const dir = host({ devDependencies: { typescript: '^5' } }, [], ['src']);
    const result = detectStack(dir);
    expect(result.collectors.typecheck.adapter).toBe('unconfigured');
    expect(result.notices.join(' ')).toMatch(/no typescript \+ tsconfig\.json/);
  });
});
