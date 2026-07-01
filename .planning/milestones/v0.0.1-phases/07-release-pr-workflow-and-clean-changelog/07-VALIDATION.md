---
phase: 07
slug: release-pr-workflow-and-clean-changelog
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-29
validated: 2026-06-29
---

# Phase 07 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Phase 7 is a release-process/config/docs phase: most deliverables are
> **one-time live operational verifications** (the ruleset switch) or
> **live-PR proofs** (the ci.yml skip-gate), not repeatable CI tests. The
> repeatable surface is the `release-hygiene` regression spec + workflow
> static validation (actionlint + act-compat). See RESEARCH.md
> "## Validation Architecture" for the full tier classification.

---

## Test Infrastructure

| Property                | Value                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| **Framework**           | Vitest 4.x via `@nx/vitest:test` (+ actionlint 1.7.7, act v0.2.89 for workflow validation) |
| **Config file**         | `e2e/angular-typechecker-install-e2e/vitest.config.mts` (serialized; forks/singleFork)     |
| **Quick run command**   | `npx nx run angular-typechecker-install-e2e:test`                                          |
| **Full suite command**  | `npx nx run-many -t test -p angular-typechecker angular-typechecker-install-e2e`           |
| **Workflow validation** | `./actionlint -color` (1.7.7) + `bash tools/act/act-compat.sh` (act v0.2.89)               |
| **Estimated runtime**   | ~30-120s (release-hygiene spec is fast text/FS; actionlint/act-compat seconds)             |

---

## Sampling Rate

- **After every task commit:** Run `npx nx run angular-typechecker-install-e2e:test`; for any `ci.yml` edit also run `./actionlint -color` and `bash tools/act/act-compat.sh`.
- **After every plan wave:** Run the full suite + `bash tools/act/act-compat.sh`.
- **Before `/gsd:verify-work`:** Full suite green; actionlint + act-compat green on the modified `ci.yml`.
- **Max feedback latency:** ~120 seconds.

---

## Per-Task Verification Map

> Finalized by `/gsd-validate-phase` post-execution. Each row's repeatable
> automatable surface was RUN this session (the install-e2e suite: 3 files /
> 24 tests passed; `release-hygiene.int.spec.ts` 17/17). One-time-operational
> and live-PR tiers are recorded as such (see "Manual-Only Verifications"),
> not as CI assertions. Tier classification confirmed against RESEARCH.md
> "## Validation Architecture".

| Task ID | Plan | Wave | Requirement         | Threat Ref                                              | Secure Behavior                                                                                                         | Test Type                  | Tier                 | Automated Command                                      | File / Evidence                                                                                                                                     | Status                      |
| ------- | ---- | ---- | ------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------- | -------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| 07-01   | 01   | 0    | REL-01              | T-07                                                    | `nx.json` has `release.git.tag:false` (+ commit:true, push:false, createRelease:false)                                  | unit (regression)          | repeatable           | `npx nx run angular-typechecker-install-e2e:test`      | `release-hygiene.int.spec.ts:99` "keeps the cut decoupled from git tagging (REL-01 / D-01)"; `nx.json:87` `tag:false`                               | [GREEN] green               |
| 07-01   | 01   | 0    | REL-01              | T-07                                                    | `release.yml` stays OIDC-only/frozen (no repo-write, SHA-pinned, no `pull_request_target`)                              | integration (existing)     | repeatable           | `npx nx run angular-typechecker-install-e2e:test`      | `release-hygiene.int.spec.ts:130-225` (PKG-04 block)                                                                                                | [GREEN] green               |
| 07-02   | 02   | 1    | REL-02              | T-07-04/05 (no deadlock / no widened-gate failure slip) | ci.yml skip-gate YAML stays parseable + spec-valid; `ci` job id+name byte-stable; negative `if:` survives act           | unit (static)              | repeatable (CI)      | `./actionlint -color` + `bash tools/act/act-compat.sh` | ci.yml `changes` job (`:54`), gated `test`/`e2e` (`:80`,`:114`), `ci` gate (`:182`); green run 28366176185                                          | [GREEN] green (CI)          |
| 07-03   | 03   | 1    | REL-01/02/03 (docs) | --                                                      | AGENTS.md release-mechanics matches the Release-PR flow; ASCII-only; 0.x table + LANDMINE unregressed                   | manual (code-review-gated) | code-review          | `/gsd-code-review` (`code_review_gate`)                | `AGENTS.md` (D-17 rewrite)                                                                                                                          | [GREEN] reviewed            |
| 07-01   | 01   | 0    | REL-03              | T-07 (no scope/PII leak)                                | curated CHANGELOG.md carries no plan-id scope token (3 leak shapes)                                                     | unit (regression spec)     | repeatable           | `npx nx run angular-typechecker-install-e2e:test`      | `release-hygiene.int.spec.ts:237-258` "carries no NN / NN-NN plan-id scope token"; non-vacuous (`rg '\b\d{2}(-\d{2})*:' CHANGELOG.md` -> 0 matches) | [GREEN] green               |
| 07-04   | 04   | 2    | REL-02              | T-07 (no unprotected window / publish bypass)           | ruleset 18229122 active + strict:false + 3 checks + empty bypass + merge:["merge"]; 18229088 deleted; 18229053 retained | gh-api state read          | one-time operational | `gh api .../rulesets/{18229122,18229088,18229053}`     | 07-04-SUMMARY (enable-then-delete, verified live)                                                                                                   | [GREEN] done (operational)  |
| 07-04   | 04   | 2    | REL-02 (DX)         | T-07-04                                                 | planning-only PR path-skips heavy jobs yet `ci` reports success; code PR runs the matrix                                | integration (live PR)      | live-PR proof        | draft/close-out PR (Phase-6 SC3-style)                 | close-out PR `gsd/phase-07-closeout` (`.planning/`-only)                                                                                            | [PENDING] pending (live-PR) |

