# Phase 36: Code Scanning gating + Scanned-files documentation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-07-22
**Phase:** 36-code-scanning-gating-scanned-files-documentation
**Mode:** `--auto` (autonomous single pass, no AskUserQuestion) + `--analyze` (trade-off tables) + `--chain` (auto-advance to plan)
**Areas discussed:** Un-path-gate the dogfood job (GATE-02 CI), Required-aggregate membership + GATE-01 contract, Ruleset enablement ownership (GATE-02 GitHub), Documentation homes, Release posture

`[--auto] Selected all gray areas.`

---

## Un-path-gate the dogfood `code-scanning` job (GATE-02 CI side)

**Trade-off analysis**

| Option | Pros | Cons | Selected |
|--------|------|------|----------|
| (A) Remove the path-gate -> job runs + uploads on every PR | Provably guarantees an analysis exists on every PR ref (satisfies the ruleset "analysis missing" check); clean tree still emits a valid empty-results SARIF; simplest | One Linux job (npm ci + nx build + one CLI run) runs on `.planning`-only PRs | YES |
| (B) Keep job scheduled, short-circuit heavy steps, upload a minimal SARIF on planning PRs | Saves the build on planning PRs | More code; risks an invalid/empty upload; same net outcome | |

**`[auto]` selection:** (A) -- recommended default. PITFALLS P1 Prevention 2. Fork-PR upload skip stays; the `code-scanning-proof` job stays PR-only + path-gated (it is not a required-tool analysis, so it needs no un-gating).
**Notes:** The `changes` path-gate + skip-tolerant `ci` aggregate solves the STATUS-CHECK deadlock only; "Require code scanning results" is an orthogonal GitHub mechanism evaluated on whether an analysis exists for the ref, so un-gating the upload is the robust fix.

---

## Required-aggregate membership + GATE-01 contract

**Trade-off analysis (membership)**

| Option | Pros | Cons | Selected |
|--------|------|------|----------|
| Add `code-scanning` + `code-scanning-proof` to `ci.needs[]` | Satisfies GATE-01 / SC1; precedented by cve-lite; job returns success on fork-skip and path-skip, so no false deadlock | An infra outage in the job can block the merge button (accepted; recover via `enforcement` toggle) | YES |
| Leave both out of `ci.needs[]` | No outage-deadlock risk | Fails GATE-01 -- the upload is not part of the gate | |

**Trade-off analysis (P7 fail-open contract)**

| Option | Pros | Cons | Selected |
|--------|------|------|----------|
| (a) Assert `produced==true` on non-fork PRs | Catches a reporter regression that empties the SARIF; ALSO prevents a silent ruleset deadlock (no analysis); matches SC1 "upload running successfully" | One extra gated step | YES |
| (b) Document GATE-01 as job-health-only, rely on `test` | Zero new logic; matches the "reporting/upload gate" stance | A silent `produced=false` leaves the job green AND silently deadlocks the ruleset | Fallback |

**`[auto]` selection:** membership = add both; contract = (a) assert `produced==true` on non-fork PRs (fork + push exempt). Still NOT a findings gate -- a type error uploads and stays green; the real diagnostic gate remains `test`'s `nx run-many -t typecheck`.
**Notes:** (a) strictly dominates for GATE-02 safety and aligns with SC1's own wording. Fallback (b) only if the assertion proves flaky against GitHub's async upload semantics during the real-CI throwaway-PR verification.

---

## Ruleset enablement ownership (GATE-02 GitHub side)

| Option | Description | Selected |
|--------|-------------|----------|
| Agent flips the `main` ruleset via `gh api` | Fully automated enablement | |
| Human-gated runbook | Phase ships CI wiring + a documented Evaluate-mode-first runbook; a human maintainer performs the actual `main` ruleset toggle | YES |

**`[auto]` selection:** human-gated runbook. The agent never changes the `main` ruleset.
**Notes:** Consistent with the repo's standing posture -- `main` is PR-only under an empty-bypass ruleset; releases, release-tag pushes, and deployment approvals are human-only controls; the roadmap itself mandates "verified on a throwaway PR first". Runbook order: Evaluate mode -> `.planning`-only + code probe PRs -> Ruleset Insights confirm no block -> Active; recovery = `enforcement: disabled` toggle (AGENTS.md Lockout recovery); fork-PR deadlock documented as accepted (read-only token -> no analysis).

---

## Documentation homes

| Deliverable | Home | Selected |
|-------------|------|----------|
| GATE-01 reversal rationale | Inline `ci.yml` comment (mirror the cve-lite divergence block) + update the two "DELIBERATELY NOT in ci needs" comments | YES |
| GATE-02 ruleset runbook | AGENTS.md (extend "The default-branch ruleset" + "Lockout recovery") -- change is code-reviewed per AGENTS.md self-governance | YES |
| DOC-01 Scanned-files limitation | README `### SARIF and GitHub Code Scanning` subsection, end-user-facing language, spike evidence, no Issue filed | YES |

**`[auto]` selection:** all three homes as above.
**Notes:** README is the only published file that changes (docs-typed, additive, no version bump).

---

## Release posture

| Option | Description | Selected |
|--------|-------------|----------|
| CI/docs-only, no bump | No `src/**` / manifest edit; additive audit vs `@0.2.3` shows only the README prose delta; CI in `ci`/`chore` commits, docs in `docs` commits | YES |
| Bump the published version | N/A -- nothing releasable | |

**`[auto]` selection:** CI/docs-only, no bump. v0.2.4 was already cut by Phase 33's RULE-01..04.

---

## Claude's Discretion

- Exact shape/placement of the D-03 `produced==true` assertion (dedicated `if:`-gated step vs folding into the produced guard) -- must exempt fork PRs + push.
- Exact wording of the ci.yml GATE-01 comment block and the AGENTS.md runbook prose (subject to code review).
- Whether the README DOC-01 note is a `####` sub-subsection or a paragraph appended to `### SARIF and GitHub Code Scanning`.
- Whether to add an OPTIONAL test/CI-only drift guard asserting both jobs remain in `ci.needs[]` and `code-scanning` stays un-path-gated.

## Deferred Ideas

- Per-project CI upload matrix (MULTI-FUT-01), inline-template TS family distinction (RULE-FUT-01), GitHub-backed Nx remote cache (Backlog), reporter-side `--category` option (rejected).
