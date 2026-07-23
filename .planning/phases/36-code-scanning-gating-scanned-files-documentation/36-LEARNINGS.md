---
phase: 36
phase_name: "code-scanning-gating-scanned-files-documentation"
project: "angular-typechecker"
generated: "2026-07-23"
counts:
  decisions: 5
  lessons: 5
  patterns: 4
  surprises: 3
missing_artifacts: []
---

# Phase 36 Learnings: Code Scanning gating + Scanned-files documentation

## Decisions

### Promote both Code Scanning jobs into the required `ci` aggregate, un-path-gate only the dogfood job

`code-scanning` and `code-scanning-proof` were appended to the `ci` job's `needs[]` (GATE-01/D-02); the `code-scanning` dogfood job had its `if: needs.changes.outputs.code != 'false'` path-gate removed so an analysis exists on every PR ref (GATE-02/D-01), while `code-scanning-proof` stayed PR-only + path-gated (D-01a).

**Rationale:** the ruleset needs an `angular-typechecker` analysis on EVERY PR ref (including `.planning/`-only) or a planning PR deadlocks; the proof job stays path-gated because it is a code-PR-only red-SARIF demonstration. `needs: changes` was kept on the un-path-gated job as the minimal CONTEXT-faithful edit (harmless serialization).
**Source:** 36-01-SUMMARY.md

### Close the P7 fail-open with pure-`if:`-gated, static-body assertion steps

Two named steps assert a non-fork PR produced a non-empty SARIF for BOTH `angular-typechecker` AND `fallow`, gated on `event == pull_request && fork == false && steps.<id>.outputs.produced == 'false'`, with a STATIC `echo "::error::..." + exit 1` body -- nothing interpolated into the shell.

**Rationale:** a silent empty SARIF would otherwise pass green AND deadlock the ruleset (missing analysis). fallow is also a required tool of the gate, so its twin assertion is mandatory. The no-shell-interpolation invariant preserves the T-36-02 command-injection mitigation verbatim.
**Source:** 36-01-SUMMARY.md

### GATE-01/GATE-02 left Pending at plan time; closed only at phase verification

Both plans committed the full CI wiring + runbook but did NOT mark GATE-01/GATE-02 complete, because the red/green aggregate verdict and GitHub SARIF ingestion are real-CI-only, and GATE-02 additionally needs a human ruleset toggle (D-04).

**Rationale:** mirrors the 35-03 PROOF-01/02 precedent -- do not claim a requirement whose only proof is a live GitHub run/human control that cannot be exercised in the offline pass.
**Source:** 36-01-SUMMARY.md, 36-02-SUMMARY.md

### Enable GATE-02 by deleting orphaned Code Scanning configs, NOT by any `ci.yml` change

The gate was made to pass by deleting 4 orphaned `angular-typechecker`-category analyses from `main` via the Code Scanning API (spike 012); the existing multi-run + default merge-ref SARIF upload was left untouched.

**Rationale:** single-run-vs-multi-run, head-ref-vs-merge-ref upload, and a supposed "GitHub roadmap limitation" were all disproven red herrings. The gate compares `(analysis_key, category, environment)` tuples; an orphaned config on `main` (from the Phase-34 category rename to `angular-typecheck`) could never be reproduced -> permanent "configuration not found". Delete-orphans is the documented community fix.
**Source:** 36-UAT.md (test 2 evidence), 36-VERIFICATION.md, HANDOFF.json

### `fallow` and `angular-typechecker-red-proof` kept OFF the required ruleset tool list

The live ruleset requires only `angular-typechecker` + CodeQL. fallow findings already gate via the `ci` `fallow` job, and the deliberate red-proof tool must never be a required (it reports intended errors).

**Rationale:** avoid a second findings gate and avoid a self-inflicted permanent block from the intentional-red proof tool; both are documented decisions, not gaps. (The AGENTS.md runbook still names fallow because the runbook was written before the orphaned-config root cause was found -- reconciled in the follow-up runbook update.)
**Source:** 36-UAT.md (test 2 evidence), HANDOFF.json

---

## Lessons

### "Configuration not found" is TRANSIENT for a live config but PERMANENT for an orphaned one

A required Code Scanning tool whose analysis is missing blocks the merge. If the tool's config is live, the block clears as soon as CI uploads an analysis. If the config is ORPHANED (left behind by a category/analysis-key rename), no future upload can ever match it, so the block is permanent until the orphaned analyses are deleted via the API.

**Context:** this single distinction was the crux of GATE-02. Many probe PRs failed with the same "1 configuration not found" message and were misread as "the gate is unviable" before the orphan was identified.
**Source:** 36-VERIFICATION.md, HANDOFF.json

### The merge gate matches `(analysis_key, category, environment)` tuples, not tool name alone

GitHub's "Require code scanning results" evaluates required tools by their analysis tuple. A category rename silently creates a new tuple and orphans the old one; both then appear as "configured" tools the gate expects.

**Context:** the Phase-34 rename from category `angular-typechecker` to `angular-typecheck` is exactly what spawned the orphan. Renaming a Code Scanning category is not free -- it forks the gate's expected-tool set.
**Source:** 36-VERIFICATION.md, HANDOFF.json

