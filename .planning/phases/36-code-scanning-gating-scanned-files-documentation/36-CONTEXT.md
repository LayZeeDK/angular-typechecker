# Phase 36: Code Scanning gating + Scanned-files documentation - Context

**Gathered:** 2026-07-22
**Status:** Ready for planning

> Discussion mode: `--auto` (autonomous, single pass) + `--analyze` (trade-off tables logged in `36-DISCUSSION-LOG.md`) + `--chain` (auto-advance to plan). Every decision below is evidence-backed by the v0.2.4 milestone research (`ARCHITECTURE.md` section 4, `PITFALLS.md` P1/P7 -- HIGH confidence, grounded against the live `ci.yml` at HEAD), the closed spike PR #53 (which already PROVED the live SARIF -> Code Scanning pipeline), and Phase 35's explicitly-deferred scope. Every gray area here is CI/docs-only, reversible, and confirmed on a throwaway PR in real CI before any `main` change -- none is in the high-impact + low-confidence quadrant, so none was escalated.

<domain>
## Phase Boundary

Make a successful Code Scanning upload part of the merge gate on TWO orthogonal axes -- the required `ci` status-check aggregate AND GitHub's separate "Require code scanning results" ruleset -- WITHOUT deadlocking planning-only PRs (~58% of this repo's PRs touch only `.planning/`) or fork PRs, and document the CodeQL-only "Scanned files" tool-status panel as a known GitHub product gap. Enabling the ruleset on `main` is a real-CI-only, human-gated step verified on a throwaway PR in Evaluate mode first.

