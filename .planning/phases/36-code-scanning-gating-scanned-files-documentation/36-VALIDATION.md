---
phase: 36
slug: code-scanning-gating-scanned-files-documentation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-22
---

# Phase 36 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Core reality: GATE-02 ruleset behavior is provable ONLY in real CI on GitHub -- local gates
> cannot prove GitHub ingestion or ruleset evaluation (auto-memory `ci-sarif-code-scanning-dogfood`).
> Validation splits three ways: in-repo static drift guards (fast, sampled every commit),
> a documentation tripwire (fast content assertion), and real-CI-only Nyquist points (the merge-gate
> behavior + the human-run ruleset verification).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x via `@nx/vitest:test` (unit `test` target). New specs are unit-tier plain `fs` reads over `ci.yml` / README. |
| **Config file** | `packages/angular-typechecker/vitest.config.mts` (planner confirm exact filename) |
| **Quick run command** | `npx nx test angular-typechecker` |
| **Full suite command** | `npx nx run-many -t test` + `-t typecheck` + `-t lint` + `nx format:check` + `-t integration` + `nx build` (the repo's six-check battery); plus `act-compat` + `lint-workflows` local equivalents when editing `ci.yml` |
| **Estimated runtime** | ~seconds for the new drift guard + docs tripwire |

---

## Sampling Rate

- **After every task commit:** Run `npx nx test angular-typechecker` (runs the new drift guard + docs tripwire).
- **After every plan wave:** Run `npx nx run-many -t test` + `-t typecheck` + `-t lint` + `nx format:check`; when `ci.yml` changed also run the `act-compat` + `lint-workflows` local equivalents.
- **Before `/gsd:verify-work`:** Full six-check battery must be green.
- **Phase gate (Nyquist point):** the real-CI PR green with `code-scanning` + `code-scanning-proof` as required `ci` members (GitHub ingestion is only provable here); THEN the human-run GATE-02 runbook (Evaluate -> throwaway PRs -> Active).
- **Max feedback latency:** ~seconds (in-repo tier); the real-CI + human runbook tiers are phase-gate latency.

---

## Per-Task Verification Map

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| GATE-01 | `code-scanning` + `code-scanning-proof` are in `ci.needs[]` | static drift guard (regex over `ci.yml`) | `npx nx test angular-typechecker` | [ ] W0 (new describe, reuse `extractJobLines`) | pending |
| GATE-01 | the D-03 `produced=='false'` assertion step exists, PR-only + non-fork gated | static drift guard | `npx nx test angular-typechecker` | [ ] W0 | pending |
| GATE-01 | the required `ci` gate goes red on a real regression / green normally | real-CI-only (Nyquist point) | the phase's own PR run + Phase 35 proof baseline (run 29875173270) | CI-authoritative | pending |
| GATE-02 | `code-scanning` stays un-path-gated (no `needs.changes.outputs.code` `if:`) | static drift guard | `npx nx test angular-typechecker` | [ ] W0 | pending |
| GATE-02 | planning-only PR NOT deadlocked; ruleset blocks missing analysis; Evaluate->Active | real-CI-only + human-run runbook | the D-04 runbook on throwaway PRs | CI/human-authoritative | pending |
| DOC-01 | README carries the Scanned-files-limitation claim | docs content-tripwire | `npx nx test angular-typechecker` | [ ] W0 (mirror `angular-cli-docs.spec.ts`) | pending |

*Status: pending / green / red / flaky. File Exists: [x] present / [ ] W0 = created in Wave 0.*

---

## Wave 0 Requirements

- [ ] Workflow drift guard: reuse `extractJobLines(ci, jobName)` in `packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts` (GUARD-01f precedent already uses it for `e2e-windows` in `ci.needs[]`). Add a new `describe('GATE-01/02: Code Scanning jobs are required + un-path-gated', ...)` in that file (one file, reuse the helper -- no new file, no new dependency). Assertions:
  - `code-scanning` AND `code-scanning-proof` are list items in the `ci` needs block. **Regex trap:** `code-scanning` is a substring of `code-scanning-proof`, so `\bcode-scanning\b` matches both -- anchor on the list-item line: `/^\s*code-scanning,\s*$/m` and `/^\s*code-scanning-proof,\s*$/m` over `extractJobLines(ci, 'ci').join('\n')`.
  - `code-scanning` job block has NO path-gate: `/^(?!\s*#).*if:\s*\$\{\{\s*needs\.changes\.outputs\.code/m.test(extractJobLines(ci, 'code-scanning').join('\n'))` is `false`.
  - (D-05 latitude) the D-03 assertion step exists, PR-only + non-fork: the `code-scanning` block contains a step whose `if:` references `github.event.pull_request.head.repo.fork == false` and `steps.atc-sarif.outputs.produced`.
- [ ] DOC-01 README content-tripwire: mirror `packages/angular-typechecker/src/angular-cli-docs.spec.ts` (normalized-whitespace `.toContain`). New `code-scanning-docs.spec.ts` or fold into an existing docs tripwire.
  - **Coverage nuance:** docs tripwires ride the `test` target, which is path-gated on `code` -- a README-only PR (`*.md` -> `code=false`) SKIPS `test`. Phase 36's OWN PR touches `ci.yml` (`code=true`), so the tripwire IS exercised this phase. Same coverage the other docs tripwires already have (precedent). Recommend: mirror precedent (accept parity); note the nuance. README-only-PR coverage would need promotion into the always-run `scoped-name-guard` target -- speculative, skip unless the planner wants it.
- [ ] AGENTS.md runbook: NO tripwire required -- the `code_review_gate` covers AGENTS.md (self-governance rule). An optional content-tripwire is YAGNI; skip unless the planner wants drift-lock parity with README.
- [ ] Framework install: none (Vitest present).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| "Require code scanning results" ruleset behaves correctly (planning-only PR not deadlocked; missing analysis blocks; fork-PR deadlock) | GATE-02 | GitHub ruleset evaluation + ingestion are provable ONLY in real CI on GitHub, and enabling the `main` ruleset is a human-only control (never-approve-deployments posture) | Follow the D-04 runbook in AGENTS.md: enable in Evaluate mode -> push a `.planning`-only probe PR + a code probe PR -> confirm in Ruleset Insights neither is blocked -> flip to Active. Recovery: toggle ruleset `enforcement: disabled`, merge fix, re-enable. |
| The required `ci` aggregate goes red on a genuine Code Scanning upload/infra failure and green on a clean PR | GATE-01 | Only provable once `code-scanning` + `code-scanning-proof` are required members on a real PR run | The phase's own PR run (both jobs green as required members); Phase 35 proof baseline run 29875173270 confirms the proof job lands + asserts. |

---

## Validation Sign-Off

- [ ] Every requirement has an automated in-repo check OR a documented real-CI-only / manual verification with rationale
- [ ] Sampling continuity: the drift guard + docs tripwire run on `npx nx test angular-typechecker` every task commit
- [ ] Wave 0 covers the two new in-repo specs (drift guard describe-block + README tripwire)
- [ ] No watch-mode flags
- [ ] Real-CI-only Nyquist points explicitly labeled (not falsely claimed as locally verifiable)
- [ ] `nyquist_compliant: true` set in frontmatter after Wave 0 specs land

**Approval:** pending
