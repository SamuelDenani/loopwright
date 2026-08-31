/**
 * Static analysis over the TypeScript sources, built on the compiler API that
 * already ships with the repo. Produces three families of signal:
 *
 *  1. shape      — cyclomatic complexity, function length, nesting, params
 *  2. size       — lines of code per file
 *  3. integrity  — the tells that a green build was bought rather than earned:
 *                  skipped tests, assertion-free tests, coverage-ignore hints
 *                  and type/lint suppressions
 *
 * The integrity family is the one that matters for agentic development. An
 * agent under pressure to turn a PR green will reach for `it.skip`, `as any`
 * or `/* v8 ignore *\/` long before it will reach for a real fix, and none of
 * those show up as a failure in any conventional tool.
 */
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import ts from 'typescript';

const FUNCTION_KINDS = new Set([
  ts.SyntaxKind.FunctionDeclaration,
  ts.SyntaxKind.FunctionExpression,
  ts.SyntaxKind.ArrowFunction,
  ts.SyntaxKind.MethodDeclaration,
  ts.SyntaxKind.Constructor,
  ts.SyntaxKind.GetAccessor,
  ts.SyntaxKind.SetAccessor,
]);

const NESTING_KINDS = new Set([
  ts.SyntaxKind.IfStatement,
  ts.SyntaxKind.ForStatement,
  ts.SyntaxKind.ForInStatement,
  ts.SyntaxKind.ForOfStatement,
  ts.SyntaxKind.WhileStatement,
  ts.SyntaxKind.DoStatement,
  ts.SyntaxKind.SwitchStatement,
  ts.SyntaxKind.TryStatement,
]);

const TEST_CALLEES = new Set(['it', 'test', 'xit', 'xtest', 'fit']);
const SUITE_CALLEES = new Set(['describe', 'xdescribe', 'fdescribe', 'suite']);