This is CI-config + docs only. The shipped reporter, the three adapters (Nx executor, Angular CLI builder, standalone CLI), the plugin `package.json`, and every production-surface file are BYTE-UNCHANGED -- **no version bump** (v0.2.4 was already cut by Phase 33's RULE-01..04; GATE/DOC add nothing releasable). The one published file that changes is the README (in the `files` allowlist), a `docs`-typed prose addition that does not bump the version and shows only as an additive README delta in the vs-`@0.2.3` audit.

**In scope (GATE-01 / GATE-02 / DOC-01):**
- Add the `code-scanning` job AND the `code-scanning-proof` job to the required `ci` aggregate's `needs[]` (`.github/workflows/ci.yml`), reversing the deliberate prior exclusion (GATE-01).
- Assert the dogfood upload actually happened on non-fork PRs so a silent empty-SARIF regression fails the gate rather than passing green (GATE-01 contract; closes PITFALLS P7).
- Un-path-gate the `code-scanning` (dogfood) job so EVERY PR -- including a `.planning/`-only PR -- produces a Code Scanning analysis, guaranteeing an analysis exists on every PR ref for the ruleset (GATE-02 CI side).
- A documented, human-gated runbook for enabling the "Require code scanning results" ruleset on `main`: Evaluate mode first, throwaway `.planning/`-only + code probe PRs, `enforcement: disabled` recovery toggle, and the fork-PR deadlock note (GATE-02 GitHub side).
- README documents the CodeQL-only "Scanned files" panel limitation with spike evidence (`run.artifacts` is inert for third-party SARIF), framed as a known GitHub gap, no Issue filed (DOC-01).

**Out of scope (own phases / deferred / rejected):**
- The AGENT flipping the `main` ruleset via `gh api` -- the actual toggle is a human maintainer action (D-04); the phase ships the wiring + runbook only.
- Any reporter-side `--category` / `automationDetails.id` CLI option -- rejected in Phase 35 (would make this release-bearing).
- Duplicating findings-gating inside the `code-scanning` job -- angular-typechecker findings already gate via `test`'s `nx run-many -t typecheck`; fallow via the `fallow` job. The code-scanning job stays a reporting/upload gate (Out-of-Scope table, REQUIREMENTS.md).
- Emitting `run.artifacts` to chase the "Scanned files" panel (proven inert; documented, not pursued).
- Un-path-gating the `code-scanning-proof` job -- it is a fixture-contract proof, not a required-tool analysis; the ruleset requires the dogfood + fallow analyses, not the proof (D-01a).

</domain>

<decisions>
## Implementation Decisions

### GATE-02 CI side -- guarantee an analysis on every PR ref

- **D-01 (un-path-gate the dogfood `code-scanning` job):** Remove the `if: ${{ needs.changes.outputs.code != 'false' }}` path-gate from the `code-scanning` job (`ci.yml:541`) so it runs `npm ci` + `nx build` + dogfood generation + upload on EVERY PR (and push), including a `.planning/`-only PR. This is PITFALLS P1 Prevention 2: GitHub's "Require code scanning results" ruleset blocks a merge when a required tool's analysis is *missing* on the PR ref -- not only when it finds alerts -- and it is a SEPARATE mechanism from the `ci` status check (the `changes` path-gate + skip-tolerant aggregate trick does NOT satisfy it). A clean tree still produces a valid, empty-results SARIF, which satisfies "analysis exists" with zero alerts. Accepted cost: one Linux job (not the OS x Node matrix) runs on planning-only PRs. The fork-PR upload skip stays (read-only token).
  - **Trade-off (logged):** (A) remove the path-gate entirely [SELECTED -- simplest, provably guarantees an analysis]; (B) keep the job scheduled but internally short-circuit the heavy steps and upload a minimal SARIF [REJECTED -- more code, same outcome, risks an invalid/empty upload]. `no-op` on a fork PR is unavoidable and documented (D-04).
- **D-01a (the `code-scanning-proof` job does NOT get un-path-gated):** The proof job stays `if: github.event_name == 'pull_request' && needs.changes.outputs.code != 'false'` (PR-only + path-gated). It uploads deliberate fixture errors under the DEDICATED `angular-typecheck-proof` category scoped to `refs/pull/<n>/merge`; it is not one of the required-tool analyses the ruleset checks (angular-typechecker dogfood + fallow), so it needs no un-gating for GATE-02. Un-gating it would also risk polluting analyses on planning-only PRs for no benefit. It IS still added to the `ci` aggregate (D-02) -- a path-skip on a planning-only PR resolves to `skipped`, which the aggregate drops from its fail set, so no deadlock.

### GATE-01 -- required-aggregate membership + the "upload succeeded" contract

- **D-02 (add both jobs to the required `ci` aggregate `needs[]`):** Add `code-scanning` and `code-scanning-proof` to the `ci` job's `needs[]` array (`ci.yml:730-743`), reversing the deliberate prior exclusion ("SARIF upload is additive reporting, never a merge gate", `ci.yml:493-497`). Safe per ARCHITECTURE section 4: (a) on a fork PR the upload steps skip but the JOB still returns success, so the aggregate sees success; (b) `|| true` on the generation steps means only a real infra break (`npm ci` / `nx build`) fails the job -- which SHOULD fail `ci`; (c) a path-skip resolves to `skipped`, which the aggregate's `contains(needs.*.result, 'failure') || contains(needs.*.result, 'cancelled')` gate drops. This mirrors the `cve-lite` precedent -- the one existing job that INTENTIONALLY diverges from the "never a merge gate" stance at the maintainer's request, with documented accepted tradeoffs (an outage can block the merge button -> recover via the ruleset `enforcement` toggle).
- **D-03 (GATE-01 contract -- close the P7 fail-open):** On a non-fork PR, ASSERT the dogfood produced a non-empty SARIF and uploaded successfully -- i.e. fail the `code-scanning` job when `produced == 'false'` on a non-fork PR (the current `|| true` + `produced` guard leaves the job GREEN when a reporter regression emits an empty/invalid SARIF, so GATE-01 would otherwise gate only "the job did not crash"). This aligns with SC1's wording ("the dogfood upload running successfully is part of the merge gate") AND is load-bearing for GATE-02: a silent `produced=false` means no analysis is uploaded, which would silently deadlock the ruleset -- a loud red job is strictly better. This is NOT a findings gate: a real type error still writes a valid SARIF (exit 1) -> `produced=true` -> upload -> job green; the real diagnostic gate stays `test`'s `nx run-many -t typecheck`. Fork PRs (read-only token -> upload skipped) and push events (not merge-gated) are EXEMPT from the assertion.
  - **Trade-off (logged):** (a) assert `produced==true` on non-fork PRs [SELECTED -- dominates: catches a reporter regression AND prevents a silent ruleset deadlock, without duplicating findings-gating]; (b) document GATE-01 as job-health-only and rely on `test` [FALLBACK -- adopt only if the assertion proves flaky against GitHub's async upload semantics in the real-CI throwaway-PR verification].
  - **Planner latitude:** exact shape of the assertion (a new `if:`-gated step that checks `steps.atc-sarif.outputs.produced` + the fork/event context, vs folding it into the produced guard) is the planner's call; it MUST NOT fire on fork PRs or push.

### GATE-02 GitHub side -- ruleset enablement is a human-gated, real-CI-only runbook

- **D-04 (the phase ships the runbook; a human flips the `main` ruleset):** The agent does NOT change the `main` "Require code scanning results" ruleset via `gh api` or any automated call. The phase deliverable is the CI wiring (D-01..D-03) plus a documented runbook the human maintainer executes:
  1. Enable the ruleset in **Evaluate mode FIRST** (GitHub's recommended de-risking -- records would-be blocks without blocking); required tools = angular-typechecker + fallow.
  2. Push a deliberate `.planning/`-only probe PR AND a code-touching probe PR; confirm in Ruleset Insights that NEITHER would be blocked (the planning-only PR now produces an analysis via D-01; the code PR produces the dogfood + fallow analyses).
  3. Only then flip the ruleset to **Active**.
  4. Recovery: if it wedges the empty-bypass `main` merge button, toggle the ruleset `enforcement` to `disabled`, merge the fix, re-enable (AGENTS.md "Lockout recovery") -- NEVER add a standing bypass actor.
  5. Fork-PR deadlock is DOCUMENTED as an accepted limitation: a fork PR gets a read-only token -> upload skipped -> no analysis -> the ruleset blocks it. Low practical impact (no external contributors; maintainer self-merges); a future external contributor's PR needs a maintainer-side re-run or the `enforcement` toggle. Prevention 2 (D-01) cannot fix forks (token is read-only).
  - **Rationale for human-gating (HIGH confidence):** consistent with the repo's standing posture -- `main` is PR-only under an empty-bypass ruleset (AGENTS.md), releases + release-tag pushes + deployment approvals are human-only controls, and the roadmap itself mandates "verified on a throwaway PR first". Enabling a second hard gate the owner cannot bypass is exactly the class of irreversible, outward-facing `main` change that stays behind a human gate.

### Documentation homes (GATE-01 rationale, GATE-02 runbook, DOC-01)

- **D-05 (three distinct homes):**
  - **GATE-01 reversal rationale** -> an inline comment block in `.github/workflows/ci.yml` on the aggregate + the two promoted jobs, mirroring the existing `cve-lite` divergence comment (`ci.yml:354-369`) that already documents "this IS a required merge gate ... INTENTIONALLY diverges from the code-scanning 'never a merge gate' stance" with its accepted tradeoffs. Update the existing "DELIBERATELY NOT in the `ci` aggregate's needs" comments on both jobs (`ci.yml:493-497`, `ci.yml:649-650`) so they no longer contradict the new membership.
  - **GATE-02 ruleset runbook** (D-04 steps) -> AGENTS.md, extending the existing "The default-branch ruleset: `main` is PR-only" (AGENTS.md:224) + "Lockout recovery" (AGENTS.md:236) sections. NOTE: an AGENTS.md change MUST be code-reviewed (AGENTS.md self-governance rule) -- satisfied by the phase's `code_review_gate`.
  - **DOC-01 Scanned-files limitation** -> a short subsection under the README's existing `### SARIF and GitHub Code Scanning` heading (`packages/angular-typechecker/README.md:694`). End-user-facing language (no board/phase/G-gate jargon): explain that GitHub's tool-status "Scanned files" panel is CodeQL-only telemetry that third-party SARIF cannot populate (spike evidence: `node-sarif-builder` already auto-emits `run.artifacts`, yet the panel stays empty), so the empty panel is a known GitHub limitation, not a defect. No GitHub Issue filed.

### No release / additive-only

- **D-06 (CI/docs-only, no bump):** Changed files: `.github/workflows/ci.yml` (MOD -- un-gate + aggregate membership + produced assertion + comment updates), `AGENTS.md` (MOD -- ruleset runbook), `packages/angular-typechecker/README.md` (MOD -- DOC-01 subsection). Only the README is in the package `files` allowlist, so the additive audit vs `@0.2.3` must show ONLY the additive README prose delta and NO production-code / manifest change. Commit hygiene (PITFALLS P2): CI/ruleset changes in `ci`/`chore`-typed commits and docs in `docs`-typed commits -- none of these bump the version. The additive-only posture holds by construction (no `packages/angular-typechecker/src/**` or `package.json` edit).

### Claude's Discretion

- Exact shape/placement of the D-03 `produced==true` assertion (dedicated `if:`-gated step vs folding into the produced guard) -- must exempt fork PRs + push.
- Exact wording of the ci.yml GATE-01 comment block and the AGENTS.md runbook prose (subject to code review).
- Whether the README DOC-01 note is a `####` sub-subsection under `### SARIF and GitHub Code Scanning` or a short paragraph appended to it.
- Whether to add a lightweight in-repo guard (e.g. a workflow-lint assertion) that both jobs remain members of `ci.needs[]` and that `code-scanning` stays un-path-gated -- OPTIONAL drift lock, planner's call; if added it MUST be test/CI-only (no published surface, no version impact).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements + roadmap (locked scope)
- `.planning/REQUIREMENTS.md` -- GATE-01 (code-scanning job a required member of the `ci` aggregate), GATE-02 (GitHub "Require code scanning results" enabled on `main` for angular-typechecker + fallow, planning-only PRs NOT deadlocked), DOC-01 (README documents the CodeQL-only Scanned-files panel gap); plus the Out-of-Scope table (no Issue filed; no `run.artifacts`; code-scanning stays a reporting/upload gate, findings gate via `test`).
- `.planning/ROADMAP.md` (Phase 36 detail) -- goal + the 4 success criteria; the cve-lite precedent for GATE-01; the "un-path-gate so a planning-only PR produces an analysis" GATE-02 requirement; the "Evaluate mode first + throwaway PR + `enforcement: disabled` recovery + fork-PR deadlock note" for GATE-02; DOC-01 "known GitHub limitation, not a defect -- no GitHub Issue filed".

### Milestone research (v0.2.4, namespaced -- do NOT clobber the root `.planning/research/*.md`)
- `.planning/research/v0.2.4-enhanced-sarif-reporting/ARCHITECTURE.md` section 4 ("GATE-01/02 -- gating") -- GATE-01 safety argument (path-gate + skip-drop, fork-skip job-still-succeeds, `|| true` only fails on infra break); GATE-02 as a repo-settings task (not code) with the planning-only-skip non-deadlock; "enable required LAST".
- `.planning/research/v0.2.4-enhanced-sarif-reporting/PITFALLS.md` -- **P1** (highest risk: "Require code scanning results" deadlocks planning-only + fork PRs; the `ci` status-check trick does NOT satisfy it -- orthogonal gates; Prevention: Evaluate-mode-first, always-upload for required tools, know the `enforcement: disabled` recovery) + **P7** (GATE-01 fail-open: `|| true` + produced guard leaves the job green on an empty SARIF -> decide/assert the `produced==true` contract or document reporting-only) + **P2** (release discipline: v0.2.4 bumps ONLY for rule metadata; CI/ruleset/docs are no-bump; additive audit vs `@0.2.3`).
- `.planning/research/v0.2.4-enhanced-sarif-reporting/SUMMARY.md` + `FEATURES.md` -- GATE/DOC table-stakes vs anti-features; the Scanned-files-panel-is-inert finding (node-sarif-builder auto-emits `run.artifacts`, panel still empty).

### CI + docs under change (grounded at HEAD)
- `.github/workflows/ci.yml` -- the `code-scanning` job (lines ~539-613: path-gate `if: needs.changes.outputs.code != 'false'` to REMOVE for D-01; job-scoped `security-events: write`; fork-PR upload skip; `atc-sarif`/`fallow-sarif` `|| true` + `produced` guard for D-03; the "DELIBERATELY NOT in the ci aggregate" comment at 493-497 to update); the `code-scanning-proof` job (654-712: PR-only + path-gate STAYS per D-01a; the "Promoting it ... is GATE-01 / Phase 36" comment at 649-650 to update); the `ci` aggregate `needs[]` (730-743) to EXTEND with both jobs; the `cve-lite` job (354-383) -- the precedent comment block to MIRROR for the GATE-01 rationale.
- `AGENTS.md` -- "The default-branch ruleset: `main` is PR-only" (line 224) + "Lockout recovery" (line 236) + "Release tag ruleset" (line 233) -- the ruleset-governance sections the GATE-02 runbook extends; the "Changing this file ... MUST be code-reviewed" self-governance rule at the top.
- `packages/angular-typechecker/README.md` -- `### SARIF and GitHub Code Scanning` (line 694) + `#### Run from the repository root` (716) -- the DOC-01 home.

### Empirical evidence (external -- the pipeline is already spike-proven)
- Closed spike PR #53 (`LayZeeDK/angular-typechecker`) -- PROVED live that SARIF -> alert lands with per-run category / tags / severity / help; that PR-ref alerts are queryable via `refs/pull/<n>/merge`; and that `run.artifacts` does NOT populate the Scanned-files panel (DOC-01 evidence).
- Phase 35 real-CI run 29875173270 (`code-scanning-proof` GREEN on PR #55) -- the proof job already lands and asserts in real CI, so promoting it into the aggregate (D-02) is promoting a job with a proven green baseline.
- Auto-memory `code-scanning-sarif-empirical-behavior` (Scanned-files panel is CodeQL-only telemetry; `run.artifacts` inert -> DOC-01) + `ci-sarif-code-scanning-dogfood` (SARIF-upload / ingestion correctness is provable ONLY in real CI -- so GATE-02's ruleset verification is a real-CI-only step, D-04).
- GitHub Docs, "Set code scanning merge protection" -- merge blocked when a required tool's analysis is missing/unconfigured/in-progress; Evaluate mode recommended before Active.

### Prior phase context (same milestone)
- `.planning/phases/35-automated-code-scanning-proof/35-CONTEXT.md` -- the deferred section that scopes THIS phase (GATE-01/02 + DOC-01) verbatim; the proof job shape (D-02b PR-only + dedicated category) the aggregate now includes.
- `.planning/phases/34-per-project-sarif-categories-in-ci/34-CONTEXT.md` + `.planning/phases/33-diagnostic-family-sarif-rule-metadata/33-CONTEXT.md` -- the dogfood multi-run/no-category upload shape and the family rule metadata the gated jobs upload.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- The `cve-lite` job + its comment block (`ci.yml:354-383`) -- the canonical precedent for a required-gate job that diverges from "never a merge gate", with its accepted-tradeoff prose and the `enforcement`-toggle recovery reference. D-05's GATE-01 comment mirrors it.
- The `ci` aggregate Gate step (`ci.yml:746-753`) -- `contains(needs.*.result, 'failure') || contains(needs.*.result, 'cancelled')` already drops `skipped`, so a path-skipped `code-scanning-proof` on a planning-only PR does not deadlock the aggregate (D-02). No change to the Gate logic is needed -- only `needs[]`.
- The existing `code-scanning` job's fork gate + `produced` guard -- D-03 layers a non-fork `produced==true` assertion on top; the job's build/generate/upload structure is otherwise reused as-is (only the path-gate is removed, D-01).
- AGENTS.md's ruleset + Lockout-recovery sections -- the GATE-02 runbook extends them rather than inventing a new doc surface.

### Established Patterns
- Path-gated heavy jobs use `if: ${{ needs.changes.outputs.code != 'false' }}` and stay in the `act -n` plan under the empty filter; D-01 makes `code-scanning` the one job that INTENTIONALLY drops the path-gate (documented, like cve-lite's divergence).
- CI security invariants preserved verbatim on every job: SHA-pin every action, `persist-credentials: false`, job-scoped least-privilege permissions, fork-PR upload skip, NO PR-metadata interpolated into a shell command. D-01..D-03 touch gating/assertion only -- none of these invariants change.
- Standing additive-only audit vs the previously published version gates every release; GATE/DOC touch no `src/**` or manifest, so the audit shows only the additive README delta (D-06).
- End-user-facing README language (no internal/board/phase jargon) for any shipped-doc change.

### Integration Points
- All logic is CI-side (`.github/workflows/ci.yml`) + two doc files (`AGENTS.md`, `packages/angular-typechecker/README.md`). The reporter seam and all three adapters are UNCHANGED.
- GATE-02's GitHub-side step (ruleset enablement) is out-of-band repo settings performed by a human via the runbook -- it does not integrate with any code path.

</code_context>

<specifics>
## Specific Ideas

- Remove exactly `if: ${{ needs.changes.outputs.code != 'false' }}` from the `code-scanning` job (`ci.yml:541`); leave the fork-PR upload gates and the proof job's PR-only + path-gate untouched.
- Extend `ci.needs[]` (`ci.yml:730-743`) with `code-scanning` and `code-scanning-proof`; no change to the Gate step body.
- D-03 assertion fails the job when `steps.atc-sarif.outputs.produced == 'false'` AND it is a non-fork `pull_request` -- exempt forks + push.
- GATE-02 runbook order is fixed: Evaluate mode -> `.planning`-only + code probe PRs -> Ruleset Insights confirm -> Active; recovery = `enforcement: disabled` toggle.
- DOC-01 note lives under `### SARIF and GitHub Code Scanning` and cites the `node-sarif-builder`-auto-emits-`run.artifacts`-yet-panel-empty evidence.

</specifics>

<deferred>
## Deferred Ideas

- Migrating per-project uploads from one merged multi-run file to a per-project CI matrix if the workspace grows past a handful of self-hosting projects -- MULTI-FUT-01, deferred.
- Precisely distinguishing inline-template TS diagnostics from ordinary `typescript` -- RULE-FUT-01, deferred.
- GitHub-backed self-hosted Nx remote CI cache -- ROADMAP Backlog item, out of this milestone.
- Any reporter-side `--category` / `automationDetails.id` CLI option -- explicitly rejected (would make this release-bearing).

None of the above is in scope for Phase 36.

</deferred>

---

*Phase: 36-code-scanning-gating-scanned-files-documentation*
*Context gathered: 2026-07-22*
