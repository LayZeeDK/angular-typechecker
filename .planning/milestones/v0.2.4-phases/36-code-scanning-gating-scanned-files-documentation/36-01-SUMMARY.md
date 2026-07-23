---
phase: 36-code-scanning-gating-scanned-files-documentation
plan: 01
subsystem: ci
tags: [sarif, code-scanning, ci-gate, merge-protection, ruleset, drift-guard, upload-sarif, fork-gate]

# Dependency graph
requires:
  - phase: 35-automated-code-scanning-proof
    provides: the PR-only, non-fork code-scanning-proof job (35-03) now promoted into the required ci aggregate; its green real-CI baseline (run 29875173270)
  - phase: 34-per-project-sarif-categories-in-ci
    provides: the dogfood code-scanning job (per-project multi-run merge-sarif + atc-sarif/fallow-sarif produced guards) that gets un-path-gated + assertion-hardened here
  - phase: 33-diagnostic-family-sarif-rule-metadata
    provides: the SARIF -> Code Scanning contract the promoted jobs upload and PROOF-02 asserts
provides:
  - .github/workflows/ci.yml -- code-scanning + code-scanning-proof are members of the required ci aggregate needs[] (GATE-01/D-02); the code-scanning dogfood job is un-path-gated (GATE-02/D-01); two non-fork-PR produced=='false' fail-loud assertion steps (GATE-01/D-03); three reconciled comment blocks (D-05)
  - packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts -- a new GATE-01/02 drift-guard describe reusing the private extractJobLines (membership list-item-anchored, un-path-gate scoped to the code-scanning block, D-03 assertion anchored on produced=='false')
