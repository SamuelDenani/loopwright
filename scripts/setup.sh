#!/usr/bin/env bash
# One-time (idempotent) setup for a repo born from the loopwright template.
# Everything file-based ships with the template; this script configures the
# GitHub state that cannot live in files, then records the initial quality
# baseline. Safe to re-run, and safe to run on an existing repo you are
# retrofitting.
set -euo pipefail

gh auth status >/dev/null || { echo "gh is not authenticated. Run: gh auth login"; exit 1; }
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
echo "Setting up ${REPO}"

# --- labels ------------------------------------------------------------------
ensure_label() {
  local name=$1 color=$2 desc=$3
  if gh label list --json name -q '.[].name' | grep -qx "$name"; then
    gh label edit "$name" --color "$color" --description "$desc" >/dev/null
    echo "label ok:       $name"
  else
    gh label create "$name" --color "$color" --description "$desc" >/dev/null
    echo "label created:  $name"
  fi
}
ensure_label rfc  0e8a16 "RFC: top-level design and intent"
ensure_label task 1d76db "Task: implementable unit linked to an RFC"

# --- secret ------------------------------------------------------------------
if gh secret list --json name -q '.[].name' | grep -qx CLAUDE_CODE_OAUTH_TOKEN; then
  echo "secret ok:      CLAUDE_CODE_OAUTH_TOKEN"
else
  echo "secret MISSING: CLAUDE_CODE_OAUTH_TOKEN — the review workflows need it."
  echo "                Set it with: gh secret set CLAUDE_CODE_OAUTH_TOKEN"
fi

# --- branch protection -------------------------------------------------------
# The Quality gate check must pass before anything merges into main.
gh api -X PUT "repos/${REPO}/branches/main/protection" \
  --input - >/dev/null <<'JSON'
{
  "required_status_checks": { "strict": false, "contexts": ["Quality gate"] },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
echo "protection ok:  main requires the Quality gate check"

# --- pre-commit hook ---------------------------------------------------------
git config core.hooksPath .githooks
echo "hooks ok:       core.hooksPath -> .githooks (fast pre-commit checks)"

# --- initial baseline --------------------------------------------------------
if [ -f quality-baseline.json ]; then
  echo "baseline ok:    quality-baseline.json exists"
else
  [ -d node_modules ] || npm install
  npm run quality:collect
  npm run quality:baseline
  echo "baseline created — review and commit it:"
  echo "  git add quality-baseline.json && git commit -m 'chore: record initial quality baseline'"
fi

echo "Done."
