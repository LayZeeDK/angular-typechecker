---
phase: 06-full-e2e-matrix-ci
reviewed: 2026-06-29T00:00:00Z
depth: deep
files_reviewed: 14
files_reviewed_list:
  - .github/workflows/ci.yml
  - .github/workflows/release.yml
  - tools/act/act-compat.sh
  - tools/act/events/pull_request.json
  - tools/act/events/push-main.json
  - tools/act/events/push-tag.json
  - tools/act/events/workflow_dispatch.json
  - .actrc
  - .nxignore
  - e2e/angular-typechecker-matrix-e2e/src/matrix-5types.int.spec.ts
  - e2e/angular-typechecker-matrix-e2e/src/pnpm-symlink.int.spec.ts
  - e2e/angular-typechecker-matrix-e2e/fixtures/consumer-workspace/libs/local-lib/tsconfig.spec.json
  - packages/angular-typechecker/src/core/filter-diagnostics.spec.ts
  - packages/angular-typechecker/src/core/run-typecheck.integration.spec.ts
findings:
  critical: 0
  warning: 3
  info: 6
  total: 9
status: issues-found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-06-29
**Depth:** deep (cross-file: workflow <-> act suite <-> release.yml <-> filter-diagnostics impl <-> fixtures)
**Files Reviewed:** 14
**Status:** issues-found

## Summary

Phase 6 ships the cross-OS CI gate (`ci.yml`), the container-free `act` compatibility
suite, the +7-line `release.yml` publish-job `if:` ref gate, the 5-type + pnpm e2e specs,
and the extended unit/integration coverage (mixed-case fold, RD-04 store-dir generality,
host-derived `useCaseSensitiveFileNames`). The implementation is high quality and the
security posture is sound: no `pull_request_target`, top-level `permissions: contents: read`,
every action is a 40-char SHA pin, `persist-credentials: false` on every checkout, no
`registry-url` in `ci.yml`, no hardcoded secrets, and `release.yml`'s OIDC model is
byte-for-byte unchanged (only the additive `if:` was added). The e2e specs are honest:
clean install (no `legacy-peer-deps`), per-run tmp copies, no committed-fixture mutation
that survives a run, and meaningful 4-way assertions (non-zero exit + `TS2322` token + no
`ERR_REQUIRE_ESM` + no `infrastructure error`) rather than exit-0-only checks.

No BLOCKER/Critical issues were found. There are no command-injection, traversal, or
secret-leak surfaces. The findings below are robustness/quality concerns. The most
material is **WR-01**: the `release.yml` `if:` ref gate also silently narrows the
`workflow_dispatch` manual escape hatch -- a manual dispatch from a branch now SKIPS the
publish job (it only fires when dispatched against a tag ref). This is consistent with the
locked RD-07 decision and the act suite encodes it, but it is a real behavior change to the
"manual escape hatch" that is under-documented at the point of use.

CLAUDE.md / AGENTS.md compliance is clean: ASCII-only throughout, no `git add .` in any
shipped script, `rg` (not `grep`) in `act-compat.sh`, `release.yml` otherwise frozen.

## Warnings

### WR-01: The `release.yml` `if:` ref gate silently narrows the `workflow_dispatch` manual escape hatch

**File:** `.github/workflows/release.yml:54`
**Issue:** The publish job now carries `if: startsWith(github.ref, 'refs/tags/angular-typechecker@')`.
This `if:` evaluates for EVERY trigger, including `workflow_dispatch`. The manual escape
hatch (`workflow_dispatch: {}`, line 31) was previously usable from any ref; it now only
reaches `publish` when the dispatch is run against a release-tag ref. A maintainer
manually dispatching from the default branch (the obvious / default choice in the GitHub
"Run workflow" dropdown) will see the job SKIP with no publish and no error -- a confusing
silent no-op for an emergency manual republish. The behavior is intentional per RD-07 and
the act suite deliberately injects a tag `GITHUB_REF` to make `workflow_dispatch` reach
publish (`act-compat.sh:118`), but the job-level comment block (`release.yml:48-53`) only
explains the tag-push case and never tells the operator "for a manual dispatch you MUST
select a tag ref, not a branch." The frozen OIDC/permissions/environment model is genuinely
untouched -- this is a reachability change, not a security regression.
**Fix:** Keep the gate (it is locked + act-testable), but make the manual-dispatch
requirement explicit so a future operator does not get a silent skip. Either widen the gate
to also allow an explicit manual run, or (preferred, lowest-risk) extend the existing
comment block to state it:
```yaml
    # ... existing comment ...
    # NOTE: this gate also applies to workflow_dispatch -- a MANUAL run must be
    # dispatched against a release TAG ref (refs/tags/angular-typechecker@<version>),
    # NOT a branch, or the publish job silently SKIPS.
    if: startsWith(github.ref, 'refs/tags/angular-typechecker@')
```
If a branch-dispatch republish is ever a real need, the explicit form is:
`if: startsWith(github.ref, 'refs/tags/angular-typechecker@') || github.event_name == 'workflow_dispatch'`
(but that re-widens the surface RD-07 deliberately closed -- only do it if the use case is real).

