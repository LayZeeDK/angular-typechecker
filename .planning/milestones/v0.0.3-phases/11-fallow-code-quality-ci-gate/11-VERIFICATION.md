---
phase: 11-fallow-code-quality-ci-gate
verified: 2026-06-30T03:15:00Z
status: passed
score: 14/14 must-haves verified
overrides_applied: 0
human_verification_resolved: "2026-06-30 -- all 5 human_verification items confirmed on REAL CI. Items 2-5: draft PR #9 (ci run 28423475278) all checks green with the fallow job present. Item 1: throwaway PR #10 (ci run 28423739251) -- fallow job FAIL (exit 1, introduced finding) -> ci aggregate FAIL, all other jobs green (red isolated to the gate); PR/branch deleted after proof. See 11-HUMAN-UAT.md (status: complete, 5/5)."
human_verification:
  - test: "On a throwaway branch, add an obviously-unused exported symbol, push a draft PR; confirm the `fallow` job (and thus the aggregate `ci` check) goes RED; then confirm a clean PR is green."
    expected: "fallow job fails the PR with a `new-only` introduced dead-code finding; the single required `ci` check goes red. A clean PR keeps `ci` green."
    why_human: "act's `needs.*.result`/skipped arithmetic diverges from GitHub; the aggregate `ci` pass/fail behavior is only authoritative on a REAL GitHub Actions run. Cannot be proven locally."
  - test: "Observe the Phase 11 PR's own `ci` check is green with the new `fallow` job present."
    expected: "The Phase 11 PR's `ci` aggregate check is green; the `fallow` job ran and passed."
    why_human: "Canonical proof of QUAL-02 'gate green on adoption' is the phase PR's own real CI run. Local `npx fallow audit` exit 0 is the fast automated proxy; the green PR run is the authoritative confirmation."
  - test: "Confirm `git rev-parse --verify origin/main` resolves inside the `fallow` job's checkout context on a real draft PR (WR-01)."
    expected: "`origin/main` resolves to a valid remote-tracking ref so fallow's `--base origin/main` attribution uses the intended base (not a silent merge-base fallback that could let introduced dead code slip through)."
    why_human: "Code review WR-01 (Warning): base-ref resolution in the CI checkout context (fork-PR / shallow-vs-full refspec edges) is a robustness concern not exercised by the threat-model or act-compat suites. Only a real PR run discharges it."
  - test: "Confirm `./actionlint -color` exits 0 on the Phase 11 PR's `lint-workflows` CI job."
    expected: "actionlint type-checks the new `fallow` job + the extended `needs.*.result` graph clean (residual research uncertainty A1)."
    why_human: "actionlint is not provisioned on the Windows arm64 dev box (verified absent on PATH and as a local `./actionlint`). Deferred to the existing CI `lint-workflows` job per the Phase 6/7 precedent. The local `act --validate` parseability guard passed."
  - test: "Confirm `bash tools/act/act-compat.sh` passes with `ci/fallow SELECTED` on the Phase 11 PR's `act-compat` CI job."
    expected: "The new `assert_selected \"$PR_PLAN\" \"ci/fallow\" \"pull_request\"` assertion passes; all prior assertions still pass."
    why_human: "Docker is not running on the dev box (`no DOCKER_HOST`), so `act -n` cannot schedule the `changes`-dependent jobs (`test`/`e2e`/`fallow`/`ci`) locally. Deferred to the CI `act-compat` job per the documented Phase 7 precedent. `bash -n` syntax check and the static `act --validate` guard passed locally."
---

# Phase 11: Fallow code-quality CI gate Verification Report

**Phase Goal:** Adopt `fallow` (npm, the dead-code / duplication / complexity analyzer, v2.x -- 2.103.0) as a CI quality gate so newly-introduced dead code / duplication / over-complexity breaks CI LOUDLY, AND resolve the repo's current fallow findings so the gate is green on adoption. (Last phase of milestone v0.0.3.)
**Verified:** 2026-06-30T03:15:00Z
**Status:** human_needed
**Re-verification:** No -- initial verification

## Goal Achievement

