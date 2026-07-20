---
phase: 30
phase_name: "Reporter seam + JSON reporter + --format threading + observability"
project: "angular-typechecker"
generated: "2026-07-18"
counts:
  decisions: 6
  lessons: 5
  patterns: 5
  surprises: 4
missing_artifacts:
  - "30-UAT.md"
---

# Phase 30 Learnings: Reporter seam + JSON reporter + --format threading + observability

## Decisions

### Widen `renderReport` with an OPTIONAL `format` (default `'human'`), not a required param
Added `format?: 'human'|'json'|'sarif'` (default `human`) to `RenderOptions` and widened the result param from `Pick<CoreResult,'diagnostics'>` to full `CoreResult`, moving `loadCompilerCli()` into the human branch so machine paths never load the ESM compiler-cli.

**Rationale:** optional-with-default keeps every existing adapter call site compiling unchanged until the adapter threads a real value (Wave 3), and makes `--format`-omitted output byte-identical to v0.2.2 — the additive-only 0.x charter. Verified: `main.ts`/`executor.ts` called `renderReport` without `format`.
**Source:** 30-02-PLAN.md, 30-02-SUMMARY.md, 30-RESEARCH.md (Open Question 1, RESOLVED)

### One shared "diagnostic -> normalized record" projection (`core/diagnostic-record.ts`)
Both the JSON reporter (Phase 30) and the future SARIF reporter (Phase 31) consume ONE projection: off-by-one `positionsOf`, `codeStringOf` (`TS####`/`NG8xxx`/`ATC9000x` via the shipped `ngCodeOf`, carrying both `code` string + raw `rawCode`), category severity, and `relativizePath`.

**Rationale:** JSON and SARIF cannot drift on positions/codes/paths if they derive from the same function (D-13).
**Source:** 30-02-SUMMARY.md, 30-CONTEXT.md (D-13)

### The reporter delegates the verdict to `evaluateResult`, never re-derives it
`formatJsonReport`'s `summary.outcome`/`success` comes from `evaluateResult`, not from counting diagnostics.

**Rationale:** the cardinal anti-false-pass — a coverage-incomplete run has `errorCount===0` but `success===false`; a reporter that re-derives from counts would silently flip a fail to a pass. `evaluateResult`/`toExitCode` stay the sole verdict owners; `evaluate-result.ts` is byte-unchanged (D-07 / FMT-02).
**Source:** 30-02-SUMMARY.md, 30-VERIFICATION.md, 30-SECURITY.md (T-30-06)

### JSON via `JSON.stringify` only; messages via `ts.flattenDiagnosticMessageText`
Zero new dependency for JSON; messages are built from `ts.flattenDiagnosticMessageText`, never the colorizing `formatReport`/`formatDiagnostics`.

**Rationale:** `JSON.stringify` correctly escapes control chars; sourcing messages from the non-colorizing API makes an ANSI byte structurally impossible in the payload (D-06 / FMT-03).
**Source:** 30-02-SUMMARY.md, 30-SECURITY.md (T-30-03)

### `totalFilesCount` counts AUTHORED non-declaration source files, excluding `.ngtypecheck.ts` TCB shims
Captured on the direct path (live `Program`) and the walk path (name-deduped `Set` via `finalizeUnion`), with `!isDeclarationFile && !endsWith('.ngtypecheck.ts')`. Optional; `evaluateResult` never reads it.

**Rationale:** OBS-01's intent is the MEANINGFUL "files checked" number; Angular-generated TCB shims are compiler-internal, not authored source, and inflate/version-drift the count (the WR-01 code-review fix; the initial 30-01 filter counted the shims).
**Source:** 30-01-SUMMARY.md, 30-REVIEW.md (WR-01), 30-VALIDATION.md

### The Nx executor gates `emitAdvisoryNotices` on `format === 'human'`
Only the human path emits the advisory notices through the `@nx/devkit` logger; machine formats skip them (the data is already in the JSON `summary`).

