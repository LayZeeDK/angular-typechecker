---
phase: 34
slug: per-project-sarif-categories-in-ci
status: audited
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-21
audited: 2026-07-21
---

# Phase 34 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Status legend (ASCII): `pending` / `green` / `red` / `flaky`; File Exists: `yes` / `no (W0)`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x via `@nx/vitest:test` |
| **Config file** | `packages/angular-typechecker/vitest.config.mts` (unit `test` target) |
| **Quick run command** | `npx nx test angular-typechecker` |
| **Full suite command** | `npx nx run-many -t test` then `npx nx run-many -t typecheck` (spec type-checking -- `nx test`/esbuild does NOT type-check specs) |
| **Estimated runtime** | ~30-60 seconds (unit tier) |

---

## Sampling Rate

- **After every task commit:** Run `npx nx test angular-typechecker` (the two new specs)
- **After every plan wave:** Run `npx nx run-many -t test` + `npx nx run-many -t typecheck`
- **Before `/gsd:verify-work`:** Full `test` + `typecheck` + `lint` (maxWarnings:0) + `format:check` green
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

*Task IDs are assigned at planning (step 8); this map is requirement-oriented until PLAN.md exists.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 34-01-T2 | 01 | 1 | MULTI-01 | -- | Merge of N single-run files -> one file with N `runs[]`, each `automationDetails.id = angular-typecheck/<name>`; empty/0-run inputs skipped; SARIF envelope preserved; zero-run all-empty input writes no file | unit (subprocess) | `npx nx test angular-typechecker` | yes | green |
| 34-01-T2 | 01 | 1 | MULTI-01 | -- | Envelope is preserved from the first entry that actually contributes a run, not merely the first entry discovered (the alphabetically-first project can parse OK yet contribute zero runs) | unit (subprocess) | `npx nx test angular-typechecker` | yes | green -- ADDED by this audit |
| 34-01-T2 | 01 | 1 | MULTI-02 | T-34 silent-drop | Discovery name-set === independent enumeration (excludes `e2e/*/fixtures/` AND workspace-root `@angular-typechecker/source`); discovery throws on empty set | unit (drift guard) | `npx nx test angular-typechecker` | yes | green |
| 34-01-T2 | 01 | 1 | MULTI-02 | -- | Discovery tolerates a stray dir / falsy name / missing `apps` or `libs` (robustness; mirrors the B3 test in `ci-e2e-coverage-guard.spec.ts`) | unit | `npx nx test angular-typechecker` | yes | green |
| 34-01-T2 | 01 | 1 | MULTI-02 | -- | Discovery unions `tsConfig` across every matching target on one project (not just the first, WR-01 regression) | unit | `npx nx test angular-typechecker` | yes | green |
| 34-01-T3 | 01 | 1 | MULTI-01 (D-05) | T-34-01/02/03/05 | `atc-sarif` step wired to `merge-sarif.mjs`; no-category upload; fork gate + SHA pin + job permissions unchanged | structural (manual git-grep, executed at plan time) | `git grep` / `git diff` (see PLAN.md Task 3 `<verify>`) | n/a (structural) | green (not a persistent regression spec -- see Audit Trail note) |

---

## Wave 0 Requirements

