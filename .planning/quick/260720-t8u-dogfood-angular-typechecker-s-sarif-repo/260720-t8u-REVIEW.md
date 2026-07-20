# Code Review: `260720-t8u` -- Dogfood angular-typechecker + fallow SARIF -> Code Scanning

**Reviewed:** 2026-07-20
**Depth:** quick, security-focused
**Files reviewed:**
- `.github/workflows/ci.yml` (new `code-scanning` job only; diff confirmed no other job touched)
- `tools/act/act-compat.sh` (two new `assert_selected` lines only)

**Scope confirmed via `git status --porcelain`:** only these two tracked files are
modified; the new `.planning/quick/260720-t8u-.../` directory is untracked planning
input, not source.

## Summary

The five stated repo CI invariants all hold as implemented:

1. Top-level `permissions: contents: read` is untouched; the new job's `permissions:`
   block is `{ contents: read, security-events: write }` -- job-level permissions
   correctly REPLACE (not merge with) the top-level block, and `contents: read` is
   correctly restated for `actions/checkout`.
2. No PR metadata is interpolated into a `run:` shell command anywhere in the new job.
   The fork check (`github.event_name != 'pull_request' || github.event.pull_request.head.repo.fork == false`)
   is an Actions `if:` expression, engine-evaluated, not shell interpolation.
3. Every new `uses:` is a full 40-char commit SHA with a version comment. Verified
   against the real registry: `git ls-remote --tags` on `github/codeql-action` shows
   the annotated tag `v3.37.1` peels (`^{}`) to commit `b7351df727350dca84cb9d725d57dcf5bc82ba26`
   -- the pin in the diff is correct. The reused `actions/checkout`/`actions/setup-node`
   pins are byte-identical to every other job in the file.
4. The new `code-scanning` job is confirmed absent from the `ci` aggregate's `needs:`
   list (`changes, discover, test, e2e, e2e-windows, fallow, format-lint, act-compat,
   lint-workflows, scoped-name-guard`) -- it cannot deadlock the PR-only merge gate.
5. Fork-PR gating is present and correctly short-circuits (`event_name != 'pull_request'`
   evaluates first, so `github.event.pull_request.*` is never dereferenced on a
   non-PR/push event).

YAML structure was verified by parsing the file with `js-yaml` -- the new job block
parses with the exact expected keys/steps and no indentation drift. `git diff --check`
reports no whitespace errors. The two `assert_selected` additions in `act-compat.sh`
follow the file's existing `ci/<job-id>` token convention exactly and target a job
with an identical `needs`/`if:` shape to jobs already asserted the same way (`test`,
`fallow`), so they should pass under `act -n` with the same reasoning already proven
for those jobs.

One real correctness gap was found in the failure-mode reasoning documented in the new
job's own comment block (see MED-01 below). It does not affect the PR-only merge gate
(the job is correctly excluded from `ci`'s `needs`), but it contradicts the explicit
design invariant the comment and the plan (`260720-t8u-PLAN.md` Task 1, step 5) both
assert, and it will produce a spurious failing/red `code-scanning` check under a real,
reachable condition.

**No Critical or High findings.** No hardcoded secrets, no injection surface, no
privilege escalation, no SHA-pin drift.

## Medium

### MED-01: `continue-on-error` on the SARIF-generation step does not cover the CLI's own infrastructure-error exit path -- an empty file gets uploaded, or the upload step fails

**File:** `.github/workflows/ci.yml:522-523` (generation step) and `:529-534` (upload step)

**Issue:** The job's header comment (lines 479-484) and the plan (`260720-t8u-PLAN.md`
Task 1, step 5: "the redirect still writes the full SARIF before exit") both assert
that `continue-on-error: true` on the generation step is safe because "both tools write
the FULL SARIF payload before exiting" on any exit code the tool itself produces. That
is only true for angular-typechecker's **exit 1** (verdict-fail) path.

Tracing `run()` in `packages/angular-typechecker/src/cli/main.ts`:
- A usage error (bad/missing flags) returns exit 2 with **`stdout: ''`** (line 126).
- A caught `TypecheckInfrastructureError` (thrown from `run-typecheck.ts` on a config
  resolution failure, a compiler-cli internal crash, etc. -- three real throw sites,
  not a hypothetical) returns exit 2 with **`stdout: ''`** (line 191).