_Status: [PENDING] pending - [GREEN] green - [RED] red - [FLAKY] flaky_
_Tier: repeatable (CI assertion) - one-time operational (live config, verified once) - live-PR proof (Phase-6 SC3-style) - code-review (AGENTS.md gate)_

---

## Wave 0 Requirements

- [x] `e2e/angular-typechecker-install-e2e/src/release-hygiene.int.spec.ts` -- DELIVERED (07-01, commit `5dc0ac0`): `it('keeps the cut decoupled from git tagging (REL-01 / D-01)')` at `:99` asserts `nx.release?.git?.tag === false`. Confirmed present via `git grep`; the spec reads the real `nx.json` (`tag:false` at `:87`) and passed this session (17/17). TDD RED->GREEN recorded in 07-01-SUMMARY (failed `expected true to be false` against `tag:true` pre-flip), so the assertion is a genuine regression gate, not vacuous.
- [x] CHANGELOG-hygiene assertion -- DELIVERED (07-01, commit `44da470`): `describe('REL-03: the public changelog exposes no internal GSD plan-id scope')` at `:237` asserts three leak shapes (conventional-commit scope, bold heading token, bare leading scope) all absent from `CHANGELOG.md`. Non-vacuous: `rg '\b\d{2}(-\d{2})*:' CHANGELOG.md` returns 0 matches today, and the regexes were validated against six representative leaks with zero false positives (07-01-SUMMARY). REL-03 is therefore automatable in CI.
- [x] No framework install needed -- Vitest, actionlint (CI, 1.7.7), act (CI, v0.2.89) are all provisioned.

---

## Manual-Only Verifications

> These are one-time live operations or live-PR proofs, recorded in
> VERIFICATION.md the way Phase 6 SC3 was -- NOT repeatable CI assertions
> (re-asserting live GitHub ruleset state every CI run would need a token +
> a GitHub round-trip; out of scope for the test suite). This is a CORRECT
> Nyquist tier classification, NOT an automatable gap: re-querying live
> GitHub config or cutting a real release on every CI run is out of scope.

