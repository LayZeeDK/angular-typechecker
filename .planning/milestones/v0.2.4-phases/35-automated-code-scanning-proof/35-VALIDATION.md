---
phase: 35
slug: automated-code-scanning-proof
status: audited
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-21
audited: 2026-07-22
---

# Phase 35 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Status legend (ASCII): `pending` / `green` / `red` / `flaky`; File Exists: `yes` / `no (W0)`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x via `@nx/vitest:test` |
| **Config file** | `packages/angular-typechecker/vitest.config.mts` (unit / `test`); `vitest.integration.config.mts` (`integration` target) |
| **Quick run command** | `npx nx run-many -t test` |
| **Full suite command** | `npx nx run-many -t test && npx nx run-many -t integration` |
| **Current counts (re-verified 2026-07-22)** | unit **578** tests / 58 files (575 pre-audit + 3 new gap-closure tests), all green; integration **156** tests / 24 files, all green |

**KEY:** `nx test` EXCLUDES `*.integration.spec.ts`; the integration tier runs under the separate `integration` target. The local drift-lock (PROOF-01's fixture-to-reporter half) is an INTEGRATION spec (real cold compiler over the fixture), so it runs under `nx integration`, not `nx test`.

---

## Sampling Rate

- **After every task commit:** Run `npx nx run-many -t test` (fast unit tier) + `npx nx integration angular-typechecker` when the drift-lock spec changes.
- **After every plan wave:** Run `npx nx run-many -t test && npx nx run-many -t integration` + `npx nx format:check` + `npx nx run-many -t lint` + `npx fallow audit --format human --base origin/main`.
- **Before `/gsd:verify-work`:** Full suite must be green.
- **Phase gate (authoritative):** the `code-scanning-proof` job GREEN on a real PR against `main` -- the ONLY place the SARIF->ingestion assertion is exercised.
- **Max feedback latency:** ~120 seconds (local); real-CI ingestion adds async latency (bounded poll).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 35-01-T3 | 01 | 1 | PROOF-01 | T-35-09 | ONE shipped-CLI run over the fixture emits exactly one diagnostic per family (TS2322/typescript/error, NG8002/template-type-check/error, extended NG8xxx/extended-diagnostics/warning, ATC90002/tool/error) in ONE SARIF run; asserts the SET of (family tag, level) tuples equals the CI assert's expected set | integration (drift-lock, real cold compiler) | `npx nx integration angular-typechecker` | yes | green -- re-run 2026-07-22, `describe('SARIF reporter integration -- sarif-proof-fixture (one rule per family, one run)')` in `packages/angular-typechecker/src/core/machine-reporters-sarif.integration.spec.ts` (4 `it`s), all pass |
| 35-01-T1 | 01 | 1 | PROOF-01 | T-35-07 | Fixture stays structurally OUTSIDE the Nx project graph (no `project.json`, no `tsconfig.missing.json`, not swept by `tsconfig.tools.json`'s explicit allowlist) so its deliberate one-per-family errors never fail the real `nx run-many -t typecheck` / fallow / format gates | unit (fs guard) | `npx nx test angular-typechecker` | yes | green -- **NEW, added by this audit** (`packages/angular-typechecker/src/sarif-proof-fixture-isolation.spec.ts`, 3 `it`s); see Audit Trail |
| 35-02-T1 | 02 | 1 | PROOF-01 / PROOF-02 | -- | Exported pure `missingTuples(alerts, expected)` returns the correct GREEN (empty) / RED (non-empty) result over a canned tuple set | unit (import smoke, part of the plan's own `<verify>`) | `node -e "import('./tools/ci/assert-code-scanning.mjs')..."` (see 35-02-PLAN.md Task 1 `<verify>`) | yes | green (structural, executed at plan time; the persistent regression coverage for this exact behavior is 35-02-T2 below, which exercises the same matcher through the real CLI entry) |
| 35-02-T2 | 02 | 1 | PROOF-01 / PROOF-02 | T-35-08, T-35-10, T-35-11 | Real `tools/ci/assert-code-scanning.mjs` (subprocess, `ASSERT_ALERTS_FILE` seam): GREEN (all 4 tuples present, incl. the trailing-slash category form) exits 0; RED (missing family) exits non-zero naming the tuple (PROOF-02); wrong-category alert does NOT satisfy a tuple (category isolation, Pattern 2) | unit (subprocess) | `npx nx test angular-typechecker` | yes | green -- `packages/angular-typechecker/src/assert-code-scanning.spec.ts` (4 `it`s: GREEN, GREEN trailing-slash, RED, category-isolation), re-run 2026-07-22 |
| 35-03-T1 | 03 | 2 | PROOF-01 / PROOF-02 | T-35-01..T-35-06, T-35-SC | `code-scanning-proof` job (PR-only, non-fork) generates the proof SARIF, uploads under the dedicated `angular-typecheck-proof` category, and runs the assert on `refs/pull/<n>/merge` -- red on any missing tuple/timeout | structural (Task-1 automated check) + **real-CI-only** (authoritative) | Task-1 `node -e` structural check (35-03-PLAN.md) + `code-scanning-proof` job on a PR | yes (`.github/workflows/ci.yml`) | green -- structurally confirmed (job present, correct gates/category/bracket-syntax/SHA-pin, absent from `ci` aggregate `needs[]`) AND independently confirmed LIVE in real CI: run `29875173270` (PR #55) -- `upload-sarif` succeeded with no `locationFromSarifResult` rejection, assert step printed `all expected (category, family tag, severity) tuples present` and exited 0 (per `35-VERIFICATION.md` Truth 2, directly re-fetched via `gh run view --log`) |
| 35-04-T1..T3 | 04 | 1 | PROOF-01 / PROOF-02 (gap closure G-35-01) | T-35-04-01 | File-less SARIF results (`record.file === null`) now carry a region-less whole-file fallback location on the relativized `tsConfigPath`, so GitHub Code Scanning no longer rejects the WHOLE SARIF payload (`locationFromSarifResult: expected at least one location`) -- this was the defect that made the `code-scanning-proof` job's FIRST real-CI run fail, closing the loop on PROOF-02's "fails loud on a genuine regression" claim | unit + integration (regenerated snapshots) | `npx nx test angular-typechecker` + `npx nx integration angular-typechecker` | yes | green -- `sarif-report.spec.ts` (flipped file-less assertion) + `machine-reporters-sarif.integration.spec.ts` (2 flipped assertions), both re-run 2026-07-22 as part of the full 578/156 totals above |

*Status: pending -> green (all rows resolved; no red, no flaky).*

---

## Wave 0 Requirements

- [x] `tools/sarif-proof-fixture/**` -- the isolated fixture (solution `tsconfig.json` + surviving leaf tsconfig + sources), NO `project.json`. Confirmed on disk: `tsconfig.json`, `tsconfig.fixture.json`, `type-error.ts`, `proof.component.ts`, `proof.component.html` -- exactly 5 files, nothing else.
- [x] `tools/ci/assert-code-scanning.mjs` -- the `gh api` poll + set-membership assert. Confirmed on disk.
- [x] `.github/workflows/ci.yml` -- the `code-scanning-proof` job. Confirmed at line 654, PR-only + non-fork gated, correct category, absent from `ci` aggregate `needs[]`.
- [x] `machine-reporters-sarif.integration.spec.ts` (extended) -- the local drift-lock, `describe('SARIF reporter integration -- sarif-proof-fixture (one rule per family, one run)')`.
- [x] `assert-code-scanning` matcher unit test -- `packages/angular-typechecker/src/assert-code-scanning.spec.ts`, proves the pure tuple-matching logic incl. the negative/RED case and category isolation without hitting GitHub.
- [x] `.fallowrc.jsonc` -- `overrides` entry scoping `tools/sarif-proof-fixture/**` off `unused-files`/`unrendered-components`/`unused-component-inputs` (confirmed at line ~277-288).
- [x] `.prettierignore` -- `/tools/sarif-proof-fixture/proof.component.html` entry confirmed at line 35.
- [x] **Added by this audit:** `packages/angular-typechecker/src/sarif-proof-fixture-isolation.spec.ts` -- a standing regression guard that the fixture stays structurally isolated (no `project.json`, no `tsconfig.missing.json`, not in the `tsconfig.tools.json` allowlist), so the one-time plan-execution-time shell check does not silently rot.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SARIF alerts land in GitHub Code Scanning with the expected category/tags/severity | PROOF-01/02 | GitHub ingestion is a live external service; local gates cannot prove it (standing SARIF-dogfood lesson) | Automated in CI via the `code-scanning-proof` job on a real PR; verify the job is GREEN and, if diagnosing, `gh api repos/LayZeeDK/angular-typechecker/code-scanning/alerts?ref=refs/pull/<n>/merge` |

*The CI job automates this; it is "manual-only" only in that it cannot run in the local unit/integration tiers. This leg is CONFIRMED, not merely automated: real CI run `29875173270` on PR #55 exercised it end-to-end and passed (per `35-VERIFICATION.md`).*

---

## The Nyquist point (load-bearing)

The phase's PRIMARY behavior -- "the SARIF contract lands in GitHub Code Scanning" -- is provable ONLY in real CI, on a `pull_request`. Local gates (schema validation, the drift-lock spec, actionlint, act-compat, the two unit specs) prove the SARIF is well-formed, carries the right tags, and that the assert script's matcher logic is correct -- but CANNOT prove GitHub ingested it and surfaced the alerts. The drift-lock spec + the assert-script unit spec are the fast local tripwires; the CI job is the authoritative gate.

**This is no longer a theoretical framing.** The phase's own history proves both directions of SC3 (PROOF-02's "fails loud on regression"):
1. The FIRST real-CI run of the `code-scanning-proof` job (PR #55, run `29866139011`) genuinely FAILED -- GitHub rejected the whole SARIF payload because file-less diagnostics carried no `locations` (gap `G-35-01`). This is a real, unplanned defect the proof caught automatically, not a synthetic drill.
2. Plan 35-04 fixed the defect (a fallback location on the relativized tsconfig), and the SAME job now runs GREEN end-to-end on the same PR (run `29875173270`).

That is a stronger, more direct demonstration of "fails red the moment the contract regresses, and passes once it's fixed" than any local-only test could provide.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (the one genuine local gap found by this audit is now filled)
- [x] No watch-mode flags
- [x] Feedback latency acceptable (local < 120s; real-CI ingestion bounded-poll, independently confirmed to complete and pass in run `29875173270`)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** APPROVED (gsd-nyquist-auditor, 2026-07-22) -- see Audit Trail below.

---

## Validation Audit 2026-07-22

**Context:** entered STATE A -- `35-VALIDATION.md` was a plan-time DRAFT (`TBD` task IDs, all rows `pending`, `nyquist_compliant: false`). The phase is fully EXECUTED and independently VERIFIED (`35-VERIFICATION.md`: 4/4 truths, re-verified after gap closure G-35-01, real CI run `29875173270` green on PR #55). This audit cross-referenced PROOF-01/PROOF-02 against the actually-executed test files (not the SUMMARYs' self-report), found ONE genuine local gap, generated and ran a real test for it, and finalized this document.

**Baseline re-run (before any change):** `npx nx test angular-typechecker` -> 57 files / 575 tests, all green. `npx nx integration angular-typechecker` -> 24 files / 156 tests, all green. Confirms the phase's reported state was not stale.

**PROOF-01 (fixture -> reporter -> assert-script chain) -- audited, THREE of four expected coverage legs confirmed genuinely COVERED, one gap found and FILLED:**

1. **Drift-lock integration spec (`machine-reporters-sarif.integration.spec.ts`, `sarif-proof-fixture` describe block)** -- genuinely adversarial, not vacuous: it schema-validates against the real ajv SARIF 2.1.0 schema, asserts EXACTLY 4 rules (not >=4, so an incidental extra diagnostic sneaking in a 5th rule would fail it), asserts the SET of (family tag, level) tuples equals the CI assert's expected set verbatim, pins the three fixed-code rules (TS2322/NG8002/ATC90002) to their exact family+level, and asserts every result resolves to its rule by index. Re-ran green (part of the 156).
2. **Assert-script matcher unit test (`assert-code-scanning.spec.ts`)** -- drives the REAL `.mjs` as a subprocess through the `ASSERT_ALERTS_FILE` seam (not a reimplementation/stand-in), covering GREEN (incl. the trailing-slash category form GitHub's `upload-sarif` actually produces -- CR-01, a defensive case that would have been easy to skip), RED (missing family, asserts both exit code AND that stderr names the missing tuple), and category isolation (a right-tag/right-severity alert under a dogfood category does NOT satisfy the tuple -- proving the category filter is load-bearing, not cosmetic). Re-ran green (part of the 578).
3. **Real-CI-only ingestion leg** -- correctly classified as manual-only/CI-authoritative per the phase's own Nyquist framing (cannot be locally faked without testing a simpler stand-in than "GitHub actually ingested it"). Independently corroborated via `35-VERIFICATION.md`, which itself independently re-fetched the real job log (`gh run view 29875173270 --log`) rather than trusting the SUMMARY narrative. Not re-verified live by this audit (would require a new PR run); the existing independent verification is treated as authoritative for this leg, consistent with the gap prompt's instruction not to fabricate a local test for GitHub ingestion.
4. **Fixture structural isolation ("outside the normal `nx typecheck` gate", PROOF-01's own requirement text) -- GAP FOUND.** This was checked exactly ONCE, as a plan-execution-time shell command in `35-01-PLAN.md` Task 1's `<verify>` block (`test ! -f tools/sarif-proof-fixture/project.json && ...`). That check ran once when the plan executed and was never persisted as a standing regression test in the `test`/`integration` tiers. Concretely: if a future edit added `tools/sarif-proof-fixture/project.json` (e.g. to debug the fixture locally with `nx graph`), nothing in `npx nx run-many -t test` or `-t integration` would catch it before a real CI run started failing `nx run-many -t typecheck` on the fixture's deliberate errors -- a real but avoidable regression path, and directly on-point for PROOF-01's own "outside the normal `nx typecheck` gate" clause.
   - **Fix applied:** added `packages/angular-typechecker/src/sarif-proof-fixture-isolation.spec.ts` (3 `it`s, unit tier): (a) no `project.json` under the fixture dir; (b) no `tsconfig.missing.json` (whose deliberate ABSENCE synthesizes the tool-family ATC90002 diagnostic -- creating this file would silently delete that alert); (c) `tsconfig.tools.json`'s explicit `include` allowlist contains no `tools/sarif-proof-fixture/*` entry.
   - **Proven non-trivial, not a vacuous pass:** temporarily reproduced the regression (wrote a real `project.json` into `tools/sarif-proof-fixture/`, ran the new spec, confirmed test (a) failed with the expected assertion message, then removed the file and confirmed `git status --short tools/sarif-proof-fixture` was clean again). This is direct evidence the test can fail, not just a structurally-plausible assertion that happens to pass.
   - Re-ran `npx nx test angular-typechecker` (57 -> 58 files, 575 -> 578 tests, all green), `npx nx lint angular-typechecker` (clean), `npx nx format:check` (clean), `npx nx typecheck angular-typechecker` (all 3 tsc green, incl. `tsconfig.tools.json` which the new spec itself reads).

**PROOF-02 (fail-loud) -- audited as genuinely COVERED, no gap:**
- Local half: `assert-code-scanning.spec.ts`'s RED case (drops the `tool` alert) and category-isolation case are unit-proven and asserted to exit non-zero with the missing tuple named in stderr.
- Real-world half: the phase's OWN production history is the strongest possible evidence here -- the first real-CI run hit a genuine, unplanned SARIF->Code Scanning contract break and the `code-scanning-proof` job went red automatically with no manual intervention (documented above under "The Nyquist point"). No fabricated local test could demonstrate this fact set as directly as the real incident already does.
- **Residual, non-blocking (WARNING, same as `35-VERIFICATION.md`'s own noted residual):** the assert script's tuple-membership RED branch has been exercised against a real GitHub CI failure at the WHOLE-SARIF-REJECTED layer (G-35-01) and against mocked/canned data at the tuple-membership layer (the unit spec), but never against a live GitHub alerts response that ingested successfully yet was missing one specific expected tuple. This is lower-risk residual coverage (the ingestion-rejection failure mode already proved red-on-regression works end-to-end) -- flagged for visibility per the auditor's mandate to record caveated-pass items, not treated as a BLOCKER.

**Verdict: nyquist_compliant.** PROOF-01 and PROOF-02 are both genuinely, adversarially covered across the fixture / matcher / real-CI legs; one real local gap (fixture structural-isolation regression coverage) was found and closed by this audit with a test proven capable of failing; the real-CI ingestion leg is correctly classified as CI-authoritative (not locally fakeable) and is independently corroborated, not merely assumed.

**gaps_found:** 1 (structural isolation regression coverage)
**gaps_resolved:** 1 (test generated, run, proven to fail on the regression it guards, and green on the current tree)
**gaps_escalated:** 0