Every automated must-have is VERIFIED against the actual codebase (not SUMMARY claims). The gate command was run independently in this verifier's process and exits 0 on a fully clean 0-finding tree; the engine regression suite was re-run green; all config / CI-wiring / pin / posture assertions were checked directly against the shipped files. Status is `human_needed` (not `passed`) ONLY because the gate's CI red/green behavior is authoritative only on a real GitHub Actions run, and the local-tooling checks (actionlint, `act -n` selection) are deferred to CI on the Windows arm64 dev box -- these are tracked human-verification items, not gaps.

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1   | `npx fallow audit --format json --base origin/main` exits 0 (verdict pass) | VERIFIED | Ran in verifier process: `FALLOW_EXIT=0`, `verdict: "pass"`, `base_ref: origin/main`, `head_sha 178cf4e`, merge-base `origin/main = 1e37d55` (matches RESEARCH). |
| 2   | Post-resolution tree has 0 dead-code findings | VERIFIED | `dead_code_issues: 0`, `dead_code_has_errors: false`, introduced 0 / inherited 0; `complexity_findings: 0`; `duplication_clone_groups: 0`; `stale_suppressions: 0`; `unused_dependencies: 0`. |
| 3   | Gate pinned `new-only` in config (deterministic) | VERIFIED | Audit JSON `attribution.gate: "new-only"`; `.fallowrc.jsonc` `audit.gate: "new-only"`. |
| 4   | `.fallowrc.jsonc` exists at repo root with all declared suppressions | VERIFIED | entry=drift.ts; ignoreExports=UNKNOWN_ERROR_CODE; overrides=unused-enum-members off on compiler-cli-types.ts + `fixtures/fault-isolation/**` off; rules.unused-dev-dependencies off; audit.gate new-only. Each has a JSONC comment. |
| 5   | `@angular/forms` removed from root deps, zero usage repo-wide | VERIFIED | `git grep @angular/forms` in package.json -> exit 1; repo-wide (packages/fixtures/e2e/tools) -> exit 1; lockfile `node_modules/@angular/forms` -> exit 1. |
| 6   | No IN-05 / publishConfig suppression exists | VERIFIED | `git grep -i publishConfig\|provenance\|IN-05 .fallowrc.jsonc` -> exit 1 (correctly absent). |
| 7   | `fallow` exact-pinned `2.103.0` root devDependency (no `^`/`~`) | VERIFIED | package.json devDependencies `"fallow": "2.103.0"`; lockfile root devDep spec `2.103.0`, `node_modules/fallow` version `2.103.0`; installed in node_modules. |
| 8   | `ci.yml` has a path-gated `fallow` job (negative form, Node 24, fetch-depth 0) | VERIFIED | Job `fallow:` at line 159; `needs: changes` + `if: ... code != 'false'` (3 such gates: test/e2e/fallow); `runs-on: ubuntu-latest`; `node-version: 24`; exactly one real `fetch-depth: 0` (line 167; line 153 is comment). |
| 9   | Gate command + FALLOW_AUDIT_BASE in the job | VERIFIED | `run: npx fallow audit --format json --base origin/main` (exactly once, line 173); `env: FALLOW_AUDIT_BASE: origin/main` (line 175). |
| 10  | `fallow` in the `ci` aggregate `needs:`; gate expression unchanged | VERIFIED | `needs: [changes, test, e2e, fallow, act-compat, lint-workflows]` (line 226); `contains(needs.*.result, 'failure')` still present once; `ci` job id/name unchanged. |
| 11  | Security posture preserved (SHA pins, contents: read, no SARIF, no PR-metadata) | VERIFIED | checkout SHA `93cb6e...` reused (6x), setup-node `a0853c...` reused (3x), no new SHA; single top-level `permissions: contents: read` (no job re-grant); no real `--ci`/`sarif`/`security-events` directive (only the explanatory comment at line 148); zero `github.event` interpolation (exit 1). |
| 12  | `act-compat.sh` asserts `ci/fallow` selected on pull_request | VERIFIED | Line 113: `assert_selected "$PR_PLAN" "ci/fallow" "pull_request"`; `bash -n` passes; not added to PUSH_MAIN/PUSH_TAG/DISPATCH; no assert_absent. |
| 13  | Engine regression backstop green (forms removal did not break engine) | VERIFIED | `nx run-many -t typecheck-drift test -p angular-typechecker --skip-nx-cache`: 26 test files, 147 tests passed; typecheck-drift + 1 dep task succeeded. |
| 14  | Fallow detector is live (gate is not a vacuous no-op) | VERIFIED | `npx fallow dead-code` returns 24 issues, exit 1 -- the detector genuinely finds code patterns; the `new-only` audit correctly attributes them all inherited (0 introduced) and passes. |