| Behavior                                                                                   | Requirement | Tier                 | Status                                                                                                                                                                                   | Test Instructions                                                                                                   |
| ------------------------------------------------------------------------------------------ | ----------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Ruleset 18229122 active + strict:false + 3 checks + empty bypass + merge:["merge"]         | REL-02      | one-time operational | DONE (07-04, verified live: `{"approvals":0,"bypass":[],"checks":["Analyze (actions)","Analyze (javascript-typescript)","ci"],"enforcement":"active","merge":["merge"],"strict":false}`) | `gh api repos/LayZeeDK/angular-typechecker/rulesets/18229122 --jq '{enforcement, ...}'` (RESEARCH Runbook 2 step 2) |
| v0.0.1 ruleset (18229088) deleted                                                          | REL-02      | one-time operational | DONE (07-04, returns 404)                                                                                                                                                                | `gh api repos/LayZeeDK/angular-typechecker/rulesets/18229088` returns 404                                           |
| Release-tag ruleset (18229053) retained                                                    | REL-02      | one-time operational | DONE (07-04, active tag ruleset)                                                                                                                                                         | `gh api repos/LayZeeDK/angular-typechecker/rulesets/18229053` returns active tag ruleset                            |
| New skip-gate ci.yml green on real runners (deadlock-avoidance precondition)               | REL-02      | one-time operational | DONE (07-04, run 28366176185, push `19a6340`: `changes`/`test` 6 cells/`e2e`/`act-compat`/`lint-workflows`/`ci` all `success`)                                                           | inspect Actions run 28366176185; all jobs `success`                                                                 |
| ci.yml planning-only PR skips heavy jobs yet `ci` reports success; code PR runs the matrix | REL-02 (DX) | live-PR proof        | PENDING (close-out PR `gsd/phase-07-closeout`, `.planning/`-only diff, serves as the live skip-gate proof -- record in VERIFICATION.md like Phase 6 SC3)                                 | Close-out PR (planning-only): matrix skipped, `ci` green; a future code PR runs the full matrix                     |
| release-branch `nx release --dry-run` shows version+changelog and creates NO tag           | REL-01      | one-time operational | PENDING (proven at the first real cut; out of scope for this docs/config phase per 07-01 scope boundary)                                                                                 | `npx nx release --dry-run` on a `release/*` branch -- read "Tagging ... Skipped"                                    |
| GitHub Release notes match the curated CHANGELOG section                                   | REL-03      | one-time operational | PENDING (per-release, at the first real cut)                                                                                                                                             | `gh release view angular-typechecker@x.y.z`                                                                         |

---

## Validation Sign-Off

- [x] All tasks have an automated verify (repeatable spec / static CI) OR are correctly classified as one-time-operational / live-PR / code-review tiers above. The repeatable automatable surface (the `release-hygiene` spec + ci.yml actionlint/act-compat) is fully covered.
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (every repeatable behavior rides `npx nx run angular-typechecker-install-e2e:test`; ci.yml edits add actionlint + act-compat).
- [x] Wave 0 covers the `release-hygiene` `git.tag:false` assertion AND the CHANGELOG-hygiene assertion -- both DELIVERED in 07-01 and green this session (`wave_0_complete: true`).
- [x] No watch-mode flags (Vitest run via `@nx/vitest:test`, no `--watch`; act-compat is `act -n`).
- [x] Feedback latency < 120s (install-e2e suite ran in ~30s this session, cached thereafter).
- [x] `nyquist_compliant: true` set in frontmatter.

### Verification performed this session (report-only; no test files created/edited)

- Ran `npx nx run angular-typechecker-install-e2e:test` -> **3 files / 24 tests passed**; `release-hygiene.int.spec.ts` **17/17** (incl. the REL-01 `git.tag===false` and REL-03 CHANGELOG-no-plan-id-scope assertions). The console "consumer-app angular-typecheck failed" line is the install-smoke spec's EXPECTED injected-TS2322 non-zero exit (asserted TEST-05 behavior), not a test failure.
- `git grep` confirmed both Wave-0 assertions exist in the spec (`:99` git.tag, `:237`-`:258` CHANGELOG hygiene).
- `nx.json` confirmed `release.git` = `{ commit:true, tag:false, push:false }` + `changelog.workspaceChangelog.createRelease:false` (`:85`-`:95`).
- `rg '\b\d{2}(-\d{2})*:' CHANGELOG.md` -> 0 matches, so the REL-03 assertion is non-vacuous.
- ci.yml skip-gate structural invariants confirmed (`changes` job + SHA-pinned `dorny/paths-filter`, negative `if:` on test/e2e, byte-stable `ci` job/name).
- Tier classification audited against RESEARCH "## Validation Architecture": REL-02 ruleset switch + new-ci.yml-green = one-time operational (DONE, run 28366176185); planning-only skip-gate = live-PR proof (PENDING close-out PR); spec invariants + ci.yml static validity = repeatable (GREEN). The operational / live-PR items are correctly NON-CI-repeatable, NOT automatable gaps.

### No new test recommended

The repeatable automatable surface for REL-01/02/03 is satisfied by the existing `release-hygiene.int.spec.ts` invariants (nx.json release.git + CHANGELOG hygiene) plus ci.yml static validation (actionlint + act-compat). The remaining items are inherently one-time-operational (live GitHub ruleset state, a real release cut) or live-PR proofs (the path-skip DX), which re-asserting on every CI run would require a token + GitHub round-trip or a real release context -- explicitly out of scope per RESEARCH. No genuine automatable gap remains.

**Approval:** APPROVED -- `nyquist_compliant: true`, `wave_0_complete: true`. Validated 2026-06-29.
