import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ADAPTERS } from '../scripts/adapters/index.mjs';
import { REPORT_FILES, writeUnconfigured, resolveCollector } from '../scripts/run-report.mjs';

describe('adapter registry', () => {
  it('covers the collector set from the spec', () => {
    expect(Object.keys(ADAPTERS).sort()).toEqual(['biome', 'eslint', 'jest', 'jscpd', 'npm-audit', 'tsc', 'vitest']);
  });
  it('every adapter declares its collector slot and default command', () => {
    for (const adapter of Object.values(ADAPTERS)) {
      expect(['typecheck', 'lint', 'tests', 'audit', 'duplication']).toContain(adapter.collector);
      expect(typeof adapter.defaultCommand).toBe('string');
      expect(typeof adapter.collect).toBe('function');
    }
  });
});

describe('resolveCollector', () => {
  it('config command and cwd override the adapter defaults', () => {
    const resolved = resolveCollector('tests', { adapter: 'vitest', command: 'npx vitest run', cwd: '.loopwright' }, '/host');
    expect(resolved.adapter.name).toBe('vitest');
    expect(resolved.command).toBe('npx vitest run');
    expect(resolved.cwd).toBe(join('/host', '.loopwright'));
  });
  it('falls back to the adapter default command and cwd "." when the config entry gives none', () => {
    const resolved = resolveCollector('tests', { adapter: 'vitest' }, '/host');
    expect(resolved.command).toBe(resolved.adapter.defaultCommand);
    expect(resolved.cwd).toBe(resolve('/host'));
  });

  it('unknown adapter names are an explicit error', () => {
    expect(() => resolveCollector('lint', { adapter: 'nope' }, '/host')).toThrow(/unknown adapter/);
  });
});

describe('writeUnconfigured', () => {
  it('stamps {configured:false} on every report file of the collector', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lw-'));
    writeUnconfigured('tests', dir);
    for (const file of REPORT_FILES.tests) {
      expect(JSON.parse(readFileSync(join(dir, file), 'utf8'))).toEqual({ configured: false });
    }
  });
});