**Rationale:** the CR-01 blocker fix — `@nx/devkit`'s `logger.info` writes to STDOUT, so an unconditional advisory emit corrupted `--format json` on the executor/builder. Gating on human preserves byte-identical v0.2.2 human output while guaranteeing stdout purity for machine formats. The CLI path was already safe (BufferingLogger -> stderr) and was left unchanged.
**Source:** 30-REVIEW.md (CR-01), executor.ts, 30-SECURITY.md (T-30-07)

---

## Lessons

### Mock-based unit tests hid an adapter-specific stdout-contamination bug; only an independent review of the real dependency caught it
The verifier passed 8/8 must-haves, but the executor's `--format json` path emitted advisory text to stdout (via `@nx/devkit` `logger.info` -> `console.info` -> stdout) before the JSON payload, producing invalid JSON. The unit tests mocked the logger, so they never exercised the real stream routing. The independent code-reviewer found it by reading `node_modules/nx/.../logger.js`.

**Context:** for a machine-output feature, at least one test per adapter must assert stdout PURITY against the REAL logger/stream, not a mock. Independent code-review that reads the actual dependency behavior is not redundant with goal-verification.
**Source:** 30-REVIEW.md (CR-01), 30-VERIFICATION.md

### `nx typecheck` is the authoritative type gate; the IDE/LSP diagnostics feed lagged every wave
On all four edit rounds (3 waves + the fix pass), the LSP `new-diagnostics` feed reported structural TS errors (missing type members, arg-count, module-not-found) that were stale mid-edit snapshots; `nx typecheck` (tsc over spec+drift+tools) was green each time.

**Context:** never treat the LSP feed as a regression, especially in the same turn a file was edited; run `tsc`/`nx typecheck` to settle it. (This repo already documents `nx test` does not type-check specs — `nx typecheck` is the separate, load-bearing gate.)
**Source:** orchestration observation across 30-01/02/03 + the code-fix pass; 30-VERIFICATION.md, 30-VALIDATION.md

### The GSD milestone slug/branch derives from the ROADMAP `## Phase Details (...)` heading, not STATE.md frontmatter
A malformed heading `## Phase Details (v0.2.3 -- current milestone)` made GSD compute `milestone_slug: current-milestone` and a `gsd/v0.2.3-current-milestone` branch that regenerated after every milestone-branch operation. Fixing STATE.md `milestone_name` did NOT change it; fixing the ROADMAP heading to the real name did.

**Context:** when a GSD milestone name/slug is wrong, fix the ROADMAP `## Phase Details (<version> -- <name>)` heading (the parse source), not just STATE.md.
**Source:** orchestration (init.execute-phase milestone fields); commit 9e06761

### A GSD `state.*` helper repeatedly corrupted STATE.md `milestone_name` and mis-read the phase number as a plan index
`state.begin-phase`/`advance-plan` re-mangled `milestone_name` to `-- ... )` and (advance-plan) treated phase `30` as a plan index, declaring "last_plan" and zeroing progress. Executors had to `git checkout -- .planning/STATE.md` and hand-correct it.

**Context:** prefer `roadmap.update-plan-progress` for tracking; treat `state advance-plan` output as suspect on this OpenGSD version and re-verify STATE.md frontmatter after any state write.
**Source:** 30-01-SUMMARY.md, 30-02-SUMMARY.md notes-to-orchestrator

### An asserted behavior in `must_haves` is not proven unless the test actually exercises that path
30-01's original walk-path dedupe proof used `totalFilesCount >= rootNamesCount`, which passes whether or not dedupe works, and could run against a direct-path leaf fixture. The plan-checker flagged it (W3); the fix pinned a genuine solution-tsconfig fixture (`solution-style-overlap`) with an EXACT deduped literal.

**Context:** dedupe/uniqueness truths need an exact-count assertion on a fixture that genuinely drives the deduping path, not a `>=` inequality.
**Source:** 30-REVIEW-adjacent (plan-checker W3), 30-01-PLAN.md, total-files-count.integration.spec.ts

