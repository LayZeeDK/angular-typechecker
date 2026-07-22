---
phase: 36
slug: code-scanning-gating-scanned-files-documentation
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-22
validated: 2026-07-22
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
| GATE-01 | `code-scanning` + `code-scanning-proof` are in `ci.needs[]` | static drift guard (regex over `ci.yml`) | `npx nx test angular-typechecker` | [x] `ci-e2e-coverage-guard.spec.ts` `GATE-01/02` it#1 (list-item anchored) | green |
| GATE-01 | the D-03 `produced=='false'` assertion step exists, PR-only + non-fork gated | static drift guard | `npx nx test angular-typechecker` | [x] `ci-e2e-coverage-guard.spec.ts` `GATE-01/02` it#3 (anchored on `produced == 'false'`) | green |
| GATE-01 | the required `ci` gate goes red on a real regression / green normally | real-CI-only (Nyquist point) | the phase's own PR run + Phase 35 proof baseline (run 29875173270) | CI-authoritative | DEFERRED (real-CI-only) |
| GATE-02 | `code-scanning` stays un-path-gated (no `needs.changes.outputs.code` `if:`) | static drift guard | `npx nx test angular-typechecker` | [x] `ci-e2e-coverage-guard.spec.ts` `GATE-01/02` it#2 (scoped to the `code-scanning` block, `.toBe(false)`) | green |
| GATE-02 | `code-scanning-proof` stays PR-only + path-gated (no deadlock on planning-only PR) | static (byte-unchanged `if:` at ci.yml:692) + real-CI | `npx nx test angular-typechecker` (membership it#1 asserts it is a `ci` member; its skipped-on-planning-only behavior is real-CI) | [x] confirmed in read | green (static side) |
| GATE-02 | planning-only PR NOT deadlocked; ruleset blocks missing analysis; Evaluate->Active | real-CI-only + human-run runbook | the D-04 runbook on throwaway PRs | CI/human-authoritative | DEFERRED (human-only, real-CI-only) |
| GATE-02 | AGENTS.md runbook accuracy | code_review_gate (D-05: NO tripwire by design) | `/gsd-code-review` phase gate | n/a (self-governance rule) | covered by code_review_gate |
| DOC-01 | README carries the Scanned-files-limitation claim | docs content-tripwire | `npx nx test angular-typechecker` | [x] `code-scanning-docs.spec.ts` (heading on raw string + 4 tokens on normalized string) | green |

*Status: green / DEFERRED (real-CI-only or human-only, not a fillable local gap) / covered by code_review_gate. File Exists: [x] present.*

---

## Wave 0 Requirements

- [x] Workflow drift guard: reuses `extractJobLines(ci, jobName)` in `packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts` (GUARD-01f precedent). The new `describe('GATE-01/02: Code Scanning jobs are required + un-path-gated', ...)` (ci-e2e-coverage-guard.spec.ts:705-746) reuses the private helper -- no new file, no new dependency. All three assertions land:
  - it#1: `code-scanning` AND `code-scanning-proof` are list items in the `ci` needs block via `/^\s*code-scanning,\s*$/m` and `/^\s*code-scanning-proof,\s*$/m` over `extractJobLines(ci, 'ci').join('\n')` (NOT `\bcode-scanning\b` -- substring-trap avoided). Confirmed against ci.yml:779-780.
  - it#2: `code-scanning` block has NO path-gate: `/^(?!\s*#).*if:\s*\$\{\{\s*needs\.changes\.outputs\.code/m.test(extractJobLines(ci, 'code-scanning').join('\n'))` is `false`. Confirmed against ci.yml:551-646 (no non-comment path-gate; `needs: changes` retained without `if:`).
  - it#3: the D-03 assertion step exists, PR-only + non-fork: anchored on `github.event.pull_request.head.repo.fork == false` AND `steps.atc-sarif.outputs.produced == 'false'`. Confirmed against ci.yml:615 (does NOT false-match the upload step's `produced == 'true'` at ci.yml:634).
- [x] DOC-01 README content-tripwire: `packages/angular-typechecker/src/code-scanning-docs.spec.ts` mirrors `angular-cli-docs.spec.ts` (normalized-whitespace `.toContain`). Asserts the raw heading `### SARIF and GitHub Code Scanning` (README:694) + tokens `Scanned files` / `a GitHub limitation` / `CodeQL` / `run.artifacts` (README:724-734) on the normalized string.
  - **Coverage nuance (recorded):** docs tripwires ride the `test` target, path-gated on `code` -- a README-only PR (`*.md` -> `code=false`) SKIPS `test`. Phase 36's OWN PR touches `ci.yml` (`code=true`), so the tripwire IS exercised this phase. Same coverage the other docs tripwires already have (accepted parity). README-only-PR coverage promotion into the always-run tier was deliberately NOT pursued (speculative).
- [x] AGENTS.md runbook: NO tripwire added -- the `code_review_gate` covers AGENTS.md (self-governance rule, D-05). An optional content-tripwire would be YAGNI; correctly skipped.
- [x] Framework install: none (Vitest present).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| "Require code scanning results" ruleset behaves correctly (planning-only PR not deadlocked; missing analysis blocks; fork-PR deadlock) | GATE-02 | GitHub ruleset evaluation + ingestion are provable ONLY in real CI on GitHub, and enabling the `main` ruleset is a human-only control (never-approve-deployments posture) | Follow the D-04 runbook in AGENTS.md: enable in Evaluate mode -> push a `.planning`-only probe PR + a code probe PR -> confirm in Ruleset Insights neither is blocked -> flip to Active. Recovery: toggle ruleset `enforcement: disabled`, merge fix, re-enable. |
| The required `ci` aggregate goes red on a genuine Code Scanning upload/infra failure and green on a clean PR | GATE-01 | Only provable once `code-scanning` + `code-scanning-proof` are required members on a real PR run | The phase's own PR run (both jobs green as required members); Phase 35 proof baseline run 29875173270 confirms the proof job lands + asserts. |

---

## Validation Sign-Off

- [x] Every requirement has an automated in-repo check OR a documented real-CI-only / manual verification with rationale
- [x] Sampling continuity: the drift guard + docs tripwire run on `npx nx test angular-typechecker` every task commit
- [x] Wave 0 covers the two new in-repo specs (drift-guard `GATE-01/02` describe-block in `ci-e2e-coverage-guard.spec.ts` + `code-scanning-docs.spec.ts` README tripwire)
- [x] No watch-mode flags
- [x] Real-CI-only Nyquist points explicitly labeled (not falsely claimed as locally verifiable)
- [x] `nyquist_compliant: true` set in frontmatter after Wave 0 specs land

## Post-Execution Verdict (adversarial audit, 2026-07-22)

**Verdict: NYQUIST-COMPLIANT. GAPS FILLED 0/0 -- all locally-coverable points were pre-covered NON-VACUOUSLY by the shipped Wave-0 guards; no fillable local gap remained.**

- **Test run:** `npx nx test angular-typechecker --skip-nx-cache` -> 585 passed / 58 files (0 failed), including the `GATE-01/02` drift-guard describe (3 its) and `code-scanning-docs.spec.ts` (4 its).
- **Non-vacuity proof (FORCE stance):** replayed each shipped guard's exact regex against MUTATED in-memory copies of `ci.yml` / `README.md` (implementation files kept read-only). 19/19 checks held:
  - GATE-01 membership it#1 flips to RED when `code-scanning,` is dropped from `ci.needs[]`, and the anchored regex does NOT false-match the `code-scanning-proof,` line (substring trap defused).
  - GATE-02 un-path-gate it#2 flips to RED when a `needs.changes.outputs.code` `if:` is re-added to the `code-scanning` block, and comment prose mentioning the token does NOT false-trigger (the `^(?!\s*#)` anchor works).
  - GATE-01 D-03 it#3 flips to RED when the `produced == 'false'` assertion line is dropped, and does NOT false-match the upload step's `produced == 'true'`.
  - DOC-01 tripwire: all 4 tokens flip to RED when the `### SARIF and GitHub Code Scanning` subsection is gutted.
  - Anti-vacuous-green backstop confirmed: `extractJobLines` throws on a missing `ci`/`code-scanning` job, so a deleted job fails loud rather than passing silently.
- **DEFERRED-by-design (NOT fillable local gaps -- correctly not tests):**
  - GATE-01 real-CI Nyquist point: the required `ci` aggregate genuinely going RED on a Code Scanning upload/infra failure (or a PROOF-02 regression) and GREEN on a clean PR. Provable only on the phase's own PR run (GitHub ingestion + aggregate verdict); mirrors the 35-03 PROOF precedent. PR #55 corroborates the GREEN-on-clean half (`ci`/`code-scanning`/`code-scanning-proof` all SUCCESS).
  - GATE-02 human-only ruleset toggle (D-04): enabling "Require code scanning results" on `main` in Evaluate mode -> probe throwaway PRs -> Active. Out-of-band, human-only, real-CI-only GitHub repo-settings action; the agent never performs it (never-approve-deployments posture). Runbook shipped in AGENTS.md.
  - GATE-02 AGENTS.md runbook accuracy: covered by the phase `code_review_gate` (D-05 -- NO tripwire by design; adding one would be YAGNI).

**Approval:** validated -- nyquist_compliant, wave_0_complete.
