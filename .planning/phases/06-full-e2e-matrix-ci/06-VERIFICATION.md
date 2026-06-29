---
phase: 06-full-e2e-matrix-ci
verified: 2026-06-29T02:30:00Z
status: human_needed
score: 2/3 must-haves verified (SC1 + SC2 verified locally; SC3 human-gated per RD-10)
overrides_applied: 0
human_verification:
  - test: "Open a throwaway draft PR (branch ci/validate-ci-matrix) on real GitHub runners to prove the full lean 6-cell matrix is GREEN and the aggregate `ci` gate passes"
    expected: "All 6 test cells (ubuntu 22/24/26 + windows 24/26 + macos 24) green; the Linux-only e2e job green (install-e2e + cache-e2e + matrix-e2e); act-compat green; lint-workflows green (actionlint clean); the aggregate `ci` job green. Then close the PR WITHOUT merging and land ci.yml on main via the existing direct-push flow (do NOT pre-adopt Phase 7's ruleset switch)."
    why_human: "RD-10: windows-latest + macos-latest CANNOT be emulated locally (act runs Linux containers only; the dev box is Windows arm64). The draft-PR matrix run on real GitHub runners is the only authoritative cross-OS proof. No push is allowed tonight. The aggregate gate's `skipped`-handling must also be confirmed there (act's needs.*.result/skipped semantics diverge from GitHub)."
---

# Phase 6: Full e2e Matrix + CI Verification Report

**Phase Goal:** The executor is validated across all five project types on a real installed package, and a cross-OS / multi-Node GitHub Actions matrix gates every change -- the slow, gating backstop for packaging, peer-range, path-normalization, and cross-OS bugs.
**Verified:** 2026-06-29
**Status:** human_needed
**Re-verification:** No -- initial verification

## Goal Achievement

This phase is `mode: mvp` but its ROADMAP goal is an outcome statement, not a User Story
(`/^As a .+, I want to .+, so that .+\.$/`). The User Flow Coverage section is therefore
dormant; goal-backward verification is applied against the three ROADMAP Success Criteria
(the roadmap contract), corroborated by the PLAN frontmatter must_haves of 06-01..06-05.

### Observable Truths

| #   | Truth (ROADMAP Success Criterion) | Status | Evidence |
| --- | --------------------------------- | ------ | -------- |
| SC1 | Executor validated e2e across all 5 project types (app, local lib, buildable lib, publishable lib, spec tsconfig) against the INSTALLED tarball, incl. a pnpm fixture + a mixed-case path assertion | VERIFIED (locally) | `nx run angular-typechecker-matrix-e2e:test --skip-nx-cache` -> **Tests 7 passed (7)**: 5 rows in `matrix-5types.int.spec.ts` (one per project type, green exit 0 then injected `TS2322` + no `ERR_REQUIRE_ESM`) + 2 in `pnpm-symlink.int.spec.ts`. Mixed-case backstop: `nx run angular-typechecker:test --skip-nx-cache` -> **114 passed**, incl. `filter-diagnostics.spec.ts` **13 tests** (mixed-case parity under both case modes + RD-04 .pnpm/.bun/plain store-dir generality) + `run-typecheck.integration.spec.ts` **13 tests** (host-derived `useCaseSensitiveFileNames`) on a live case-insensitive Windows arm64 box. Verified in the verifier's own process. |
| SC2 | GitHub Actions runs unit+integration on a Node 22/24/26 x Linux/Windows/macOS matrix (free standard public runners), heavy e2e Linux-only | VERIFIED | `.github/workflows/ci.yml` defines the LEAN 6-cell `matrix.include` (ubuntu 22/24/26 + windows 24/26 + macos 24, all 3 Node majors x all 3 OS represented), `fail-fast:false`, NO arm64 runners, NO `architecture` pin; a Linux-only Node-24 `e2e` job running the 3 serialized e2e projects by explicit list; `act-compat` + `lint-workflows` + the aggregate `ci` gate (id+name EXACTLY `ci`, `needs:[test,e2e,act-compat,lint-workflows]`, `if:always()`, fail-closed on failure\|cancelled\|skipped). `act --validate` exit 0 on both workflows; `tools/act/act-compat.sh` ran **12 passed / 0 failed** in the verifier's process (trigger/condition fidelity + the RD-07 tag-vs-branch publish discrimination). |
| SC3 | Full matrix GREEN on real runners + the required gate before merge/publish | HUMAN-NEEDED (by design, RD-10) | ci.yml is correctly authored + statically/locally validated (`act --validate` clean; act-compat 12/0). The cross-OS matrix-green proof requires a throwaway draft PR on real GitHub runners -- windows-latest/macos-latest cannot be emulated locally (act = Linux containers only; dev box is Windows arm64) and no push is allowed tonight. NOT a failure: classified `human_needed` per the locked RD-10 contract. |