const COVERAGE_IGNORE = /\b(?:istanbul|v8|c8|node:coverage)\s+ignore\b/;
const TS_SUPPRESSION = /@ts-(?:ignore|nocheck|expect-error)\b/;
// Both linters loopwright supports, in one rule: an integrity metric that
// only knows eslint reports a clean zero on a biome repo, which reads as
// 'nobody suppressed anything' rather than 'this check cannot see anything'.
const LINT_SUPPRESSION = /eslint-disable(?:-next-line|-line)?\b|biome-ignore(?:-start|-end)?\b/;
const ASSERTION = /\b(?:expect|expectTypeOf|assert|should)\s*[.(]/;

function isFunctionLike(node) {
  return FUNCTION_KINDS.has(node.kind);
}

function functionName(node, sourceFile) {
  if (node.name && ts.isIdentifier(node.name)) return node.name.text;
  const parent = node.parent;
  if (parent && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) return parent.name.text;
  if (parent && ts.isPropertyAssignment(parent) && ts.isIdentifier(parent.name)) return parent.name.text;
  if (parent && ts.isPropertyDeclaration(parent) && ts.isIdentifier(parent.name)) return parent.name.text;
  if (parent && ts.isCallExpression(parent)) {
    const callee = parent.expression.getText(sourceFile);
    return `${callee} callback`;
  }
  return '<anonymous>';
}

/** Every node kind that is unconditionally one decision point. */
const DECISION_KINDS = new Set([
  ts.SyntaxKind.IfStatement,
  ts.SyntaxKind.ForStatement,
  ts.SyntaxKind.ForInStatement,
  ts.SyntaxKind.ForOfStatement,
  ts.SyntaxKind.WhileStatement,
  ts.SyntaxKind.DoStatement,
  ts.SyntaxKind.ConditionalExpression,
  ts.SyntaxKind.CatchClause,
]);

/** Short-circuiting operators each add a path through the function. */
const BRANCHING_OPERATORS = new Set([
  ts.SyntaxKind.AmpersandAmpersandToken,
  ts.SyntaxKind.BarBarToken,
  ts.SyntaxKind.QuestionQuestionToken,
]);

function decisionPointsFor(node) {
  if (DECISION_KINDS.has(node.kind)) return 1;
  // `default:` is not a decision point, and neither is an empty fallthrough case.
  if (ts.isCaseClause(node)) return node.statements.length > 0 ? 1 : 0;
  if (ts.isBinaryExpression(node)) return BRANCHING_OPERATORS.has(node.operatorToken.kind) ? 1 : 0;
  return 0;
}

/**
 * Cyclomatic complexity for one function, matching how ESLint's `complexity`
 * rule counts: one plus every decision point, with nested functions excluded
 * because they are scored on their own.
 */
function measureFunction(fn, sourceFile) {
  let complexity = 1;
  let maxDepth = 0;

  const visit = (node, depth) => {
    if (node !== fn && isFunctionLike(node)) return; // scored separately

    complexity += decisionPointsFor(node);

    const nextDepth = NESTING_KINDS.has(node.kind) ? depth + 1 : depth;
    if (nextDepth > maxDepth) maxDepth = nextDepth;
    ts.forEachChild(node, (child) => visit(child, nextDepth));
  };

  ts.forEachChild(fn, (child) => visit(child, 0));

  const start = sourceFile.getLineAndCharacterOfPosition(fn.getStart(sourceFile)).line;
  const end = sourceFile.getLineAndCharacterOfPosition(fn.getEnd()).line;

  return {
    name: functionName(fn, sourceFile),
    line: start + 1,
    endLine: end + 1,
    loc: end - start + 1,
    params: fn.parameters?.length ?? 0,
    complexity,
    maxDepth,
  };
}

function scriptKindFor(path) {
  if (path.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (path.endsWith('.jsx')) return ts.ScriptKind.JSX;
  if (path.endsWith('.mjs') || path.endsWith('.cjs') || path.endsWith('.js')) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function countCodeLines(text) {
  let inBlockComment = false;
  let count = 0;
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (inBlockComment) {
      if (line.includes('*/')) inBlockComment = false;
      continue;
    }
    if (line === '') continue;
    if (line.startsWith('//')) continue;
    if (line.startsWith('/*')) {
      if (!line.includes('*/')) inBlockComment = true;
      continue;
    }
    count += 1;
  }
  return count;
}

function scanComments(text, filePath, findings) {
  text.split('\n').forEach((line, index) => {
    const location = { file: filePath, line: index + 1, snippet: line.trim().slice(0, 120) };
    if (COVERAGE_IGNORE.test(line)) findings.coverageIgnores.push(location);
    if (TS_SUPPRESSION.test(line)) findings.typeSuppressions.push(location);
    if (LINT_SUPPRESSION.test(line)) findings.lintSuppressions.push(location);
  });
}

/** `it.skip(...)` / `describe.only(...)` / `xit(...)` and friends. */
function classifyTestCall(node, sourceFile) {
  if (!ts.isCallExpression(node)) return null;

  let expression = node.expression;
  const modifiers = [];

  // Unwrap `it.each([...])` — the tagged form is `it.each(table)(name, fn)`.
  if (ts.isCallExpression(expression)) expression = expression.expression;

  while (ts.isPropertyAccessExpression(expression)) {
    modifiers.push(expression.name.text);
    expression = expression.expression;
  }
  if (!ts.isIdentifier(expression)) return null;

  const base = expression.text;
  const isTest = TEST_CALLEES.has(base);
  const isSuite = SUITE_CALLEES.has(base);
  if (!isTest && !isSuite) return null;

  const skipped = modifiers.includes('skip') || modifiers.includes('todo') || base.startsWith('x');
  const focused = modifiers.includes('only') || base.startsWith('f');

  const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
  const title = ts.isStringLiteralLike(node.arguments[0]) ? node.arguments[0].text : '<dynamic title>';

  return { kind: isSuite ? 'suite' : 'test', base, skipped, focused, line, title, node };
}

function testBodyHasAssertion(call, sourceFile) {
  const body = call.arguments.find((arg) => isFunctionLike(arg));
  if (!body) return true; // `it('name')` with no body is a todo, counted elsewhere
  const text = body.getText(sourceFile);
  return ASSERTION.test(text);
}

function analyzeFile(absolutePath, rootDir) {
  const filePath = relative(rootDir, absolutePath).split('\\').join('/');
  const text = readFileSync(absolutePath, 'utf8');
  const sourceFile = ts.createSourceFile(absolutePath, text, ts.ScriptTarget.ES2022, true, scriptKindFor(absolutePath));

  const functions = [];
  const findings = {
    coverageIgnores: [],
    typeSuppressions: [],
    lintSuppressions: [],
    skippedTests: [],
    focusedTests: [],
    assertionlessTests: [],
    emptyCatches: [],
  };

  scanComments(text, filePath, findings);

  const visit = (node) => {
    if (isFunctionLike(node)) {
      functions.push({ file: filePath, ...measureFunction(node, sourceFile) });
    }

    if (ts.isCatchClause(node) && node.block.statements.length === 0) {
      findings.emptyCatches.push({
        file: filePath,
        line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
        snippet: 'empty catch block',
      });
    }

    const testCall = classifyTestCall(node, sourceFile);
    if (testCall) {
      const location = { file: filePath, line: testCall.line, snippet: testCall.title };
      if (testCall.skipped) findings.skippedTests.push(location);
      if (testCall.focused) findings.focusedTests.push(location);
      if (
        testCall.kind === 'test' &&
        !testCall.skipped &&
        !testBodyHasAssertion(testCall.node, sourceFile)
      ) {
        findings.assertionlessTests.push(location);
      }
    }

    ts.forEachChild(node, visit);
  };

  ts.forEachChild(sourceFile, visit);

  const lines = text.split('\n').length;

  return {
    file: filePath,
    lines,
    codeLines: countCodeLines(text),
    functionCount: functions.length,
    maxComplexity: functions.reduce((max, fn) => Math.max(max, fn.complexity), 0),
    functions,
    findings,
  };
}

export function analyzeSources(files, rootDir) {
  const perFile = files.map((file) => analyzeFile(file, rootDir));
  const functions = perFile.flatMap((entry) => entry.functions);

  const findings = {
    coverageIgnores: [],
    typeSuppressions: [],
    lintSuppressions: [],
    skippedTests: [],
    focusedTests: [],
    assertionlessTests: [],
    emptyCatches: [],
  };
  for (const entry of perFile) {
    for (const key of Object.keys(findings)) {
      findings[key].push(...entry.findings[key]);
    }
  }

  const complexities = functions.map((fn) => fn.complexity);
  const totalComplexity = complexities.reduce((sum, value) => sum + value, 0);

  return {
    files: perFile.map((entry) => ({
      file: entry.file,
      lines: entry.lines,
      codeLines: entry.codeLines,
      functionCount: entry.functionCount,
      maxComplexity: entry.maxComplexity,
    })),
    functions,
    findings,
    totals: {
      fileCount: perFile.length,
      functionCount: functions.length,
      totalLines: perFile.reduce((sum, entry) => sum + entry.lines, 0),
      totalCodeLines: perFile.reduce((sum, entry) => sum + entry.codeLines, 0),
      maxComplexity: complexities.length > 0 ? Math.max(...complexities) : 0,
      averageComplexity: functions.length > 0 ? Number((totalComplexity / functions.length).toFixed(2)) : 0,
    },
  };
}
