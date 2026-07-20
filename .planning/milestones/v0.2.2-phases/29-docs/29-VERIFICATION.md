---
phase: 29-docs
verified: 2026-07-17T02:20:00Z
status: passed
score: 7/7 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: null
gaps: []
---

# Phase 29: Docs Verification Report

**Phase Goal:** The README documents the standalone CLI -- installation, the flag set, and the `0`/`1`/`2` exit-code contract -- steering users to `npx angular-typechecker` (never `npx atc`, which would fetch the unrelated `atc@0.0.6`), with a curated end-user-language CHANGELOG entry.
**Verified:** 2026-07-17T02:20:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | README has a `## Standalone CLI` section with install steps, the full flag set, and the exit-code contract table (ROADMAP SC1) | VERIFIED | `README.md:474` heading, placed after `## Angular CLI` (ends ~473) and before `## Storybook` (`:577`). `### Install and run` (`:483-515`), `### Options` 7-flag table (`:517-537`), `### Exit codes` 3-row `0`/`1`/`2` table (`:539-557`). ToC anchor `[Standalone CLI](#standalone-cli)` at `:42`, between Angular CLI (`:41`) and Storybook (`:43`). |
| 2 | Reader steered to `npx angular-typechecker`; NEVER told `npx atc`; `atc` only as post-install PATH alias with `atc@0.0.6` warning (ROADMAP SC2) | VERIFIED | Section leads with `npx angular-typechecker -c <tsconfig>` (`:487`). `atc` documented only as PATH shorthand (`:503-509`) with explicit `atc@0.0.6` supply-chain warning (`:511-515`). `git grep -c -F "npx atc"` over README + CHANGELOG = ZERO matches. `atc@0.0.6` present in README `:513` and CHANGELOG `:35`. |
| 3 | Documented flag set matches the CLI's actual `--help` output (drift-locked) | VERIFIED | README table (`:524-530`) mirrors HELP_TEXT (`parse-args.ts:70-79`) verbatim across all 7 flags. `standalone-cli-docs.spec.ts:66-71` iterates all 7 FLAG_TOKENS asserting each in BOTH normalized README AND live `parseCliArgs(['--help'])` text -- 8 tests green under `nx test`. |
| 4 | Exit-code table states `0` clean / `1` verdict-fail / `2` infrastructure-or-usage without contradicting `## Exit codes` | VERIFIED | Table `README.md:547-551` with the three literal codes + meanings. Prose (`:553-557`) reconciles: "same pass/fail verdict the [Exit codes](#exit-codes) section describes ... with the non-zero case split into `1` and `2`", and frames the CLI as the first adapter owning literal `2` (`:541-545`). Code review (29-REVIEW.md) cross-traced the table against `main.ts` and confirmed factual correctness. |
| 5 | Repo-root CHANGELOG carries a `## 0.2.2` entry in end-user language, no internal ids/scopes (ROADMAP SC3) | VERIFIED | `CHANGELOG.md:5-40`: `## 0.2.2` above `## 0.2.1`, undated, bold lead + `### Features` / `### Notes` / `### Compatibility`. Compatibility line (`:39-40`) matches 0.2.1 verbatim + "No new runtime dependency." Tripwire regex `not.toMatch(/DOC-01|CLI-0\d|SC#|\bphase\b/i)` over the 0.2.2 slice passes. No `Phase 29`, plan-id, or board jargon in the entry. |
| 6 | The doc-tripwire spec is green under `nx test angular-typechecker` | VERIFIED | `src/standalone-cli-docs.spec.ts` exists (8 tests), imports `parseCliArgs` from `./cli/parse-args`, reads `../README.md` + `../../../CHANGELOG.md`. Ran `nx test angular-typechecker`: 44 files / 447 tests passed, tripwire included. |
| 7 | Locked CONTEXT.md decisions D-01..D-10 honored | VERIFIED | D-01/D-02 placement + ToC (`:42`, `:474`); D-03 canonical npx-first (`:487`); D-04 npm/pnpm install forms + atc PATH alias (`:494-509`); D-05 never `npx atc` + `atc@0.0.6` (`:511-515`); D-06 7-flag HELP_TEXT mirror (`:524-530`); D-07 own `0`/`1`/`2` table (`:547-551`); D-08 reconciled with `## Exit codes` (`:553-557`); D-09/D-10 curated undated additive `## 0.2.2` (`CHANGELOG.md:5-40`). All ten mapped to concrete lines. |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `packages/angular-typechecker/README.md` | `## Standalone CLI` section + `[Standalone CLI](#standalone-cli)` ToC anchor | VERIFIED | Section `:474-575`; ToC anchor `:42`. Also removed the now-stale "standalone CLI is a non-goal" Limitations line (`:690` narrowed to JSON/SARIF only) -- an in-scope coherence fix. |
| `CHANGELOG.md` | Curated public `## 0.2.2` entry | VERIFIED | `:5-40`, above `## 0.2.1`, hygienic + undated. |
| `packages/angular-typechecker/src/standalone-cli-docs.spec.ts` | Doc-drift tripwire (README + CHANGELOG hygiene + HELP_TEXT drift-lock) | VERIFIED | 99 lines, 8 tests, green. Commit `dc5f192`. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `README.md` | `src/cli/parse-args.ts` | `parseCliArgs(['--help'])` flag tokens drift-locked against README prose | WIRED | Spec `:66-71` asserts each of 7 tokens in both README and live help text; `helpText` derives from a real `parseCliArgs(['--help'])` call (collapses to `''` and fails all assertions if the seam regresses -- not tautological, confirmed by 29-REVIEW.md). |
| `standalone-cli-docs.spec.ts` | `README.md` | `readFileSync(join(here,'../README.md'))` | WIRED | `:29`; from `src/`, `../README.md` resolves to the package README. |
| `standalone-cli-docs.spec.ts` | `CHANGELOG.md` | `readFileSync(join(here,'../../../CHANGELOG.md'))` | WIRED | `:83`; `src` -> pkg root -> packages -> repo root resolves to repo-root CHANGELOG. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full test suite (incl. tripwire) | `nx test angular-typechecker` | 44 files / 447 tests passed; `standalone-cli-docs.spec.ts` 8/8 | PASS |
| Format gate | `nx format:check` | exit 0 (clean) | PASS |
| Type-check gate (distinct from `nx test`; esbuild does not type-check specs) | `nx typecheck angular-typechecker` | spec + drift + tools tsc all pass | PASS |
| Lint gate (maxWarnings:0) | `nx lint angular-typechecker` | All files pass linting | PASS |
| Supply-chain guard | `git grep -c -F "npx atc"` over README + CHANGELOG | ZERO matches | PASS |
| `atc@0.0.6` warning present | `git grep -F "atc@0.0.6"` | README `:513`, CHANGELOG `:35` | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| DOC-01 | 29-01-PLAN.md | README `## Standalone CLI` section (install + flag set + `0`/`1`/`2` table); canonical `npx angular-typechecker`, never `npx atc` (`atc@0.0.6` hazard); `atc` only a PATH shorthand; curated public CHANGELOG in end-user language, no internal ids | SATISFIED | Truths 1-7 above. DOC-01 is the only ID mapped to Phase 29 (REQUIREMENTS.md:52, :108); no orphaned requirements. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (none) | -- | No TBD/FIXME/XXX debt markers in any phase-modified file | ℹ️ Info | Clean. |
| `README.md` | 526 (+189) | `--fail-fast` description ("Report only the first failing file.") mirrors HELP_TEXT verbatim but is subtly inaccurate vs `format-report.ts:69-77` (truncates at first Error-category diagnostic, not file-scoped); executor table `:189` phrases it differently | ℹ️ Info (noted follow-up, NOT a goal gap) | 29-REVIEW.md WR-01. Root cause is `HELP_TEXT` in `parse-args.ts` (shipped Phase 26, outside DOC-01's changed-file set). D-06 mandated mirroring HELP_TEXT verbatim, so the README is correct-by-contract; fixing it means editing HELP_TEXT + README together in a future change. |
| `standalone-cli-docs.spec.ts` | 38-46 | Drift-lock does not catch an *added* flag (hardcoded FLAG_TOKENS) -- catches removals/renames only | ℹ️ Info | 29-REVIEW.md IN-01. The tripwire still enforces the 7 shipped flags stay in both README and `--help`; goal satisfied. Optional hardening. |
| `standalone-cli-docs.spec.ts` | 96 | Hygiene regex `\bphase\b` is broad -- could false-positive on legitimate future "phase" prose | ℹ️ Info | 29-REVIEW.md IN-02. Current 0.2.2 entry is clean; passes today. Optional tightening. |

### Human Verification Required

None. This is a documentation phase whose every load-bearing claim (section presence, ToC anchor, 7-flag drift-lock, `0`/`1`/`2` triad, supply-chain `npx atc` guard, `atc@0.0.6` warning, CHANGELOG hygiene) is policed by the automated `standalone-cli-docs.spec.ts` tripwire and confirmed by the four green gates. The duplicate `#exit-codes` anchor from the `### Exit codes` subsection is harmless-by-design: every existing `[Exit codes](#exit-codes)` cross-link (ToC `:37`, in-section `:553`) resolves to the top-level `## Exit codes` (`:263`), and nothing links to the auto-suffixed subsection anchor.

### Gaps Summary

No gaps. All three ROADMAP success criteria and all seven PLAN truths are observably satisfied in the actual files. DOC-01 is closed. The full gate battery (`nx test` 447/447, `nx format:check`, `nx lint`, `nx typecheck`) is green, and the supply-chain guard (`npx atc` absent, `atc@0.0.6` named) holds in both docs. The one code-review warning (WR-01, `--fail-fast` wording) and two info notes are pre-existing / out-of-DOC-01-scope follow-ups, correctly deferred: WR-01's root cause is Phase 26's HELP_TEXT and the docs are correct-by-contract under decision D-06. The `## 0.2.2` entry is written but undated -- the version bump/tag/publish is the separate human-gated Release-PR flow (AGENTS.md), which is out of this phase's scope by design.

---

_Verified: 2026-07-17T02:20:00Z_
_Verifier: Claude (gsd-verifier)_