- [x] `packages/angular-typechecker/src/multi-typecheck-discovery-guard.spec.ts` -- the MULTI-02 drift guard (D-04): discovery output == independent root-agnostic enumeration (subtract e2e fixtures + root project). Confirmed genuinely discriminating: the real repo's `libs/test-util/project.json` declares a target literally NAMED `typecheck` with executor `nx:run-commands` (not `angular-typechecker:typecheck`) -- a name-match regression in `list-typecheck-projects.mjs` would surface it as a 5th consumer and this guard would go RED against its own independently-computed executor-filtered enumeration. Also covers a stray-subdir/falsy-name robustness case and a multi-target tsConfig-union regression case.
- [x] A merge-shape unit spec for `tools/ci/merge-sarif.mjs` -- MULTI-01: write fake single-run SARIF parts to a temp dir (or stub the CLI spawn), assert merged `runs[]` count + per-run `automationDetails.id` + empty-input skip. May share the guard spec file or a sibling; mirror the `execFileSync`/temp-root style of `ci-e2e-coverage-guard.spec.ts`'s B3 test. **This audit added a third case** (envelope-selection ordering independence, see Audit Trail) closing the one real behavioral gap found.
- Framework install: NONE (Vitest present).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Merged file is ACCEPTED by GitHub and lands as N distinct analyses `angular-typecheck/<project>` | MULTI-01 (end-to-end) | GitHub Code Scanning ingestion is asynchronous + server-side; local schema-validate / actionlint / act-compat all pass while GitHub can still reject (multi-run-same-category class). Not locally provable. | On a PR, `gh api repos/LayZeeDK/angular-typechecker/code-scanning/analyses?tool_name=angular-typechecker&ref=refs/pull/<n>/merge` and assert one analysis per `angular-typecheck/<project>` category. Phase 35 (PROOF) automates this. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (the two new specs, now with a third case added)
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** APPROVED (gsd-nyquist-auditor, 2026-07-21) -- see Audit Trail below.

---

## Audit Trail (retroactive Nyquist audit, 2026-07-21)

**Context:** entered STATE A -- both Wave-0 specs (`multi-typecheck-discovery-guard.spec.ts`, `merge-sarif.spec.ts`) already existed and were reported green in `34-01-SUMMARY.md`. This audit independently re-verified genuineness of coverage rather than accepting the SUMMARY's self-report, then filled the one real gap found.

**Baseline re-run (before any change):** `npx nx test angular-typechecker --skip-nx-cache` -> 55 files / 570 tests passed. Confirms the SUMMARY's claim was not stale.

