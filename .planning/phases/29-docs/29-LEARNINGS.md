---
phase: 29
phase_name: "Docs"
project: "angular-typechecker"
generated: "2026-07-17"
counts:
  decisions: 4
  lessons: 3
  patterns: 3
  surprises: 2
missing_artifacts:
  - "UAT.md"
---

# Phase 29 Learnings: Docs

## Decisions

### Mirror HELP_TEXT via the exported `parseCliArgs(['--help'])`, not the private constant
The README `## Standalone CLI` flag reference documents all 7 flags with descriptions
copied verbatim from the CLI's `HELP_TEXT`; the doc-tripwire drift-locks them by asserting
each flag token appears in BOTH the README and the LIVE output of the exported
`parseCliArgs(['--help'])` (`HELP_TEXT` itself is module-private and not exported).

**Rationale:** One source of truth prevents the README and `--help` from silently
diverging; reading the live help output (rather than a hardcoded copy) makes the lock
non-tautological — a flag rename/drop in either surface fails the spec.
**Source:** 29-01-PLAN.md, 29-CONTEXT.md (D-06)

### Place `## Standalone CLI` between `## Angular CLI` and `## Storybook`
The new section sits in adapter order (Nx executor -> Angular CLI builder -> standalone
CLI), with a matching `[Standalone CLI](#standalone-cli)` ToC anchor.

**Rationale:** The CLI is framed as "a third thin adapter over the same core," so grouping
it beside the other two adapters mirrors the mental model; docs ordering is trivially
reversible so this was a low-risk auto-lock.
**Source:** 29-CONTEXT.md (D-01/D-02)

### One plan / three tasks, tripwire ordered LAST (content-first, then lock)
The planner produced a single plan (README, CHANGELOG, spec) rather than the 2-plan split
the VALIDATION sketch suggested, with the doc-tripwire as Task 3.

**Rationale:** Single concern, ~3 files, and the tripwire asserts BOTH the README and the
CHANGELOG so it must land after their content regardless — no parallelism to gain. A
single-plan wave also skips git-worktree isolation per AGENTS.md, running on the main
checkout with real `node_modules`.
**Source:** 29-01-SUMMARY.md, planner return

### CHANGELOG `## 0.2.2` written now, undated; release cut is a separate flow
The curated end-user-language `## 0.2.2` entry (no internal ids/scopes) is authored in this
phase but left undated; the version bump/tag/publish stays in the human-gated Release-PR
flow.

**Rationale:** AGENTS.md separates writing the changelog from cutting the release; the date
is stamped at the cut. Matches the undated `## 0.2.1` precedent.
**Source:** 29-CONTEXT.md (D-09), 29-01-SUMMARY.md, AGENTS.md

---

## Lessons

### A newly shipped feature can leave contradictory prose in unrelated doc sections
Documenting the standalone CLI required narrowing a stale `## Limitations` line that had
called "a standalone CLI" a non-goal in v0.x — that claim became false once Phases 25-28
shipped the CLI.

**Context:** When documenting a new capability, sweep the whole document for now-false
claims elsewhere, not just the section being added. The executor caught this as a Rule-1
bug deviation and narrowed the line to the still-true non-goals (JSON/SARIF reporters).
**Source:** 29-01-SUMMARY.md (Deviation)

### "Mirror the source of truth verbatim" propagates the source's own inaccuracies
Code review (WR-01) found the `--fail-fast` description the README copied from `HELP_TEXT`
("Report only the first failing file") does not match `format-report.ts` (which truncates
at the first error, inclusive) — and the README's older Executor-options section phrases
the same flag differently ("first error").

**Context:** A drift-lock guarantees consistency-WITH-`HELP_TEXT`, not correctness-vs-runtime
behavior. Faithfully executing a "mirror verbatim" decision (D-06) can carry a pre-existing
inaccuracy into the new docs and surface a latent internal inconsistency. The correct fix
touches `HELP_TEXT` + both README spots together (out of DOC-01 scope; a follow-up).
**Source:** 29-REVIEW.md

### A post-execution auditor agent can die mid-task and write nothing
The gsd-verifier was terminated by an org spend limit partway through and produced no
VERIFICATION.md; the artifact had to be confirmed absent and the agent re-spawned after the
limit reset before the phase could be marked complete.

**Context:** Never trust an auditor's implied completion — check the artifact exists on disk
before proceeding, and re-spawn rather than self-certifying the verdict inline.
**Source:** 29-VERIFICATION.md (present only after re-spawn)

---

## Patterns

### Doc-tripwire: whitespace-normalized fs read + supply-chain guard + live drift-lock
A pure `readFileSync` of `../README.md` (and, new here, `../../../CHANGELOG.md`),
`.replace(/\s+/g, ' ')`-normalized, asserting headings against raw text and prose against
the normalized string; plus a `not.toContain('npx atc')` negative guard and a token-set
drift-lock against a live exported accessor.

**When to use:** To lock documentation to a code source of truth so it cannot silently
drift, and to enforce a load-bearing negative claim (a supply-chain warning) in CI. Runs in
the fast `nx test` loop with no compiler load, so it gates docs-only PRs cheaply.
**Source:** 29-01-SUMMARY.md, 29-VALIDATION.md (modeled on `src/angular-cli-docs.spec.ts`)

### Enforce a supply-chain "never say X" rule as a negative test assertion
The hazard "a reader runs `npx atc` and fetches the unrelated `atc@0.0.6`" is mitigated by
phrasing the docs so the literal `npx atc` never appears, and locking that with
`not.toContain('npx atc')` over the whole README (and CHANGELOG).

**When to use:** When a doc must avoid a specific dangerous string (typosquat, deprecated
command, secret shape), assert its ABSENCE in a tripwire rather than relying on review.
**Source:** 29-SECURITY.md (T-29-01), 29-01-SUMMARY.md

### Public-changelog hygiene as a regex leak-check
The `## 0.2.2` CHANGELOG slice is asserted leak-free with `not.toMatch(/DOC-01|CLI-0\d|.../)`
so an internal plan-id/scope cannot reach the public changelog or GitHub Release notes.

**When to use:** Any repo whose changelog feeds public release notes and whose internal
workflow uses plan-id scopes — turn the changelog-hygiene rule into an automated gate.
**Source:** 29-SECURITY.md (T-29-02), 29-VALIDATION.md

---

## Surprises

### A docs phase surfaced a latent inaccuracy in already-shipped code
WR-01's root cause is in `HELP_TEXT` (shipped Phase 26), yet it only became visible when
Phase 29 documented that surface and a deep review cross-checked the description against
`format-report.ts`.

**Impact:** Recorded as a non-blocking follow-up (correct-by-contract under D-06), not a
phase-goal gap — but it shows a docs phase doubles as a correctness audit of the code it
documents.
**Source:** 29-REVIEW.md, 29-VERIFICATION.md

### The decision-coverage gate reads only `must_haves`/`truths`, not body prose
The blocking plan-phase gate (13a) reported 0/10 decisions covered even though every
`D-NN` id was cited throughout the plan body; it passed 10/10 only after a single `truths`
citation line enumerating D-01..D-10 was added.

**Impact:** The fix is a one-line `truths` addition (not a re-plan); worth knowing the gate
token-matches `D-NN` exclusively inside `must_haves`/`truths`.
**Source:** 29-01-PLAN.md (`must_haves.truths`)
