---
phase: quick-260715-050
verified: 2026-07-15T09:38:08Z
status: passed
score: 8/8 must-haves verified
overrides_applied: 0
design_evolution: >
  The PLAN.md frontmatter must_haves describe an EARLY build-artifact design (a `build`
  job uploading `dist` + `.nx/cache` for e2e cells to replay as an nx cache hit). CI
  MEASURED that design a no-op (nx rejects a cross-runner `.nx/cache` as
  `unknown-local-cache`) and the user DELIBERATELY superseded it. The authoritative
  shipped spec is 260715-050-MEASUREMENTS.md (DECISION + Applied config + AFTER-A/B) +
  260715-050-SUMMARY.md. The absence of the build job / artifact upload/download /
  `fromJSON(needs.build...)` is the INTENDED outcome, NOT a gap. Verified against the
  shipped Lever A design (lean `discover` job + per-cell build).
---

# Quick Task 260715-050: Optimize e2e-tier CI wall-clock -- Verification Report

**Task Goal:** Optimize the e2e tier's CI wall-clock by splitting the e2e work into
multiple CI jobs (and/or applying the parked nub cache). Must verify in CI, measure, and
compare the delta.
**Verified:** 2026-07-15T09:38:08Z
**Status:** passed
**Re-verification:** No -- initial verification
**HEAD:** c7eabb4 (`ci(e2e): split the e2e tier into a per-project matrix (~41% faster CI)`)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | ci.yml has a lean `discover` job (runs `node tools/ci/list-e2e-projects.mjs` -> `outputs.projects`) | VERIFIED | ci.yml:153-174 -- `discover:` job, `projects: ${{ steps.list.outputs.projects }}`, step runs `projects=$(node tools/ci/list-e2e-projects.mjs)` as a separate assignment (fail-loud under `set -e`, not `echo "$(...)"`) |
| 2 | e2e job is a DYNAMIC per-project matrix `fromJSON(needs.discover.outputs.projects || '[...]')` | VERIFIED | ci.yml:202-209 -- `strategy.matrix.project: ${{ fromJSON(needs.discover.outputs.projects || '[...4 known...]') }}`, `needs: [changes, discover]`; each cell runs `run-many -t typecheck`/`-t e2e -p ${{ matrix.project }}` (ci.yml:244,250) |
| 3 | `discover` is in the `ci` aggregate `needs` (cell/discover failure fails `ci`) | VERIFIED | ci.yml:404-415 -- `discover` listed in `ci.needs`; existing `contains(needs.*.result, 'failure'\|'cancelled')` gate (ci.yml:421) |
| 4 | NO build job, NO upload/download-artifact, NO actions/cache (Lever B discarded) | VERIFIED | `git grep` of ci.yml for `upload-artifact`/`download-artifact`/`actions/cache`/`fromJSON(needs.build`/`nx build angular-typechecker`/`^  build:` -> ZERO matches (all superseded, as intended) |
| 5 | `tools/ci/list-e2e-projects.mjs` exists and emits exactly the 4 e2e projects | VERIFIED | Ran it: `["angular-typechecker-cache-e2e","angular-typechecker-install-e2e","angular-typechecker-matrix-e2e","angular-typechecker-ng-cli-e2e"]` |
| 6 | e2e-target `dependsOn: angular-typechecker:build` INTACT on all 4 e2e project.jsons (per-cell build; local dev + GUARD-01e preserved) | VERIFIED | `git grep` shows all 4 e2e project.jsons carry `"dependsOn": [{ "projects": ["angular-typechecker"], "target": "build" }]`; GUARD-01e green |
| 7 | GUARD-01/01b/01c/01d/01e pass (dynamic-matrix wiring + discovery-script consistency asserted) | VERIFIED | `nx test angular-typechecker`: 39 files / 373 tests passed, incl. `ci-e2e-coverage-guard.spec.ts` (15 tests) with the new "discover script enumerates EXACTLY the e2e/* projects" check |
| 8 | `.fallowrc.jsonc` declares `tools/ci/list-e2e-projects.mjs` as an `entry` | VERIFIED | .fallowrc.jsonc:53 (inside the `entries` array, with a rationale comment) |
| 9 | CI verified + measured + delta COMPARED (620s -> ~366s, ~41%; Lever B null result) | VERIFIED | MEASUREMENTS.md AFTER-A + AFTER-B; corroborated against real CI run metadata (see Behavioral Spot-Checks) |
| 10 | Safety: no package.json version mutation; throwaway PR #36 closed + branch deleted; nothing pushed to main; no ruleset edit | VERIFIED | version still `0.2.0`; PR #36 state=CLOSED; scratch branch `260715-050-e2e-split-probe` gone from remote (ls-remote empty; `fetch --prune` would drop the stale local ref); HEAD commit touches only 4 files (no settings/ruleset); feature-branch commits are additive/local-only |

