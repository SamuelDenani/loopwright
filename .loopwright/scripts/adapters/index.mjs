/**
 * Adapter registry. Each adapter serves exactly one `config.collectors` slot
 * (its `collector` field) and knows how to run its tool and normalise the
 * result into reports/. Tasks 4-5 replace the temporary `collect()` bodies
 * with real parsers; the `name`/`collector`/`defaultCommand` values below are
 * final.
 */
import tsc from './tsc.mjs';
import eslint from './eslint.mjs';
import biome from './biome.mjs';
import vitest from './vitest.mjs';
import jest from './jest.mjs';
import npmAudit from './npm-audit.mjs';
import jscpd from './jscpd.mjs';

export const ADAPTERS = Object.fromEntries(
  [tsc, eslint, biome, vitest, jest, npmAudit, jscpd].map((adapter) => [adapter.name, adapter]),
);