### WR-02: act job-selection assertions are brittle to matrix-cell renumbering and assert only cell index 1 of 6

**File:** `tools/act/act-compat.sh:97,107`
**Issue:** The fidelity assertions match the literal token `[ci/test-1` (via
`rg -q -F "[$token"` in `assert_selected`). act names matrix jobs `test-1 .. test-N`
positionally over the `matrix.include` list. The suite asserts only `test-1` exists -- it
never verifies that all six cells are planned, and the `-1` suffix is an implementation
detail of act's matrix-expansion numbering. If a future edit reorders `matrix.include`,
removes the first cell, or act changes its job-id numbering, the assertion can pass while
silently exercising a different cell (or fail spuriously) without telling the maintainer
the matrix shape drifted. Because act cannot emulate windows/macos cells anyway and the
authoritative matrix proof is the draft-PR run (RD-10), this is a robustness gap, not a
correctness bug -- but the suite's value is "did the trigger select the test job at all,"
which a single hardcoded cell index under-specifies.
**Fix:** Assert the job FAMILY rather than a positional cell, e.g. match the stable prefix
`[ci/test-` (any cell) instead of `[ci/test-1`, and -- if cell-count coverage matters --
count the distinct `[ci/test-N` tokens and assert it equals 6:
```bash
# selected at least one test cell (family match, suffix-agnostic):
assert_selected "$PR_PLAN" "ci/test-" "pull_request"
# optional: assert all six cells are planned
local cells
cells=$(printf '%s\n' "$PR_PLAN" | rg -o '\[ci/test-[0-9]+' | sort -u | wc -l)
[ "$cells" -eq 6 ] || fail "pull_request: expected 6 test cells, got $cells"
```

### WR-03: `act --version` / `act --validate` run before any guard and abort the whole suite under `set -e` without a counted FAIL

**File:** `tools/act/act-compat.sh:82,86`
**Issue:** The script runs `set -euo pipefail` (line 28), then calls bare `act --version`
(line 82) outside the `pass`/`fail` accounting. Under `set -e`, if `act` is missing or
errors on `--version` (e.g. a partial install in the CI `act-compat` job, where act is
fetched by a piped `curl | sudo bash`), the script dies immediately with a non-zero exit
and the summary line + the explicit "act compatibility suite FAILED" message never print.
The `act --validate` guard (line 86) is correctly wrapped in `if ... else fail`, but the
bare `act --version` above it is not, so a degraded-act environment fails opaquely rather
than through the suite's own reporting path. This is a diagnosability concern for the CI
job, not a false-pass: a dead `act` still fails the job (good), just without the intended
`[FAIL]` breadcrumb.
**Fix:** Either drop the redundant bare `act --version` (the CI job already runs
`act --version` in the install step, `ci.yml:103`), or guard it so a failure is counted and
the summary still prints:
```bash
if ! act --version; then
  fail "act --version: act not runnable"
  echo "=== summary: $PASS_COUNT passed, $FAIL_COUNT failed ==="
  exit 1
fi
```

## Info

### IN-01: D-10 integration "live case-insensitive" assertion is a tautology, not a true host-case-fold exercise

**File:** `packages/angular-typechecker/src/core/run-typecheck.integration.spec.ts:197-199`
**Issue:** The assertion `expect(reportedInProjectPath?.toLowerCase()).toBe(mainLibComponent.replace(/\\/g, '/').toLowerCase())`
lower-cases BOTH sides in the test itself. That makes it pass identically on a
case-sensitive (Linux) and a case-insensitive (mac/Windows) host regardless of what the
production canonicalizer does with case -- it does not actually distinguish host-derived
folding from a no-op. The test's stated intent ("live case-insensitive exercise") is not
what the assertion proves; what it proves is "the reported in-project path equals the
on-disk path modulo case." The genuine host-derived case-fold IS covered deterministically
in the unit tier (`filter-diagnostics.spec.ts` :93/:111/:123/:135, both `:false` and
`:true` modes), so coverage is not lost -- but this integration assertion is weaker than its
comment claims. The comment honestly acknowledges the no-op-on-Linux aspect.
**Fix:** Either re-label the assertion to match what it verifies (path-identity modulo case,
host-derived reporting) or strengthen it to query a flipped-case path through the real host
and assert the same classification -- but the unit tier already owns the load-bearing proof,
so re-labelling is sufficient.

