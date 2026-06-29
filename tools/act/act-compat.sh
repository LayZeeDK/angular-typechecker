#!/usr/bin/env bash
#
# act compatibility suite (RD-05/RD-06). Container-free: it runs ONLY
# `act --validate` (parseability) + `act -n` (dry-run; trigger/condition
# fidelity). It NEVER runs plain `act <event>` execution -- no workflow step
# ever runs, so there is no nested Docker, no OIDC, no secrets.
#
# Two distinct guards (complementary -- neither subsumes the other):
#   1. PARSEABILITY (Req 2): `act --validate` proves act can ingest BOTH
#      workflows (ci.yml + release.yml). This is act's own ingest check, not the
#      GitHub-spec check that actionlint runs in the lint-workflows job.
#   2. TRIGGER/CONDITION FIDELITY (Req 1): for each trigger, `act -n` produces a
#      dry-run plan whose job selection we assert. act IGNORES `on:` filters
#      (branches/tags/paths/types) -- only the event NAME matters -- but it DOES
#      evaluate `if:`. So tag-vs-branch discrimination is encoded as the 06-04
#      release.yml publish-job `if:` ref gate and exercised by injecting
#      GITHUB_REF + an event payload. We capture each plan to a variable BEFORE
#      grepping so a pipe tail cannot mask act's exit code.
#
# CAVEAT (RD-09): act's needs.*.result / skipped semantics DIVERGE from GitHub,
# so the aggregate `ci` gate's skipped-handling is NOT verified here -- it is
# verified on the REAL draft-PR run. This suite verifies WHICH jobs are selected
# per trigger, not the gate's pass/fail arithmetic.
#
# Run locally on the Windows arm64 dev box (Docker auto-selects arm64 via the
# repo .actrc) or in CI (the act-compat job on ubuntu-latest, act pinned
# v0.2.89). Both are container-free.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

EVENTS="tools/act/events"
TAG_REF="refs/tags/angular-typechecker@0.0.2"
BRANCH_REF="refs/heads/main"

PASS_COUNT=0
FAIL_COUNT=0

pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  echo "[PASS] $1"
}

fail() {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  echo "[FAIL] $1"
}

# Capture the dry-run plan (stdout+stderr) for a trigger. --pull=false avoids a
# network image fetch on every dry-run; the plan job-selection is identical.
plan() {
  local event="$1"
  shift
  # act exits non-zero on a genuine plan error; `|| true` lets us inspect the
  # captured text and assert ourselves rather than aborting on act's own code
  # (which can be non-zero for benign dry-run reasons on some hosts).
  act "$event" -n --pull=false "$@" 2>&1 || true
}

# Substring match via pure bash -- NO external `rg`/`grep`. GitHub ubuntu runners
# do NOT ship ripgrep, and the repo's local `grep` deny rule is irrelevant inside a
# portable script; `[[ == *glob* ]]` works identically on CI (ubuntu/mac) and the
# local Git Bash box. `"[$token"` is quoted so `[` is literal, not a glob class.
contains_token() {
  local haystack="$1" token="$2"
  [[ "$haystack" == *"[$token"* ]]
}

# Assert a job token IS present in a captured plan.
assert_selected() {
  local plan_text="$1" token="$2" label="$3"
  if contains_token "$plan_text" "$token"; then
    pass "$label: $token SELECTED"
  else
    fail "$label: expected $token in the plan, not found"
  fi
}

# Assert a job token is ABSENT from a captured plan.
assert_absent() {
  local plan_text="$1" token="$2" label="$3"
  if contains_token "$plan_text" "$token"; then
    fail "$label: expected $token ABSENT, but it was selected"
  else
    pass "$label: $token SKIPPED/absent"
  fi
}

echo "=== act compatibility suite ==="
# WR-03: do NOT let a bare version probe abort the suite under `set -e` -- a
# degraded/missing act must surface as a counted [FAIL] via the guarded
# `act --validate` below + the summary, not a silent uncounted abort.
act --version || true

echo
echo "--- Guard 1: parseability (act --validate) ---"
if act --validate; then
  pass "act --validate: both workflows parse"
else
  fail "act --validate: a workflow failed to parse"
fi

echo
echo "--- Guard 2: trigger/condition fidelity (act -n per trigger) ---"

# pull_request -> ci jobs reachable (release.yml has no pull_request trigger).
# WR-02: match the `ci/test-` job FAMILY, not the positional `ci/test-1`, so the
# assertion survives any reorder/resize of the matrix `include` list.
PR_PLAN="$(plan pull_request -e "$EVENTS/pull_request.json" --env GITHUB_REF=refs/pull/1/merge)"
assert_selected "$PR_PLAN" "ci/test-" "pull_request"
assert_selected "$PR_PLAN" "ci/e2e" "pull_request"
assert_selected "$PR_PLAN" "ci/act-compat" "pull_request"
assert_selected "$PR_PLAN" "ci/lint-workflows" "pull_request"
assert_selected "$PR_PLAN" "ci/ci" "pull_request"
assert_absent "$PR_PLAN" "release/publish" "pull_request"

# push to main -> ci jobs reachable AND release publish SKIPPED (the 06-04 if:
# ref gate is false on a branch ref).
PUSH_MAIN_PLAN="$(plan push -e "$EVENTS/push-main.json" --env GITHUB_REF=$BRANCH_REF)"
assert_selected "$PUSH_MAIN_PLAN" "ci/test-" "push-main"
assert_selected "$PUSH_MAIN_PLAN" "ci/ci" "push-main"
assert_absent "$PUSH_MAIN_PLAN" "release/publish" "push-main"

# push tag -> release publish SELECTED (the if: ref gate is true on a tag ref).
# NEVER executed -- this is dry-run only; OIDC/secrets are out of act's reach.
PUSH_TAG_PLAN="$(plan push -e "$EVENTS/push-tag.json" --env GITHUB_REF=$TAG_REF --env GITHUB_REF_TYPE=tag)"
assert_selected "$PUSH_TAG_PLAN" "release/publish" "push-tag"

# workflow_dispatch -> release publish reachable (the manual escape hatch;
# reachable when dispatched against a release tag ref).
DISPATCH_PLAN="$(plan workflow_dispatch -e "$EVENTS/workflow_dispatch.json" --env GITHUB_REF=$TAG_REF --env GITHUB_REF_TYPE=tag)"
assert_selected "$DISPATCH_PLAN" "release/publish" "workflow_dispatch"

echo
echo "=== summary: $PASS_COUNT passed, $FAIL_COUNT failed ==="
if [ "$FAIL_COUNT" -ne 0 ]; then
  echo "act compatibility suite FAILED"
  exit 1
fi
echo "act compatibility suite PASSED"