**Score:** 14/14 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `.fallowrc.jsonc` | config resolving all current findings | VERIFIED | Exists at repo root; all six declarations present with JSONC comments; corrected repo-root fixture glob `fixtures/fault-isolation/**`; validated against fallow 2.103.0 schema (11-REVIEW IN-01); audit exits 0. WIRED (auto-discovered by `npx fallow audit`, confirmed by the live run). Data flows: 61 entry points (`manual_entry: 1` = drift file active; `plugin: 56` Angular auto-detect). |
| `package.json` | fallow@2.103.0 pin + @angular/forms removed | VERIFIED | `"fallow": "2.103.0"` in devDependencies (exact); `@angular/forms` absent from dependencies. |
| `package-lock.json` | regenerated with fallow, without @angular/forms | VERIFIED | root devDep spec `2.103.0`; `node_modules/fallow` version `2.103.0`; no `@angular/forms` entry. |
| `.github/workflows/ci.yml` | the fallow job + ci.needs edit | VERIFIED | Job at line 159 between e2e and act-compat; `fallow` in `ci.needs`; threat-model header (lines 1-19) byte-unchanged; no job permissions block; no SARIF; no PR-metadata interpolation. WIRED into the aggregate gate. |
| `tools/act/act-compat.sh` | the ci/fallow assertion | VERIFIED | One line at 113 in the pull_request block; matches the `ci/<jobid>` family; `bash -n` clean. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `.fallowrc.jsonc` | `compiler-cli-types.drift.ts` | entry array declares the tsconfig-files-only drift tripwire reachable | WIRED | entry path present; drift file exists; audit shows `manual_entry: 1`, `unused_files: 0`. |
| `.fallowrc.jsonc` | `fixtures/fault-isolation/` | overrides glob scopes off intentional fixture findings | WIRED | Repo-root glob present; fixtures dir exists; audit `unrendered_components: 0`, `unused_component_inputs: 0`. |
| `ci.yml` fallow job | `.fallowrc.jsonc` | `npx fallow audit` auto-discovers the repo-root config | WIRED | Run step present; the live audit confirms the config is discovered and applied (gate=new-only). |
| `ci.yml` fallow job | `ci` aggregate gate | `fallow` in `ci.needs` globbed by `contains(needs.*.result, ...)` | WIRED | `needs: [changes, test, e2e, fallow, act-compat, lint-workflows]`; gate expression unchanged so it auto-includes `fallow`. |
| `act-compat.sh` | `ci.yml` fallow job | act labels the job `ci/fallow`; assertion proves selection | WIRED (static) | Assertion present + syntactically valid; runtime `act -n` selection deferred to CI (Docker unavailable locally). |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `.fallowrc.jsonc` | fallow audit attribution | live `npx fallow audit --base origin/main` over the git tree + import graph | Yes (61 entry points resolved, 122 changed files diffed vs `origin/main`, real merge-base `1e37d55`) | FLOWING |
| `ci.yml` fallow job | gate exit code | `npx fallow audit` exit status after `npm ci` | Yes (exit code gates; verified exit 0 locally; real-PR red/green is the human item) | FLOWING (CI confirmation pending) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Gate command exits 0 on clean tree | `npx fallow audit --format json --base origin/main` | exit 0, verdict pass, 0 findings | PASS |
| Fallow detector is functional (not a no-op) | `npx fallow dead-code --format json` | 24 issues, exit 1 | PASS |
| Engine unaffected by forms removal | `nx run-many -t typecheck-drift test -p angular-typechecker --skip-nx-cache` | 147 tests pass, typecheck-drift green | PASS |
| act-compat script syntax | `bash -n tools/act/act-compat.sh` | clean | PASS |
| actionlint on the new job | `./actionlint -color` | not provisioned on dev box | SKIP (deferred to CI lint-workflows) |
| `act -n` ci/fallow selection | `bash tools/act/act-compat.sh` | Docker unavailable on dev box | SKIP (deferred to CI act-compat) |

### Probe Execution