### IN-02: pnpm Windows-fallback assertion is near-vacuous

**File:** `e2e/angular-typechecker-matrix-e2e/src/pnpm-symlink.int.spec.ts:325`
**Issue:** On the Windows dev box (and any non-symlink layout), the realpath-guard test
falls back to `expect(probe.realPath.length).toBeGreaterThan(0)`, which is true for any
resolvable path. This is an honest, documented fallback (the true cross-boundary teeth run
on the Linux CI leg per RD-10, and the load-bearing realpath proof lives in the unit tier),
and the SECOND `it` is not the only coverage -- the FIRST `it` already proves green +
injected under the pnpm-installed layout. So this is not a masked failure. It is flagged
only so a reader does not mistake the fallback branch for a meaningful symlink assertion.
**Fix:** None required (correctly documented). Optionally assert the resolved path is the
installed package (`expect(probe.realPath).toContain('angular-typechecker')`) so the
fallback at least confirms the right artifact resolved.

### IN-03: `local-lib.component.spec.ts` comment is stale after the Deviation-3 fix

**File:** `e2e/angular-typechecker-matrix-e2e/fixtures/consumer-workspace/libs/local-lib/src/local-lib.component.spec.ts:16`
**Issue:** The fixture comment reads "to keep the file self-contained and the committed
baseline green under `types: ["node"]`." But 06-02 Deviation 3 changed
`tsconfig.spec.json` to `types: []` (verified: `tsconfig.spec.json:12` is `"types": []`)
precisely because the consumer installs no `@types/node` and `types:["node"]` produced a
TS2688 on the green baseline. The comment now documents the exact configuration that was
removed, which will mislead a future reader into thinking `types:["node"]` is the working
shape.
**Fix:** Update the comment to reference `types: []` (and the reason: no `@types/node`
installed; the file declares its own ambient `describe`/`it`/`expect`).

### IN-04: `consumer-workspace/package.json` declares `nx` directly, contradicting the project's own published-package rule

**File:** `e2e/angular-typechecker-matrix-e2e/fixtures/consumer-workspace/package.json:16`
**Issue:** The fixture `devDependencies` declare both `@nx/devkit` and `nx` explicitly.
This is correct and expected for a CONSUMER workspace (a consumer's own workspace pins its
own `nx`), and is unrelated to the published-plugin "never declare `nx`" rule (which governs
`packages/angular-typechecker/package.json`, not a consumer fixture). Flagged only to record
that the reviewer checked it and confirmed it is NOT a violation of the AGENTS.md/CLAUDE.md
"plugin must not declare nx" constraint -- the rule applies to the shipped package, not to a
test consumer that legitimately needs its own Nx runtime.
**Fix:** None (intentional; documented here to close the question).

### IN-05: act event payloads under-specify `workflow_dispatch` (no ref in the payload; relies entirely on injected `GITHUB_REF`)

**File:** `tools/act/events/workflow_dispatch.json:1-3`
**Issue:** `workflow_dispatch.json` is `{"inputs": {}}` with no ref, so the
`workflow_dispatch -> release/publish reachable` assertion depends entirely on the
`--env GITHUB_REF=$TAG_REF --env GITHUB_REF_TYPE=tag` injection in `act-compat.sh:118`. This
works and mirrors how GitHub would set `github.ref` for a tag-targeted dispatch, but the
coupling between the (empty) payload and the externally-injected ref is implicit. A reader
inspecting only the JSON cannot tell which ref the dispatch assertion exercises.
**Fix:** None functionally required. Optionally add a top-level `"ref"` to the payload or a
one-line comment in the script tying the injected ref to the assertion intent (the script's
inline comment at :116-117 partially does this).

### IN-06: `ci.yml` aggregate gate's `skipped`-handling is correct but unverifiable by the act suite (documented divergence)

**File:** `.github/workflows/ci.yml:137`
**Issue:** The gate fails closed on `failure || cancelled || skipped` via
`contains(needs.*.result, ...)`, which is the robust form (a plain
`needs.test.result != 'success'` could read `success` when one cell passes under
`fail-fast:false`). This is correct. The `skipped` term is the right defensive choice for a
required check. The only caveat -- correctly documented in `act-compat.sh:20-23` and the
06-05 summary -- is that act's `needs.*.result`/`skipped` semantics diverge from GitHub, so
this arm is proven on the real draft-PR run, not under act. No code change needed; recorded
so the verification chain is explicit.
**Fix:** None. Ensure the Phase-6 draft-PR validation (RD-10) explicitly exercises a
skipped-dependency path before the `ci` check is wired as required in Phase 7.

---

_Reviewed: 2026-06-29_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