---

## Patterns

### Shared normalized-record projection to prevent multi-reporter drift
When two output formats (JSON now, SARIF next) render the same underlying data, extract ONE pure `(diagnostic) -> record` projection both consume.

**When to use:** any time N reporters must agree on positions/codes/paths.
**Source:** 30-02-SUMMARY.md (diagnostic-record.ts)

### Optional-with-default seam widening for additive-only threading
Add a new option as optional with the legacy value as default (`format?` default `'human'`), so downstream call sites compile unchanged and behavior is byte-identical until each is threaded.

**When to use:** widening a shared seam under an additive-only (0.x / no-breaking-change) charter.
**Source:** 30-02-PLAN.md, 30-VERIFICATION.md

### Sequential single-plan-per-wave on the main checkout for a dependent chain
For a strictly dependent chain (30-01 -> 30-02 -> 30-03), run each wave's single executor sequentially on the main working tree (no worktree): each executor sees the prior wave's commits AND has the real `node_modules` needed to run `nx test/typecheck`.

**When to use:** dependent waves with one plan each, or any wave with no parallelism to gain (worktrees would start without `node_modules` and couldn't self-verify).
**Source:** orchestration; AGENTS.md worktree rules

### Adapter-boundary stdout-purity test against the real logger
For each adapter that can emit a machine payload, add a test that drives an advisory-producing result through the REAL adapter and asserts stdout is exactly one parseable payload (no notice text), catching stream-routing bugs a mocked logger hides.

**When to use:** any machine-readable output feature spanning adapters with different logger/stream wiring.
**Source:** 30-REVIEW.md (CR-01 fix), executor.spec.ts

### Independent-gate layering caught what goal-verification alone missed
verify (goal) -> code-review (independent bug hunt on the real diff/deps) -> secure (threat mitigations) -> validate (Nyquist coverage) each found or confirmed something the others did not — code-review found CR-01 that verify passed over.

**When to use:** correctness-critical deliverables; do not collapse the independent review into the goal verifier.
**Source:** 30-VERIFICATION.md, 30-REVIEW.md, 30-SECURITY.md, 30-VALIDATION.md

---

## Surprises

### The IDE/LSP diagnostics feed was stale on every single edit round (4/4)
Every wave and the fix pass produced a `new-diagnostics` burst of structural TS errors that `nx typecheck` immediately contradicted.

**Impact:** none to the code (all green), but it repeatedly demanded an authoritative compiler run to disprove; reinforced treating the LSP feed as non-authoritative.
**Source:** orchestration across 30-01/02/03 + fix pass

### A clean 8/8 goal-verification still shipped a stdout-corruption blocker
The phase-goal verifier confirmed all must_haves, yet the executor `--format json` path emitted invalid JSON whenever a node_modules diagnostic was suppressed.

**Impact:** would have defeated `--format json` on the primary (Nx executor) adapter for any real project with third-party suppressions; caught + fixed pre-completion by the independent code-review gate (CR-01).
**Source:** 30-REVIEW.md, 30-SECURITY.md (T-30-07)

### `totalFilesCount` silently counted Angular TCB shims
The `!isDeclarationFile` filter (chosen for parity with diagnostic gathering) also admits generated `.ngtypecheck.ts` shims, so the shipped "files checked" metric was ~authored files + component count.

**Impact:** an inflated, version-drifting observability number for agents; fixed to authored-only (WR-01), the dedupe fixture literal moved `2 -> 1`.
**Source:** 30-01-SUMMARY.md, 30-REVIEW.md (WR-01)

### The GSD state helper mis-fired on a two-digit phase number
`state advance-plan` read phase `30` as a plan index and declared "last_plan", zeroing progress and mangling `milestone_name`.

**Impact:** executors had to discard the bad STATE.md write and hand-correct frontmatter each wave; tracking was done via `roadmap.update-plan-progress` instead.
**Source:** 30-02-SUMMARY.md notes-to-orchestrator