**MULTI-02 (discovery + drift guard) -- audited as genuinely COVERED, no gap:**
- The set-equality test (`discovery output equals the independent root-agnostic enumeration`) is non-vacuous (asserts `independent.length > 0` before the equality) and execs the real CLI, not a stub.
- Verified the executor-vs-target-name distinction (D-01a, the plan's explicitly-called-out Pitfall 2) is NOT incidental: `libs/test-util/project.json` in this real repo declares a target literally named `"typecheck"` with `executor: "nx:run-commands"`. Because the guard's own `independentTypecheckProjects()` filters by the `executor` field (never target name) and the real CLI does too, both sides correctly exclude `test-util`; a regression to a name-match in `list-typecheck-projects.mjs` would make `discovered` include `test-util` while `independent` would not, producing a real, located RED. This is genuine adversarial coverage from the real workspace, not a synthetic-only proof.
- Robustness (stray dir, falsy name) and the WR-01 multi-target tsConfig-union case are both exercised via real CLI execution (`execFileSync`) against a synthetic temp workspace -- correct technique per the "no cross-project import" constraint.
- **Noted but not blocking (WARNING, partial-coverage caveat):** the drift guard proves the discovered *name set* matches the four real consumers, but no persistent spec asserts the *tsConfig path values* for the real repo's four consumers (e.g. `ng-spike-app -> apps/ng-spike-app/tsconfig.app.json`) -- that fidelity was checked once as a manual "smoke" step during Task 1 execution (recorded in SUMMARY.md), not as a regression gate. A future edit that broke a real project's `tsConfig` path (typo) while leaving its name/executor untouched would not be caught by any automated test today. This is out of MULTI-02's stated Wave-0 scope (name-set drift, not tsConfig-value fidelity) and would fail loudly at real CI runtime (broken path -> tsc error) rather than silently, so it does not rise to BLOCKER; flagged here as a WARNING for future phases rather than filled, to avoid a brittle test that breaks on every legitimate tsConfig path change.

**MULTI-01 (merge shape) -- audited, ONE real gap found and FILLED:**
- The two existing cases (2-valid+1-empty merge; all-empty writes-nothing) genuinely exercise the CLI-level `collectEntries` skip (empty stdout) via a real subprocess run against a hermetic temp workspace + stub `dist/.../cli/bin.js` -- correct technique, not testing a simpler stand-in behavior.
- **Gap found:** the must_haves text specifies the envelope is "preserved from the first VALID run" (not simply "the first run"), which only means something distinct from "the first run" when an earlier, alphabetically-first-discovered project's doc PARSES successfully (non-empty stdout, valid JSON) but contributes zero runs (`doc.runs` present but empty/missing `[0]`) -- the separate `if (!run) continue;` skip path INSIDE `mergeSarifRuns`, as opposed to the CLI-level empty-stdout skip in `collectEntries`. In the existing test the alphabetically-first project (`proj-a`) was always the first VALID one too, so this path was never exercised at any level -- a regression that moved the `envelope ??= ...` assignment before the `!run` check (or otherwise sourced the envelope from `entries[0]` unconditionally) would have passed both existing tests while violating the stated requirement.
- **Fix applied:** added a third test in `merge-sarif.spec.ts` -- `'aaa-no-run'` (sorts first, stub emits valid JSON with `runs: []`) and `'zzz-has-run'` (sorts second, stub emits a real run) -- asserting the merged file has exactly 1 run, id `angular-typecheck/zzz-has-run`, and envelope `{version: 'has-run-version', $schema: 'has-run-schema'}` (i.e. NOT the no-run project's distinct envelope values, which would leak through under the buggy ordering). This is a genuinely adversarial test: it is GREEN against the current correct implementation and would go RED against the described regression. Also refactored the existing `writeStubBin(root)` helper to accept an optional custom stub script (default = the existing `STUB_BIN`), so the new case reuses the fixture-writing helpers without touching the two already-passing tests.
- Re-ran `npx nx test angular-typechecker --skip-nx-cache` (full suite, 55 files / 571 tests -- the new test is genuinely counted and green), `npx nx typecheck angular-typechecker --skip-nx-cache` (clean), `npx nx lint angular-typechecker --skip-nx-cache` (0 warnings), `npx nx format:check --skip-nx-cache` (exit 0).

**MULTI-01 end-to-end (real-CI-only) -- correctly classified, not a gap:** the "merged file lands as N distinct GitHub Code Scanning analyses" contract is genuinely unprovable locally (async, server-side ingestion). Confirmed this is properly scoped as `manual_procedural` / `human_judgment: true` in the SUMMARY's coverage table and in this VALIDATION.md's Manual-Only Verifications section, deferred to Phase 35 (PROOF) rather than mis-classified as a local MISSING gap. No action needed.

**D-05 (ci.yml structural wiring) -- observation, not this audit's gap to fill:** verified via `git grep`/`git diff` at Task 3 execution time (recorded in SUMMARY.md) plus the pre-existing `ci-e2e-coverage-guard.spec.ts` GUARD-01 family (confirms ci.yml still parses/structurally holds post-edit, though those specs target the e2e job, not code-scanning specifically). There is no persistent spec asserting "the atc-sarif step invokes `node tools/ci/merge-sarif.mjs`" or "the angular-typechecker upload has no `category` key" that would catch a future silent regression of the code-scanning job's wiring. This is out of the `<coverage_to_verify>` scope handed to this audit (framed as MULTI-01/MULTI-02 only) and `ci.yml` is an implementation file this audit may not modify with a new persistent test without exceeding the given gap list; flagged here for visibility, not filled.

**Verdict: nyquist_compliant.** MULTI-01 and MULTI-02 are both genuinely, adversarially covered (one real gap found and closed by this audit); the sole remaining real-CI-only item is correctly classified as manual/deferred, not a local coverage gap.
