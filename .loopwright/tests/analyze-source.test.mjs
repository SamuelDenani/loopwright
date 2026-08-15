import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { analyzeSources } from '../scripts/lib/analyze-source.mjs';

const root = join(import.meta.dirname, 'fixtures', 'src-sample');
const files = ['widget.tsx', 'legacy.jsx', 'util.mjs'].map((f) => join(root, f));

describe('multi-extension analysis', () => {
  const analysis = analyzeSources(files, root);
  it('parses tsx/jsx/mjs without dropping functions', () => {
    expect(analysis.totals.fileCount).toBe(3);
    expect(analysis.totals.functionCount).toBeGreaterThanOrEqual(3);
  });
  it('finds jest-style skipped tests and empty catches in js files', () => {
    expect(analysis.findings.skippedTests).toHaveLength(1);
    expect(analysis.findings.emptyCatches).toHaveLength(1);
  });
});