**Score:** 2/3 truths verified (SC1 + SC2 verified locally; SC3 is the single human-gated item).

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `e2e/angular-typechecker-matrix-e2e/src/matrix-5types.int.spec.ts` | 5-type e2e, install-once, it.each over 5 targets, green + injected TS2322 | VERIFIED | `it.each(MATRIX_ROWS)` over exactly 5 targets; install-once `beforeAll`; 4-way assertion (non-zero + TS2322 token + no ERR_REQUIRE_ESM + no 'infrastructure error'); `--skip-nx-cache` per run (correctly busts the spec-row cache). 5 tests pass. |
| `e2e/angular-typechecker-matrix-e2e/src/pnpm-symlink.int.spec.ts` | pnpm symlinked-store e2e + realpath regression-guard (OUT-02 backstop) | VERIFIED | `pnpm add ... --config.frozen-lockfile=false --ignore-scripts`; `includeDeps:true` target; `lstatSync`/`realpathSync` PROBE gates the boundary-crossing guard with the documented Windows fallback. 2 tests pass. |
| `e2e/.../fixtures/consumer-workspace/**` (5-type fixture) | app, local-lib (+spec sibling), buildable-lib, publishable-lib; NO @nx/angular dep | VERIFIED | All 4 projects + 5 angular-typecheck targets present (local-lib carries both `angular-typecheck` and `angular-typecheck-spec`); build markers `@nx/angular:ng-packagr-lite` / `@nx/angular:package` are structural-only; `package.json` contains NO `@nx/angular` (OQ-1/B-03 preserved); pins 22.0.4 present. |
| `e2e/.../fixtures/consumer-workspace/pnpm-lock.yaml` | committed lockfile (v9.0, pnpm 11.9.0) | VERIFIED | Present on disk; referenced by the pnpm spec; removed from the npm-install copy at runtime (avoids the js/dependencies-and-lockfile graph hard-fail). |
| `packages/.../filter-diagnostics.spec.ts` | extended D-10 mixed-case + RD-04 store-dir generality | VERIFIED | Contains `RD-04`, `.pnpm`, `.bun`, both `useCaseSensitiveFileNames: true` and `: false`; 13 tests green. |
| `packages/.../run-typecheck.integration.spec.ts` | host-derived useCaseSensitiveFileNames assertion | VERIFIED | References `getTsProgram`/`useCaseSensitiveFileNames`; 13 tests green (real compiler). |
| `.github/workflows/ci.yml` | lean 6-cell matrix + Linux-only e2e + act-compat + lint-workflows + aggregate `ci` gate | VERIFIED | `name: ci`; `on: { pull_request:{}, push:{branches:[main]} }`; `permissions: contents: read`; 6-cell `matrix.include`; `needs:[test,e2e,act-compat,lint-workflows]`; `contains(needs.*.result,'failure'\|'cancelled'\|'skipped')`; checkout/setup-node SHAs reused from release.yml; pnpm/action-setup SHA-pinned; no registry-url; no pull_request_target. |
| `tools/act/act-compat.sh` + `tools/act/events/*.json` | container-free act --validate + act -n per trigger | VERIFIED | `act --validate` + `act -n` per trigger; captures plans then asserts with `rg`; ASCII-only; all 4 event payloads present (push-tag carries `refs/tags/angular-typechecker@`, push-main carries `refs/heads/main`). Ran 12/0 locally. |
| `.actrc` | native-arm64 runner-image mapping | VERIFIED | Maps `ubuntu-latest` + `ubuntu-24.04` -> `catthehacker/ubuntu:act-24.04`; no forced `--container-architecture linux/amd64`. |
| `.github/workflows/release.yml` (RD-07 ref gate) | publish-job `if: startsWith(github.ref,'refs/tags/angular-typechecker@')`; OIDC model unchanged | VERIFIED | Comment-stripped structural assertion: the `if:` gate present; all `uses:` 40-char SHA; `id-token: write`; no `contents: write`; `registry-url` retained; `NPM_CONFIG_PROVENANCE: true`; `persist-credentials: false`; no `pull_request_target`; no `NODE_AUTH_TOKEN`. |
| `.nxignore` (DI-06-01) | excludes the matrix-e2e fixtures from the main graph | VERIFIED | `nx show projects` lists `angular-typechecker-matrix-e2e` but NOT the 4 fixture sub-projects -> the release `preVersionCommand` (`nx run-many -t build`) no longer fails on ng-packagr. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| matrix-5types spec | 5 fixture targets (published id) | `npx nx run <target> --output-style=static --skip-nx-cache` over it.each | WIRED | All 5 targets resolve the published `angular-typechecker:angular-typecheck` id; ran green + injected. |
| matrix/pnpm specs | the packed tarball | `nx build --skip-nx-cache` -> `npm pack` -> cpSync -> `npm install`/`pnpm add` | WIRED | Install-once beforeAll; executors.json sanity check asserts the executor resolves from the install. |
| ci.yml e2e job | 3 serialized e2e projects | `nx run-many -t test -p install-e2e cache-e2e matrix-e2e` | WIRED | Explicit project list present at ci.yml line 86-88. |
| ci.yml ci gate | Phase 7 Default branch ruleset | `needs:[...4 jobs] + if:always() + contains(needs.*.result,...)` | WIRED | Aggregate `ci` job id+name EXACTLY `ci`; robust fail-closed form. |
| act-compat.sh | ci.yml + release.yml if: gate | `act -n -e events/<trigger>.json --env GITHUB_REF=...` | WIRED + RUN | 12/0: push-tag -> release/publish SELECTED; push-main -> SKIPPED; pull_request -> all ci jobs, no publish. |
| release.yml publish job | tag-ref gate | `if: startsWith(github.ref,'refs/tags/angular-typechecker@')` | WIRED | Present at job level; act-discriminable (proven by act-compat). |

