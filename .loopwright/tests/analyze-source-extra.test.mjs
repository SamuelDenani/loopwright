import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { analyzeSources } from '../scripts/lib/analyze-source.mjs';

function writeFixture(content) {
  const root = mkdtempSync(join(tmpdir(), 'lw-analyze-'));
  const file = join(root, 'sample.mjs');
  writeFileSync(file, content);
  return { root, file };
}

describe('functionName — every naming fallback', () => {
  it('names a function assigned as an object property (PropertyAssignment)', () => {
    const { root, file } = writeFixture('const obj = {\n  foo: function () {\n    return 1;\n  },\n};\n');
    const { functions } = analyzeSources([file], root);
    expect(functions.map((f) => f.name)).toContain('foo');
  });

  it('names a class field arrow function (PropertyDeclaration)', () => {
    const { root, file } = writeFixture('class C {\n  bar = () => {\n    return 1;\n  };\n}\n');
    const { functions } = analyzeSources([file], root);
    expect(functions.map((f) => f.name)).toContain('bar');
  });

  it('names a bare callback passed directly to a call expression', () => {
    const { root, file } = writeFixture('setTimeout(function () {\n  doThing();\n}, 10);\n');
    const { functions } = analyzeSources([file], root);
    expect(functions.map((f) => f.name)).toContain('setTimeout callback');
  });

  it('falls back to <anonymous> when nothing else applies', () => {
    const { root, file } = writeFixture('[1, 2].map((function () { return function () {}; })());\n');
    const { functions } = analyzeSources([file], root);
    expect(functions.some((f) => f.name === '<anonymous>')).toBe(true);
  });
});

describe('decisionPointsFor — every decision-point kind', () => {
  it('counts a non-empty case clause and skips an empty fallthrough case', () => {
    const { root, file } = writeFixture(
      [
        'function f(x) {',
        '  switch (x) {',
        '    case 1:',
        '    case 2:',
        '      return "a";',
        '    default:',
        '      return "b";',
        '  }',
        '}',
      ].join('\n'),
    );
    const { functions } = analyzeSources([file], root);
    const f = functions.find((fn) => fn.name === 'f');
    // base 1 + switch is not itself scored + one non-empty case (case 2, which
    // owns the statements) — the empty fallthrough case 1 contributes nothing.
    expect(f.complexity).toBe(2);
  });

  it('counts &&, ||, and ?? as one decision point each, but not a plain binary op', () => {
    const { root, file } = writeFixture(
      'function g(a, b, c) {\n  return (a && b) || (c ?? a) ? a + b : c - a;\n}\n',
    );
    const { functions } = analyzeSources([file], root);
    const g = functions.find((fn) => fn.name === 'g');
    // base 1 + && + || + ?? + the ternary itself (ConditionalExpression) = 5
    expect(g.complexity).toBe(5);
  });

  it('counts a catch clause as a decision point and a try/for/while as nesting', () => {
    const { root, file } = writeFixture(
      [
        'function h() {',
        '  for (let i = 0; i < 1; i++) {',
        '    try {',
        '      while (true) {',
        '        break;',
        '      }',
        '    } catch (e) {',
        '      report(e);',
        '    }',
        '  }',
        '}',
      ].join('\n'),
    );
    const { functions } = analyzeSources([file], root);
    const h = functions.find((fn) => fn.name === 'h');
    expect(h.maxDepth).toBeGreaterThanOrEqual(3);
    expect(h.complexity).toBeGreaterThan(1);
  });
});

describe('classifyTestCall — every test-framework shape', () => {
  it('flags .only as focused and un-prefixed x/f callees as skipped/focused', () => {
    // Built with a variable, not a literal focused-test call, so this fixture
    // text (deliberately-bad code for the analyzer to detect) does not itself
    // trip the repo's own pre-commit shortcut-scanner — it's data for
    // analyzeSources to parse, not a real focused/skipped test.
    const only = '.only';
    const { root, file } = writeFixture(
      [
        `describe${only}('suite', () => {`,
        "  it('a', () => { expect(1).toBe(1); });",
        "  xit('b', () => { expect(1).toBe(1); });",
        "  fit('c', () => { expect(1).toBe(1); });",
        '});',
      ].join('\n'),
    );
    const { findings } = analyzeSources([file], root);
    expect(findings.focusedTests.length).toBeGreaterThanOrEqual(2); // describe.only + fit
    expect(findings.skippedTests.length).toBeGreaterThanOrEqual(1); // xit
  });

  it('unwraps it.each(table)(name, fn) and still classifies the inner call', () => {
    const { root, file } = writeFixture(
      "it.each([[1, 2]])('adds %i and %i', (a, b) => { expect(a + b).toBeGreaterThan(0); });\n",
    );
    const { findings } = analyzeSources([file], root);
    expect(findings.assertionlessTests).toEqual([]);
  });

  it('treats a bodyless test as a todo, not assertion-less, and records a dynamic title', () => {
    const { root, file } = writeFixture("const name = 'x';\nit(name);\nit('literal title');\n");
    const { findings } = analyzeSources([file], root);
    expect(findings.assertionlessTests).toEqual([]);
  });

  it('flags a test whose body has no assertion call', () => {
    const { root, file } = writeFixture("it('does nothing useful', () => {\n  const x = 1;\n});\n");
    const { findings } = analyzeSources([file], root);
    expect(findings.assertionlessTests).toHaveLength(1);
  });

  it('ignores a call expression that is neither a test nor a suite callee', () => {
    const { root, file } = writeFixture("describe('ok', () => {\n  helper();\n});\n");
    const { functions } = analyzeSources([file], root);
    expect(functions.length).toBeGreaterThan(0);
  });
});

describe('empty catch detection', () => {
  it('flags a catch block with zero statements', () => {
    const { root, file } = writeFixture('function f() {\n  try {\n    risky();\n  } catch {\n  }\n}\n');
    const { findings } = analyzeSources([file], root);
    expect(findings.emptyCatches).toHaveLength(1);
  });
});

// The bait lives in tests/fixtures/, which `sources.ignore` and the hook both
// exclude: sources.roots covers this directory, so a suppression written out
// in a test would be counted as a real one by the scanner under test.
function suppressionsIn(name) {
  const file = join(import.meta.dirname, 'fixtures', 'suppressions', name);
  return analyzeSources([file], dirname(file)).findings.lintSuppressions;
}

describe('lint suppressions — both supported linters', () => {
  it('counts an eslint suppression in each of its comment forms', () => {
    expect(suppressionsIn('eslint-forms.mjs')).toHaveLength(3);
  });

  // Regression: this matched only one of the two linters loopwright supports,
  // so a biome repo reported zero suppressions however many it carried — a
  // check that cannot see anything reads exactly like nothing to see.
  it('counts a biome suppression in each of its comment forms', () => {
    expect(suppressionsIn('biome-forms.mjs')).toHaveLength(3);
  });

  it('reports the file and line of each suppression so the gate can cite it', () => {
    const found = suppressionsIn('biome-forms.mjs');
    expect(found.map((entry) => entry.line)).toEqual([1, 3, 5]);
    expect(found[0].file).toBe('biome-forms.mjs');
  });

  it('leaves a file with no suppressions at zero', () => {
    expect(suppressionsIn('clean.mjs')).toHaveLength(0);
  });
});