**Score:** 8/8 must-haves verified (the 7 orchestrator-specified checks + safety, consolidated; the two design-superseded frontmatter must_haves are the intended outcome, not counted as failures)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.github/workflows/ci.yml` | Lean `discover` job + dynamic per-project `e2e` matrix; `discover` in `ci` needs; NO build/artifact/cache | VERIFIED | Substantive (116 lines changed), wired (`discover` -> `e2e` -> `ci`), fs-read discovery flows real project list |
| `tools/ci/list-e2e-projects.mjs` | Dynamic e2e-project discovery (pure `node:fs`, no nx/npm) | VERIFIED | 51 lines; exports `listE2eProjects`; CLI prints compact JSON; emits the 4 projects when run |
| `packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts` | GUARD-01b `--parallel=2` assertion replaced by dynamic-matrix wiring + discovery-script consistency; 4 retained invariants intact | VERIFIED | GUARD-01b now asserts `fromJSON(needs.discover.outputs.projects)`, the `list-e2e-projects.mjs` command, `run-many -t e2e`, discovery==enumeration, plus pack-destination / install-e2e / cache-e2e parallelism:false / no-in-spec-build (all green) |
| `.fallowrc.jsonc` | `tools/ci/list-e2e-projects.mjs` as an `entry` | VERIFIED | Line 53 |
| `260715-050-MEASUREMENTS.md` | AFTER-A + AFTER-B measurements + per-lever verdicts + Applied config | VERIFIED | Baseline 620s, AFTER-A 366s (~41%), Lever B null result, Applied config = Lever A only |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `discover` job | `needs.discover.outputs.projects` | `node tools/ci/list-e2e-projects.mjs` -> `$GITHUB_OUTPUT` | WIRED | ci.yml:171-174 |
| `e2e` matrix | `needs.discover.outputs.projects` | `fromJSON(... \|\| '[...4 known...]')` with act-`-n` fallback | WIRED | ci.yml:203,209 |
| e2e cell | `angular-typechecker:build` | per-cell `dependsOn: build` (no `--skip-nx-cache`; no artifact) | WIRED | 4x e2e project.json + GUARD-01e |
| `ci` aggregate | `discover` + `e2e` | `contains(needs.*.result, 'failure'\|'cancelled')` | WIRED | ci.yml:404-415,421 |
| discovery CLI | GUARD-01 enumeration | GUARD-01b `execSync` equality assertion | WIRED | guard spec:275-290 (green) |

### Behavioral Spot-Checks

| Behavior | Command / source | Result | Status |
|----------|------------------|--------|--------|
| Discovery script emits 4 projects | `node tools/ci/list-e2e-projects.mjs` | 4-element JSON array | PASS |
| Guard suite green | `nx test angular-typechecker` | 373/373 tests pass (guard spec 15/15) | PASS |
| No Lever B leftovers | `git grep` ci.yml for artifact/cache/build | 0 matches | PASS |
| AFTER-A CI corroboration | `gh run view 29396866900` | discover 6s; ng-cli 356s (floor), install 293s, matrix 80s, cache 76s -> 366s tier wall; all discover/e2e cells SUCCESS (only red = orthogonal fallow finding, later fixed) | PASS |
| Full-green split CI gate | `gh run view 29402336635` | overall + `ci` aggregate = SUCCESS | PASS |
| Baseline single-job e2e | `gh run view 29369041238` | e2e job = 620s SUCCESS | PASS |
| Lever B miss/hit run | `gh run view 29403722214` | SUCCESS (both attempts green; opposite-sign delta => null result) | PASS |

**Delta (independently corroborated from CI run metadata):** 620s -> 366s = 254s saved / ~41% faster. Meets the KEEP-A criterion (> ~90s AND > ~15%) decisively.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| QUICK-260715-050 | 260715-050-PLAN.md | Optimize e2e-tier CI wall-clock; split into multiple CI jobs and/or apply the parked cache; verify in CI, measure, compare the delta | SATISFIED | Per-project matrix shipped (Lever A); Lever B measured + discarded; delta measured on real CI (620->366s, ~41%) and recorded in MEASUREMENTS.md |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | -- | -- | -- | No debt markers (TBD/FIXME/XXX/TODO), no stubs, no empty implementations in the 4 changed files |

The `|| '[...4 known projects...]'` hardcoded fallback in the e2e matrix is intentional and documented (act `-n` dry-run convenience: empty `needs.discover.outputs.projects` would make bare `fromJSON('')` error and drop `ci/e2e` from the act plan); real CI always uses the discover-job output. Not a stub.

### Human Verification Required

None. The one item the task flagged as potentially human-only -- the exact CI run states -- was verified directly by reading the recorded run metadata (run IDs 29396866900, 29402336635, 29403722214, 29369041238) via `gh run view` (metadata read, not a CI re-run). All corroborate MEASUREMENTS.md. The act-compat / lint / format-lint local gates are covered by the full-green CI run 29402336635 (those jobs are part of the `ci` workflow that reported success).

### Gaps Summary

No gaps. The shipped Lever A outcome is delivered, measured on real CI, and safe:

- The e2e tier is a dynamic per-project matrix fed by a lean fs-read `discover` job; the four e2e projects now run on separate runners in parallel instead of serially in one job.
- The dynamic `fromJSON(needs.discover.outputs.projects)` wiring + GUARD-01b's discovery-script consistency check auto-cover any future e2e project with no static list to drift.
- Per-cell build via the untouched `dependsOn: angular-typechecker:build` preserves local dev + GUARD-01e; the superseded build/artifact/cache apparatus is correctly absent (nx rejects a cross-runner `.nx/cache`).
- CI wall-clock: 620s -> ~366s (~41% faster), fully green on the whole `ci` gate; Lever B (per-cell Verdaccio cache) was measured and discarded as within CI noise.
- Safety intact: version unchanged (0.2.0), throwaway PR #36 closed + scratch branch deleted, nothing pushed to main, no ruleset edit, no new permission scope.

Deferred (by explicit user decision, NOT gaps): the GitHub-backed Nx remote cache is ROADMAP Phase 25; a sub-project (per-PM/custom-bucket) split to lower the ng-cli-e2e ~356s floor is a possible future follow-up.

---

_Verified: 2026-07-15T09:38:08Z_
_Verifier: Claude (gsd-verifier)_