### Data-Flow Trace (Level 4)

Not applicable in the rendering-dynamic-data sense -- this phase ships test specs + CI
workflow YAML, not data-rendering UI artifacts. The equivalent "real data flows" check is
the e2e behavioral run: the specs install the REAL freshly-packed tarball and run the REAL
executor (not a stub), surfacing a REAL injected `TS2322` per type -- verified by the 7-test
green run, not by a hardcoded return.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Plugin unit+integration suite green (mixed-case backstop) | `nx run angular-typechecker:test --skip-nx-cache` | Test Files 20 passed; Tests 114 passed | PASS |
| 5-type + pnpm e2e against installed tarball | `nx run angular-typechecker-matrix-e2e:test --skip-nx-cache` | Test Files 2 passed; Tests 7 passed (5 types green+injected TS2322 + 2 pnpm) | PASS |
| matrix-e2e registered in Nx graph; fixtures excluded | `nx show projects` | matrix-e2e present; app/local-lib/buildable-lib/publishable-lib absent | PASS |
| DI-06-01 resolved (no ng-packagr leak into main graph) | `nx show projects` filter | NO_FIXTURE_LEAK | PASS |

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| act parseability (Req 2) | `act --validate` | exit 0, both workflows parse | PASS |
| act trigger/condition fidelity (Req 1) | `bash tools/act/act-compat.sh` | `=== summary: 12 passed, 0 failed ===`, exit 0 | PASS |

