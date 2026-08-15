import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// run-report.mjs's main() reads CONFIG_PATH and writes to REPORTS_DIR, both
// fixed exports of paths.mjs; redirect them to a scratch host so main() never
// touches the real .loopwright/config.json or reports/ directory.
let CONFIG_PATH;
let REPORTS_DIR;
let HOST_ROOT;

vi.mock('../scripts/lib/paths.mjs', async () => {
  const actual = await vi.importActual('../scripts/lib/paths.mjs');
  return {
    ...actual,
    get CONFIG_PATH() { return CONFIG_PATH; },
    get REPORTS_DIR() { return REPORTS_DIR; },
    get HOST_ROOT() { return HOST_ROOT; },
  };
});

const { main } = await import('../scripts/run-report.mjs');

let originalArgv;
let logs;
let errors;
let logSpy;
let errorSpy;

beforeEach(() => {
  const scratch = mkdtempSync(join(tmpdir(), 'lw-run-report-'));
  CONFIG_PATH = join(scratch, 'config.json');
  REPORTS_DIR = join(scratch, 'reports');
  HOST_ROOT = scratch;
  mkdirSync(REPORTS_DIR, { recursive: true });
  originalArgv = process.argv;
  logs = [];
  errors = [];
  logSpy = vi.spyOn(console, 'log').mockImplementation((msg) => logs.push(msg));
  errorSpy = vi.spyOn(console, 'error').mockImplementation((msg) => errors.push(msg));
});

afterEach(() => {
  process.argv = originalArgv;
  process.exitCode = undefined;
  logSpy.mockRestore();
  errorSpy.mockRestore();
});

function writeConfig(collectors) {
  writeFileSync(CONFIG_PATH, JSON.stringify({ collectors }));
}

describe('run-report main()', () => {
  it('runs every configured collector for --all, including a real adapter run', () => {
    writeConfig({
      typecheck: { adapter: 'unconfigured' },
      tests: { adapter: 'vitest', command: 'true', cwd: '.' },
    });
    process.argv = ['node', 'run-report.mjs', '--all'];
    main();
    expect(JSON.parse(readFileSync(join(REPORTS_DIR, 'typecheck.json'), 'utf8'))).toEqual({ configured: false });
    expect(existsSync(join(REPORTS_DIR, 'test-summary.json'))).toBe(true);
    expect(logs.join('\n')).toMatch(/typecheck: unconfigured \(skipped\)/);
  });

  it('runs a single named collector, not the whole set', () => {
    writeConfig({ typecheck: { adapter: 'unconfigured' }, lint: { adapter: 'unconfigured' } });
    process.argv = ['node', 'run-report.mjs', 'lint'];
    main();
    expect(existsSync(join(REPORTS_DIR, 'typecheck.json'))).toBe(false);
    expect(existsSync(join(REPORTS_DIR, 'lint.json'))).toBe(true);
  });

  it('errors with exit code 2 for a collector name absent from config.json', () => {
    writeConfig({ typecheck: { adapter: 'unconfigured' } });
    process.argv = ['node', 'run-report.mjs', 'nope'];
    main();
    expect(process.exitCode).toBe(2);
    expect(errors.join(' ')).toMatch(/no collector "nope"/);
  });
});
