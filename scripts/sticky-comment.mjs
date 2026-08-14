#!/usr/bin/env node
/**
 * Posts (or updates) the single quality-gate comment on a PR.
 *
 * Uses the `gh` CLI that GitHub-hosted runners already ship, so the workflow
 * takes on no third-party action as a dependency — a supply-chain surface that
 * a quality gate has no business introducing.
 *
 * Identifies its own previous comment by the hidden marker at the top of the
 * body, so a PR ends up with one comment that gets rewritten on every push
 * instead of a wall of them.
 *
 * Env: GH_TOKEN (or GITHUB_TOKEN), GITHUB_REPOSITORY, PR_NUMBER.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { COMMENT_MARKER } from './lib/report.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const bodyPath = resolve(ROOT, process.argv[2] ?? 'reports/quality-gate.md');

const repo = process.env.GITHUB_REPOSITORY;
const prNumber = process.env.PR_NUMBER;

if (!existsSync(bodyPath)) {
  console.error(`No report at ${bodyPath}; nothing to post.`);
  process.exit(0);
}
if (!repo || !prNumber) {
  console.error('GITHUB_REPOSITORY and PR_NUMBER must be set; skipping the sticky comment.');
  process.exit(0);
}

function gh(args, options = {}) {
  return execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, ...options });
}

const body = readFileSync(bodyPath, 'utf8');

// GitHub rejects comment bodies over 65536 characters.
const MAX_BODY = 65000;
const finalBody =
  body.length > MAX_BODY
    ? `${body.slice(0, MAX_BODY)}\n\n> _Report truncated. The full version is in the workflow artifacts._`
    : body;

let existingId = null;
try {
  const raw = gh([
    'api',
    '--paginate',
    `repos/${repo}/issues/${prNumber}/comments`,
    '--jq',
    `[.[] | select(.body | contains("${COMMENT_MARKER}")) | .id] | .[0] // empty`,
  ]);
  existingId = raw.trim() || null;
} catch (error) {
  console.error(`Could not list existing comments: ${error.message}`);
}

// Pass the body via a file so newlines and backticks survive the shell.
const scratch = mkdtempSync(join(tmpdir(), 'quality-gate-'));
const payloadPath = join(scratch, 'body.txt');
writeFileSync(payloadPath, finalBody);

try {
  if (existingId) {
    gh(['api', '--method', 'PATCH', `repos/${repo}/issues/comments/${existingId}`, '-F', `body=@${payloadPath}`]);
    console.log(`Updated quality-gate comment ${existingId} on PR #${prNumber}.`);
  } else {
    gh(['api', '--method', 'POST', `repos/${repo}/issues/${prNumber}/comments`, '-F', `body=@${payloadPath}`]);
    console.log(`Posted quality-gate comment on PR #${prNumber}.`);
  }
} catch (error) {
  // A comment that cannot be posted must not mask the gate's own verdict.
  console.error(`Failed to post the sticky comment: ${error.message}`);
  process.exit(0);
}