The SUMMARY's "12 passed locally" claim was NOT trusted -- it was re-run in the verifier's
own process (Docker present; act v0.2.89 installed) and independently reproduced 12/0.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| TEST-03 | 06-01, 06-02 | Executor validated across all 5 project types | SATISFIED (locally) | matrix-e2e 5-type spec + pnpm spec green (7/7); fixture carries all 5 type shapes; full-matrix-green on real runners is the SC3 human item |
| CI-01 | 06-04, 06-05 | GitHub Actions Node x OS matrix; e2e Linux-only | SATISFIED (authored + locally validated) | ci.yml lean 6-cell matrix + Linux-only e2e + aggregate gate; act-compat 12/0; release.yml ref gate; matrix-green-on-real-runners is the SC3 human item |
| OUT-02 (backstop) | 06-03 | realpath/case-insensitive-FS-safe filtering | SATISFIED | filter-diagnostics 13 tests (mixed-case + .pnpm/.bun/plain store-dir generality) + host-derived case-sensitivity integration assertion green on a live case-insensitive box; pnpm realpath regression-guard (Linux teeth on the draft PR) |

No ORPHANED requirements: REQUIREMENTS.md maps exactly TEST-03 + CI-01 to Phase 6 (OUT-02
is a Phase-3 requirement intentionally backstopped here per 06-03). All accounted for.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (none) | - | No TBD/FIXME/XXX in any phase-modified source/CI/script file | - | Clean -- completion is auditable |
| (none) | - | No TODO/HACK/PLACEHOLDER/"not yet implemented" in the specs/ci.yml/act-compat.sh | - | No stubs |

The interspersed `NX Running target ... failed` lines in the e2e output are the EXPECTED
non-zero exits the specs capture via `execSync`'s catch (the injected-error rows) -- the
Vitest summary (`Tests 7 passed (7)`) is the authority. Not a defect.

### Human Verification Required

#### 1. Draft-PR full-matrix-green proof (SC3, RD-10)

**Test:** Push a throwaway `ci/validate-ci-matrix` branch and open a DRAFT PR so `ci.yml`
runs on real GitHub-hosted runners.
**Expected:** All 6 `test` cells green (ubuntu 22/24/26 + windows 24/26 + macos 24); the
Linux-only `e2e` job green (install-e2e + cache-e2e + matrix-e2e -- the pnpm realpath guard
gets its true cross-boundary teeth on the Linux leg where pnpm makes real symlinks); the
`act-compat` job green; the `lint-workflows` (actionlint) job green; the aggregate `ci`
gate green (its `skipped`-handling confirmed here -- act's semantics diverge). Then CLOSE
the PR without merging and land `ci.yml` on `main` via the existing direct-push flow. Do
NOT enable the "Default branch" ruleset or wire `ci` into required checks (that is Phase 7).
**Why human:** windows-latest + macos-latest cannot be emulated locally (act is Linux-only;
the dev box is Windows arm64); no push is permitted tonight. This is the locked RD-10
contract -- SC3 is human-gated and must NOT fail the phase.

Note: actionlint is NOT installed on the dev box, so the local actionlint clean-pass is
deferred to the `lint-workflows` job on this same draft PR. `act --validate` (run here)
confirms both workflows are act-parseable; ci.yml was authored to be actionlint-clean.

### Gaps Summary

No BLOCKERs. SC1 (all 5 project types + pnpm + mixed-case against the installed tarball)
and SC2 (the 6-cell matrix + Linux-only e2e + act-compat + lint-workflows + the aggregate
`ci` gate, with the RD-07 tag-vs-branch discrimination) are both VERIFIED in the verifier's
own process -- not merely trusted from the SUMMARYs. The only open item is SC3's
matrix-green-on-real-runners proof, which is HUMAN-GATED by design (RD-10: requires a draft
PR on windows-latest/macos-latest that cannot be exercised locally and cannot be pushed
tonight). ci.yml is correctly authored and locally/statically validated. Status is
`human_needed`, not `passed` -- per the decision tree a non-empty human-verification section
takes priority over a clean local score.

---

_Verified: 2026-06-29_
_Verifier: Claude (gsd-verifier)_