### Prove a red Code Scanning check is non-blocking before assuming it is

The `angular-typechecker` Code Scanning result check was assumed non-required (the ruleset then listed only CodeQL), but the base-branch policy still hard-blocked the milestone PR merge on the deliberate proof-fixture red alerts. GitHub groups alerts by tool (`driver.name`), NOT by category, so a distinct `category` was insufficient -- the fix was a separate `driver.name` for the proof SARIF.

**Context:** proven empirically (`gh pr merge` -> "the base branch policy prohibits the merge"). Treat any red Code Scanning check as merge-blocking until proven otherwise.
**Source:** .continue-here.md (phase 36), HANDOFF.json

### Credit a CI run only after confirming its `headSha`

A green run (29881837667) was on the PRE-change head where `code-scanning` was not yet a `ci` member, so it did not evidence GATE-01. The actual proof was run 29898624245 on head `3e4fc6f`.

**Context:** always match a run's `headSha` to the commit under evaluation before crediting its verdict as evidence for a requirement.
**Source:** 36-UAT.md (test 1 evidence)

### `nx test` (Vitest/esbuild) does not type-check specs

The 36-01 spec changes were type-checked with an explicit `tsc --noEmit -p tsconfig.spec.json` because `nx test` transpiles without type-checking; a spec type error would pass the test run but fail a standalone `tsc`.

**Context:** confirmed as a standing gate gap in prior phases; the phase ran the explicit spec typecheck to close it.
**Source:** 36-01-SUMMARY.md

---

## Patterns

### List-item-anchored `ci.needs[]` membership drift guard

Assert membership with `/^\s*code-scanning,\s*$/m` (line-anchored), NOT `\bcode-scanning\b` -- because `code-scanning` is a substring of `code-scanning-proof`, a word-boundary match would false-pass. Reuses the private `extractJobLines` slicer (no new export, no dependency).

**When to use:** any drift guard locking a YAML list membership where one item name is a prefix of another.
**Source:** 36-01-SUMMARY.md

### Pure-`if:`-gated fail-loud assertion step

Gate a workflow assertion on a GitHub Actions expression (event + fork + step-output) with a STATIC `echo/exit 1` body -- nothing interpolated into the shell. Turns a silent empty artifact into a red job while preserving the no-command-injection invariant verbatim.

**When to use:** whenever a "produced nothing" state must fail loud without introducing shell interpolation of untrusted step outputs / PR metadata.
**Source:** 36-01-SUMMARY.md

### Normalized-whitespace docs tripwire, one `*-docs.spec.ts` per README claim family

Read the raw README with `node:fs`, assert the exact heading on the raw string and the claim tokens on a `replace(/\s+/g, ' ')` normalized string. No markdown parser, no new dependency. Each tripwire owns only its own claim (storybook / angular-cli / standalone-cli / machine-readable / code-scanning), no cross-duplication.

**When to use:** locking a shipped-README prose claim against silent gutting, without coupling to markdown structure.
**Source:** 36-02-SUMMARY.md

### Governance runbook extends existing doc sections rather than inventing a surface

The GATE-02 ruleset runbook was inserted between the existing "Lockout recovery" and "Parallel execution" sections of AGENTS.md, documentation-only (no ruleset-mutating `gh api`), and routed through the phase code_review_gate per the AGENTS.md self-governance rule instead of adding a separate tripwire (YAGNI).

**When to use:** adding a human-run operational runbook to a governance doc that already has adjacent recovery/protection sections.
**Source:** 36-02-SUMMARY.md

---

## Surprises

### The blocker was an orphaned config, not the runbook mechanics

The phase shipped an elaborate human-run ruleset runbook (Evaluate-first, probe two PR kinds, flip to Active), but the real obstacle to a passing gate was a single orphaned Code Scanning config on `main`. Deleting 4 orphaned analyses made the gate pass with the EXISTING CI setup and no `ci.yml` change.

**Impact:** the resolution required zero workflow code change; the fix was operational (API cleanup), and the initial (wrong) conclusion that "the gate is unviable" cost many probe PRs before the root cause surfaced.
**Source:** 36-VERIFICATION.md, HANDOFF.json

### Three plausible causes were all red herrings

Single-run SARIF, head-ref-vs-merge-ref upload, and a "GitHub roadmap #847 limitation" each looked like the cause and were each disproven. An experimental single-run change to `main` (41ac49a) was made and then reverted (44e4306) once single-run turned out moot.

**Impact:** reinforced that the "configuration not found" message is generic -- it names the symptom (a required tool has no matching analysis) and says nothing about the cause, so it invited several wrong hypotheses.
**Source:** HANDOFF.json, 36-VERIFICATION.md

### A same-milestone rename shifted the proof job id during the phase

A quick task renamed the proof job `code-scanning-proof` -> `code-scanning-red-proof` while the phase was open; both Code Scanning jobs remained required `ci` members and the drift guard was updated to lock the new id, so GATE-01's contract still held.

**Impact:** a non-regression, but it means the VERIFICATION evidence references a job id that differs from the plan/summary text -- worth noting for anyone auditing the wiring against the older SUMMARY.
**Source:** 36-VERIFICATION.md