No conventional `scripts/*/tests/probe-*.sh` probes are declared for this phase. The gate command itself (`npx fallow audit`) and the act-compat suite serve as the runnable checks and were executed above. No `MISSING_PROBE`.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| QUAL-01 | 11-02 (also 11-01 frontmatter) | Path-gated, SHA-pinned `fallow` CI job (new-only) wired into the `ci` aggregate needs+gate | SATISFIED | Truths 8-11; the fallow job + ci.needs edit + preserved gate expression. Real-PR red/green is the tracked human item. |
| QUAL-02 | 11-01 | Hand-authored `.fallowrc.jsonc` resolves current findings (not baselined); audit exits 0 | SATISFIED | Truths 1-6; live audit exit 0, 0 findings, `@angular/forms` removed, no IN-05 suppression. |
| QUAL-03 | 11-01 + 11-02 | Exact-pinned `fallow` devDep + act-compat assertion + preserved security posture, no SARIF | SATISFIED | Truths 7, 11, 12; exact pin in package.json + lockfile, ci/fallow assertion, SHA pins / contents: read / no SARIF / no PR-metadata interpolation preserved. |

All three declared requirement IDs are accounted for. REQUIREMENTS.md maps exactly QUAL-01..03 to Phase 11 and marks all three Complete (lines 85-87); no orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (none) | -- | No debt markers (TBD/FIXME/XXX), no stubs, no placeholder returns in the 4 changed files | Info | The `.fallowrc.jsonc` `off` rule values and the SARIF/`--ci` mentions in ci.yml are documented config decisions / explanatory comments, not anti-patterns. The `rules.unused-dev-dependencies: off` is the deliberate D-06 structural fix with a documented reason. |

### Human Verification Required

The phase goal's CI behavior (a PR with introduced dead code must break the single required `ci` check LOUDLY) is authoritative only on a real GitHub Actions run. The following items must be confirmed before considering the gate fully proven in production:

1. **Throwaway dead-code PR goes red** -- Add an obviously-unused exported symbol on a throwaway branch, push a draft PR; confirm the `fallow` job and the aggregate `ci` check go red; confirm a clean PR is green. (QUAL-01; act's skipped/result arithmetic diverges from GitHub.)
2. **Phase 11 PR's own `ci` is green** -- Observe the phase PR's `ci` check green with the `fallow` job present. (QUAL-02 canonical proof.)
3. **WR-01: `origin/main` resolves in the CI checkout context** -- Confirm `git rev-parse --verify origin/main` resolves inside the `fallow` job on a real draft PR, so `--base origin/main` does not silently fall back to a merge-base. (Code-review Warning; robustness, not a proven defect. Locally `origin/main` resolves to `1e37d55` after `git fetch`.)
4. **actionlint green on the new job** -- Deferred to the CI `lint-workflows` job (actionlint not on the Windows arm64 dev box; `act --validate` parseability passed locally). Phase 6/7 precedent.
5. **`act -n` selects `ci/fallow`** -- Deferred to the CI `act-compat` job (Docker not running locally; `bash -n` + `act --validate` passed). Phase 6/7 precedent.

### Gaps Summary

No gaps. All 14 automated must-haves are VERIFIED directly against the shipped codebase, independent of SUMMARY claims:
- The gate command was run in this verifier's own process and exits 0 with verdict pass on a fully clean 0-finding tree (`stale_suppressions: 0` confirms no over-suppression; the detector independently returns 24 findings via `fallow dead-code`, proving the gate is live, not a no-op).
- `@angular/forms` is removed everywhere (package.json, repo-wide source, lockfile); `fallow@2.103.0` is exact-pinned in both package.json and the lockfile.
- The `fallow` CI job is correctly path-gated (negative form), SHA-pinned (reused pins, no new SHA), `fetch-depth: 0`, runs the exact gate command with `FALLOW_AUDIT_BASE`, is in the `ci` aggregate `needs:` with the gate expression unchanged, and adds no SARIF / job permissions / PR-metadata interpolation. The threat-model header is byte-unchanged.
- The engine regression suite stays green (147 tests + typecheck-drift), proving the dependency change did not regress the engine.

The status is `human_needed` solely because the items above (real-PR red/green CI behavior and the local-tooling deferrals to CI) are confirmable only on a real GitHub run -- the documented Manual-Only verifications (11-VALIDATION.md) and the code-review WR-01 Warning. These are expected, tracked, and consistent with the Phase 6/7 precedent for a CI-gate phase; they are not failures.

---

_Verified: 2026-06-30T03:15:00Z_
_Verifier: Claude (gsd-verifier)_