affects: [36-02-doc-01-agents-runbook, GATE-02-human-ruleset-runbook, phase-36-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-if:-gated fail-loud assertion step: gate on a GitHub Actions expression (event + fork + step-output), STATIC echo/exit 1 body -- nothing interpolated into the shell (no-command-injection invariant preserved verbatim)"
    - "List-item-anchored ci.needs[] membership drift guard (/^\\s*code-scanning,\\s*$/m) -- substring-trap-safe because code-scanning is a substring of code-scanning-proof"
    - "Reuse the private extractJobLines slicer for a new drift-guard describe (no export, no new dependency) -- third describe in this file to lock ci.yml wiring against silent drift"

key-files:
  created: []
  modified:
    - .github/workflows/ci.yml
    - packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts

key-decisions:
  - "Kept `needs: changes` on the un-path-gated code-scanning job (minimal CONTEXT-faithful edit; harmless serialization after the fast changes job) rather than dropping it (RESEARCH open-question #2)"
  - "Included the fallow produced=='false' twin assertion alongside the atc one -- fallow is ALSO a required tool of the GATE-02 ruleset, so a missing fallow analysis would deadlock the ref too (RESEARCH Section 2 'fallow leg')"
  - "Reconciled the cve-lite comment (D-05 4c) to state BOTH are now required merge gates, rather than framing cve-lite as diverging FROM an additive code-scanning"
  - "GATE-01/GATE-02 left Pending (not marked complete): the required-aggregate red/green behavior + GitHub ingestion is real-CI-only (phase Nyquist point), and GATE-02 additionally needs 36-02's AGENTS.md runbook + a human ruleset toggle -- mirrors the 35-03 PROOF-01/02 precedent"

patterns-established:
  - "Fail-loud non-fork-PR SARIF-produced assertion (D-03): a silent empty SARIF becomes a red job instead of a green pass that would also deadlock the ruleset"
  - "Comment blocks that assert workflow-membership facts are reconciled in the same commit as the wiring change so the file stays internally consistent (D-05)"

requirements-completed: []

coverage:
  - id: D1
    description: "code-scanning + code-scanning-proof are members of the required ci aggregate needs[]; the code-scanning dogfood job is un-path-gated; two non-fork-PR produced=='false' fail-loud assertion steps exist; three comment blocks reconciled -- all statically locked by the new GATE-01/02 drift guard"
    requirement: "GATE-01"
    verification:
      - kind: unit
        ref: "packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts#GATE-01/02: Code Scanning jobs are required + un-path-gated"
        status: pass
      - kind: unit
        ref: "npx nx test angular-typechecker (581 passed, 57 files) + npx prettier --check .github/workflows/ci.yml"
        status: pass
    human_judgment: false
  - id: D2
    description: "the required ci aggregate goes RED on a genuine Code Scanning upload/infra failure (or a proof-contract regression) and GREEN on a clean PR, with code-scanning + code-scanning-proof as required members; a planning-only PR produces an analysis and is not deadlocked"
    requirement: "GATE-02"
    verification: []
    human_judgment: true
    rationale: "Real-CI-only Nyquist point -- GitHub SARIF ingestion + the required-aggregate verdict are provable ONLY on the phase's own PR run (Phase 35 proof baseline run 29875173270 confirms the proof job lands). GATE-02 additionally requires 36-02's AGENTS.md runbook and a human maintainer flipping the main ruleset (D-04, human-only control)."

# Metrics
duration: 8min
completed: 2026-07-22
status: complete
---

# Phase 36 Plan 01: Code Scanning gating (GATE-01/02 CI side) Summary

**Promoted both Code Scanning jobs into the required `ci` aggregate and un-path-gated the dogfood job so an analysis exists on every PR ref, with two pure-`if:`-gated non-fork-PR `produced=='false'` fail-loud assertions closing the P7 fail-open -- four surgical `ci.yml` edits plus a new `extractJobLines`-reusing drift guard that statically locks the wiring in `nx test`.**

## Performance
- **Duration:** ~8 min
- **Started:** 2026-07-22T01:10:28Z
- **Completed:** 2026-07-22
- **Tasks:** 2
- **Files modified:** 2 (both modified, none created)

## Accomplishments
- **GATE-01/D-02 (aggregate membership):** appended `code-scanning,` and `code-scanning-proof,` to the `ci` job's `needs[]` (after `scoped-name-guard,`). The `if: always()` and the Gate step body are byte-unchanged -- the existing `contains(needs.*.result, 'failure') || contains(needs.*.result, 'cancelled')` already drops `skipped`, so a path-skipped `code-scanning-proof` on a planning-only PR / push resolves to `skipped` and does not deadlock.
- **GATE-02/D-01 (un-path-gate the dogfood job):** deleted the `if: ${{ needs.changes.outputs.code != 'false' }}` line from the `code-scanning` job so it runs on EVERY PR (incl. `.planning/`-only), producing an analysis on the PR ref. Kept `needs: changes` (minimal CONTEXT-faithful edit). The `code-scanning-proof` job's `if:` (PR-only + path-gated, D-01a) is byte-unchanged.
- **GATE-01/D-03 (close the P7 fail-open):** added two named steps after `fallow-sarif` and before the upload step -- `Assert angular-typechecker SARIF was produced (non-fork PR)` and `Assert fallow SARIF was produced (non-fork PR)`. Each is gated `github.event_name == 'pull_request' && github.event.pull_request.head.repo.fork == false && steps.<id>.outputs.produced == 'false'` with a STATIC `echo "::error::..."` + `exit 1` body -- NO step output / PR metadata interpolated into the shell (T-36-02 mitigated verbatim). Fork PRs + push are exempt; a real type error still writes a valid SARIF (produced=true) -> upload -> green (not a findings gate).
- **D-05 (three comment rewrites):** rewrote both `DELIBERATELY NOT in the ci aggregate` blocks (dogfood + proof) to reflect the new membership, mirroring the `cve-lite` divergence rationale (accepted tradeoff: an outage/infra break can block the merge button -> `enforcement: disabled` recovery per AGENTS.md "Lockout recovery"), and reconciled the stale `cve-lite` clause that described `code-scanning` as additive / never-a-merge-gate.
- **Task 2 drift guard:** a new `describe('GATE-01/02: Code Scanning jobs are required + un-path-gated', ...)` in `ci-e2e-coverage-guard.spec.ts` reusing the private `extractJobLines` (no export, no new dep). Three `it`s: list-item-anchored membership for both jobs (NOT `\bcode-scanning\b`, avoiding the substring trap), the `code-scanning` block has no non-comment `needs.changes.outputs.code` `if:` (scoped to that block), and a D-03 assertion anchored on `steps.atc-sarif.outputs.produced == 'false'` (so it cannot false-match the upload step's `produced == 'true'`).

## Task Commits

Each task committed atomically (conventional scope `36-01`):

1. **Task 1: ci.yml -- aggregate membership + un-path-gate + D-03 assertions + comment rewrites** - `194920e` (ci)
2. **Task 2: GATE-01/02 drift guard describe (reuse extractJobLines)** - `8ef9ac4` (test)

_Note: an orchestrator commit `5ba7f82` (chore: enable security_enforcement) landed between the two task commits -- not part of this plan's scope; my task commits are cleanly scoped to ci.yml and the spec respectively._

## Files Created/Modified
- `.github/workflows/ci.yml` (MOD) - both Code Scanning jobs added to `ci.needs[]`; `code-scanning` path-gate removed; two `if:`-gated `produced=='false'` assertion steps; three reconciled comment blocks. Security invariants preserved verbatim (SHA-pinned `upload-sarif@7188fc36... # v4.37.1`, `persist-credentials: false`, `fetch-depth: 0`, job-scoped `contents: read` + `security-events: write`, fork-PR upload gates); no new action/SHA/permission.
- `packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts` (MOD) - new GATE-01/02 drift-guard `describe` (+58 lines) reusing `extractJobLines`.

## Verification
- **`npx nx test angular-typechecker`: PASSED** -- 581 tests / 57 files (was 578; +3 new GATE-01/02 `it`s). Existing GUARD-01/01b/01c/01d/01e/01f still green.
- **`npx prettier --check .github/workflows/ci.yml`: PASSED** -- ci.yml Prettier-clean.
- **`npx nx typecheck angular-typechecker` + explicit `tsc --noEmit -p tsconfig.spec.json`: PASSED** -- spec types clean (nx test does NOT type-check specs, so the spec tsconfig was checked explicitly).
- **`npx nx lint angular-typechecker` (maxWarnings:0): PASSED** -- All files pass linting.
- **`git diff` scope (D-06 additive-only): PASSED** -- my two task commits touch ONLY `.github/workflows/ci.yml` (194920e) and the spec (8ef9ac4); the plugin `package.json`/manifest is byte-unchanged; no non-spec `src/**` runtime change; no version bump. (`.planning/config.json` changed in a separate orchestrator commit, outside this plan.)
- **REAL-CI-ONLY (Nyquist point, DEFERRED to phase verification):** the required `ci` aggregate going RED on a genuine Code Scanning upload/infra failure and GREEN on a clean PR, with both jobs as required members, is provable ONLY on this phase's own PR run (GitHub ingestion + aggregate verdict). Not claimed as locally verified.
- **`act --validate` / `act -n`:** not run locally (`act`/`actionlint` not installed here); the authoritative check is the CI `lint-workflows` (actionlint) + `act-compat` jobs on this phase's PR. ci.yml parses cleanly and Prettier-clean; the drift guard structurally validates the wiring.

## Decisions Made
- **Kept `needs: changes` on the un-path-gated `code-scanning` job** (RESEARCH open-question #2) -- harmless serialization after the fast `changes` job; removing only the `if:` is the smaller, CONTEXT-faithful diff.
- **Included the fallow `produced=='false'` twin assertion** -- fallow is ALSO a required tool of the GATE-02 ruleset, so a missing fallow analysis would deadlock the ref; the plan Task-1 action mandates both.
- **D-05 4c reconciliation:** reframed the `cve-lite` comment to note both are now required merge gates (rather than cve-lite diverging from an additive code-scanning).
- **GATE-01/GATE-02 left Pending** (not marked complete) -- see Requirements below.

## Deviations from Plan
None - plan executed exactly as written. All four `ci.yml` edits and the drift-guard `describe` were implemented to the PLAN/PATTERNS/RESEARCH literal shapes.

## Issues Encountered
- **`rtk npx nx test` mangled `npx` into `npm`** ("Missing script: nx"). Re-ran the verification with plain `npx nx test` -- passed. Not a code issue; the RTK npx wrapper misfired on this box, so plain `npx` was used for all nx invocations.
- **`.planning/config.json` + `.planning/STATE.md` showed pre-existing modifications** at execution start (orchestrator phase-transition bookkeeping: 35->36, `security_enforcement: true`). Handled correctly -- staged only my task files by name; `config.json` was committed separately by the orchestrator (`5ba7f82`); `STATE.md` is updated in this plan's final docs commit.

## Authentication Gates
None. All work was local file edits + `nx`/`prettier` runs; no external auth required. (The real ruleset toggle is a human-only control performed via 36-02's runbook -- out of this plan's scope, D-04.)

## Known Stubs
None. No placeholder data, empty returns, or TODO markers introduced. The assertion steps have real static bodies; the drift guard exercises real regexes over the real `ci.yml`.

## Threat Flags
None beyond the plan's `<threat_model>`. The two new D-03 assertion steps are pure-`if:`-gated with static bodies (T-36-02 HIGH mitigated verbatim -- no shell interpolation); un-path-gating reuses the same trusted `pull_request` code-checkout trigger with unchanged job-scoped permissions and the fork-PR upload skip (T-36-03 accepted); no new action/SHA/package (T-36-SC accepted, no legitimacy checkpoint needed). The Task-2 drift guard mitigates T-36-01 (workflow-tampering) by statically locking membership + un-path-gate + the D-03 assertion.

## Requirements
- **GATE-01 / GATE-02: Pending (not marked complete).** The committed CI wiring (membership, un-path-gate, D-03 assertions) and its static drift guard are fully done and green in `nx test`, but both requirements have a real-CI-only Nyquist point: the required-aggregate red/green verdict and GitHub SARIF ingestion are provable ONLY on this phase's own PR run. GATE-02 additionally requires 36-02's AGENTS.md runbook plus a human maintainer flipping the `main` "Require code scanning results" ruleset (D-04, human-only control). They close at phase verification, mirroring the 35-03 PROOF-01/02 precedent. No `requirements mark-complete` call was made for this plan.

## Next Phase Readiness
- The CI side of GATE-01/GATE-02 is wired and drift-locked. This phase's PR run is the authoritative gate that exercises the real-CI Nyquist point.
- **Plan 36-02** delivers DOC-01 (README "Scanned files" panel limitation + tripwire) and the GATE-02 AGENTS.md runbook (Evaluate-mode-first, probe PRs, `enforcement: disabled` recovery, fork-PR deadlock note). The AGENTS.md change MUST be code-reviewed (self-governance rule; satisfied by the phase's code_review_gate).
- **Human step (out-of-band):** flipping the `main` ruleset per the 36-02 runbook is a human-only control (never agent-automated).

## Self-Check: PASSED
- `.github/workflows/ci.yml` exists (modified).
- `packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts` exists (modified, +58 lines).
- Task commit `194920e` present in git log (ci.yml).
- Task commit `8ef9ac4` present in git log (drift guard).
- `npx nx test angular-typechecker` green (581 passed) including the new GATE-01/02 describe.

---
*Phase: 36-code-scanning-gating-scanned-files-documentation*
*Completed: 2026-07-22*
