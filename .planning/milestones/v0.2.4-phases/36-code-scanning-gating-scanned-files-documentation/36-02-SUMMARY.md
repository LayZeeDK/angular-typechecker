---
phase: 36-code-scanning-gating-scanned-files-documentation
plan: 02
subsystem: docs
tags: [sarif, code-scanning, ruleset, runbook, docs-tripwire, scanned-files, agents-md, readme]

# Dependency graph
requires:
  - phase: 36-code-scanning-gating-scanned-files-documentation
    plan: 01
    provides: the un-path-gated code-scanning dogfood job + code-scanning/code-scanning-proof aggregate membership (the CI wiring the GATE-02 runbook documents); the drift guard the DOC-01 tripwire sits beside
  - phase: 35-automated-code-scanning-proof
    provides: the spike-proven SARIF -> Code Scanning pipeline (closed PR #53) whose run.artifacts-inert Scanned-files finding DOC-01 documents
provides:
  - AGENTS.md -- a human-run "Require code scanning results" ruleset runbook (Evaluate-first, probe two PR kinds, then Active; enforcement:disabled recovery; fork-PR deadlock accepted); states the agent NEVER flips the main ruleset (D-04)
  - packages/angular-typechecker/README.md -- a #### "Scanned files" panel stays empty (a GitHub limitation) sub-subsection under ### SARIF and GitHub Code Scanning (DOC-01, end-user language, no Issue filed)
  - packages/angular-typechecker/src/code-scanning-docs.spec.ts -- a normalized-whitespace docs tripwire locking the DOC-01 claim (Scanned files / a GitHub limitation / CodeQL / run.artifacts)
affects: [phase-36-verification, GATE-02-human-ruleset-runbook, phase-36-code-review-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Normalized-whitespace docs tripwire mirroring angular-cli-docs.spec.ts: exact heading on the RAW README string + claims on the (\\s+ -> single space) NORMALIZED string, pure fs read, no markdown parser, no new dependency"
    - "AGENTS.md governance runbook extends the existing default-branch-ruleset + Lockout-recovery sections rather than inventing a new doc surface; documentation-only (no ruleset-mutating gh api)"

key-files:
  created:
    - packages/angular-typechecker/src/code-scanning-docs.spec.ts
  modified:
    - AGENTS.md
    - packages/angular-typechecker/README.md

key-decisions:
  - "Used a #### sub-subsection under ### SARIF and GitHub Code Scanning (D-05 latitude between a sub-subsection and an appended paragraph) so the DOC-01 note sits beside the sibling #### Run from the repository root"
  - "Marked DOC-01 complete but left GATE-02 Pending: DOC-01 is fully delivered by committed artifacts (README subsection + tripwire), while GATE-02's requirement wording (enabled on main) needs the human ruleset toggle (D-04) + real-CI verification -- mirrors 36-01's GATE-02 treatment"
  - "No AGENTS.md tripwire added (D-05): the phase code_review_gate reviews the runbook via the AGENTS.md self-governance rule, so a tripwire would be YAGNI"

patterns-established:
  - "A *-docs.spec.ts content tripwire per shipped-README claim family (storybook / angular-cli / standalone-cli / machine-readable / now code-scanning) -- each owns only its own claim, no cross-duplication"

requirements-completed: [DOC-01]

coverage:
  - id: D1
    description: "The shipped README documents the CodeQL-only Scanned-files panel as a known GitHub limitation (not a defect), cites the run.artifacts-inert spike evidence, in end-user language, no GitHub Issue filed; the claim is statically locked by code-scanning-docs.spec.ts against prose gutting"
    requirement: "DOC-01"
    verification:
      - kind: unit
        ref: "packages/angular-typechecker/src/code-scanning-docs.spec.ts#README ### SARIF and GitHub Code Scanning -- Scanned-files limitation (docs tripwire)"
        status: pass
      - kind: unit
        ref: "npx nx test angular-typechecker (585 passed, 58 files) + npx prettier --check packages/angular-typechecker/README.md"
        status: pass
    human_judgment: false
  - id: D2
    description: "The human-run GATE-02 ruleset runbook (Evaluate-first, probe .planning-only + code PRs, flip to Active, enforcement:disabled recovery, fork-PR deadlock accepted) ships in AGENTS.md, stating the agent never flips the main ruleset; the actual ruleset enablement on main is verified"
    requirement: "GATE-02"
    verification: []
    human_judgment: true
    rationale: "This plan ships the RUNBOOK (the committable half of GATE-02); the requirement as worded (Require code scanning results enabled on main) is a human-only, real-CI-only control (D-04) -- a maintainer enables the ruleset in Evaluate mode, probes throwaway PRs, then flips to Active AFTER this phase's PR merges. GitHub ingestion + ruleset evaluation are provable only on GitHub. Left Pending, mirroring 36-01."

# Metrics
duration: 5min
completed: 2026-07-22
status: complete
---

# Phase 36 Plan 02: Code Scanning gating runbook + Scanned-files documentation Summary

Shipped the human-run GATE-02 ruleset runbook (AGENTS.md), the DOC-01 end-user note
that the empty "Scanned files" panel is a known CodeQL-only GitHub limitation
(shipped README), and a normalized-whitespace docs tripwire locking that claim --
docs/test-only, purely additive, no version bump (D-06).

## What Was Built

- **Task 1 -- GATE-02 runbook (AGENTS.md, D-04/D-05).** A new `###` subsection
  "Enabling the \"Require code scanning results\" ruleset (human-run, real-CI-only)"
  inserted between the "Lockout recovery" paragraph and
  `## Parallel execution in git worktrees`. It opens by stating the agent NEVER
  flips the `main` ruleset (human maintainer action, real-CI-only, performed after
  this phase's PR merges) and follows the fixed 6-step order: (1) add the rule for
  BOTH `angular-typechecker` AND `fallow` with a conservative alert threshold
  (existence gate, not a second findings gate); (2) Evaluate mode FIRST (with the
  plan-tier caveat to confirm live); (3) probe a `.planning/`-only PR AND a code PR,
  confirming neither is blocked in the Ruleset-Insights view; (4) flip to Active only
  after step 3; (5) `enforcement: disabled` recovery (reusing the Lockout-recovery
  pointer), never a standing bypass; (6) fork-PR deadlock as an accepted limitation
  (read-only token -> upload skipped -> no analysis -> blocked). No ruleset-mutating
  `gh api` call anywhere.
- **Task 2 -- DOC-01 note (shipped README, D-05).** A new `#### The "Scanned files"
  panel stays empty (a GitHub limitation)` sub-subsection under
  `### SARIF and GitHub Code Scanning`, after `#### Run from the repository root` and
  before `## Storybook`. End-user language: GitHub fills the "Scanned files" panel
  only from its own CodeQL telemetry, SARIF has no field a third-party tool can use to
  populate it, angular-typechecker's SARIF is well-formed and its alerts / rules /
  locations appear normally, emitting the optional `run.artifacts` list does not
  change it, so an empty panel is expected and can be ignored. No GitHub Issue
  suggested or filed. Carries the four literal tripwire tokens.
- **Task 3 -- DOC-01 tripwire (`code-scanning-docs.spec.ts`).** A new spec mirroring
  `angular-cli-docs.spec.ts` verbatim in shape (same `node:fs`/`node:path`/`node:url`
  + vitest imports, `../README.md` read, `normalized = readme.replace(/\s+/g, ' ')`).
  Asserts the exact `### SARIF and GitHub Code Scanning` heading on the RAW string and
  `Scanned files` / `a GitHub limitation` / `CodeQL` / `run.artifacts` on the
  NORMALIZED string. Header comment records the false-assurance purpose and the
  path-gated-`test` coverage nuance (a README-only PR skips it; this phase's PR touches
  `ci.yml` -> `code=true` -> exercised). No markdown parser, no new dependency, no
  cross-duplication with the other `*-docs.spec.ts` tripwires.

## Commits

1. **Task 1: AGENTS.md GATE-02 ruleset runbook** - `ee3209a` (docs)
2. **Task 2: README DOC-01 Scanned-files limitation subsection** - `25630b5` (docs)
3. **Task 3: code-scanning-docs.spec.ts DOC-01 tripwire** - `b712b96` (test)

## Files Changed

- `AGENTS.md` (MOD) - new human-run ruleset-enablement `###` subsection (+38 lines).
- `packages/angular-typechecker/README.md` (MOD) - new DOC-01 `####` sub-subsection
  (+13 lines); the ONLY changed file in the package `files` allowlist.
- `packages/angular-typechecker/src/code-scanning-docs.spec.ts` (NEW) - DOC-01 docs
  tripwire (+51 lines); a test file excluded from the tarball by `tsconfig.lib.json`.

## Verification

- **`npx nx test angular-typechecker`: PASSED** -- 585 tests / 58 files (was 581;
  +4 new `code-scanning-docs.spec.ts` `it`s).
- **`npx prettier --check AGENTS.md packages/angular-typechecker/README.md`: PASSED**
  (checked individually; both clean).
- **`npx prettier --check packages/angular-typechecker/src/code-scanning-docs.spec.ts`:
  PASSED.**
- **`npx nx lint angular-typechecker` (maxWarnings:0): PASSED.**
- **`npx nx format:check`: PASSED (exit 0).**
- **Additive audit vs phase-start (0577e83..HEAD):** 3 files changed, 102 insertions,
  0 deletions -- exactly `AGENTS.md`, `README.md`, `code-scanning-docs.spec.ts`. The
  only `src/**` change is the test spec (tarball-excluded); no `package.json`/manifest
  change, no version bump (D-06 holds by construction).
- **Public-repo hygiene:** the added AGENTS.md + README prose is generic CI/docs with
  no email-shaped token; the allowlist-inversion email-hygiene check in the normal
  battery stays green.

## Deviations from Plan

None - plan executed exactly as written. All three tasks landed per their
`acceptance_criteria`; the D-05 latitude was resolved to a `####` sub-subsection (as
the plan itself specified for Task 2).

## Requirements

- **DOC-01: complete (marked).** The shipped README documents the CodeQL-only
  Scanned-files panel as a known GitHub limitation (not a defect) with the
  `run.artifacts`-inert evidence, in end-user language, no Issue filed; the claim is
  statically locked by `code-scanning-docs.spec.ts` and green in `nx test`.
- **GATE-02: Pending (not marked complete).** This plan ships the committable half --
  the AGENTS.md human-run runbook. The requirement as worded ("Require code scanning
  results" enabled on `main`) is a human-only, real-CI-only control (D-04): a
  maintainer enables the ruleset in Evaluate mode, probes throwaway PRs, then flips to
  Active AFTER this phase's PR merges. Left Pending, mirroring 36-01's GATE-02
  treatment; it closes at phase verification / the human runbook run.

## Code-Review Gate Note

`AGENTS.md` is in this phase's changed-file set. The AGENTS.md self-governance rule
(top of the file) requires any AGENTS.md change to be code-reviewed; this is satisfied
by the phase `code_review_gate`, which must verify the runbook's factual accuracy
against the live `ci.yml` + the GitHub ruleset UI (the 6-step order, human-only /
Evaluate-first / `enforcement: disabled` recovery / fork-PR-deadlock content).

## Threat Surface

No new security-relevant surface. This plan touches only two doc files and one test
spec; no network endpoint, auth path, file-access pattern, or schema change. The
threat register's `mitigate` items land as intended: T-36-04 (README claim locked by
the tripwire), T-36-05 (AGENTS.md accuracy routed through the code_review_gate),
T-36-06 (no email/domain in the added prose).

## Self-Check: PASSED

- Files exist: `AGENTS.md`, `packages/angular-typechecker/README.md`,
  `packages/angular-typechecker/src/code-scanning-docs.spec.ts` -- all FOUND.
- Commits exist: `ee3209a`, `25630b5`, `b712b96` -- all FOUND in git log.

## Next

- Phase verification (gsd-verifier) closes GATE-01/GATE-02 against this phase's real-CI
  PR run; GATE-02's ruleset enablement additionally awaits the human maintainer running
  the AGENTS.md runbook post-merge.
- The AGENTS.md runbook is queued for the phase `code_review_gate` (self-governance rule).
