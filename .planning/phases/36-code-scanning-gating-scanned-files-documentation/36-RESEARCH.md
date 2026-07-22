# Phase 36: Code Scanning gating + Scanned-files documentation - Research

**Researched:** 2026-07-22
**Domain:** GitHub Actions CI wiring + GitHub Code Scanning merge-protection ruleset + shipped-README docs, on a hardened PR-only repo. No production code, no version bump.
**Confidence:** HIGH (grounded entirely in existing authoritative sources: CONTEXT.md D-01..D-06, the live `ci.yml` at HEAD, `ARCHITECTURE.md` section 4, `PITFALLS.md` P1/P2/P7/P10, the closed spike PR #53 evidence, AGENTS.md, and one verified GitHub-docs fetch).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 (un-path-gate the dogfood `code-scanning` job):** Remove `if: ${{ needs.changes.outputs.code != 'false' }}` from the `code-scanning` job (`ci.yml:541`) so it runs on EVERY PR (and push), including a `.planning/`-only PR, guaranteeing an analysis exists on every PR ref for the ruleset (PITFALLS P1 Prevention 2). Accepted cost: one Linux job (not the OS x Node matrix) runs on planning-only PRs. Fork-PR upload skip stays. Selected over an internal-short-circuit alternative.
- **D-01a (the `code-scanning-proof` job does NOT get un-path-gated):** It stays `if: github.event_name == 'pull_request' && needs.changes.outputs.code != 'false'` (PR-only + path-gated). It is NOT one of the ruleset's required-tool analyses (angular-typechecker dogfood + fallow). It IS still added to the `ci` aggregate (D-02); a path-skip resolves to `skipped`, which the aggregate drops.
- **D-02 (add both jobs to the required `ci` aggregate `needs[]`):** Add `code-scanning` and `code-scanning-proof` to the `ci` job's `needs[]` (`ci.yml:730-743`), reversing the deliberate prior exclusion. Safe per ARCHITECTURE section 4 (fork-skip -> job still succeeds; `|| true` -> only infra break fails; path-skip -> dropped). Mirrors the `cve-lite` precedent.
- **D-03 (GATE-01 contract -- close the P7 fail-open):** On a non-fork PR, ASSERT the dogfood produced a non-empty SARIF and uploaded (fail the `code-scanning` job when `produced == 'false'` on a non-fork PR). NOT a findings gate (a real type error still writes valid SARIF -> `produced=true` -> upload -> green; the diagnostic gate stays `test`'s `nx run-many -t typecheck`). Fork PRs and push events are EXEMPT. Planner latitude on the exact shape; MUST NOT fire on fork PRs or push.
- **D-04 (the phase ships the runbook; a human flips the `main` ruleset):** The agent does NOT change the `main` ruleset via `gh api`. Deliverable = CI wiring (D-01..D-03) + a documented runbook: Evaluate mode FIRST; `.planning/`-only + code probe PRs; Ruleset Insights confirm neither is blocked; then Active; `enforcement: disabled` recovery; fork-PR deadlock documented as accepted.
- **D-05 (three distinct documentation homes):** GATE-01 rationale -> inline `ci.yml` comments mirroring the `cve-lite` divergence block, plus updating the two "DELIBERATELY NOT in the ci aggregate" comments; GATE-02 runbook -> AGENTS.md (extending the ruleset + Lockout-recovery sections; MUST be code-reviewed); DOC-01 -> a short subsection under the README `### SARIF and GitHub Code Scanning` heading, end-user language, no Issue filed.
- **D-06 (CI/docs-only, no bump):** Changed files: `.github/workflows/ci.yml` (MOD), `AGENTS.md` (MOD), `packages/angular-typechecker/README.md` (MOD). Only README is in the package `files` allowlist -> additive audit vs `@0.2.3` shows ONLY the additive README prose delta. CI/ruleset in `ci`/`chore` commits, docs in `docs` commits -- none bump the version.

### Claude's Discretion

- Exact shape/placement of the D-03 `produced==true` assertion (dedicated `if:`-gated step vs folding into the produced guard) -- must exempt fork PRs + push.
- Exact wording of the ci.yml GATE-01 comment block and the AGENTS.md runbook prose (subject to code review).
- Whether the README DOC-01 note is a `####` sub-subsection or a short paragraph appended under `### SARIF and GitHub Code Scanning`.
- Whether to add a lightweight in-repo guard (workflow-lint assertion) that both jobs remain in `ci.needs[]` and that `code-scanning` stays un-path-gated -- OPTIONAL drift lock, planner's call; if added it MUST be test/CI-only (no published surface, no version impact).

### Deferred Ideas (OUT OF SCOPE)

- The AGENT flipping the `main` ruleset via `gh api` (human maintainer action, D-04).
- Any reporter-side `--category` / `automationDetails.id` CLI option (rejected in Phase 35 -- would make this release-bearing).
- Duplicating findings-gating inside the `code-scanning` job (findings already gate via `test`'s `nx run-many -t typecheck` + the `fallow` job).
- Emitting `run.artifacts` to chase the "Scanned files" panel (proven inert; documented, not pursued).
- Un-path-gating the `code-scanning-proof` job (fixture-contract proof, not a required-tool analysis; D-01a).
- MULTI-FUT-01 per-project CI matrix, RULE-FUT-01 inline-template TS distinction, GitHub-backed Nx remote cache -- all deferred.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GATE-01 | The `code-scanning` CI job is a required member of the `ci` aggregate (the dogfood upload running successfully is part of the merge gate). | Section 1 (exact `needs[]` edit + no Gate-step change), Section 2 (the D-03 `produced==true` contract closing PITFALLS P7), Section 5 (the `cve-lite` precedent + the two comment-block rewrites). |
| GATE-02 | GitHub "Require code scanning results" enabled on `main` for angular-typechecker + fallow, configured so planning-only PRs are NOT deadlocked. | Section 3 (un-path-gate the `code-scanning` job; proof stays PR-only), Section 4 (the human-gated Evaluate-first runbook + verified GitHub UI labels + `enforcement: disabled` recovery + fork-PR deadlock note). |
| DOC-01 | README documents the CodeQL-only "Scanned files" panel gap (spike evidence), framed as a known GitHub limitation, no Issue filed. | Section 6 (the exact README subsection content + the content-tripwire strings, grounded in spike PR #53's `run.artifacts`-inert finding). |
</phase_requirements>

## Summary

Every technical question in this phase is already answered by existing authoritative artifacts; the work is precise wiring and prose, not derivation. The SARIF -> GitHub Code Scanning pipeline is spike-proven (closed PR #53) and Phase 35's `code-scanning-proof` job already lands and asserts GREEN in real CI. Phase 36 does three things: (1) promote the two existing Code Scanning jobs into the required `ci` aggregate's `needs[]` and add a fail-loud "the dogfood SARIF was actually produced" assertion so the gate cannot pass on a silent empty upload (GATE-01); (2) remove one `if:` line so the dogfood job runs on every PR including `.planning/`-only ones, guaranteeing an analysis exists on every PR ref, plus ship a human-run runbook for enabling the "Require code scanning results" ruleset (GATE-02); (3) add a short end-user README subsection documenting that the "Scanned files" panel is CodeQL-only telemetry a third-party SARIF tool cannot populate (DOC-01).

The two gates are ORTHOGONAL and this must stay front-of-mind: GATE-01 is the required `ci` status check (a GitHub Actions concern); GATE-02 is GitHub's separate "Require code scanning results" ruleset (a repo-settings concern evaluated against whether an analysis exists on the PR ref). Making `code-scanning` a member of `ci` does NOT satisfy GATE-02; un-path-gating the job does (it guarantees the analysis). The D-03 `produced==true` assertion is load-bearing for BOTH: it turns a silent empty SARIF (which would both pass GATE-01 green AND deadlock the GATE-02 ruleset with a missing analysis) into a loud red job.

**Primary recommendation:** Make the minimal, precedent-faithful edits -- remove exactly one `if:` line, extend `needs[]` by two entries, add two tiny pure-`if:`-gated assertion steps, rewrite three comment blocks, add one README subsection and one AGENTS.md runbook subsection -- then reuse the existing `extractJobLines` drift-guard pattern (`ci-e2e-coverage-guard.spec.ts`) and the docs-tripwire pattern (`angular-cli-docs.spec.ts`) for the in-repo static assertions. The ruleset enablement is a human-run, real-CI-only step; the agent ships only the runbook.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| GATE-01 aggregate membership | CI workflow (`ci.yml`) | -- | `needs[]` + Gate-step logic live in the GitHub Actions workflow. |
| GATE-01 "upload succeeded" contract (D-03) | CI workflow (`ci.yml`) | in-repo static guard (Vitest) | The assertion is a workflow step; a drift guard statically asserts the step exists + is correctly gated. |
| GATE-02 "analysis exists on every ref" | CI workflow (`ci.yml`) | in-repo static guard (Vitest) | Un-path-gating is a workflow edit; a guard statically asserts the path-gate stays absent. |
| GATE-02 ruleset enablement | GitHub repo settings (human) | docs (AGENTS.md runbook) | The ruleset is out-of-band repo configuration; the agent ships the runbook only (D-04). |
| DOC-01 Scanned-files limitation | Docs (shipped README) | in-repo static guard (docs tripwire) | Prose in the published README; a content-tripwire spec locks the claim against drift. |

## Standard Stack

Not a dependency phase. No packages are installed. The relevant tooling is already present and unchanged:

| Tool | Version | Role this phase |
|------|---------|-----------------|
| GitHub Actions | n/a (hosted) | Runs `.github/workflows/ci.yml`; the `ci` aggregate is the required status check. |
| `github/codeql-action/upload-sarif` | pinned `@7188fc36...` (v4.37.1) in `ci.yml` | Already used by both Code Scanning jobs; REUSED, no new action, no new SHA pin. |
| `gh` CLI | ambient on runners | Already used by the proof job's assert step; not touched this phase. |
| Vitest via `@nx/vitest:test` | 4.x | Runs the new in-repo drift-guard + docs-tripwire specs on the fast `test` tier. |

**Installation:** none. Any change that adds a marketplace action would need a full 40-char SHA pin + Dependabot coverage (PITFALLS "Repo-Specific Warnings"); this phase adds none.

## Package Legitimacy Audit

**N/A -- this phase installs no external packages.** Changed files are `.github/workflows/ci.yml`, `AGENTS.md`, and `packages/angular-typechecker/README.md` (plus optional in-repo `*.spec.ts` guards that add no dependency). No `package.json` edit, no `src/**` edit.

## Section 1 -- GATE-01 CI edit: `needs[]` membership (must-answer #1)

### The exact `needs[]` edit

Current `ci` aggregate (`ci.yml:730-743`):

```yaml
  ci:
    needs:
      [
        changes,
        discover,
        test,
        e2e,
        e2e-windows,
        fallow,
        cve-lite,
        format-lint,
        act-compat,
        lint-workflows,
        scoped-name-guard,
      ]
```

Add the two jobs (append, order is cosmetic):

```yaml
  ci:
    needs:
      [
        changes,
        discover,
        test,
        e2e,
        e2e-windows,
        fallow,
        cve-lite,
        format-lint,
        act-compat,
        lint-workflows,
        scoped-name-guard,
        code-scanning,
        code-scanning-proof,
      ]
```

### No change to the `ci` Gate step body is needed -- confirmed

The Gate step (`ci.yml:746-753`) is:

```yaml
    steps:
      - name: Gate
        run: |
          if [ "${{ contains(needs.*.result, 'failure') || contains(needs.*.result, 'cancelled') }}" = "true" ]; then
            echo "A required job failed or was cancelled"
            exit 1
          fi
          echo "All required jobs succeeded or were intentionally path-skipped"
```

`skipped` is already DROPPED from the fail set (D-08). This handles both new members correctly with NO edit:

- **`code-scanning` on a planning-only PR:** after D-01 it is un-path-gated, so it RUNS and SUCCEEDS (clean tree -> valid SARIF -> `produced=true` -> upload -> D-03 assertion skipped) -> result `success`. Not a failure. OK.
- **`code-scanning-proof` on a planning-only PR:** stays path-gated + PR-only, so `code != 'false'` is false -> job `skipped` -> aggregate drops it. No deadlock. OK.
- **`code-scanning-proof` on push-to-`main`:** `github.event_name == 'pull_request'` is false -> `skipped` -> dropped. OK.
- **Either job genuinely fails (infra break, or D-03 assertion fires, or the proof contract regresses):** result `failure` -> `contains(needs.*.result, 'failure')` -> `ci` fails. This is the intended GATE-01 behavior.

### The `needs: changes` on `code-scanning` becomes orphaned (note)

Removing the D-01 `if:` (Section 3) leaves `needs: changes` (`ci.yml:540`) referenced by nothing in the job. **Minimal, CONTEXT-faithful edit: remove only the `if:` line and leave `needs: changes`** -- it is harmless (just serializes `code-scanning` after the fast `changes` job, which always runs). The planner MAY drop `needs: changes` for cleanliness, but it is not required and keeping it is the smaller diff. `code-scanning-proof` KEEPS `needs: changes` (it still references `needs.changes.outputs.code` in its path-gate).

## Section 2 -- GATE-01 contract: the `produced==true` assertion (must-answer #2, closes PITFALLS P7)

### The problem (P7 fail-open)

The generation steps use `|| true` + a `produced` guard so an infra exit-2 (empty SARIF) does not feed `upload-sarif` an invalid file (`ci.yml:570-593`). Once `code-scanning` is a required `ci` member, a reporter regression that emits an empty/invalid SARIF sets `produced=false`, skips the upload, and leaves the job GREEN -- so GATE-01 would gate only "the job did not crash," and the GATE-02 ruleset would silently deadlock (no analysis on the ref). Fix: fail loud on `produced=false` for a non-fork PR.

### Recommended shape: two pure-`if:`-gated steps (no shell interpolation)

Add these AFTER the two generation steps (after `ci.yml:593`) or at the end of the job -- placement is order-independent because each reads a step output already set by the time it runs. Using pure `if:` gating with a static `echo`/`exit 1` body means NO step output is interpolated into a shell command (trivially satisfies the top-of-file no-command-injection invariant):

```yaml
      # GATE-01 contract (D-03, closes RESEARCH PITFALLS P7): on a non-fork PR a silent
      # empty/absent SARIF (produced=false) would (a) let the now-required `code-scanning`
      # gate pass GREEN on a reporter regression and (b) leave the "Require code scanning
      # results" ruleset with no analysis on the PR ref (deadlock). Fail loud instead.
      # Exempt fork PRs (read-only token -> upload skipped by design) and push events (not
      # merge-gated). NOT a findings gate: a real type error still writes a valid SARIF
      # (exit 1 -> produced=true) -> uploads -> green; diagnostics gate in `test`.
      - name: Assert angular-typechecker SARIF was produced (non-fork PR)
        if: ${{ github.event_name == 'pull_request' && github.event.pull_request.head.repo.fork == false && steps.atc-sarif.outputs.produced == 'false' }}
        run: |
          echo "::error::angular-typechecker produced no SARIF on a non-fork PR. A reporter regression (empty/invalid SARIF) would pass this required gate green AND leave the Code Scanning ruleset with no analysis on the PR ref. Failing loud."
          exit 1
      # fallow is ALSO a required tool of the GATE-02 ruleset, so a missing fallow analysis
      # would deadlock the ref too. fallow's `--format sarif -o` always writes a valid file,
      # so this is a cheap backstop against a fallow infra break, not an expected failure.
      - name: Assert fallow SARIF was produced (non-fork PR)
        if: ${{ github.event_name == 'pull_request' && github.event.pull_request.head.repo.fork == false && steps.fallow-sarif.outputs.produced == 'false' }}
        run: |
          echo "::error::fallow produced no SARIF on a non-fork PR. The 'Require code scanning results' ruleset lists fallow as a required tool, so a missing fallow analysis would deadlock the PR ref. Failing loud."
          exit 1
```

### Why this satisfies every D-03 constraint

- **Exempts fork PRs:** `github.event.pull_request.head.repo.fork == false` is false on a fork -> step skipped.
- **Exempts push events:** `github.event_name == 'pull_request'` is false on push -> step skipped.
- **Does NOT duplicate findings-gating:** a real type error -> CLI exit 1 -> `|| true` -> valid non-empty SARIF -> `produced=true` -> the `== 'false'` condition is false -> step skipped -> upload proceeds -> job green. The diagnostic gate remains `test`'s `nx run-many -t typecheck`.
- **`== 'false'` vs `!= 'true'`:** identical in practice (the generation step always writes exactly `true` or `false`). CONTEXT D-03 words it as `produced == 'false'`; use that. `!= 'true'` is an equally valid defensive alternative if the planner prefers it -- either is fine (Claude's discretion per D-03 planner latitude).

### The fallow leg (must-answer #2 "note the fallow leg")

Include the fallow assertion. It is load-bearing for GATE-02 (the ruleset lists BOTH angular-typechecker AND fallow as required tools -- D-04 step 1 -- so a missing fallow analysis also deadlocks the ref), even though fallow's `--format sarif -o` "always writes a valid file" (`ci.yml:574-575`), making it a cheap belt-and-suspenders backstop against a fallow crash rather than an expected trigger. If the planner wants the absolute minimum, the dogfood assertion alone satisfies D-03/SC1's literal wording ("the dogfood upload running successfully"); the fallow assertion is the recommended completeness step for GATE-02.

## Section 3 -- GATE-02 CI edit: un-path-gate the dogfood job (must-answer #3)

### The exact `if:` to remove

In the `code-scanning` job, remove line 541:

```yaml
  code-scanning:
    needs: changes
    if: ${{ needs.changes.outputs.code != 'false' }}   # <-- REMOVE THIS LINE (ci.yml:541)
    runs-on: ubuntu-latest
```

Result: the job has no `if:`, so it runs on every `pull_request` and every push-to-`main`. On a `.planning/`-only PR it now runs `npm ci` + `nx build` + `merge-sarif.mjs` (dogfood over the real projects) + upload, producing a valid analysis on that PR ref.

### Accepted cost

One Linux job (npm ci + nx build + one CLI run per discovered project + upload) runs on planning-only PRs -- roughly a couple of minutes, NOT the OS x Node matrix (D-01 accepted this explicitly). This is the price of guaranteeing an analysis exists on every PR ref so the ruleset cannot deadlock a planning-only PR (PITFALLS P1 Prevention 2). The status-check path-skip trick alone does NOT satisfy the ruleset -- the two gates are orthogonal.

### `code-scanning-proof` stays PR-only + path-gated -- confirmed unchanged

Do NOT touch the proof job's `if:` (`ci.yml:656`):

```yaml
  code-scanning-proof:
    needs: changes
    if: ${{ github.event_name == 'pull_request' && needs.changes.outputs.code != 'false' }}   # UNCHANGED (D-01a)
```

It is a fixture-contract proof scoped to `refs/pull/<n>/merge` under the dedicated `angular-typecheck-proof` category, NOT one of the ruleset's required-tool analyses (angular-typechecker dogfood + fallow), so it needs no un-gating. It IS added to `ci.needs[]` (Section 1); a path-skip/push resolves to `skipped`, which the aggregate drops.

## Section 4 -- GATE-02 GitHub-side runbook (must-answer #4, documentation only)

**A human maintainer performs the ruleset toggle; the agent ships only the runbook (D-04). The ruleset behavior is provable ONLY in real CI on GitHub -- local gates cannot prove ingestion or ruleset evaluation.**

### Home: AGENTS.md

Add a new subsection extending "The default-branch ruleset: `main` is PR-only" (`AGENTS.md:224`) and "Lockout recovery" (`AGENTS.md:236`). **This AGENTS.md change MUST be code-reviewed** (the self-governance rule at the top of AGENTS.md), satisfied by the phase's `code_review_gate` -- flag it explicitly in the plan.

### Verified GitHub UI labels (`[VERIFIED: docs.github.com "Set code scanning merge protection"]`, fetched 2026-07-22)

- The rule is configured under **"Required tools and alert thresholds"**; click **"Add tool"** to add each scanning tool.
- Per tool you set **"Alerts"** (None / Errors / Errors and Warnings / All) and **"Security alerts"** (None / Critical / High or higher / Medium or higher / All) thresholds.
- Enforcement is chosen from an enforcement-status dropdown (the page shows "Disabled" as one option).

### The runbook (fixed order -- do not skip Evaluate)

1. **Add the rule.** Settings -> Rules -> Rulesets -> the `main` ruleset -> add "Require code scanning results". Under "Required tools and alert thresholds", "Add tool" for BOTH `angular-typechecker` AND `fallow`. Recommendation: set the alert threshold conservatively so this becomes an ANALYSIS-EXISTENCE gate, not a second findings gate -- findings already gate via `ci`'s `test` (`nx run-many -t typecheck`) and the `fallow` job (Out-of-Scope table). The load-bearing block is the MISSING-analysis block, which fires regardless of the alert threshold (`[CITED: PITFALLS P1 / GitHub docs]` -- "blocks when a required tool's analysis is missing, not-configured, or in-progress, not only when it finds alerts").
2. **Evaluate mode FIRST** (`[CITED: PITFALLS P1 / GitHub docs]` -- Evaluate records would-be blocks without blocking; recommended before Active). `[ASSUMED]`: for repo-level rulesets, "Evaluate" enforcement may depend on the GitHub plan tier; if Evaluate is unavailable, verify on a throwaway branch/PR scoped ruleset and rely on the `enforcement: disabled` recovery below. Flag this for user confirmation.
3. **Probe.** Push a deliberate `.planning/`-only PR AND a code-touching PR. In the ruleset's Insights/evaluation view, confirm NEITHER would be blocked: the planning-only PR now produces an angular-typechecker analysis (via D-01 un-path-gate) + fallow; the code PR produces both plus the proof. `[ASSUMED]` on the exact "Ruleset Insights" label -- verify in the live UI when running the runbook.
4. **Flip to Active** only after step 3 confirms no would-be block.
5. **Recovery** (if it wedges the empty-bypass `main` merge button): toggle the ruleset `enforcement` to `disabled`, merge the fix, re-enable -- exactly as AGENTS.md "Lockout recovery". NEVER add a standing bypass actor.
6. **Fork-PR deadlock (accepted limitation, DOCUMENT it):** a fork PR gets a read-only token -> the upload steps skip -> no analysis -> the ruleset blocks it. Low practical impact here (no external contributors; the maintainer self-merges). A future external contributor's PR needs a maintainer-side re-run or the `enforcement: disabled` toggle. D-01 (un-path-gate) cannot fix forks -- the token is read-only.

### External/runtime state note

GATE-02 mutates GitHub-side repo state (the `main` ruleset) that lives in repo settings, NOT in git. It is the one part of this phase not captured by any committed file -- which is exactly why it is a human-run runbook, not an agent action.

## Section 5 -- The `ci.yml` comment rewrites (must-answer #1, the GATE-01 rationale)

Three comment blocks must change so they stop contradicting the new membership. Exact prose is Claude's discretion (D-05, subject to code review); the required content is below.

### 5a. The `cve-lite` precedent to MIRROR (`ci.yml:354-369`)

This is the existing block that documents a required gate diverging from the "never a merge gate" stance. Its structure (mirror it for `code-scanning`):
- States it IS a required merge gate (in the `ci` aggregate's needs) at the maintainer's request, INTENTIONALLY diverging from the code-scanning "never a merge gate" stance.
- Lists accepted tradeoffs: an outage / newly-published advisory can block the merge button -> recover via the branch ruleset `enforcement` toggle (AGENTS.md "Lockout recovery"); the tool is pinned so an upstream publish cannot silently enter CI.

### 5b. Rewrite the `code-scanning` "DELIBERATELY NOT" comment (`ci.yml:493-497`)

Currently: "DELIBERATELY NOT in the `ci` aggregate's needs: SARIF upload is additive reporting, never a merge gate ... Keeping this job out of `ci` means a Code Scanning outage or a fork-PR upload skip can NEVER deadlock the PR-only merge button."

Rewrite to state (mirroring 5a):
- This job IS NOW a required member of the `ci` aggregate (GATE-01), reversing the prior exclusion, at the maintainer's request -- the dogfood upload succeeding is part of the merge gate (SC1).
- Safe because: (a) un-path-gated (D-01) so it runs on every PR incl. planning-only, producing an analysis; (b) on a fork PR the upload steps skip but the JOB still returns success; (c) `|| true` on generation means only a real infra break (`npm ci`/`nx build`) fails the job -- which SHOULD fail `ci`; (d) the D-03 `produced==true` assertion fails the job on a silent empty SARIF (non-fork PR).
- Accepted tradeoff (mirror cve-lite): a Code Scanning outage or infra break can block the merge button -> recover via the ruleset `enforcement: disabled` toggle (AGENTS.md "Lockout recovery").

### 5c. Rewrite the `code-scanning-proof` "DELIBERATELY NOT" comment (`ci.yml:649-650`)

Currently: "DELIBERATELY NOT in the `ci` aggregate's needs (D-02d) ... Promoting it into the required merge gate is GATE-01 / Phase 36."

Rewrite to state:
- This job IS NOW a member of the `ci` aggregate (GATE-01 / Phase 36) -- a real SARIF -> Code Scanning contract regression (PROOF-02) now fails the required `ci` check.
- It stays PR-only + path-gated (D-01a), so on a planning-only PR or a push it resolves to `skipped`, which the aggregate's `contains(needs.*.result, ...)` gate drops -- no deadlock.

## Section 6 -- DOC-01 README subsection (must-answer #5)

### Home + shape

Under `### SARIF and GitHub Code Scanning` (`packages/angular-typechecker/README.md:694`), after the existing content (e.g. after the "Run from the repository root" subsection at line 716-722, or as a `####` sub-subsection). Shape is Claude's discretion (D-05).

### Draft content (end-user language, spike-grounded, no Issue filed)

```markdown
#### The "Scanned files" panel stays empty (a GitHub limitation)

On an alert's detail page, GitHub shows a "Scanned files" tool-status panel. For
angular-typechecker -- and for any third-party SARIF tool -- that panel stays
empty. This is a GitHub limitation, not a defect in angular-typechecker or its
SARIF output: GitHub fills "Scanned files" only from its own CodeQL analysis
telemetry, and the SARIF format has no field a third-party tool can use to
populate it. angular-typechecker's SARIF is well-formed and its alerts, rule
descriptions, and file locations all appear normally -- only that one
CodeQL-specific panel is blank. Emitting the optional SARIF `run.artifacts`
list does not change it: the panel ignores it. So an empty "Scanned files"
panel is expected and can be ignored.
```

Rationale for the framing: `[CITED: PITFALLS P10 / spike PR #53 / auto-memory code-scanning-sarif-empirical-behavior]` -- "Scanned files" is CodeQL-internal per-language telemetry; emitting `run.artifacts` with `roles:["analysisTarget"]` left it unchanged in the spike. End-user language per the repo's "CHANGELOG + README must be end-user-facing" rule (no board/phase/G-gate/"telemetry surface" jargon beyond what a consumer needs). No GitHub Issue is filed (user preference; PITFALLS "Repo-Specific Warnings").

### The content-tripwire (see Validation Architecture)

Mirror `angular-cli-docs.spec.ts`: a normalized-whitespace `readFileSync` of the README asserting the claim is present, e.g.:
- `expect(readme).toContain('### SARIF and GitHub Code Scanning')`
- `expect(normalized).toContain('Scanned files')`
- `expect(normalized).toContain('a GitHub limitation')` (or `'not a defect'`)
- `expect(normalized).toContain('CodeQL')`
- `expect(normalized).toContain('run.artifacts')` (locks the spike evidence in)

## Section 7 -- No-release / additive posture (must-answer #6)

| Changed file | In package `files` allowlist? | Enters the tarball? | Commit type | Bumps version? |
|--------------|-------------------------------|---------------------|-------------|----------------|
| `.github/workflows/ci.yml` | No | No | `ci(...)` (or `chore`) | No |
| `AGENTS.md` | No | No | `docs(...)` | No |
| `packages/angular-typechecker/README.md` | **Yes** (`files` whitelists `README.md`) | Yes | `docs(...)` | No |
| optional in-repo `*.spec.ts` guards | No (test file, excluded by `tsconfig.lib.json`) | No | `test(...)` (or `ci`) | No |

- **Additive audit vs `@0.2.3`:** only README is in the tarball, and its delta is the DOC-01 prose subsection. So the audit shows ONLY the additive README prose delta and NO `src/**` or `package.json` change. Additive-only holds BY CONSTRUCTION (no production-code or manifest edit) -- consistent with the standing charter (`32-/33-ADDITIVE-AUDIT.md` precedent).
- **No bump:** `ci`/`chore`/`docs`/`test` are all no-bump conventional-commit types under this repo's `nx release` config, AND none of them touch package files, so `nx release` derives no bump for `angular-typechecker` (AGENTS.md "Only commits that touch the published project count"). `package.json` version is UNCHANGED (stays `0.2.3` in-repo; the `0.2.3 -> 0.2.4` cut is Phase 33's RULE work, released via the human-gated Release-PR flow at milestone end -- Phase 36 adds nothing releasable, PITFALLS P2).
- **Do NOT touch:** `packages/angular-typechecker/src/**`, `packages/angular-typechecker/package.json`, `src/index.ts` barrel, or any schema/manifest. The phase preserves the "GATE/DOC add nothing releasable" invariant purely by not editing those files.

## Validation Architecture

**Nyquist validation is enabled for this phase.** The core reality: the ruleset behavior (GATE-02) is provable ONLY in real CI on GitHub -- local gates cannot prove GitHub ingestion or ruleset evaluation (auto-memory `ci-sarif-code-scanning-dogfood`). So validation splits three ways: in-repo static drift guards (fast, sampled every commit), documentation tripwires (fast, content assertions), and real-CI-only Nyquist points (the merge-gate behavior + the human-run ruleset verification).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.x via `@nx/vitest:test` (unit `test` target); integration tier under the separate `integration` target |
| Config file | `packages/angular-typechecker/vitest.config.mts` (unit) -- planner confirm exact filename; the new specs are unit-tier plain fs reads |
| Quick run command | `npx nx test angular-typechecker` |
| Full suite command | `npx nx run-many -t test` (+ `-t typecheck`, `-t lint`, `nx format:check`, `-t integration`, `nx build` -- the repo's six-check battery) |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| GATE-01 | `code-scanning` + `code-scanning-proof` are in `ci.needs[]` | static drift guard (regex over `ci.yml`) | `npx nx test angular-typechecker` | Wave 0 (new describe, reuse `extractJobLines`) |
| GATE-01 | the D-03 `produced==true` assertion step exists, PR-only + non-fork gated | static drift guard | `npx nx test angular-typechecker` | Wave 0 |
| GATE-01 | the required `ci` gate actually goes red on a real regression / green normally | real-CI-only (Nyquist point) | the phase's own PR run + Phase 35 proof baseline (run 29875173270) | CI-authoritative |
| GATE-02 | `code-scanning` stays un-path-gated (no `needs.changes.outputs.code` `if:`) | static drift guard | `npx nx test angular-typechecker` | Wave 0 |
| GATE-02 | planning-only PR is NOT deadlocked; ruleset blocks missing analysis; Evaluate->Active | real-CI-only + human-run runbook | the D-04 runbook on throwaway PRs | CI/human-authoritative |
| DOC-01 | README carries the Scanned-files-limitation claim | docs content-tripwire | `npx nx test angular-typechecker` | Wave 0 (mirror `angular-cli-docs.spec.ts`) |

### Sampling Rate

- **Per task commit:** `npx nx test angular-typechecker` (runs the new drift guard + docs tripwire; seconds).
- **Per wave merge:** `npx nx run-many -t test` + `npx nx run-many -t typecheck` + `npx nx run-many -t lint` + `npx nx format:check` + the `act-compat` + `lint-workflows` local equivalents if editing `ci.yml`.
- **Phase gate:** the real-CI PR green with `code-scanning` + `code-scanning-proof` as required `ci` members (this is the Nyquist point -- GitHub ingestion is only provable here); THEN the human-run GATE-02 runbook (Evaluate -> throwaway PRs -> Active).

### Wave 0 Gaps

- [ ] A workflow drift-guard: **reuse the existing `extractJobLines(ci, jobName)` slicer in `packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts`** (it is the exact precedent -- GUARD-01f already uses it to assert `e2e-windows` is in `ci.needs[]`). Add a new `describe('GATE-01/02: Code Scanning jobs are required + un-path-gated', ...)` in that file (ponytail: one file, reuse the helper -- no new file, no new dependency). Assertions:
  - `code-scanning` is in the `ci` needs block. **Regex subtlety:** `code-scanning` is a substring of `code-scanning-proof`, so `\bcode-scanning\b` matches BOTH. Anchor on the list-item line instead: `/^\s*code-scanning,\s*$/m` and `/^\s*code-scanning-proof,\s*$/m` over `extractJobLines(ci, 'ci').join('\n')`.
  - The `code-scanning` job block has NO path-gate: `expect(/^(?!\s*#).*if:\s*\$\{\{\s*needs\.changes\.outputs\.code/m.test(extractJobLines(ci, 'code-scanning').join('\n'))).toBe(false)`.
  - (Optional, D-05 latitude) the D-03 assertion step exists and is PR-only + non-fork gated: assert the `code-scanning` block contains a step whose `if:` references `github.event.pull_request.head.repo.fork == false` and `steps.atc-sarif.outputs.produced`.
  - Note `extractJobLines` is a private function in that spec; adding a describe block in the same file reuses it directly (no export needed).
- [ ] A DOC-01 README content-tripwire: **mirror `packages/angular-typechecker/src/angular-cli-docs.spec.ts`** (normalized-whitespace `.toContain` assertions). Either a new `code-scanning-docs.spec.ts` or fold into an existing docs tripwire.
  - **Coverage nuance (flag for the planner):** the existing docs tripwires ride the plugin `test` target, which is path-gated on `code` -- a README-only PR (`*.md` -> `code=false`) SKIPS `test`, so a future README-only gutting PR would not be caught by a `test`-tier tripwire. This is the same coverage the OTHER docs tripwires already have (precedent). Phase 36's OWN PR touches `ci.yml` (a non-md file -> `code=true`), so the tripwire IS exercised during this phase's verification. If the planner wants README-only-PR coverage, promote the assertion into the always-run `scoped-name-guard` target (the repo's E1 "must run even on docs-only PRs" mechanism); otherwise mirror the existing precedent and accept parity. Recommend: mirror precedent (lazy-correct), note the nuance.
- [ ] AGENTS.md runbook: NO tripwire required -- the `code_review_gate` covers AGENTS.md (self-governance rule). An optional content-tripwire is speculative (YAGNI); skip unless the planner wants drift-lock parity with README.
- [ ] Framework install: none (Vitest present).

## Common Pitfalls

### Pitfall 1: Treating GATE-01 and GATE-02 as the same gate
**What goes wrong:** assuming that adding `code-scanning` to `ci.needs[]` satisfies "Require code scanning results." **Why:** they are orthogonal GitHub mechanisms -- `ci` is a status check; the ruleset is evaluated against whether an analysis EXISTS on the PR ref, and does not read the `ci` check (PITFALLS P1). **How to avoid:** do BOTH -- membership (D-02) for GATE-01, un-path-gate (D-01) for GATE-02. **Warning sign:** a planning-only PR shows "Code scanning results / <tool> -- Waiting for results" and the merge button stays disabled.

### Pitfall 2: The P7 fail-open (a silent empty SARIF passes green)
**What goes wrong:** without the D-03 assertion, a reporter regression emits an empty SARIF -> `produced=false` -> upload skipped -> job green -> GATE-01 gates only "did not crash" AND the ruleset deadlocks on a missing analysis. **How to avoid:** the Section 2 pure-`if:` assertion. **Warning sign:** `code-scanning` green but no analysis appears under `code-scanning/analyses?tool_name=angular-typechecker&ref=refs/pull/<n>/merge`.

### Pitfall 3: Enabling the ruleset to Active before Evaluate/probe
**What goes wrong:** enabling on the empty-bypass `main` without Evaluate-first can lock out ALL merges including the fix (PITFALLS "Repo-Specific Warnings"). **How to avoid:** the Section 4 runbook order (Evaluate -> probe PRs -> Active); know the `enforcement: disabled` recovery. **This is a human-run step -- the agent ships only the runbook.**

### Pitfall 4: The `code-scanning` / `code-scanning-proof` regex overlap in the drift guard
**What goes wrong:** `\bcode-scanning\b` matches inside `code-scanning-proof`, so a naive membership assertion for `code-scanning` passes even if only the proof job is listed. **How to avoid:** anchor on the full list-item line (`/^\s*code-scanning,\s*$/m`). GUARD-01f's simpler `\be2e-windows\b` worked only because there is no superset collision there.

### Pitfall 5: Accidentally making the phase release-bearing
**What goes wrong:** editing any `packages/angular-typechecker/src/**` or `package.json` file makes `nx release` derive a bump and breaks the additive-only charter (PITFALLS P2). **How to avoid:** touch only `ci.yml`, `AGENTS.md`, README, and test-tier `*.spec.ts`; use `ci`/`docs`/`test` commit types; run the additive git-diff audit vs `@0.2.3` before considering the phase done.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Slicing a job block out of `ci.yml` for a static assertion | a YAML parser dependency or a bespoke slicer | the existing `extractJobLines(ci, jobName)` in `ci-e2e-coverage-guard.spec.ts` | Line-level invariant; the repo already standardized on this no-parser slicer (GUARD-01/01b/01c/01f). |
| Asserting a README claim survives edits | a Markdown AST parser | the `angular-cli-docs.spec.ts` normalized-whitespace `.toContain` pattern | Locks the CLAIM, not the line breaks; survives prose re-wrapping; fast fs read. |
| Gating a workflow step on PR/fork/event context | shell `if [ ... ]` interpolating step outputs | pure `if:` expression gating + a static `echo`/`exit 1` body | Avoids interpolating anything into a shell (no-command-injection invariant), self-documents in the Actions UI. |
| A merge-protection gate for "analysis exists" | a custom polling job | GitHub's native "Require code scanning results" ruleset | Native mechanism; the phase's whole point (GATE-02). |

## State of the Art

| Old approach (pre-Phase-36) | Current approach | Impact |
|-----------------------------|------------------|--------|
| `code-scanning` deliberately OUT of `ci.needs[]` ("never a merge gate") | `code-scanning` + `code-scanning-proof` ARE required `ci` members | Reverses the prior stance; mirrors the `cve-lite` precedent (the first job to diverge). |
| `code-scanning` path-gated (skips planning-only PRs) | `code-scanning` un-path-gated (runs on every PR) | Guarantees an analysis on every PR ref so the GATE-02 ruleset cannot deadlock a planning-only PR. |
| `produced` guard leaves the job green on an empty SARIF | non-fork-PR `produced==true` assertion fails loud | Closes the P7 fail-open; a silent reporter regression / ruleset deadlock becomes a red job. |
| "Scanned files" panel undocumented (looked like a defect) | README documents it as a known CodeQL-only GitHub limitation | DOC-01; no Issue filed. |

**Deprecated/outdated:** the two "DELIBERATELY NOT in the `ci` aggregate" comment blocks (`ci.yml:493-497`, `ci.yml:649-650`) become false after D-02 and MUST be rewritten (Section 5).

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | For repo-level rulesets, "Evaluate" enforcement mode may depend on the GitHub plan tier | Section 4 step 2 | If Evaluate is unavailable, the human must verify on a throwaway-branch-scoped ruleset and lean on `enforcement: disabled` recovery -- the runbook already provides this fallback, so the risk is low. Verify in the live UI when running the runbook. |
| A2 | The ruleset's would-be-block view is labeled "Ruleset Insights" | Section 4 step 3 | Cosmetic -- the human finds the evaluation view under the ruleset regardless of the exact label. |
| A3 | Setting a tool's "Alerts" threshold conservatively yields an analysis-existence gate while the missing-analysis block still fires independently | Section 4 step 1 | If the alert threshold interacts with the missing-analysis block differently, the human adjusts during the Evaluate-mode probe (step 3 catches it before Active). PITFALLS P1 (HIGH, GitHub-docs-grounded) states the missing-analysis block is independent of alerts. |

All other claims are VERIFIED against the live `ci.yml` / the specs / CONTEXT, or CITED from the research docs / spike PR #53 / the one GitHub-docs fetch.

## Open Questions

1. **Exact `vitest` unit config filename for the new specs.**
   - What we know: the plugin uses `@nx/vitest:test`; the integration tier uses `vitest.integration.config.mts`.
   - What's unclear: the exact unit config filename (likely `vitest.config.mts`).
   - Recommendation: the new specs are plain fs-read unit specs riding `nx test angular-typechecker`; the planner confirms the config filename when placing the file (non-blocking -- it lands in the plugin `src/` like the existing guards).

2. **Whether to drop the orphaned `needs: changes` on `code-scanning`.**
   - What we know: after removing the `if:`, `needs: changes` is referenced by nothing in the job.
   - Recommendation: leave it (minimal diff, harmless) OR drop it (cleaner) -- planner's call. Removing only the `if:` line is the minimal CONTEXT-faithful edit.

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| GitHub Actions (hosted runners) | GATE-01/02 real-CI verification | Yes (CI) | hosted | none -- GitHub ingestion is real-CI-only |
| `github/codeql-action/upload-sarif` | both Code Scanning jobs | Yes (pinned in `ci.yml`) | v4.37.1 `@7188fc36...` | REUSED; no new action |
| `gh` CLI | proof job assert (unchanged this phase) | Yes (runner ambient) | ambient | -- |
| Vitest / `@nx/vitest:test` | new drift-guard + docs-tripwire specs | Yes | 4.x | -- |
| GitHub ruleset admin access | GATE-02 human runbook | human maintainer | -- | none -- human-gated, out-of-band |

**Missing dependencies with no fallback:** none block the AGENT's work (CI wiring + docs). The GATE-02 ruleset enablement REQUIRES a human maintainer with repo-admin access -- by design (D-04), not a blocker for the phase's committed deliverables.

## Security Domain

`security_enforcement` is on for this repo (SECURITY.md gates). This phase edits the security-sensitive `ci.yml` surface, so the existing CI security invariants MUST be preserved verbatim (CONTEXT code_context) and no new attack surface introduced.

### Applicable controls

| Control | Applies | This phase |
|---------|---------|-----------|
| No PR-metadata interpolated into a shell (command injection) | yes | The Section 2 assertion steps use pure `if:` gating + static `echo`/`exit 1` -- NOTHING is interpolated into a shell. No new injection surface. |
| SHA-pinned actions | yes | No new action added; the existing `upload-sarif@7188fc36...` pin is reused. |
| Least-privilege job permissions | yes | `code-scanning` keeps job-scoped `security-events: write` + `contents: read`; un-path-gating does not change permissions. |
| `persist-credentials: false` on every checkout | yes | Unchanged. |
| Fork-PR upload skip | yes | Unchanged; the D-03 assertion explicitly EXEMPTS fork PRs. |

### Threat patterns

| Pattern | STRIDE | Mitigation |
|---------|--------|------------|
| CI workflow tampering that silently disables a gate | Tampering | The Wave-0 drift guard asserts `code-scanning`/`code-scanning-proof` stay in `ci.needs[]` and `code-scanning` stays un-path-gated -- a regression fails loud. |
| Un-path-gating runs `npm ci` + `nx build` on planning-only PRs | Elevation of Privilege | Same trusted `pull_request` (code-checkout) trigger the rest of the file uses; no privileged sibling trigger, no new secret, fork upload still skipped -> no new privilege. |
| Ruleset ADDS a merge-protection control | (defensive) | GATE-02 strengthens the security posture (a second hard gate on `main`); the empty-bypass risk is mitigated by the Evaluate-first runbook + `enforcement: disabled` recovery. |

## Sources

### Primary (HIGH confidence)
- `.github/workflows/ci.yml` at HEAD -- the `code-scanning` job (539-613, path-gate at 541, `atc-sarif`/`fallow-sarif` `produced` guards at 570-593, fork-gated uploads at 600-613), the `code-scanning-proof` job (654-712, PR-only `if:` at 656), the `ci` aggregate `needs[]` (730-743) + Gate step (746-753, drops `skipped`), the `cve-lite` precedent block (354-383), the two "DELIBERATELY NOT" comments (493-497, 649-650).
- `.planning/phases/36-.../36-CONTEXT.md` -- D-01..D-06 locked decisions (the authoritative scope).
- `.planning/REQUIREMENTS.md` -- GATE-01/02, DOC-01 + the Out-of-Scope table.
- `.planning/research/v0.2.4-enhanced-sarif-reporting/ARCHITECTURE.md` section 4 -- the GATE-01 safety argument + GATE-02-as-repo-settings.
- `.planning/research/v0.2.4-enhanced-sarif-reporting/PITFALLS.md` -- P1 (planning/fork-PR deadlock; orthogonal gates), P2 (release discipline), P7 (GATE-01 fail-open), P10 (Scanned-files not SARIF-fixable).
- `packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts` -- the `extractJobLines` slicer + GUARD-01f (the drift-guard pattern to reuse).
- `packages/angular-typechecker/src/angular-cli-docs.spec.ts` -- the docs content-tripwire pattern to mirror.
- `packages/angular-typechecker/README.md:694-722` -- the `### SARIF and GitHub Code Scanning` section (DOC-01 home).
- `AGENTS.md:224-241` -- the `main` PR-only ruleset + Lockout-recovery sections (GATE-02 runbook home) + the self-governance code-review rule.
- Closed spike PR #53 + auto-memory `code-scanning-sarif-empirical-behavior` -- `run.artifacts` inert; "Scanned files" is CodeQL-only telemetry (DOC-01 evidence). Phase 35 run 29875173270 -- proof job GREEN baseline.

### Secondary (verified this session)
- `[VERIFIED: docs.github.com "Set code scanning merge protection"]` (fetched 2026-07-22) -- the "Required tools and alert thresholds" + "Add tool" UI, per-tool "Alerts"/"Security alerts" thresholds, and the enforcement-status dropdown.

### Tertiary (assumed, see Assumptions Log)
- GitHub ruleset "Evaluate" mode plan-tier availability for repo-level rulesets (A1); the "Ruleset Insights" label (A2) -- verify in the live UI during the human runbook.

## Metadata

**Confidence breakdown:**
- CI edits (GATE-01/02 CI side): HIGH -- exact line numbers + snippets verified against the live `ci.yml`.
- GATE-01 contract (D-03 assertion): HIGH -- pure-`if:` shape satisfies every D-03 constraint; grounded in the existing fork-gate expressions.
- GATE-02 runbook: HIGH on the flow (CONTEXT D-04 + PITFALLS P1); MEDIUM on exact GitHub UI labels (one label verified, Evaluate/Insights assumed -- Assumptions Log).
- DOC-01: HIGH -- spike-proven evidence, end-user framing per repo rules.
- Validation Architecture: HIGH -- reuses two established in-repo patterns; the real-CI-only boundary is explicit.

**Research date:** 2026-07-22
**Valid until:** stable (CI/docs/ruleset domain); re-verify the GitHub ruleset UI labels at runbook time (product UI can drift).