- Only the completed-run branch (exit 0 or 1) returns `stdout: report`, a real SARIF
  payload (line 184).

The workflow step is:
```yaml
- run: node dist/packages/angular-typechecker/src/cli/bin.js -c apps/ng-spike-app/tsconfig.app.json --format sarif > angular-typechecker.sarif
  continue-on-error: true
```
On an exit-2 path, `bin.ts` writes nothing to stdout (`if (stdout) { process.stdout.write(stdout); }` is false-guarded), but the shell `>` redirect still creates/truncates `angular-typechecker.sarif` to **0 bytes**. `continue-on-error: true` marks the step's *conclusion* as success, so the next step (`Upload angular-typechecker SARIF`, which has no `if:` gate on the generation step's outcome, only the fork-gate) still runs by default. `github/codeql-action/upload-sarif` will then be handed an empty/invalid-JSON file and fail (that step is NOT `continue-on-error`), turning the whole `code-scanning` job red.

This is a real, reachable path: `TypecheckInfrastructureError` is thrown from three
sites in `run-typecheck.ts` (config resolution failures, compiler-cli internal
errors), and it is exactly the class of failure a compiler-driven tool can hit against
a real Angular app (`apps/ng-spike-app`) independent of whether the type-check verdict
itself is clean or dirty. It's not the "npm ci / nx build infra failure" case the
comment explicitly reasons about (those are separate, earlier steps without
`continue-on-error` and are correctly handled) -- it's a distinct, undocumented failure
mode of the CLI invocation itself.

Consequence: since `code-scanning` is correctly excluded from the required `ci`
aggregate, this cannot block a merge -- but it will render a spurious red status check
on the PR whenever the dogfooded compile hits an infra-class error, undermining the
job's own signal value and contradicting the stated design invariant.

**Fix:** Gate the upload step on the generation step's own outcome (in addition to the
existing fork check), e.g.:
```yaml
- id: atc-sarif
  run: node dist/packages/angular-typechecker/src/cli/bin.js -c apps/ng-spike-app/tsconfig.app.json --format sarif > angular-typechecker.sarif
  continue-on-error: true
...
- name: Upload angular-typechecker SARIF
  if: ${{ steps.atc-sarif.outcome == 'success' && (github.event_name != 'pull_request' || github.event.pull_request.head.repo.fork == false) }}
  uses: github/codeql-action/upload-sarif@b7351df727350dca84cb9d725d57dcf5bc82ba26 # v3.37.1
  with:
    sarif_file: angular-typechecker.sarif
    category: angular-typechecker
```
`steps.atc-sarif.outcome` is `'success'` only when the CLI itself exited 0 or 1 (both of
which write a real SARIF report); it is `'failure'` on the exit-2 empty-stdout paths,
which is exactly the case to skip. Apply the analogous guard to the fallow upload step
if fallow can ever exit non-zero for a reason other than its gate verdict (e.g., a tool
crash before it reaches its own `-o` write) -- in that case `fallow.sarif` would not
exist at all rather than be empty, which `upload-sarif` will also reject.

## Low

### LOW-01: `FALLOW_AUDIT_BASE` env var scoped at job level, not step level (style inconsistency, harmless)

**File:** `.github/workflows/ci.yml:503-505`

**Issue:** The existing `fallow` job scopes `FALLOW_AUDIT_BASE: origin/main` to the
`run: npx fallow audit ...` step's own `env:` block (line 351-352). The new
`code-scanning` job instead sets it at the job level (`env:` block under
`code-scanning:`, lines 503-505), so it's also (harmlessly) exported to `npm ci`,
`nx build`, and the angular-typechecker CLI invocation, which never read it. Not a
bug -- `--base origin/main` is passed explicitly to `fallow audit` as a CLI flag too,
so the env var is redundant defense-in-depth either way -- just an avoidable
inconsistency with the established per-step scoping convention in the same file.

**Fix:** Move `FALLOW_AUDIT_BASE: origin/main` into the fallow step's own `env:` block
to match the `fallow` job's existing convention, or leave as-is with a one-line comment
noting the deliberate broadening (defensive base-pin for both SARIF-producing tools).

## Info

None beyond the above -- no debug artifacts, no dead code, no naming issues introduced
by this diff.

---

_Reviewed: 2026-07-20_
_Reviewer: Claude (adversarial code review)_
_Depth: quick, security-focused_
